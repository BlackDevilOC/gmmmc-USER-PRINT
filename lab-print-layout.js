/**
 * Lab report A4 pagination + print styles (shared with main LabFlow app).
 */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MM_TO_PX = 96 / 25.4;

function resolvePageSizeRule(settings) {
    const raw = String(settings?.page_size || 'A4').trim().toUpperCase();
    if (raw === 'A4') return 'A4 portrait';
    if (raw === 'LETTER') return 'letter portrait';
    return `${A4_WIDTH_MM}mm ${A4_HEIGHT_MM}mm`;
}

function mmToPx(mm) {
    return mm * MM_TO_PX;
}

function getFooterHeightPx(s) {
    if (s?.footer_height != null && s.footer_height > 0) {
        return Number(s.footer_height);
    }
    const marginTop = s?.footer_margin_top ?? 40;
    const paddingTop = s?.footer_padding_top ?? 20;
    const fontSize = s?.footer_font_size ?? 20;
    const lineHeight = 1.35;
    let lines = 2;
    if (s?.display_pathologist_signature) lines += 1;
    if (s?.display_verified_by) lines += 1;
    const borderPx = 1;
    return marginTop + paddingTop + borderPx + Math.ceil(lines * fontSize * lineHeight) + 6;
}

function getPageLayout(settings) {
    const s = settings || {};
    const marginTopMm = s.page_top_margin ?? 25;
    const marginBottomMm = s.page_bottom_margin ?? 25;
    const headerPx = s.header_height ?? 140;
    const footerPx = getFooterHeightPx(s);
    const innerHeightPx = mmToPx(A4_HEIGHT_MM - marginTopMm - marginBottomMm);
    const bodyBudgetPx = Math.max(80, innerHeightPx - headerPx - footerPx);
    return {
        marginTopMm,
        marginRightMm: s.page_right_margin ?? 15,
        marginBottomMm,
        marginLeftMm: s.page_left_margin ?? 15,
        headerPx,
        footerPx,
        bodyBudgetPx
    };
}

function linePx(fontSize, lineHeight = 1.25) {
    return fontSize * lineHeight;
}

function estimateCategoryChromePx(s) {
    const catFont = s?.category_font_size ?? 18;
    const catPadTop = s?.category_padding_top ?? 10;
    const catPadBottom = s?.category_padding_bottom ?? 4;
    const catBorder = s?.category_border_width ?? 2;
    const headFont = s?.test_name_font_size ?? 14;
    const headPadV = s?.table_header_padding_vertical ?? 8;
    const titleBlock = catBorder + catPadTop + linePx(catFont, 1.2) + catPadBottom + 8;
    const theadBlock = headPadV * 2 + linePx(headFont, 1.2) + 2;
    return titleBlock + theadBlock;
}

function estimateTestTitleRowPx(s) {
    const font = s?.group_font_size ?? 15;
    const padTop = s?.group_padding_top ?? 8;
    const padBottom = s?.group_padding_bottom ?? 2;
    return padTop + linePx(font, 1.2) + padBottom;
}

function estimateParamRowPx(s) {
    const font = s?.result_font_size ?? 14;
    const padV = s?.table_cell_padding_vertical ?? 4;
    return padV * 2 + linePx(font, 1.25);
}

function estimateRemarksRowPx(s) {
    const font = Math.max(10, (s?.result_font_size ?? 14) - 2);
    return 6 + linePx(font, 1.35) + 4;
}

function estimateTestBlockPx(block, s) {
    let h = estimateTestTitleRowPx(s);
    h += (block.params?.length || 0) * estimateParamRowPx(s);
    if (block.remarks) h += estimateRemarksRowPx(s);
    return h;
}

function splitTestBlock(block, budgetPx, s) {
    const full = { ...block, continued: false };
    if (estimateTestBlockPx(full, s) <= budgetPx) {
        return [full];
    }

    const parts = [];
    let remaining = (block.params || []).slice();
    let partIndex = 0;

    if (!remaining.length && block.remarks) {
        return [{
            category: block.category,
            name: block.name,
            params: [],
            remarks: block.remarks,
            continued: false
        }];
    }

    while (remaining.length > 0) {
        partIndex += 1;
        const titlePx = estimateTestTitleRowPx(s);
        const remarksPx = block.remarks ? estimateRemarksRowPx(s) : 0;
        const chunk = [];
        let used = titlePx;

        while (remaining.length > 0) {
            const paramPx = estimateParamRowPx(s);
            const isLastParam = remaining.length === 1;
            const tailPx = isLastParam && block.remarks ? remarksPx : 0;

            if (chunk.length > 0 && used + paramPx + tailPx > budgetPx) break;
            if (chunk.length === 0 && used + paramPx + tailPx > budgetPx) {
                chunk.push(remaining.shift());
                used += paramPx;
                break;
            }

            chunk.push(remaining.shift());
            used += paramPx;
        }

        const isLast = remaining.length === 0;
        parts.push({
            category: block.category,
            name: block.name,
            params: chunk,
            remarks: isLast ? (block.remarks || '') : '',
            continued: partIndex > 1
        });
    }

    return parts.length ? parts : [full];
}

function paginateCategoryBlocks(blocks, settings) {
    const layout = getPageLayout(settings);
    const chromePx = estimateCategoryChromePx(settings);
    const pageContentBudget = () => layout.bodyBudgetPx - chromePx;

    const pages = [];
    let current = [];
    let usedPx = 0;

    const flush = () => {
        if (current.length) {
            pages.push(current.slice());
            current = [];
            usedPx = 0;
        }
    };

    const budgetRemaining = () => pageContentBudget() - usedPx;

    for (const block of blocks) {
        let blockPx = estimateTestBlockPx(block, settings);

        if (blockPx <= budgetRemaining()) {
            current.push({ ...block, continued: block.continued || false });
            usedPx += blockPx;
            continue;
        }

        if (current.length) {
            flush();
            blockPx = estimateTestBlockPx(block, settings);
        }

        if (blockPx <= pageContentBudget()) {
            current.push({ ...block, continued: block.continued || false });
            usedPx = blockPx;
            continue;
        }

        const parts = splitTestBlock(block, pageContentBudget(), settings);
        parts.forEach((part, idx) => {
            if (idx > 0) flush();
            const partPx = estimateTestBlockPx(part, settings);
            current.push(part);
            usedPx = partPx;
            if (idx < parts.length - 1) flush();
        });
    }

    flush();
    return pages;
}

function paginateByCategory(categories, settings) {
    const result = [];
    const catNames = Object.keys(categories).sort((a, b) => a.localeCompare(b));

    for (const cat of catNames) {
        const testMap = categories[cat];
        const blocks = Object.keys(testMap)
            .sort((a, b) => a.localeCompare(b))
            .map((name) => {
                const entry = testMap[name];
                const params = Array.isArray(entry) ? entry : (entry?.params || []);
                const remarks = Array.isArray(entry) ? '' : (entry?.remarks || '').trim();
                return { category: cat, name, params: params.slice(), remarks };
            });

        if (!blocks.length) continue;

        const catPages = paginateCategoryBlocks(blocks, settings);
        catPages.forEach((pageBlocks, idx) => {
            result.push({
                category: cat,
                blocks: pageBlocks,
                continued: idx > 0
            });
        });
    }

    return result;
}

function buildLabPrintStyles(s, extraCss = '') {
    const layout = getPageLayout(s);
    const pageSizeRule = resolvePageSizeRule(s);
    const top = layout.marginTopMm;
    const right = layout.marginRightMm;
    const bottom = layout.marginBottomMm;
    const left = layout.marginLeftMm;
    const cellV = s?.table_cell_padding_vertical ?? 4;
    const cellH = s?.table_cell_padding_horizontal ?? 12;
    const headV = s?.table_header_padding_vertical ?? 8;
    const groupTop = s?.group_padding_top ?? 8;

    return `
@page {
    size: ${pageSizeRule};
    margin: 0;
}
html {
    width: ${A4_WIDTH_MM}mm;
}
html, body {
    margin: 0; padding: 0; background: #fff;
    width: ${A4_WIDTH_MM}mm;
    color: ${s?.primary_color || '#111'};
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.lab-print-body { margin: 0; padding: 0; width: ${A4_WIDTH_MM}mm; }
.report-page {
    box-sizing: border-box;
    width: ${A4_WIDTH_MM}mm;
    height: ${A4_HEIGHT_MM}mm;
    min-height: ${A4_HEIGHT_MM}mm;
    max-height: ${A4_HEIGHT_MM}mm;
    padding: ${top}mm ${right}mm ${bottom}mm ${left}mm;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.report-page.last-page { page-break-after: auto; }
.page-header {
    flex: 0 0 ${layout.headerPx}px;
    height: ${layout.headerPx}px;
    min-height: ${layout.headerPx}px;
    max-height: ${layout.headerPx}px;
    overflow: hidden;
}
.page-body {
    flex: 1 1 auto;
    min-height: 0;
    max-height: ${layout.bodyBudgetPx}px;
    overflow: hidden;
}
.page-footer {
    flex: 0 0 ${layout.footerPx}px;
    height: ${layout.footerPx}px;
    min-height: ${layout.footerPx}px;
    max-height: ${layout.footerPx}px;
    overflow: hidden;
    margin-top: auto;
    border-top: 1px solid #000;
    padding-top: ${s?.footer_padding_top ?? 20}px;
    box-sizing: border-box;
}
.info-card {
    border: 1px solid #111;
    border-left: none; border-right: none;
    padding: ${s?.patient_info_padding_vertical ?? 8}px 0;
    margin-bottom: ${s?.patient_info_bottom_margin ?? 8}px;
    box-sizing: border-box;
}
.info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${s?.patient_info_row_gap ?? 6}px 24px;
    font-size: ${s?.patient_info_font_size ?? 14}px;
    line-height: 1.3;
}
.row {
    display: grid;
    grid-template-columns: ${s?.patient_info_label_width ?? 140}px 1fr;
    gap: 6px;
    align-items: baseline;
}
.label { font-weight: 700; font-size: ${s?.patient_info_label_font_size ?? 14}px; }
.value { font-weight: 600; }
.category {
    margin-top: 0;
    padding-top: ${s?.category_padding_top ?? 10}px;
    border-top: ${s?.category_border_width ?? 2}px solid #111;
}
.category-title {
    font-weight: 900;
    letter-spacing: .04em;
    text-transform: uppercase;
    font-size: ${s?.category_font_size ?? 18}px;
    margin: 0 0 ${s?.category_padding_bottom ?? 4}px;
    padding: 4px 0 0;
    color: #111;
    border: none;
}
table { width: 100%; border-collapse: collapse; font-size: ${s?.test_name_font_size ?? 14}px; }
thead th {
    text-align: left; font-weight: 800;
    padding: ${headV}px ${cellH}px;
    border: 1px solid #bdbdbd;
    background: #f5f5f5;
    font-size: ${s?.test_name_font_size ?? 14}px;
}
tbody td {
    padding: ${cellV}px ${cellH}px;
    vertical-align: top;
    border: none;
    line-height: 1.25;
    font-size: ${s?.result_font_size ?? 14}px;
}
.test-group {
    font-weight: 800;
    text-transform: uppercase;
    font-size: ${s?.group_font_size ?? 15}px;
    padding-top: ${groupTop}px;
    padding-bottom: ${s?.group_padding_bottom ?? 2}px;
    padding-left: ${s?.group_padding_left ?? 4}px;
}
.result-col { width: 150px; white-space: nowrap; }
.range-col { width: 200px; }
.test-remarks {
    padding: 4px ${cellH}px 6px;
    color: #b91c1c;
    font-weight: 600;
    font-size: ${Math.max(10, (s?.result_font_size ?? 14) - 2)}px;
    line-height: 1.35;
    border-top: 1px dashed #d1d5db;
}
.test-remarks-label {
    font-weight: 800;
    text-transform: uppercase;
    font-size: 10px;
    margin-right: 4px;
}
.test-block { page-break-inside: avoid; break-inside: avoid; }
.footer {
    font-size: ${s?.footer_font_size ?? 11}px;
    font-weight: 700;
    text-align: center;
}
.footer-left {
    margin-top: 6px;
    font-size: ${s?.footer_font_size ?? 11}px;
    font-weight: 700;
}
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
@media print {
    @page { size: ${pageSizeRule} !important; margin: 0 !important; }
    html, body { width: ${A4_WIDTH_MM}mm !important; margin: 0 !important; padding: 0 !important; }
    .report-page {
        width: ${A4_WIDTH_MM}mm !important;
        height: ${A4_HEIGHT_MM}mm !important;
        min-height: ${A4_HEIGHT_MM}mm !important;
        max-height: ${A4_HEIGHT_MM}mm !important;
    }
}
${extraCss || ''}
`;
}

function buildLabPrintDocument(contentHtml, settings, extraCss) {
    const styles = buildLabPrintStyles(settings, extraCss);
    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>Lab Report</title>
<style>${styles}</style>
</head>
<body><div class="lab-print-body">${contentHtml}</div></body></html>`;
}

function printLabReportInIframe(html) {
    let iframe = document.getElementById('lab-print-iframe');
    if (iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = 'lab-print-iframe';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${A4_WIDTH_MM}mm;height:${A4_HEIGHT_MM}mm;border:none;`;
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    const win = iframe.contentWindow;
    win.focus();
    setTimeout(() => win.print(), 400);
}

window.LabPrintLayout = {
    A4_WIDTH_MM,
    A4_HEIGHT_MM,
    getPageLayout,
    getFooterHeightPx,
    paginateByCategory,
    paginateCategoryBlocks,
    buildLabPrintStyles,
    buildLabPrintDocument,
    printLabReportInIframe
};

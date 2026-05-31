(function () {

  const cfg = window.LABFLOW_PORTAL_CONFIG || {};

  const supabaseUrl = (cfg.supabaseUrl || "").replace(/\/$/, "");

  const functionName = cfg.functionName || "patient-portal";

  const hospitalName = cfg.hospitalName || "Lab Results Portal";

  const hospitalTitle =

    cfg.hospitalTitle || "GMMMC TEACHING HOSPITAL SUKKUR";

  const hospitalNameUr =

    cfg.hospitalNameUr || "جی ایم ایم سی ٹیچنگ ہسپتال سکھر";

  const hospitalPhone = cfg.hospitalPhone || "071561223";



  /** Standard A4 portal print — not tied to in-lab preprinted paper settings. */
  const DEFAULT_PRINT_SETTINGS = {

    page_size: "A4",

    page_top_margin: 15,

    page_right_margin: 15,

    page_bottom_margin: 15,

    page_left_margin: 15,

    header_height: 108,

    category_font_size: 18,

    group_font_size: 15,

    test_name_font_size: 14,

    result_font_size: 14,

    patient_info_font_size: 14,

    patient_info_label_font_size: 14,

    footer_font_size: 11,

    patient_info_padding_vertical: 6,

    patient_info_row_gap: 5,

    patient_info_label_width: 120,

    patient_info_bottom_margin: 4,

    table_header_padding_vertical: 8,

    table_header_padding_horizontal: 12,

    table_cell_padding_vertical: 4,

    table_cell_padding_horizontal: 12,

    category_padding_top: 10,

    category_padding_bottom: 4,

    category_border_width: 2,

    group_padding_top: 10,

    group_padding_bottom: 2,

    group_padding_left: 4,

    footer_margin_top: 0,

    footer_padding_top: 8,

    display_verified_by: false,

    display_pathologist_signature: false,

    footer_line1: "Electronic Signature : System Generated",

    footer_line2: "Printed on: {timestamp}",

    footer_line3: "LabFlow Diagnostics System by rehan ahmed",

    primary_color: "#111827",

  };



  const loginView = document.getElementById("login-view");

  const reportView = document.getElementById("report-view");

  const loginForm = document.getElementById("login-form");

  const loginError = document.getElementById("login-error");

  const loginBtn = document.getElementById("login-btn");

  const reportContent = document.getElementById("reportContent");

  const hospitalEl = document.getElementById("hospital-name");



  let lastPatient = null;

  let lastTests = [];



  if (hospitalEl) hospitalEl.textContent = hospitalName;



  function assetUrl(rel) {

    const path = String(rel || "").replace(/^\//, "");

    let base = (cfg.basePath || "").replace(/\/?$/, "");

    if (!base) {

      const p = window.location.pathname || "";

      const dir = p.endsWith("/")

        ? p.slice(0, -1)

        : p.replace(/\/[^/]*$/, "");

      if (dir && dir !== "/") base = dir;

    }

    if (!base) return path;

    return `${base}/${path}`;

  }



  function portalApiUrl() {

    return `${supabaseUrl}/functions/v1/${functionName}`;

  }



  function escapeHtml(text) {

    if (text === null || text === undefined) return "";

    const div = document.createElement("div");

    div.textContent = String(text);

    return div.innerHTML;

  }



  function fmtRange(minV, maxV) {

    const min =

      minV === null || minV === undefined || minV === "" ? null : String(minV);

    const max =

      maxV === null || maxV === undefined || maxV === "" ? null : String(maxV);

    if (min && max) return `${escapeHtml(min)} - ${escapeHtml(max)}`;

    if (min && !max) return `&ge; ${escapeHtml(min)}`;

    if (!min && max) return `&le; ${escapeHtml(max)}`;

    return "";

  }



  function formatAgeGender(patient) {

    const age =

      patient.age !== null &&

      patient.age !== undefined &&

      patient.age !== "" &&

      patient.age !== 0 &&

      patient.age !== "0"

        ? String(patient.age)

        : "0";

    const gender = patient.gender ? String(patient.gender) : "";

    const g = gender ? (gender.endsWith(".") ? gender : `${gender}.`) : "—";

    return `${age}/${g}`;

  }



  function getPrintSettings() {

    const merged = {

      ...DEFAULT_PRINT_SETTINGS,

      ...(cfg.printSettings || {}),

    };

    const letterheadExtra = cfg.letterheadHeaderExtra ?? 50;

    return {

      ...merged,

      header_height: (merged.header_height || 108) + letterheadExtra,

    };

  }



  function resolveRelation(patient) {

    const rawRelation = `${patient.relation_type || patient.relation || ""}`.trim();

    const relationMap = {

      W: "W/O",

      S: "S/O",

      D: "D/O",

      C: "C/O",

      H: "H/O",

      F: "F/O",

      M: "M/O",

    };

    const relationKey = rawRelation.replace(/\s+/g, "").toUpperCase();

    return relationMap[relationKey] || rawRelation || "W/O";

  }



  function toParamList(testValues) {

    const values =

      testValues && typeof testValues === "object"

        ? Object.values(testValues)

        : [];

    return values.filter((v) => v && typeof v === "object");

  }



  function groupByCategoryAndTest(rows) {

    const out = {};

    for (const r of rows) {

      const cat = (r.category || "General").trim() || "General";

      if (!out[cat]) out[cat] = {};

      const tname = (r.test_name || "Test").trim() || "Test";

      if (!out[cat][tname]) out[cat][tname] = { params: [], remarks: "" };

      out[cat][tname].params.push(...toParamList(r.test_values));

      const rm = (r.remarks || "").trim();

      if (rm) {

        const existing = out[cat][tname].remarks;

        out[cat][tname].remarks = existing ? `${existing}; ${rm}` : rm;

      }

    }

    return out;

  }



  function renderLetterheadScreen(patient) {

    const logoLeft = cfg.logoLeft

      ? assetUrl(cfg.logoLeft)

      : "images/hospital_logo.png";

    const logoRight = cfg.logoRight ? assetUrl(cfg.logoRight) : "images/logo.png";

    const mr = escapeHtml(patient.mr_no ?? "—");

    const ageGender = escapeHtml(formatAgeGender(patient));



    return `

      <header class="hospital-letterhead">

        <div class="letterhead-inner">

          <img class="letterhead-logo" src="${logoLeft}" alt="">

          <div class="letterhead-center">

            <div class="letterhead-title">${escapeHtml(hospitalTitle)}</div>

            ${

              hospitalNameUr

                ? `<div class="letterhead-urdu" dir="rtl">${escapeHtml(hospitalNameUr)}</div>`

                : ""

            }

            ${

              hospitalPhone

                ? `<div class="letterhead-phone">${escapeHtml(hospitalPhone)}</div>`

                : ""

            }

          </div>

          <img class="letterhead-logo" src="${logoRight}" alt="">

        </div>

        <hr class="letterhead-rule">

        <div class="letterhead-patient-row">

          <span>Patient MR # : ${mr}</span>

          <span>Age/Gender : ${ageGender}</span>

        </div>

      </header>`;

  }



  function renderLetterheadPrintCompact() {

    const logoLeft = cfg.logoLeft

      ? assetUrl(cfg.logoLeft)

      : "images/hospital_logo.png";

    const logoRight = cfg.logoRight ? assetUrl(cfg.logoRight) : "images/logo.png";



    return `

      <div class="print-letterhead">

        <img class="print-letterhead-logo" src="${logoLeft}" alt="">

        <div class="print-letterhead-center">

          <div class="print-letterhead-title">${escapeHtml(hospitalTitle)}</div>

          ${

            hospitalNameUr

              ? `<div class="print-letterhead-urdu" dir="rtl">${escapeHtml(hospitalNameUr)}</div>`

              : ""

          }

        </div>

        <img class="print-letterhead-logo" src="${logoRight}" alt="">

      </div>

      <hr class="print-letterhead-rule">`;

  }



  function portalPrintExtraCss() {

    return `

.print-letterhead {

    display: flex;

    align-items: center;

    justify-content: space-between;

    gap: 6px;

    margin-bottom: 2px;

}

.print-letterhead-logo {

    width: 38px;

    height: 38px;

    object-fit: contain;

    flex-shrink: 0;

}

.print-letterhead-center { flex: 1; text-align: center; min-width: 0; }

.print-letterhead-title {

    font-size: 9px;

    font-weight: 700;

    text-transform: uppercase;

    letter-spacing: 0.02em;

    line-height: 1.2;

}

.print-letterhead-urdu {

    font-size: 9px;

    font-weight: 600;

    line-height: 1.3;

}

.print-letterhead-rule {

    border: none;

    border-top: 1px solid #000;

    margin: 2px 0 4px;

}

.info-card { margin-bottom: 0; padding-top: 2px; padding-bottom: 2px; }

.info-grid { gap: 3px 14px; font-size: 10px; line-height: 1.25; }

.row { grid-template-columns: 100px 1fr; gap: 4px; }

.label, .value { font-size: 10px; }

`;

  }



  function renderScreenParamRow(p) {

    const name = p.name || p.label || "";

    const value =

      p.value !== null && p.value !== undefined && p.value !== ""

        ? String(p.value)

        : "—";

    return `

      <tr>

        <td class="col-test-name">${escapeHtml(name)}</td>

        <td class="col-result">${escapeHtml(value)}</td>

        <td class="col-unit">${escapeHtml(p.unit || "")}</td>

        <td class="col-range">${fmtRange(p.normal_min, p.normal_max)}</td>

      </tr>`;

  }



  function renderPrintParamRow(p) {

    const nm = p.name || p.label || "";

    const val =

      p.value === null || p.value === undefined || p.value === ""

        ? "-"

        : String(p.value);

    const unit = p.unit ? String(p.unit) : "";

    const res = `${escapeHtml(val)}${unit ? " " + escapeHtml(unit) : ""}`;

    const rng = fmtRange(p.normal_min, p.normal_max);

    return `<tr><td>${escapeHtml(nm)}</td><td class="result-col">${res}</td><td class="range-col">${rng}</td></tr>`;

  }



  function renderScreenPreview(patient, tests, settings) {

    const now = new Date();

    const grouped = groupByCategoryAndTest(tests);

    const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

    const sal = patient.salutation ? `${patient.salutation} ` : "";

    const pName = `${sal}${patient.patient_name || ""}`.trim();

    const relation = resolveRelation(patient);

    const relationName = (patient.relation_name || "").trim();

    const reportDate =

      tests.length && tests[0].created_at

        ? new Date(tests[0].created_at).toISOString().slice(0, 10)

        : now.toISOString().slice(0, 10);



    if (!categories.length) {

      reportContent.innerHTML =

        '<p class="empty-msg">No completed results are available yet. Please check back later or contact the lab.</p>';

      return;

    }



    let html = `<div class="report-screen">`;

    html += renderLetterheadScreen(patient);



    html += `

      <div class="screen-patient-bar">

        <span><strong>Name:</strong> ${escapeHtml(pName || "—")}</span>

        <span><strong>${escapeHtml(relation)}:</strong> ${escapeHtml(relationName || "—")}</span>

        <span><strong>Shift:</strong> ${escapeHtml(patient.shift || "—")}</span>

        <span><strong>Report:</strong> ${escapeHtml(reportDate)}</span>

      </div>`;



    categories.forEach((category) => {

      const testMap = grouped[category];

      const testNames = Object.keys(testMap).sort((a, b) => a.localeCompare(b));



      html += `

        <section class="screen-category">

          <h2 class="screen-category-title">${escapeHtml(category)}</h2>

          <table class="screen-results-table">

            <thead>

              <tr>

                <th class="col-test-name">Test</th>

                <th class="col-result">Result</th>

                <th class="col-unit">Unit</th>

                <th class="col-range">Normal Range</th>

              </tr>

            </thead>`;



      testNames.forEach((tname) => {

        const block = testMap[tname];

        html += `<tbody class="screen-test-block">`;

        html += `<tr class="screen-test-group"><td colspan="4">${escapeHtml(tname)}</td></tr>`;

        block.params.forEach((p) => {

          html += renderScreenParamRow(p);

        });

        if (block.remarks) {

          html += `<tr class="screen-remarks"><td colspan="4"><span class="screen-remarks-label">Remarks:</span>${escapeHtml(block.remarks)}</td></tr>`;

        }

        html += `</tbody>`;

      });



      html += `</table></section>`;

    });



    const footerLine1 = settings?.footer_line1 || DEFAULT_PRINT_SETTINGS.footer_line1;

    const footerLine3 = settings?.footer_line3 || DEFAULT_PRINT_SETTINGS.footer_line3;

    html += `

      <footer class="screen-report-footer">

        <div>${escapeHtml(String(footerLine1).toUpperCase())}</div>

        <div class="screen-footer-sub">${escapeHtml(footerLine3)}</div>

      </footer>

    </div>`;



    reportContent.innerHTML = html;

  }



  function buildPrintPatientHeader(patient, settings) {

    const now = new Date();

    const createdAt =

      lastTests.length && lastTests[0].created_at

        ? new Date(lastTests[0].created_at)

        : now;

    const reportDate = createdAt.toISOString().slice(0, 10);

    const pName = `${patient.salutation || ""} ${patient.patient_name || ""}`.trim();

    const ageSex = `${patient.age || ""}/${patient.gender || ""}`.replace(

      /^\/|\/$/g,

      "",

    );

    const relation = resolveRelation(patient);

    const relationName = (patient.relation_name || "").trim();



    return `

      <div class="page-header">

        ${renderLetterheadPrintCompact()}

        <div class="info-card">

          <div class="info-grid">

            <div class="row"><div class="label">Patient MR # :</div><div class="value">${escapeHtml(patient.mr_no ?? "—")}</div></div>

            <div class="row"><div class="label">Age/Gender :</div><div class="value">${escapeHtml(ageSex || "—")}</div></div>

            <div class="row"><div class="label">Patient Name :</div><div class="value">${escapeHtml(pName || "—")}</div></div>

            <div class="row"><div class="label">${escapeHtml(relation)} :</div><div class="value">${escapeHtml(relationName || "—")}</div></div>

            <div class="row"><div class="label">Report Date :</div><div class="value">${escapeHtml(reportDate)}</div></div>

            <div class="row"><div class="label">Reported On :</div><div class="value">${escapeHtml(now.toLocaleString())}</div></div>

            <div class="row"><div class="label">SHIFT :</div><div class="value">${escapeHtml(String(patient.shift || "—").toUpperCase())}</div></div>

            <div class="row"><div class="label">PATIENT TOKEN NO :</div><div class="value">${escapeHtml(patient.patient_token ?? "—")}</div></div>

          </div>

        </div>

      </div>`;

  }



  function buildPrintFooter(settings) {

    const now = new Date();

    const line1 = settings?.footer_line1 || DEFAULT_PRINT_SETTINGS.footer_line1;

    const line3 = settings?.footer_line3 || DEFAULT_PRINT_SETTINGS.footer_line3;

    return `

      <div class="page-footer">

        <div class="footer">${escapeHtml(String(line1).toUpperCase())}</div>

        <div class="footer-left">${escapeHtml(line3)}</div>

      </div>`;

  }



  function renderPrintCategoryContent(page) {

    let body = `

      <div class="category">

        <div class="category-title">${escapeHtml(page.category)}</div>

        <table>

          <thead>

            <tr>

              <th>Test</th>

              <th class="result-col">Result</th>

              <th class="range-col">Normal Ranges</th>

            </tr>

          </thead>`;



    for (const t of page.blocks) {

      body += `<tbody class="test-block">`;

      body += `<tr><td class="test-group" colspan="3">${escapeHtml(t.name)}</td></tr>`;

      for (const p of t.params || []) {

        body += renderPrintParamRow(p);

      }

      if (t.remarks) {

        body += `<tr><td colspan="3" class="test-remarks"><span class="test-remarks-label">Remarks:</span>${escapeHtml(t.remarks)}</td></tr>`;

      }

      body += `</tbody>`;

    }



    body += `</table></div>`;

    return body;

  }



  function buildPaginatedPrintHtml(patient, tests, settings) {

    const layout = window.LabPrintLayout;

    if (!layout?.paginateByCategory) {

      console.error("LabPrintLayout not loaded");

      return "";

    }



    const categories = groupByCategoryAndTest(tests);

    const pages = layout.paginateByCategory(categories, settings);

    if (!pages.length) return "";



    const headerHtml = buildPrintPatientHeader(patient, settings);

    const footerHtml = buildPrintFooter(settings);

    let html = "";



    pages.forEach((page, pageIdx) => {

      const isLast = pageIdx === pages.length - 1;

      html += `

        <div class="report-page${isLast ? " last-page" : ""}">

          ${headerHtml}

          <div class="page-body">${renderPrintCategoryContent(page)}</div>

          ${footerHtml}

        </div>`;

    });



    return html;

  }



  function buildPrintDocument(patient, tests, settings) {

    const pagesHtml = buildPaginatedPrintHtml(patient, tests, settings);

    if (!pagesHtml) return "";

    return window.LabPrintLayout.buildLabPrintDocument(

      pagesHtml,

      settings,

      portalPrintExtraCss(),

    );

  }



  function printReport() {

    if (!lastPatient || !lastTests.length) return;

    const settings = getPrintSettings();

    const html = buildPrintDocument(lastPatient, lastTests, settings);

    if (!html) return;

    window.LabPrintLayout.printLabReportInIframe(html);

  }



  function saveAsPdf() {

    if (!lastPatient || !lastTests.length) {

      alert("No report to save.");

      return;

    }

    if (typeof html2pdf === "undefined") {

      alert("PDF library failed to load. Please refresh and try again.");

      return;

    }



    const settings = getPrintSettings();

    const pagesHtml = buildPaginatedPrintHtml(lastPatient, lastTests, settings);

    if (!pagesHtml) {

      alert("No report to save.");

      return;

    }



    const btn = document.getElementById("btn-save-pdf");

    const mr = lastPatient?.mr_no || "report";

    const filename = `LabReport_${mr}.pdf`;



    if (btn) {

      btn.disabled = true;

      btn.textContent = "Saving…";

    }



    const wrap = document.createElement("div");

    wrap.id = "pdf-export-root";

    wrap.style.cssText = "position:fixed;left:-99999px;top:0;width:210mm;";



    const styleEl = document.createElement("style");

    styleEl.textContent =

      window.LabPrintLayout.buildLabPrintStyles(settings, portalPrintExtraCss()) +

      `.report-page { margin-bottom: 0; }`;

    wrap.appendChild(styleEl);



    const body = document.createElement("div");

    body.className = "lab-print-body";

    body.innerHTML = pagesHtml;

    wrap.appendChild(body);

    document.body.appendChild(wrap);



    const opt = {

      margin: 0,

      filename,

      image: { type: "jpeg", quality: 0.96 },

      html2canvas: {

        scale: 2,

        useCORS: true,

        logging: false,

        width: Math.round((210 / 25.4) * 96),

      },

      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },

      pagebreak: { mode: ["css", "legacy"], before: ".report-page + .report-page" },

    };



    html2pdf()

      .set(opt)

      .from(body)

      .save()

      .finally(() => {

        wrap.remove();

        if (btn) {

          btn.disabled = false;

          btn.textContent = "Save PDF";

        }

      });

  }



  function showLogin(msg) {

    loginView.hidden = false;

    reportView.hidden = true;

    if (msg) {

      loginError.textContent = msg;

      loginError.hidden = false;

    } else {

      loginError.hidden = true;

      loginError.textContent = "";

    }

  }



  function showReport() {

    loginView.hidden = true;

    reportView.hidden = false;

  }



  async function fetchResults(mrNo, token, pin) {

    const body = { pin };

    if (mrNo) body.mr_no = mrNo;

    if (token) body.patient_token = token;



    const res = await fetch(portalApiUrl(), {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(body),

    });



    let data;

    try {

      data = await res.json();

    } catch {

      throw new Error("Invalid response from server.");

    }



    if (!res.ok || data.status !== "ok") {

      throw new Error(data.message || "Could not load results.");

    }

    return data;

  }



  function renderReport(patient, tests) {

    lastPatient = patient;

    lastTests = tests || [];

    renderScreenPreview(patient, lastTests, getPrintSettings());

  }



  loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    loginError.hidden = true;

    loginBtn.disabled = true;

    loginBtn.textContent = "Loading…";



    const mrRaw = document.getElementById("mr_no").value.trim();

    const token = document.getElementById("patient_token").value.trim();

    const pin = document.getElementById("pin").value.trim();



    try {

      if (!supabaseUrl) {

        throw new Error("Portal is not configured (missing supabaseUrl).");

      }

      const mrNo = mrRaw ? parseInt(mrRaw, 10) : null;

      if (!token && (mrNo === null || Number.isNaN(mrNo))) {

        throw new Error("Enter a valid lab number or patient token.");

      }



      const data = await fetchResults(

        mrNo !== null && !Number.isNaN(mrNo) ? mrNo : null,

        token || null,

        pin,

      );

      showReport();

      renderReport(data.patient, data.tests || []);

    } catch (err) {

      showLogin(err.message || "Login failed.");

    } finally {

      loginBtn.disabled = false;

      loginBtn.textContent = "View results";

    }

  });



  document.getElementById("btn-print").addEventListener("click", printReport);

  document.getElementById("btn-save-pdf").addEventListener("click", saveAsPdf);



  document.getElementById("btn-logout").addEventListener("click", () => {

    loginForm.reset();

    lastPatient = null;

    lastTests = [];

    showLogin();

  });



  if (!supabaseUrl) {

    showLogin("Missing config.js — copy config.example.js and set supabaseUrl.");

  }

})();



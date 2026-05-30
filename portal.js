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

  const loginView = document.getElementById("login-view");
  const reportView = document.getElementById("report-view");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const loginBtn = document.getElementById("login-btn");
  const reportContent = document.getElementById("reportContent");
  const hospitalEl = document.getElementById("hospital-name");

  let lastPatient = null;

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

  function renderLetterhead(patient) {
    const logoLeft = assetUrl(cfg.logoLeft || "images/hospital_logo.png");
    const logoRight = assetUrl(cfg.logoRight || "images/logo.png");
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

  function renderParamRow(p) {
    const name = p.name || p.label || "";
    const value =
      p.value !== null && p.value !== undefined ? String(p.value) : "";
    return `
      <tr class="test-row">
        <td class="test-name-cell">${escapeHtml(name)}</td>
        <td class="result-cell">${escapeHtml(value)}</td>
        <td class="unit-cell">${escapeHtml(p.unit || "")}</td>
        <td class="range-cell">${fmtRange(p.normal_min, p.normal_max)}</td>
      </tr>`;
  }

  function renderReport(patient, tests) {
    const now = new Date();
    const grouped = groupByCategoryAndTest(tests);
    const categories = Object.keys(grouped).sort();
    lastPatient = patient;

    if (categories.length === 0) {
      reportContent.innerHTML =
        '<p class="empty-msg">No completed results are available yet. Please check back later or contact the lab.</p>';
      return;
    }

    const sal = patient.salutation ? `${patient.salutation} ` : "";
    let html = renderLetterhead(patient);

    categories.forEach((category, index) => {
      const testMap = grouped[category];
      const testNames = Object.keys(testMap).sort();
      const isLast = index === categories.length - 1;

      html += `
        <div class="category-wrapper ${isLast ? "last-category" : ""}">
          <table class="category-table">
            <thead class="repeating-header">
              <tr>
                <td colspan="4" class="header-cell">
                  <div class="patient-info-boxes">
                    <div class="patient-info-box">
                      <div class="info-row"><span class="info-label">Lab No:</span> <span class="info-value">${escapeHtml(patient.mr_no ?? "N/A")}</span></div>
                      <div class="info-row"><span class="info-label">Name:</span> <span class="info-value">${escapeHtml(sal)}${escapeHtml(patient.patient_name || "")}</span></div>
                      <div class="info-row"><span class="info-label">Age / Sex:</span> <span class="info-value">${escapeHtml(String(patient.age ?? ""))} / ${escapeHtml(patient.gender || "")}</span></div>
                      <div class="info-row"><span class="info-label">Shift:</span> <span class="info-value">${escapeHtml(patient.shift || "N/A")}</span></div>
                    </div>
                    <div class="patient-info-box">
                      <div class="info-row"><span class="info-label">Branch:</span> <span class="info-value">Sukkur Branch</span></div>
                      <div class="info-row"><span class="info-label">Collection:</span> <span class="info-value">${escapeHtml(now.toLocaleString())}</span></div>
                      <div class="info-row"><span class="info-label">Reported:</span> <span class="info-value">${escapeHtml(now.toLocaleString())}</span></div>
                    </div>
                  </div>
                  <div class="category-title-block">
                    <span class="category-title">${escapeHtml(category)}</span>
                  </div>
                </td>
              </tr>
              <tr class="column-headers-row">
                <th class="col-test-name">TEST NAME</th>
                <th class="col-result">RESULT</th>
                <th class="col-unit">UNIT</th>
                <th class="col-range">NORMAL RANGE</th>
              </tr>
            </thead>
            <tbody>`;

      testNames.forEach((tname) => {
        const block = testMap[tname];
        html += `<tr class="group-title-row"><td colspan="4" class="group-name">${escapeHtml(tname)}</td></tr>`;
        block.params.forEach((p) => {
          html += renderParamRow(p);
        });
        if (block.remarks) {
          html += `<tr class="test-row"><td colspan="4"><em>Remarks: ${escapeHtml(block.remarks)}</em></td></tr>`;
        }
      });

      html += `</tbody></table></div>`;
    });

    reportContent.innerHTML = html;
  }

  function getReportDocumentHtml() {
    const sheetLinks = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]'),
    )
      .map((l) => l.href)
      .filter(Boolean);

    const styles = sheetLinks
      .map((href) => `<link rel="stylesheet" href="${href}">`)
      .join("\n");

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">${styles}
<style>
body { margin: 0; padding: 16px; background: #fff; }
.report-preview-container { box-shadow: none; max-width: none; padding: 0; min-height: 0; }
</style></head><body><div class="report-preview-container">${reportContent.innerHTML}</div></body></html>`;
  }

  function printReport() {
    if (!reportContent.querySelector(".category-wrapper")) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      window.print();
      return;
    }
    w.document.write(getReportDocumentHtml());
    w.document.close();
    w.onload = () => {
      setTimeout(() => {
        w.focus();
        w.print();
      }, 400);
    };
  }

  function saveAsPdf() {
    if (!reportContent.querySelector(".category-wrapper")) {
      alert("No report to save.");
      return;
    }
    if (typeof html2pdf === "undefined") {
      alert("PDF library failed to load. Please refresh and try again.");
      return;
    }

    const btn = document.getElementById("btn-save-pdf");
    const mr = lastPatient?.mr_no || "report";
    const filename = `LabReport_${mr}.pdf`;

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving…";
    }

    const opt = {
      margin: [8, 8, 8, 8],
      filename,
      image: { type: "jpeg", quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };

    html2pdf()
      .set(opt)
      .from(reportContent)
      .save()
      .finally(() => {
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
    showLogin();
  });

  if (!supabaseUrl) {
    showLogin("Missing config.js — copy config.example.js and set supabaseUrl.");
  }
})();

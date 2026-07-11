const state = {
  token: sessionStorage.getItem("pps-admin-token") || "",
  status: "pending",
  reports: [],
};

const el = Object.fromEntries([
  "admin-token", "load-admin", "logout-button", "admin-status", "admin-reports",
].map((id) => [id, document.getElementById(id)]));

if (state.token) el["admin-token"].value = state.token;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function adminFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.token}`,
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

function setStatus(message) {
  el["admin-status"].textContent = message;
}

function render() {
  if (!state.reports.length) {
    el["admin-reports"].innerHTML = '<div class="state-panel">目前沒有這個狀態的投稿。</div>';
    return;
  }
  el["admin-reports"].innerHTML = state.reports.map((report) => `
    <article class="admin-report" data-report-id="${escapeHtml(report.id)}">
      <div>
        <p class="kicker">${escapeHtml(report.airport_code)} · ${escapeHtml(report.status)}</p>
        <h2>${escapeHtml(report.lounge_name)}</h2>
        <p>${escapeHtml(report.nickname)} · ${escapeHtml(report.email)} · ${escapeHtml(report.visit_date)}</p>
      </div>
      <dl class="detail-facts">
        <div class="detail-fact"><dt>評分</dt><dd>餐飲 ${escapeHtml(report.food_rating)}/5 · 整體 ${escapeHtml(report.overall_rating)}/5</dd></div>
        <div class="detail-fact"><dt>入場</dt><dd>${escapeHtml(report.entry_result)} · ${escapeHtml(report.queue_level)} · ${escapeHtml(report.crowd_level)}</dd></div>
        <div class="detail-fact"><dt>心得</dt><dd>${escapeHtml(report.body)}</dd></div>
      </dl>
      <label>管理備註<textarea data-admin-note rows="2">${escapeHtml(report.admin_note || "")}</textarea></label>
      <div class="sheet-actions">
        <button class="primary-button" type="button" data-action="approved">核准公開</button>
        <button class="secondary-button" type="button" data-action="rejected">拒絕</button>
        <button class="secondary-button" type="button" data-action="delete">刪除</button>
      </div>
    </article>
  `).join("");
}

async function loadReports() {
  state.token = el["admin-token"].value.trim();
  sessionStorage.setItem("pps-admin-token", state.token);
  setStatus("正在載入…");
  const data = await adminFetch(`api/admin-reports?status=${encodeURIComponent(state.status)}`);
  state.reports = data.reports ?? [];
  setStatus(`已載入 ${state.reports.length} 筆 ${state.status} 投稿。`);
  render();
}

async function updateReport(id, status, adminNote) {
  await adminFetch("api/admin-reports", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status, adminNote }),
  });
  await loadReports();
}

async function deleteReport(id) {
  await adminFetch("api/admin-reports", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  await loadReports();
}

el["load-admin"].addEventListener("click", () => {
  loadReports().catch((error) => setStatus(`載入失敗：${error.message}`));
});

el["logout-button"].addEventListener("click", () => {
  sessionStorage.removeItem("pps-admin-token");
  state.token = "";
  el["admin-token"].value = "";
  state.reports = [];
  render();
  setStatus("已清除管理 token。");
});

document.querySelectorAll("[data-admin-status]").forEach((button) => {
  button.addEventListener("click", () => {
    state.status = button.dataset.adminStatus;
    document.querySelectorAll("[data-admin-status]").forEach((item) =>
      item.classList.toggle("active", item === button),
    );
    if (state.token) loadReports().catch((error) => setStatus(`載入失敗：${error.message}`));
  });
});

el["admin-reports"].addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const card = button.closest("[data-report-id]");
  const id = card.dataset.reportId;
  const note = card.querySelector("[data-admin-note]").value;
  const action = button.dataset.action;
  if (action === "delete") {
    if (!window.confirm("確定刪除此投稿？這個動作不可復原。")) return;
    deleteReport(id).catch((error) => setStatus(`刪除失敗：${error.message}`));
    return;
  }
  updateReport(id, action, note).catch((error) => setStatus(`更新失敗：${error.message}`));
});

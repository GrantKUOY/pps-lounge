import {
  escapeHtml,
  formatConditions,
  formatFacility,
  formatLocation,
  formatOpeningHours,
  formatTerminal,
  safeExternalUrl,
} from "./formatters.js";

const priorityFacilities = ["Showers", "Wi-Fi", "Flight information"];

export function visibleFacilities(row, limit = 3) {
  return [
    ...priorityFacilities.filter((item) => row.facilities.includes(item)),
    ...row.facilities.filter((item) => !priorityFacilities.includes(item)),
  ].slice(0, limit);
}

export function airportOverview(rows, query) {
  const code = String(query ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(code) || !rows.length) return null;
  if (!rows.every((row) => row.airportCode === code)) return null;

  const terminals = new Set(rows.map((row) => row.terminal).filter(Boolean));
  return {
    code,
    airportName: rows[0].airportName,
    count: rows.length,
    terminalCount: terminals.size,
    loungeCount: rows.filter((row) => row.type === "LOUNGE").length,
    diningCount: rows.filter((row) => row.type === "EAT").length,
  };
}

export function resultRowHtml(row) {
  if (!Number.isSafeInteger(row._searchOrder) || row._searchOrder < 0) {
    throw new TypeError("_searchOrder must be a non-negative safe integer");
  }
  const facilities = visibleFacilities(row)
    .map((item) => `<span>${escapeHtml(formatFacility(item))}</span>`)
    .join("");
  const terminal = formatTerminal(row.terminal || row.location);
  const opening = formatOpeningHours(row.openingHours).split("\n")[0];

  return `<article class="result-row">
    <div class="result-kicker">${escapeHtml(terminal)} · ${escapeHtml(row.typeLabel)}</div>
    <div class="result-body">
      <div>
        <h3>${escapeHtml(row.name)}</h3>
        <p>${escapeHtml(opening)} · ${escapeHtml(formatLocation(row.location))}</p>
      </div>
      <button class="text-action" type="button" data-detail="${row._searchOrder}">查看詳情 →</button>
    </div>
    <div class="result-facilities">${facilities || "<span>未提供設施</span>"}</div>
  </article>`;
}

export function detailHtml(row) {
  const safeUrl = safeExternalUrl(row.url);
  const officialUrl = safeUrl && [
    "www.prioritypass.com",
    "my.prioritypass.com",
  ].includes(new URL(safeUrl).hostname.toLowerCase())
    ? safeUrl
    : "";
  const facilities = row.facilities.map(formatFacility).join("、") || "未提供";
  const officialLink = officialUrl
    ? `<a class="official-link" href="${escapeHtml(officialUrl)}" target="_blank" rel="noreferrer noopener">開啟 Priority Pass 官方頁面 ↗</a>`
    : '<p class="official-missing">目前沒有可用的官方詳情連結。</p>';

  return `<header class="detail-heading">
      <span class="detail-code">${escapeHtml(row.airportCode)}</span>
      <h2>${escapeHtml(row.name)}</h2>
      <p>${escapeHtml(row.airportName)} · ${escapeHtml(formatTerminal(row.terminal))}</p>
    </header>
    <dl class="detail-facts">
      <div class="detail-fact"><dt>位置</dt><dd>${escapeHtml(formatLocation(row.location))}</dd></div>
      <div class="detail-fact"><dt>營業時間</dt><dd>${escapeHtml(formatOpeningHours(row.openingHours))}</dd></div>
      <div class="detail-fact"><dt>設施</dt><dd>${escapeHtml(facilities)}</dd></div>
      <div class="detail-fact"><dt>使用條件</dt><dd>${escapeHtml(formatConditions(row.conditions))}</dd></div>
    </dl>
    <details class="raw-copy"><summary>查看原始英文</summary>
      <div class="raw-section"><h3>Opening hours</h3><p>${escapeHtml(row.openingHours || "Not provided")}</p></div>
      <div class="raw-section"><h3>Conditions</h3><p>${escapeHtml(row.conditions || "Not provided")}</p></div>
    </details>
    ${officialLink}
    <div data-community-mount></div>
    <p class="data-note">資料可能變動；出發前請以 Priority Pass 官方頁面及現場公告為準。</p>`;
}

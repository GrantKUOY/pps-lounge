import { downloadCsv } from "./csv.js";
import {
  escapeHtml,
  formatConditions,
  formatFacility,
  formatLocation,
  formatOpeningHours,
  formatTerminal,
  safeExternalUrl,
} from "./formatters.js";
import {
  createSearchIndex,
  filterRecords,
  paginate,
  searchRecords,
  sortRecords,
} from "./search.js";
import { readRecent, writeRecent } from "./storage.js";

const state = {
  rows: [],
  query: "",
  filters: { country: "", city: "", type: "", facility: "" },
  sort: "relevance",
  page: 1,
  pageSize: 24,
  selected: null,
  loading: true,
  error: null,
  currentRows: [],
};

const el = Object.fromEntries(
  [
    "search", "clear-search", "suggestions", "recent-wrap", "recent-searches",
    "result-summary", "loading-state", "error-state", "empty-state", "results",
    "prev-page", "next-page", "page-info", "open-filters", "filters",
    "filter-form", "country-filter", "city-filter", "type-filter",
    "facility-filter", "sort-filter", "page-size-filter", "clear-filters",
    "empty-clear", "retry-button", "download-button", "detail", "detail-content",
    "close-detail", "close-detail-icon",
  ].map((id) => [id, document.getElementById(id)]),
);

let searchTimer;

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
}

function setOptions(select, values, emptyLabel, label = (value) => value) {
  const current = select.value;
  select.innerHTML = [
    `<option value="">${escapeHtml(emptyLabel)}</option>`,
    ...values.map(
      (value) =>
        `<option value="${escapeHtml(value)}">${escapeHtml(label(value))}</option>`,
    ),
  ].join("");
  if (values.includes(current)) select.value = current;
}

function populateFilters() {
  setOptions(el["country-filter"], unique(state.rows.map((row) => row.country)), "全部國家／地區");
  setOptions(el["city-filter"], unique(state.rows.map((row) => row.city)), "全部城市");
  const types = unique(state.rows.map((row) => row.type));
  const labels = new Map(state.rows.map((row) => [row.type, row.typeLabel]));
  setOptions(el["type-filter"], types, "全部類型", (value) => labels.get(value) ?? value);
  setOptions(
    el["facility-filter"],
    unique(state.rows.flatMap((row) => row.facilities)),
    "全部設施",
    formatFacility,
  );
}

function renderRecent() {
  const recent = readRecent();
  el["recent-wrap"].hidden = recent.length === 0;
  el["recent-searches"].innerHTML = recent
    .map(
      (query) =>
        `<button class="filter-chip" type="button" data-recent="${escapeHtml(query)}">${escapeHtml(query)}</button>`,
    )
    .join("");
}

function renderSuggestions() {
  const query = state.query.trim();
  if (!query || state.loading) {
    el.suggestions.hidden = true;
    el.suggestions.innerHTML = "";
    return;
  }
  const matches = searchRecords(state.rows, query);
  const airports = [];
  const seen = new Set();
  for (const row of matches) {
    if (!seen.has(row.airportCode)) {
      seen.add(row.airportCode);
      airports.push(row);
    }
    if (airports.length === 5) break;
  }
  el.suggestions.innerHTML = airports
    .map(
      (row) => `<button class="suggestion" type="button" role="option" data-suggestion="${escapeHtml(row.airportCode)}">
        <span><strong>${escapeHtml(row.airportName)}</strong><small>${escapeHtml(row.city)} · ${escapeHtml(row.country)}</small></span>
        <span class="suggestion-code">${escapeHtml(row.airportCode)}</span>
      </button>`,
    )
    .join("");
  el.suggestions.hidden = airports.length === 0;
}

function cardHtml(row) {
  const priorityFacilities = ["Showers", "Wi-Fi", "Flight information"];
  const visibleFacilities = [
    ...priorityFacilities.filter((item) => row.facilities.includes(item)),
    ...row.facilities.filter((item) => !priorityFacilities.includes(item)),
  ].slice(0, 5);
  const facilities = visibleFacilities
    .map((item) => `<span class="facility">${escapeHtml(formatFacility(item))}</span>`)
    .join("");
  return `<article class="result-card">
    <div class="card-top"><span class="airport-code">${escapeHtml(row.airportCode)}</span><span class="type-badge">${escapeHtml(row.typeLabel)}</span></div>
    <h3>${escapeHtml(row.name)}</h3>
    <p class="subline">${escapeHtml(row.country)} · ${escapeHtml(row.city)} · ${escapeHtml(row.airportName)}</p>
    <div class="meta-grid">
      <div class="meta-box"><span>位置／航廈</span><strong>${escapeHtml(formatTerminal(row.terminal || row.location))}</strong></div>
      <div class="meta-box"><span>營業時間</span><strong>${escapeHtml(formatOpeningHours(row.openingHours).split("\n")[0])}</strong></div>
    </div>
    <div class="facility-list">${facilities || '<span class="facility">未提供設施</span>'}</div>
    <button class="secondary-button card-action" type="button" data-detail="${row._searchOrder}">查看詳情</button>
  </article>`;
}

function computeRows() {
  const searched = searchRecords(state.rows, state.query);
  const filtered = filterRecords(searched, state.filters);
  return sortRecords(filtered, state.query && state.sort === "relevance" ? "relevance" : state.sort);
}

function render() {
  el["loading-state"].hidden = !state.loading;
  el["error-state"].hidden = !state.error;
  el.search.disabled = state.loading || Boolean(state.error);
  el["download-button"].disabled = state.loading || Boolean(state.error);
  el["clear-search"].hidden = !state.query;
  if (state.loading || state.error) return;

  state.currentRows = computeRows();
  const page = paginate(state.currentRows, state.page, state.pageSize);
  state.page = page.page;
  el.results.innerHTML = page.rows.map(cardHtml).join("");
  el["empty-state"].hidden = state.currentRows.length > 0;
  el["result-summary"].textContent = state.currentRows.length
    ? `顯示第 ${page.start}–${page.end} 筆，共 ${page.totalItems} 筆結果。`
    : "目前沒有符合條件的結果。";
  el["page-info"].textContent = `第 ${page.page} / ${page.totalPages} 頁`;
  el["prev-page"].disabled = page.page <= 1;
  el["next-page"].disabled = page.page >= page.totalPages;
  renderSuggestions();
}

function resetFilters() {
  state.filters = { country: "", city: "", type: "", facility: "" };
  state.sort = "relevance";
  state.page = 1;
  state.pageSize = 24;
  for (const id of ["country-filter", "city-filter", "type-filter", "facility-filter"]) el[id].value = "";
  el["sort-filter"].value = "relevance";
  el["page-size-filter"].value = "24";
  document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.remove("active"));
  document.querySelector('[data-quick-filter=""]').classList.add("active");
  render();
}

function setQuery(query, remember = false) {
  state.query = query.trim();
  state.page = 1;
  el.search.value = state.query;
  if (remember && state.query) {
    writeRecent([state.query, ...readRecent()]);
    renderRecent();
  }
  render();
}

function showDetail(index) {
  const row = state.rows.find((item) => item._searchOrder === Number(index));
  if (!row) return;
  state.selected = row;
  const officialUrl = safeExternalUrl(row.url);
  const facilities = row.facilities
    .map((item) => `<span class="facility">${escapeHtml(formatFacility(item))}</span>`)
    .join("");
  el["detail-content"].innerHTML = `
    <header class="detail-hero">
      <span class="airport-code">${escapeHtml(row.airportCode)}</span>
      <h2>${escapeHtml(row.name)}</h2>
      <p class="subline">${escapeHtml(row.country)} · ${escapeHtml(row.city)} · ${escapeHtml(row.airportName)}</p>
    </header>
    <section class="detail-section"><h3>位置</h3><p>${escapeHtml(formatLocation(row.location))}\n${escapeHtml(formatTerminal(row.terminal))}</p></section>
    <section class="detail-section"><h3>營業時間</h3><p>${escapeHtml(formatOpeningHours(row.openingHours))}</p></section>
    <section class="detail-section"><h3>使用條件</h3><p>${escapeHtml(formatConditions(row.conditions))}</p></section>
    <section class="detail-section"><h3>設施</h3><div class="facility-list">${facilities || '<span class="facility">未提供</span>'}</div></section>
    <details class="raw-copy"><summary>查看原始英文</summary>
      <section class="detail-section"><h3>Opening hours</h3><p>${escapeHtml(row.openingHours || "Not provided")}</p></section>
      <section class="detail-section"><h3>Conditions</h3><p>${escapeHtml(row.conditions || "Not provided")}</p></section>
    </details>
    ${officialUrl ? `<a class="official-link" href="${escapeHtml(officialUrl)}" target="_blank" rel="noreferrer noopener">開啟 Priority Pass 官方頁面 ↗</a>` : ""}
  `;
  el.detail.showModal();
}

async function loadData() {
  state.loading = true;
  state.error = null;
  render();
  try {
    const response = await fetch("data/lounges.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1754) throw new Error("資料筆數不符");
    state.rows = createSearchIndex(rows);
    populateFilters();
    renderRecent();
    state.loading = false;
  } catch (error) {
    state.error = error;
    state.loading = false;
  }
  render();
}

el.search.addEventListener("input", (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => setQuery(event.target.value), 120);
});
el.search.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    clearTimeout(searchTimer);
    setQuery(event.currentTarget.value, true);
    el.suggestions.hidden = true;
  }
});
el["clear-search"].addEventListener("click", () => setQuery(""));
el.suggestions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-suggestion]");
  if (button) setQuery(button.dataset.suggestion, true);
  el.suggestions.hidden = true;
});
el["recent-searches"].addEventListener("click", (event) => {
  const button = event.target.closest("[data-recent]");
  if (button) setQuery(button.dataset.recent);
});
el["open-filters"].addEventListener("click", () => el.filters.showModal());
el["filter-form"].addEventListener("submit", () => {
  state.filters = {
    country: el["country-filter"].value,
    city: el["city-filter"].value,
    type: el["type-filter"].value,
    facility: el["facility-filter"].value,
  };
  state.sort = el["sort-filter"].value;
  state.pageSize = Number(el["page-size-filter"].value);
  state.page = 1;
  render();
});
el["clear-filters"].addEventListener("click", resetFilters);
el["empty-clear"].addEventListener("click", () => {
  state.query = "";
  el.search.value = "";
  resetFilters();
});
el["retry-button"].addEventListener("click", loadData);
el["prev-page"].addEventListener("click", () => {
  state.page -= 1;
  render();
  el["results-title"].scrollIntoView({ behavior: "smooth" });
});
el["next-page"].addEventListener("click", () => {
  state.page += 1;
  render();
  el["results-title"].scrollIntoView({ behavior: "smooth" });
});
el.results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-detail]");
  if (button) showDetail(button.dataset.detail);
});
el["close-detail"].addEventListener("click", () => el.detail.close());
el["close-detail-icon"].addEventListener("click", () => el.detail.close());
el["download-button"].addEventListener("click", () => {
  if (!state.currentRows.length) return window.alert("目前沒有可匯出的資料。");
  downloadCsv(state.currentRows);
});
document.querySelectorAll("[data-quick-filter], [data-quick-type]").forEach((button) => {
  button.addEventListener("click", () => {
    const isFacility = Object.hasOwn(button.dataset, "quickFilter");
    if (isFacility) state.filters.facility = button.dataset.quickFilter;
    else state.filters.type = button.dataset.quickType;
    state.page = 1;
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.remove("active"));
    button.classList.add("active");
    render();
  });
});

loadData();

import { downloadCsv } from "./csv.js";
import {
  escapeHtml,
  formatFacility,
} from "./formatters.js";
import {
  createSearchIndex,
  filterRecords,
  paginate,
  searchRecords,
  sortRecords,
} from "./search.js";
import {
  airportOverview,
  detailHtml,
  resultRowHtml,
} from "./presentation.js";
import {
  configureLocalizedNames,
  displayCityName,
  displayCountryName,
} from "./localized-names.js";
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
    "results-title", "result-summary", "loading-state", "error-state",
    "empty-state", "results",
    "prev-page", "next-page", "page-info", "open-filters", "filters",
    "close-filters", "filter-form", "country-filter", "city-filter", "type-filter",
    "facility-filter", "sort-filter", "page-size-filter", "clear-filters",
    "empty-clear", "retry-button", "download-button", "detail", "detail-content",
    "close-detail", "close-detail-icon",
    "airport-overview", "overview-code", "overview-name", "overview-meta",
  ].map((id) => [id, document.getElementById(id)]),
);

let searchTimer;
let detailTrigger = null;

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

function citiesForCountry(country) {
  return unique(
    state.rows
      .filter((row) => !country || row.country === country)
      .map((row) => row.city),
  );
}

function setCityOptions(country) {
  setOptions(
    el["city-filter"],
    citiesForCountry(country),
    "全部城市",
    displayCityName,
  );
}

function populateFilters() {
  setOptions(
    el["country-filter"],
    unique(state.rows.map((row) => row.country)),
    "全部國家／地區",
    displayCountryName,
  );
  setCityOptions(el["country-filter"].value);
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

function computeRows() {
  const searched = searchRecords(state.rows, state.query);
  const filtered = filterRecords(searched, state.filters);
  return sortRecords(filtered, state.query && state.sort === "relevance" ? "relevance" : state.sort);
}

function renderAirportOverview(items) {
  const overview = airportOverview(items, state.query);
  el["airport-overview"].hidden = !overview;
  if (!overview) return;

  el["overview-code"].textContent = overview.code;
  el["overview-name"].textContent = overview.airportName;
  el["overview-meta"].textContent =
    `${overview.count} 個據點 · ${overview.terminalCount} 座航廈 · ` +
    `${overview.loungeCount} 間貴賓室 · ${overview.diningCount} 個餐飲權益`;
}

function render() {
  el["loading-state"].hidden = !state.loading;
  el["error-state"].hidden = !state.error;
  el.search.disabled = state.loading || Boolean(state.error);
  el["download-button"].disabled = state.loading || Boolean(state.error);
  el["clear-search"].hidden = !state.query;
  if (state.loading || state.error) return;

  state.currentRows = computeRows();
  renderAirportOverview(state.currentRows);
  const page = paginate(state.currentRows, state.page, state.pageSize);
  state.page = page.page;
  el.results.innerHTML = page.rows.map(resultRowHtml).join("");
  el["empty-state"].hidden = state.currentRows.length > 0;
  el["result-summary"].textContent = state.currentRows.length
    ? `顯示第 ${page.start}–${page.end} 筆，共 ${page.totalItems} 筆結果。`
    : "目前沒有符合條件的結果。";
  el["page-info"].textContent = `第 ${page.page} / ${page.totalPages} 頁`;
  el["prev-page"].disabled = page.page <= 1;
  el["next-page"].disabled = page.page >= page.totalPages;
  renderSuggestions();
}

function syncQuickFilterState(type) {
  document.querySelectorAll("[data-quick-type]").forEach((button) => {
    const active = button.dataset.quickType === type;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function syncFilterControls() {
  el["country-filter"].value = state.filters.country;
  setCityOptions(state.filters.country);
  el["city-filter"].value = state.filters.city;
  el["type-filter"].value = state.filters.type;
  el["facility-filter"].value = state.filters.facility;
  el["sort-filter"].value = state.sort;
  el["page-size-filter"].value = String(state.pageSize);
}

function resetFilters() {
  state.filters = { country: "", city: "", type: "", facility: "" };
  state.sort = "relevance";
  state.page = 1;
  state.pageSize = 24;
  syncFilterControls();
  syncQuickFilterState("");
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

function showDetail(index, trigger) {
  const row = state.rows.find((item) => item._searchOrder === Number(index));
  if (!row) return;
  state.selected = row;
  detailTrigger = trigger;
  el.detail.setAttribute("aria-label", `${row.name} 詳情`);
  el["close-detail"].textContent = `← 返回 ${row.airportCode} 的搜尋結果`;
  el["detail-content"].innerHTML = detailHtml(row);
  el.detail.showModal();
  el["close-detail"].focus();
}

function closeDetail() {
  el.detail.close();
}

function scrollResultsIntoView() {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    .matches;
  el["results-title"].scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
  });
}

async function loadLocalization() {
  try {
    const response = await fetch("data/localization/city-names-zh-tw.json", {
      cache: "no-cache",
    });
    if (!response.ok) return;
    configureLocalizedNames({ cityNamesZhTw: await response.json() });
  } catch {
    // 中文城市對照是顯示增強；載入失敗時保留內建 fallback 與英文名稱。
  }
}

async function loadData() {
  state.loading = true;
  state.error = null;
  render();
  try {
    const response = await fetch("data/lounges.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("資料內容不符");
    state.rows = createSearchIndex(rows);
    await loadLocalization();
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
el["open-filters"].addEventListener("click", () => {
  syncFilterControls();
  el.filters.showModal();
});
el["close-filters"].addEventListener("click", () => {
  syncFilterControls();
  el.filters.close();
});
el["country-filter"].addEventListener("change", () => {
  setCityOptions(el["country-filter"].value);
});
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
  syncQuickFilterState(state.filters.type);
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
  scrollResultsIntoView();
});
el["next-page"].addEventListener("click", () => {
  state.page += 1;
  render();
  scrollResultsIntoView();
});
el.results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-detail]");
  if (button) showDetail(button.dataset.detail, button);
});
el["close-detail"].addEventListener("click", closeDetail);
el["close-detail-icon"].addEventListener("click", closeDetail);
el.detail.addEventListener("close", () => detailTrigger?.focus());
el["download-button"].addEventListener("click", () => {
  if (!state.currentRows.length) return window.alert("目前沒有可匯出的資料。");
  downloadCsv(state.currentRows);
});
document.querySelectorAll("[data-quick-type]").forEach((button) => {
  button.addEventListener("click", () => {
    state.filters.type = button.dataset.quickType;
    state.filters.facility = "";
    el["type-filter"].value = state.filters.type;
    el["facility-filter"].value = "";
    state.page = 1;
    syncQuickFilterState(state.filters.type);
    render();
  });
});

loadData();

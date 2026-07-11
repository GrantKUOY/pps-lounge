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
  communityReportsHtml,
  loungeKeyForRow,
} from "./community.js";
import {
  fetchApprovedReports,
  submitCommunityReport,
} from "./community-client.js";
import {
  configureLocalizedNames,
  displayCityName,
  displayCountryName,
} from "./localized-names.js";
import { readRecent, writeRecent } from "./storage.js";

const state = {
  rows: [],
  query: "",
  filters: { region: "", country: "", city: "", type: "", facility: "" },
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
    "close-filters", "filter-form", "region-filter", "country-filter", "city-filter", "type-filter",
    "facility-filter", "sort-filter", "page-size-filter", "clear-filters",
    "empty-clear", "retry-button", "download-button", "detail", "detail-content",
    "close-detail", "close-detail-icon",
    "airport-overview", "overview-code", "overview-name", "overview-meta",
    "report-dialog", "report-form", "report-lounge", "report-status",
    "close-report", "cancel-report", "submit-report", "report-photos",
    "pwa-install", "pwa-install-button", "pwa-offline", "pwa-update", "pwa-update-button",
  ].map((id) => [id, document.getElementById(id)]),
);

let searchTimer;
let detailTrigger = null;
let photoLightbox = null;
let installPromptEvent = null;

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

function rowsForRegion(region) {
  return state.rows.filter((row) => !region || row.region === region);
}

function countriesForRegion(region) {
  return unique(rowsForRegion(region).map((row) => row.country));
}

function citiesForCountry(country, region = "") {
  return unique(
    state.rows
      .filter((row) => (!region || row.region === region) && (!country || row.country === country))
      .map((row) => row.city),
  );
}

function setCityOptions(country, region = "") {
  setOptions(
    el["city-filter"],
    citiesForCountry(country, region),
    "全部城市",
    displayCityName,
  );
}

function populateFilters() {
  setOptions(
    el["country-filter"],
    countriesForRegion(el["region-filter"].value),
    "全部國家／地區",
    displayCountryName,
  );
  setCityOptions(el["country-filter"].value, el["region-filter"].value);
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

function syncRegionShortcutState(region) {
  document.querySelectorAll("[data-quick-region]").forEach((button) => {
    const active = button.dataset.quickRegion === region;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function syncFilterControls() {
  el["region-filter"].value = state.filters.region;
  setOptions(
    el["country-filter"],
    countriesForRegion(state.filters.region),
    "全部國家／地區",
    displayCountryName,
  );
  el["country-filter"].value = state.filters.country;
  setCityOptions(state.filters.country, state.filters.region);
  el["city-filter"].value = state.filters.city;
  el["type-filter"].value = state.filters.type;
  el["facility-filter"].value = state.filters.facility;
  el["sort-filter"].value = state.sort;
  el["page-size-filter"].value = String(state.pageSize);
}

function resetFilters() {
  state.filters = { region: "", country: "", city: "", type: "", facility: "" };
  state.sort = "relevance";
  state.page = 1;
  state.pageSize = 24;
  syncFilterControls();
  syncQuickFilterState("");
  syncRegionShortcutState("");
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
  renderCommunitySection(row);
}

function closeDetail() {
  el.detail.close();
}

function ensurePhotoLightbox() {
  if (photoLightbox) return photoLightbox;
  const lightbox = document.createElement("dialog");
  lightbox.className = "photo-lightbox";
  lightbox.innerHTML = `<button class="photo-lightbox-surface" type="button" aria-label="關閉照片預覽">
    <img alt="">
  </button>`;
  document.body.append(lightbox);
  lightbox.addEventListener("click", closePhotoLightbox);
  photoLightbox = lightbox;
  return photoLightbox;
}

function openPhotoLightbox(src, alt = "旅客上傳照片") {
  if (!src) return;
  const lightbox = ensurePhotoLightbox();
  const image = lightbox.querySelector("img");
  image.src = src;
  image.alt = alt;
  if (!lightbox.open) lightbox.showModal();
  document.body.classList.add("photo-lightbox-open");
  lightbox.querySelector("button").focus();
}

function closePhotoLightbox() {
  if (!photoLightbox || !photoLightbox.open) return;
  photoLightbox.close();
  photoLightbox.querySelector("img").removeAttribute("src");
  document.body.classList.remove("photo-lightbox-open");
}

function isStandaloneDisplay() {
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

function showInstallPrompt(event) {
  if (isStandaloneDisplay()) return;
  event.preventDefault?.();
  installPromptEvent = event;
  el["pwa-install"].hidden = false;
}

async function promptInstall() {
  if (!installPromptEvent) return;
  const event = installPromptEvent;
  installPromptEvent = null;
  el["pwa-install"].hidden = true;
  await event.prompt?.();
  await event.userChoice?.catch?.(() => null);
}

function syncOfflineNotice() {
  el["pwa-offline"].hidden = navigator.onLine;
}

function showUpdateNotice() {
  el["pwa-update"].hidden = false;
}

function wirePwaEnhancements() {
  window.addEventListener("beforeinstallprompt", showInstallPrompt);
  el["pwa-install-button"].addEventListener("click", () => {
    promptInstall().catch(() => {
      el["pwa-install"].hidden = true;
    });
  });

  syncOfflineNotice();
  window.addEventListener("online", syncOfflineNotice);
  window.addEventListener("offline", syncOfflineNotice);

  window.addEventListener("pps-update-ready", showUpdateNotice);
  el["pwa-update-button"].addEventListener("click", () => window.location.reload());
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
el["region-filter"].addEventListener("change", () => {
  setOptions(
    el["country-filter"],
    countriesForRegion(el["region-filter"].value),
    "全部國家／地區",
    displayCountryName,
  );
  if (el["country-filter"].value && !countriesForRegion(el["region-filter"].value).includes(el["country-filter"].value)) {
    el["country-filter"].value = "";
  }
  setCityOptions(el["country-filter"].value, el["region-filter"].value);
});
el["country-filter"].addEventListener("change", () => {
  setCityOptions(el["country-filter"].value, el["region-filter"].value);
});
el["filter-form"].addEventListener("submit", () => {
  state.filters = {
    region: el["region-filter"].value,
    country: el["country-filter"].value,
    city: el["city-filter"].value,
    type: el["type-filter"].value,
    facility: el["facility-filter"].value,
  };
  state.sort = el["sort-filter"].value;
  state.pageSize = Number(el["page-size-filter"].value);
  state.page = 1;
  syncQuickFilterState(state.filters.type);
  syncRegionShortcutState(state.filters.region);
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
document.querySelectorAll("[data-quick-region]").forEach((button) => {
  button.addEventListener("click", () => {
    const nextRegion = state.filters.region === button.dataset.quickRegion
      ? ""
      : button.dataset.quickRegion;
    state.filters.region = nextRegion;
    state.filters.country = "";
    state.filters.city = "";
    state.page = 1;
    syncFilterControls();
    syncRegionShortcutState(nextRegion);
    render();
  });
});

function reportFormData() {
  const data = Object.fromEntries(new FormData(el["report-form"]).entries());
  return {
    nickname: data.nickname,
    email: data.email,
    visitDate: data.visitDate,
    airlineFlight: data.airlineFlight,
    cabinClass: data.cabinClass,
    accessSource: data.accessSource,
    entryResult: data.entryResult,
    queueLevel: data.queueLevel,
    crowdLevel: data.crowdLevel,
    foodRating: data.foodRating,
    restRating: data.restRating,
    overallRating: data.overallRating,
    body: data.body,
  };
}

async function renderCommunitySection(row) {
  const target = el["detail-content"].querySelector("[data-community-mount]");
  if (!target) return;
  target.innerHTML = communityReportsHtml([]);
  try {
    const result = await fetchApprovedReports(row);
    if (!result.enabled) {
      target.querySelector(".community-empty").textContent =
        "旅客回報後端尚未設定；目前只能查看官方資料。";
      return;
    }
    target.innerHTML = communityReportsHtml(result.reports);
  } catch {
    target.innerHTML = `<section class="community-section" data-community-section>
      <div class="community-heading"><div><p class="kicker">Traveler data points</p><h3>旅客 Data Points</h3></div>
      <button class="secondary-button" type="button" data-open-report-form>分享你的體驗</button></div>
      <p class="community-empty">旅客回報暫時載入失敗，不影響官方資料查詢。</p>
    </section>`;
  }
}

function openReportDialog() {
  if (!state.selected) return;
  el["report-form"].reset();
  el["report-status"].textContent = navigator.onLine
    ? "送出後會先進入待審，不會立即公開。"
    : "目前離線，請恢復網路後再投稿。";
  el["submit-report"].disabled = !navigator.onLine;
  el["report-lounge"].textContent =
    `${state.selected.airportCode} · ${state.selected.name} · 投稿需審核後才會公開。`;
  el["report-dialog"].showModal();
}

el["detail-content"].addEventListener("click", (event) => {
  const photoButton = event.target.closest("[data-lightbox-src]");
  if (photoButton) {
    openPhotoLightbox(
      photoButton.dataset.lightboxSrc,
      photoButton.querySelector("img")?.alt,
    );
    return;
  }
  if (event.target.closest("[data-open-report-form]")) openReportDialog();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePhotoLightbox();
});
el["close-report"].addEventListener("click", () => el["report-dialog"].close());
el["cancel-report"].addEventListener("click", () => el["report-dialog"].close());
el["report-form"].addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selected) return;
  if (!navigator.onLine) {
    el["report-status"].textContent = "目前離線，請恢復網路後再投稿。";
    return;
  }
  el["submit-report"].disabled = true;
  el["report-status"].textContent = "正在送出…";
  const photos = Array.from(el["report-photos"].files ?? []);
  try {
    const result = await submitCommunityReport(state.selected, reportFormData(), photos);
    if (result.ok) {
      el["report-status"].textContent = result.message;
      el["report-form"].reset();
    } else {
      const fieldErrors = Object.values(result.errors ?? {});
      const photoErrors = result.photoErrors ?? [];
      el["report-status"].textContent =
        [...fieldErrors, ...photoErrors].join(" ") || result.message || "投稿失敗，請稍後再試。";
    }
  } catch (error) {
    el["report-status"].textContent = error?.message || "投稿失敗，請稍後再試。";
  } finally {
    el["submit-report"].disabled = false;
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { type: "module" }).then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) showUpdateNotice();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateNotice();
          }
        });
      });
    }).catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (navigator.serviceWorker.controller) showUpdateNotice();
    });
  });
}

wirePwaEnhancements();
loadData();

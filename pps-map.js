const records = Array.isArray(window.PPS_RECORDS) ? window.PPS_RECORDS : [];
const recordsMeta = Object.freeze(window.PPS_RECORDS_META || {});
const locationZhByCode = Object.freeze(window.PPS_LOCATION_ZH || {});
const geoByCode = Object.freeze(window.PPS_AIRPORT_GEO || {});
const geoMeta = Object.freeze(window.PPS_AIRPORT_GEO_META || {});
const topFacilities = ["Digital card accepted", "Air conditioning", "Wi-Fi", "Soft drinks", "Disabled access", "Televisions", "Flight information", "Alcoholic drinks (Standard)", "Newspapers / magazines", "Showers", "Telephone", "Conference facilities", "Luggage storage", "Alcoholic drinks (Premium-brand)"];
const typeOrder = ["LOUNGE", "EAT", "REFRESH", "REST", "UNWIND"];
const typeMeta = Object.freeze({
  LOUNGE: { label: "貴賓室", color: "#0f7b76" },
  EAT: { label: "餐飲", color: "#df8f36" },
  REFRESH: { label: "淋浴／整理", color: "#893654" },
  REST: { label: "休息", color: "#29556d" },
  UNWIND: { label: "舒壓", color: "#4d6472" },
});
const countryZhOverrides = Object.freeze({
  "中華民國": "臺灣",
  "大韓民國": "韓國",
  "中華人民共和國": "中國",
  "阿拉伯聯合大公國": "阿聯",
});
const facilityLabels = Object.freeze({
  "A la carte menu": "單點餐點",
  "Air conditioning": "空調",
  "Alcoholic drinks (Premium-brand)": "高級酒精飲品",
  "Alcoholic drinks (Standard)": "標準酒精飲品",
  "Conference facilities": "會議空間",
  "Digital card accepted": "支援電子會員卡",
  "Disabled access": "無障礙設施",
  "Flight information": "航班資訊",
  "Luggage storage": "行李寄放",
  "Massage chairs": "按摩椅",
  "Newspapers / magazines": "報章雜誌",
  "Shoe shine": "擦鞋服務",
  "Showers": "淋浴間",
  "Soft drinks": "無酒精飲品",
  "Telephone": "電話",
  "Televisions": "電視",
  "Wi-Fi": "Wi‑Fi",
});
const dayLabels = Object.freeze({
  Monday: "週一",
  Tuesday: "週二",
  Wednesday: "週三",
  Thursday: "週四",
  Friday: "週五",
  Saturday: "週六",
  Sunday: "週日",
});

const state = {
  asiaOnly: false,
  country: "",
  city: "",
  type: "",
  facility: "",
  search: "",
  selectedAirportCode: String(new URLSearchParams(window.location.search).get("airport") || "").trim().toUpperCase(),
};

const el = {
  heroRecordCount: document.getElementById("heroRecordCount"),
  heroAirportCount: document.getElementById("heroAirportCount"),
  heroCountryCount: document.getElementById("heroCountryCount"),
  heroShowerCount: document.getElementById("heroShowerCount"),
  quickChips: document.getElementById("quickChips"),
  searchInput: document.getElementById("searchInput"),
  countryFilter: document.getElementById("countryFilter"),
  cityFilter: document.getElementById("cityFilter"),
  typeFilter: document.getElementById("typeFilter"),
  facilityFilter: document.getElementById("facilityFilter"),
  clearButton: document.getElementById("clearButton"),
  resultText: document.getElementById("resultText"),
  activeFilters: document.getElementById("activeFilters"),
  visibleAirportCount: document.getElementById("visibleAirportCount"),
  visibleRecordCount: document.getElementById("visibleRecordCount"),
  visibleCountryCount: document.getElementById("visibleCountryCount"),
  visibleShowerCount: document.getElementById("visibleShowerCount"),
  mapSummary: document.getElementById("mapSummary"),
  mapError: document.getElementById("mapError"),
  airportList: document.getElementById("airportList"),
  airportListBadge: document.getElementById("airportListBadge"),
  airportListNote: document.getElementById("airportListNote"),
  detailTitle: document.getElementById("detailTitle"),
  detailSubtitle: document.getElementById("detailSubtitle"),
  detailMeta: document.getElementById("detailMeta"),
  detailContent: document.getElementById("detailContent"),
};

const compareText = (a, b) => String(a).localeCompare(String(b), "en", { sensitivity: "base" });
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

let map = null;
let markerLayer = null;
const markerByCode = new Map();

function normalizeZhLabel(value) {
  const clean = String(value ?? "").trim();
  return countryZhOverrides[clean] || clean;
}

function cleanZhPlace(value) {
  let clean = normalizeZhLabel(value);
  for (const suffix of ["特別行政區", "特別市", "自治市", "直轄市", "縣", "市", "都", "州", "省", "區", "府"]) {
    if (clean.endsWith(suffix) && clean.length > suffix.length + 1) {
      clean = clean.slice(0, -suffix.length).trim();
      break;
    }
  }
  return clean;
}

function normalizeLatin(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatBilingualText(zh, en) {
  const primary = String(zh ?? "").trim();
  const fallback = String(en ?? "").trim();
  if (primary && fallback && primary.toLowerCase() !== fallback.toLowerCase()) {
    return `${primary} / ${fallback}`;
  }
  return primary || fallback || "未標示";
}

function getLocationZhEntry(record) {
  return locationZhByCode[record.airportCode] || null;
}

function getCountryZh(record) {
  return normalizeZhLabel(getLocationZhEntry(record)?.countryZh || "");
}

function getAirportZh(record) {
  return normalizeZhLabel(getLocationZhEntry(record)?.airportZh || "");
}

function getPlaceCandidatesZh(record, countryZh) {
  const items = getLocationZhEntry(record)?.placesZh || [];
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const clean = cleanZhPlace(item);
    if (!clean || clean === countryZh || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function deriveAirportShortZh(airportZh, countryZh) {
  let clean = normalizeZhLabel(airportZh);
  if (!clean) return "";
  clean = clean.replace(/(?:國際|國內)?(?:機場|空港|航空站)$/u, "").trim();
  if (countryZh && clean.startsWith(countryZh) && clean.length > countryZh.length + 1) {
    clean = clean.slice(countryZh.length).trim();
  }
  return clean;
}

function pickCityZh(record, airportShortZh, placeCandidates) {
  const cityToken = normalizeLatin(record.city);
  const airportToken = normalizeLatin(record.airportName);
  if (airportShortZh && cityToken && airportToken.includes(cityToken)) {
    return airportShortZh;
  }
  if (!placeCandidates.length) return airportShortZh;
  if (placeCandidates.length > 1 && airportShortZh && placeCandidates.includes(airportShortZh)) {
    return placeCandidates.find((item) => item !== airportShortZh) || placeCandidates[0];
  }
  return placeCandidates[0];
}

function replaceWithRules(text, rules) {
  let result = String(text ?? "");
  for (const [pattern, replacement] of rules) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function hasHeavyEnglish(text) {
  return /[A-Za-z][A-Za-z0-9&'(),.\-/:;+ ]{18,}/.test(String(text ?? ""));
}

function formatFacilityLabel(value) {
  return facilityLabels[value] || value;
}

function formatTerminalDisplay(value) {
  if (!value) return "未標示";
  return replaceWithRules(value, [
    [/New International Terminal/gi, "新國際航廈"],
    [/International Terminal/gi, "國際航廈"],
    [/Domestic Terminal/gi, "國內航廈"],
    [/Terminal (\d+)/gi, "第$1航廈"],
    [/Terminal/gi, "航廈"],
    [/Landside/gi, "管制區外"],
    [/Airside/gi, "管制區內"],
  ]).replace(/\s{2,}/g, " ").trim();
}

function formatLocationDisplay(value) {
  if (!value) return "未提供";
  return replaceWithRules(value, [
    [/New International Terminal/gi, "新國際航廈"],
    [/International Terminal/gi, "國際航廈"],
    [/Domestic Terminal/gi, "國內航廈"],
    [/Terminal (\d+)/gi, "第$1航廈"],
    [/Terminal/gi, "航廈"],
    [/Landside/gi, "管制區外"],
    [/Airside/gi, "管制區內"],
    [/Departure Level/gi, "出發樓層"],
    [/Arrivals?/gi, "抵達區"],
  ]).replace(/\s{2,}/g, " ").trim();
}

function translateHoursLine(line) {
  const value = String(line ?? "").trim();
  if (!value) return "";
  const dayMatch = value.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):\s*(.+)$/i);
  if (dayMatch) {
    const dayKey = dayMatch[1][0].toUpperCase() + dayMatch[1].slice(1).toLowerCase();
    return `${dayLabels[dayKey] || dayMatch[1]}：${translateHoursLine(dayMatch[2])}`;
  }
  const noteMatch = value.match(/^Note:\s*(.*)$/i);
  if (noteMatch) {
    return noteMatch[1] ? `備註：${translateHoursLine(noteMatch[1])}` : "備註：";
  }
  if (/^24 hours daily\.?$/i.test(value)) return "每日 24 小時營業";
  let result = replaceWithRules(value, [
    [/THIS LOUNGE IS TEMPORARILY CLOSED UNTIL FURTHER NOTICE\.?/gi, "此貴賓室暫時關閉，恢復開放時間另行公告。"],
    [/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}) daily\.?/gi, "每日 $1 至 $2"],
    [/(\d{2}:\d{2})\s*-\s*last flight\.?/gi, "$1 起至末班機前"],
    [/(\d+) hours? and (\d+) minutes before first flight\s*-\s*(\d+) minutes before last flight\.?/gi, "首班機前 $1 小時 $2 分鐘開放，至末班機前 $3 分鐘"],
    [/(\d+) hour and (\d+) minutes before first flight\s*-\s*(\d+) minutes before last flight\.?/gi, "首班機前 $1 小時 $2 分鐘開放，至末班機前 $3 分鐘"],
    [/(\d+) hours? before first flight\s*-\s*(\d+) minutes before last flight\.?/gi, "首班機前 $1 小時開放，至末班機前 $2 分鐘"],
    [/(\d+) hours? before first flight\s*-\s*last flight\.?/gi, "首班機前 $1 小時開放，至末班機前"],
    [/Hours may be subject to seasonal changes\.?/gi, "營業時間可能依季節調整。"],
    [/OPENING TIMES ON ([0-9A-Z]+):\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\.?/gi, "$1 開放時間為 $2 至 $3。"],
    [/Food service stops at (\d{2}:\d{2}) daily\.?/gi, "每日餐點供應至 $1。"],
    [/Based on scheduled departures/gi, "依表定航班時間調整"],
    [/Access may be restricted due to space constraints\.?/gi, "若現場客滿，可能限制入場。"],
    [/Closed 25 Dec\.?/gi, "12 月 25 日休息。"],
    [/Arrivals not accepted within 1 hour of closing\.?/gi, "距離關閉前 1 小時起不接受抵達旅客。"],
  ]).replace(/\s{2,}/g, " ").trim();
  if (hasHeavyEnglish(result)) return "此據點另有營業補充說明，請再開官方頁面查看英文細節。";
  if (!/[一-鿿]/.test(result) && (/US\$/i.test(value) || /value|spa|hair|nails|eyebrow/i.test(value))) {
    return "附加服務內容詳見原始英文說明。";
  }
  return result;
}

function formatOpeningHoursDisplay(value) {
  if (!value) return "未提供";
  const translated = [];
  for (const line of String(value).split(/\r?\n/)) {
    const item = translateHoursLine(line);
    if (item && !translated.includes(item)) translated.push(item);
  }
  return translated.length ? translated.join("\n") : "未提供";
}

function splitConditionSegments(value) {
  const source = String(value ?? "").trim();
  if (!source) return [];
  if (/\d+\.\s/.test(source)) return source.split(/(?=\d+\.\s)/).map((item) => item.trim()).filter(Boolean);
  if (source.includes(" - ")) return source.split(/\s+-\s+/).map((item) => item.trim()).filter(Boolean);
  return source.split(/,\s+(?=[A-Z0-9])/).map((item) => item.trim()).filter(Boolean);
}

function translateConditionSegment(segment) {
  const cleaned = String(segment ?? "").trim().replace(/^\d+\.\s*/, "");
  if (!cleaned) return "";
  let result = replaceWithRules(cleaned, [
    [/Maximum (\d+) hour stay \(prior to scheduled flight departure time only\)/gi, "最長可停留 $1 小時，且僅限表定起飛前使用"],
    [/Maximum (\d+) hour stay/gi, "最長可停留 $1 小時"],
    [/Children under (\d+) years are admitted free/gi, "$1 歲以下兒童可免費入場"],
    [/Children under (\d+) years admitted free/gi, "$1 歲以下兒童可免費入場"],
    [/Children under (\d+) years are not admitted\.?/gi, "$1 歲以下兒童不得入場"],
    [/Children are not admitted\.?/gi, "不開放兒童入場"],
    [/All children must be accompanied by an adult\.?/gi, "所有兒童須由成人陪同"],
    [/No smoking \(including vaping\)/gi, "禁止吸菸與電子煙"],
    [/No dress code/gi, "無服裝規定"],
    [/Smart casual dress at all times\.?/gi, "請穿著整潔便服"],
    [/Access may be restricted due to space constraints\.?/gi, "若現場客滿，可能限制入場。"],
    [/Quiet area\.?/gi, "設有安靜區"],
    [/Separate children'?s play area available\.?/gi, "設有兒童遊戲區。"],
    [/Separate prayer room available\.?/gi, "設有祈禱室。"],
    [/Separate prayer room\.?/gi, "設有祈禱室。"],
    [/Separate smoking room available\.?/gi, "設有吸菸室。"],
    [/Separate smoking room\.?/gi, "設有吸菸室。"],
    [/Computer workstations available\.?/gi, "設有電腦工作站。"],
    [/Workstations available\.?/gi, "設有工作區。"],
    [/Complimentary massage chairs available\.?/gi, "提供免費按摩椅。"],
    [/All food and beverages must be consumed inside the lounge\.?/gi, "餐飲僅限於貴賓室內享用。"],
    [/Complimentary drinks are limited to one per person\.?/gi, "每人免費飲品以 1 杯為限。"],
  ]).replace(/\s{2,}/g, " ").trim();
  if (hasHeavyEnglish(result)) {
    if (/bill|credit|meal|drinks|transaction|gratuity|Cardholders?/i.test(cleaned)) {
      return "此據點含餐飲或權益折抵規則，細節請看官方頁面。";
    }
    if (/massage|spa|hair|nails|eyebrow|treatment|US\$/i.test(cleaned)) {
      return "提供額外服務項目，細節請看官方頁面。";
    }
    return "此據點另有使用限制，細節請看官方頁面。";
  }
  if (!/[一-鿿]/.test(result)) return "此據點另有使用限制，細節請看官方頁面。";
  return result;
}

function formatConditionsDisplay(value) {
  if (!value) return "未提供";
  const translated = [];
  for (const segment of splitConditionSegments(value)) {
    const item = translateConditionSegment(segment);
    if (item && !translated.includes(item)) translated.push(item);
  }
  return translated.length ? translated.join("\n") : "未提供";
}

function getDisplayRecord(record) {
  if (!record._displayCache) {
    const location = formatLocationDisplay(record.location);
    const terminal = formatTerminalDisplay(record.terminal);
    const openingHours = formatOpeningHoursDisplay(record.openingHours);
    const conditions = formatConditionsDisplay(record.conditions);
    const facilities = record.facilities.map(formatFacilityLabel);
    const countryZh = getCountryZh(record);
    const airportZh = getAirportZh(record);
    const airportShortZh = deriveAirportShortZh(airportZh, countryZh);
    const cityZh = pickCityZh(record, airportShortZh, getPlaceCandidatesZh(record, countryZh));
    const countryDisplay = formatBilingualText(countryZh, record.country);
    const cityDisplay = formatBilingualText(cityZh, record.city);
    const airportDisplay = formatBilingualText(airportZh, record.airportName);
    const airportCodeLabelZh = cityZh || airportShortZh;
    record._displayCache = {
      location,
      terminal,
      openingHours,
      conditions,
      facilities,
      countryZh,
      cityZh,
      airportZh,
      airportShortZh,
      airportCodeLabelZh,
      countryDisplay,
      cityDisplay,
      airportDisplay,
      searchText: [
        record.searchText,
        countryZh,
        cityZh,
        airportZh,
        airportShortZh,
        airportCodeLabelZh,
        countryDisplay,
        cityDisplay,
        airportDisplay,
        location,
        terminal,
        openingHours,
        conditions,
        facilities.join(" "),
        record.typeLabel,
        record.isAsia ? "亞洲 中東" : "其他區域",
      ].join(" ").toLowerCase(),
    };
  }
  return record._displayCache;
}

function unique(values, ordered = []) {
  const seen = new Set();
  const result = [];
  for (const value of ordered) {
    if (values.includes(value) && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  for (const value of values.slice().sort(compareText)) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function populateSelect(select, values, current, label, formatter = (value) => value) {
  const safeValues = values.filter(Boolean);
  if (current && !safeValues.includes(current)) current = "";
  select.innerHTML = [`<option value="">${escapeHtml(label)}</option>`]
    .concat(
      safeValues.map((value) => {
        const selected = value === current ? " selected" : "";
        return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(formatter(value))}</option>`;
      }),
    )
    .join("");
  select.value = current;
  return current;
}

function getCountryOptionLabel(value) {
  const sample = records.find((record) => record.country === value);
  return sample ? getDisplayRecord(sample).countryDisplay : value;
}

function getCityOptionLabel(value) {
  const sample = records.find((record) => record.city === value && (!state.country || record.country === state.country));
  return sample ? getDisplayRecord(sample).cityDisplay : value;
}

function filterRecord(record) {
  if (state.asiaOnly && !record.isAsia) return false;
  if (state.country && record.country !== state.country) return false;
  if (state.city && record.city !== state.city) return false;
  if (state.type && record.type !== state.type) return false;
  if (state.facility && !record.facilities.includes(state.facility)) return false;
  if (state.search && !getDisplayRecord(record).searchText.includes(state.search.toLowerCase())) return false;
  return true;
}

function filteredRecords() {
  return records.filter(filterRecord);
}

function filteredForCity() {
  return records.filter((record) => {
    if (state.asiaOnly && !record.isAsia) return false;
    if (state.country && record.country !== state.country) return false;
    return true;
  });
}

function filteredForFacility() {
  return records.filter((record) => {
    if (state.asiaOnly && !record.isAsia) return false;
    if (state.country && record.country !== state.country) return false;
    if (state.city && record.city !== state.city) return false;
    if (state.type && record.type !== state.type) return false;
    return true;
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function buildTypeSummary(typeCounts) {
  return typeOrder
    .filter((type) => typeCounts[type])
    .map((type) => `${typeMeta[type]?.label || type} ${typeCounts[type]}`)
    .join(" ｜ ");
}

function getMarkerColor(typeCounts) {
  const activeTypes = typeOrder.filter((type) => typeCounts[type]);
  if (activeTypes.length === 1) return typeMeta[activeTypes[0]]?.color || "#4d6472";
  return "#4d6472";
}

function groupAirports(items) {
  const airports = new Map();
  for (const record of items) {
    const geo = geoByCode[record.airportCode];
    if (!geo) continue;
    const display = getDisplayRecord(record);
    const code = record.airportCode;
    if (!airports.has(code)) {
      airports.set(code, {
        code,
        lat: Number(geo.lat),
        lng: Number(geo.lng),
        source: geo.source || geoMeta.source || "座標資料",
        country: record.country,
        city: record.city,
        airportName: record.airportName,
        display,
        records: [],
        typeCounts: {},
        facilities: new Set(),
      });
    }
    const airport = airports.get(code);
    airport.records.push(record);
    airport.typeCounts[record.type] = (airport.typeCounts[record.type] || 0) + 1;
    for (const facility of display.facilities) airport.facilities.add(facility);
  }

  return Array.from(airports.values())
    .map((airport) => ({
      ...airport,
      airportDisplay: airport.display.airportDisplay,
      cityDisplay: airport.display.cityDisplay,
      countryDisplay: airport.display.countryDisplay,
      airportCodeDisplay: airport.display.airportCodeLabelZh ? `${airport.code} ｜ ${airport.display.airportCodeLabelZh}` : airport.code,
      count: airport.records.length,
      facilityList: Array.from(airport.facilities),
      markerColor: getMarkerColor(airport.typeCounts),
    }))
    .sort((a, b) =>
      (b.count - a.count) ||
      compareText(a.country, b.country) ||
      compareText(a.city, b.city) ||
      compareText(a.code, b.code)
    );
}

function getMarkerRadius(count) {
  return Math.min(18, 7 + Math.ceil(Math.sqrt(count) * 2));
}

function getActiveFilterSummary() {
  const filters = [];
  if (state.asiaOnly) filters.push("亞洲（含中東）");
  if (state.country) filters.push(`國家：${getCountryOptionLabel(state.country)}`);
  if (state.city) filters.push(`城市：${getCityOptionLabel(state.city)}`);
  if (state.type) filters.push(`類型：${typeMeta[state.type]?.label || state.type}`);
  if (state.facility) filters.push(`設施：${formatFacilityLabel(state.facility)}`);
  if (state.search) filters.push(`關鍵字：${state.search}`);
  return filters;
}

function renderQuickChips() {
  const chips = [
    {
      label: "亞洲（含中東）",
      active: state.asiaOnly,
      onClick: () => {
        state.asiaOnly = !state.asiaOnly;
        state.city = "";
        render();
      },
    },
    {
      label: "只看貴賓室",
      active: state.type === "LOUNGE",
      onClick: () => {
        state.type = state.type === "LOUNGE" ? "" : "LOUNGE";
        render();
      },
    },
    {
      label: "只看餐飲",
      active: state.type === "EAT",
      onClick: () => {
        state.type = state.type === "EAT" ? "" : "EAT";
        render();
      },
    },
    {
      label: "只看淋浴／整理",
      active: state.type === "REFRESH",
      onClick: () => {
        state.type = state.type === "REFRESH" ? "" : "REFRESH";
        render();
      },
    },
    {
      label: "含淋浴設施",
      active: state.facility === "Showers",
      onClick: () => {
        state.facility = state.facility === "Showers" ? "" : "Showers";
        render();
      },
    },
  ];

  el.quickChips.innerHTML = "";
  for (const chip of chips) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${chip.active ? " active" : ""}`;
    button.textContent = chip.label;
    button.addEventListener("click", chip.onClick);
    el.quickChips.appendChild(button);
  }
}

function syncInputs() {
  el.searchInput.value = state.search;
  el.countryFilter.value = state.country;
  el.cityFilter.value = state.city;
  el.typeFilter.value = state.type;
  el.facilityFilter.value = state.facility;
}

function renderFilterOptions() {
  const countryValues = unique(records.map((record) => record.country));
  const cityValues = unique(filteredForCity().map((record) => record.city));
  const typeValues = unique(records.map((record) => record.type), typeOrder);
  const facilityValues = unique(filteredForFacility().flatMap((record) => record.facilities), topFacilities);

  state.country = populateSelect(el.countryFilter, countryValues, state.country, "全部國家／地區", getCountryOptionLabel);
  state.city = populateSelect(el.cityFilter, cityValues, state.city, "全部城市", getCityOptionLabel);
  state.type = populateSelect(el.typeFilter, typeValues, state.type, "全部類型", (value) => typeMeta[value]?.label || value);
  state.facility = populateSelect(el.facilityFilter, facilityValues, state.facility, "全部設施", formatFacilityLabel);
  syncInputs();
}

function renderSummary(items, airports) {
  const visibleCountries = new Set(items.map((record) => record.country));
  const visibleShowers = items.filter((record) => record.facilities.includes("Showers")).length;
  el.visibleAirportCount.textContent = formatNumber(airports.length);
  el.visibleRecordCount.textContent = formatNumber(items.length);
  el.visibleCountryCount.textContent = formatNumber(visibleCountries.size);
  el.visibleShowerCount.textContent = formatNumber(visibleShowers);

  el.resultText.textContent = items.length
    ? `目前地圖顯示 ${formatNumber(airports.length)} 座機場、${formatNumber(items.length)} 筆據點。地圖點位已用 752 / 752 機場座標補齊。`
    : "目前沒有符合條件的據點。可以先清掉部分篩選，或改用機場代碼、城市、lounge 名稱搜尋。";

  el.mapSummary.textContent = items.length
    ? `共 ${formatNumber(airports.length)} 座機場、${formatNumber(items.length)} 筆據點。點任一標記即可看該機場整理結果。`
    : "沒有可顯示的標記。";

  const filterSummary = getActiveFilterSummary();
  el.activeFilters.innerHTML = filterSummary.length
    ? filterSummary.map((item) => `<span class="filter-pill">${escapeHtml(item)}</span>`).join("")
    : `<span class="filter-pill">目前沒有額外篩選</span>`;
}

function buildPopupHtml(airport) {
  return `
    <div class="popup">
      <h3>${escapeHtml(airport.airportCodeDisplay)}</h3>
      <p class="muted">${escapeHtml(airport.countryDisplay)} ｜ ${escapeHtml(airport.cityDisplay)}</p>
      <p class="muted">${escapeHtml(airport.airportDisplay)}</p>
      <div class="popup-meta">
        <span class="meta-tag">${escapeHtml(buildTypeSummary(airport.typeCounts) || `${airport.count} 筆據點`)}</span>
        <span class="meta-tag">${escapeHtml(`${airport.count} 筆據點`)}</span>
      </div>
    </div>
  `;
}

function initMap() {
  if (!window.L) {
    el.mapError.hidden = false;
    el.mapError.textContent = "Leaflet 沒有成功載入，地圖無法建立。";
    return false;
  }

  map = L.map("map", {
    worldCopyJump: true,
    preferCanvas: true,
    zoomSnap: 0.5,
    minZoom: 2,
  }).setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
  return true;
}

function autoFitMap(airports) {
  if (!map) return;
  if (!airports.length) {
    map.setView([20, 0], 2);
    return;
  }
  if (airports.length === 1) {
    map.setView([airports[0].lat, airports[0].lng], 6);
    return;
  }
  const bounds = L.latLngBounds(airports.map((airport) => [airport.lat, airport.lng]));
  map.fitBounds(bounds, { padding: [28, 28], maxZoom: 4 });
}

function renderMap(airports) {
  if (!markerLayer) return;
  markerLayer.clearLayers();
  markerByCode.clear();

  for (const airport of airports) {
    const marker = L.circleMarker([airport.lat, airport.lng], {
      radius: getMarkerRadius(airport.count),
      color: airport.markerColor,
      weight: 2,
      fillColor: airport.markerColor,
      fillOpacity: 0.34,
    });

    marker.bindPopup(buildPopupHtml(airport), { autoPanPadding: [24, 24] });
    marker.on("click", () => {
      selectAirport(airport.code, { panToMarker: false, openPopup: true });
    });

    marker.addTo(markerLayer);
    markerByCode.set(airport.code, marker);
  }

  if (!airports.some((airport) => airport.code === state.selectedAirportCode)) {
    state.selectedAirportCode = "";
  }

  renderDetail(state.selectedAirportCode ? airports.find((airport) => airport.code === state.selectedAirportCode) || null : null);
  autoFitMap(airports);
}

function renderAirportList(airports) {
  const limited = airports.slice(0, 24);
  el.airportListBadge.textContent = `前 ${limited.length} 筆`;
  el.airportList.innerHTML = limited.length
    ? limited.map((airport) => `
      <button class="airport-item${airport.code === state.selectedAirportCode ? " is-active" : ""}" type="button" data-airport-code="${escapeHtml(airport.code)}">
        <strong>${escapeHtml(airport.airportCodeDisplay)}</strong>
        <small>${escapeHtml(airport.countryDisplay)} ｜ ${escapeHtml(airport.cityDisplay)}</small>
        <small>${escapeHtml(buildTypeSummary(airport.typeCounts) || `${airport.count} 筆據點`)}</small>
      </button>
    `).join("")
    : `<div class="detail-empty">目前沒有符合條件的機場。</div>`;

  el.airportListNote.textContent = airports.length > limited.length
    ? `目前共 ${formatNumber(airports.length)} 座機場，左側先顯示前 ${limited.length} 座；其餘可直接從地圖上點選。`
    : airports.length
      ? `目前共 ${formatNumber(airports.length)} 座機場。`
      : "先調整篩選條件後，這裡會列出符合條件的機場。";

  el.airportList.querySelectorAll("[data-airport-code]").forEach((button) => {
    button.addEventListener("click", () => {
      selectAirport(button.getAttribute("data-airport-code"), { panToMarker: true, openPopup: true });
    });
  });
}

function renderDetail(airport) {
  if (!airport) {
    el.detailTitle.textContent = "選一個機場看詳情";
    el.detailSubtitle.textContent = "點地圖標記，或從左側清單點一個機場。";
    el.detailMeta.innerHTML = "";
    el.detailContent.className = "detail-empty";
    el.detailContent.textContent = "目前尚未選取機場。你可以先用篩選縮小範圍，再點任一標記查看該機場的據點清單。";
    return;
  }

  el.detailTitle.textContent = airport.airportCodeDisplay;
  el.detailSubtitle.textContent = `${airport.countryDisplay} ｜ ${airport.cityDisplay} ｜ ${airport.airportDisplay}`;
  el.detailMeta.innerHTML = [
    `<span class="meta-tag">${escapeHtml(`${airport.count} 筆據點`)}</span>`,
    `<span class="meta-tag">${escapeHtml(buildTypeSummary(airport.typeCounts) || "單一類型")}</span>`,
    `<span class="meta-tag">${escapeHtml(`座標來源：${airport.source}`)}</span>`,
  ].join("");

  const cards = airport.records
    .slice()
    .sort((a, b) => compareText(a.type, b.type) || compareText(a.name, b.name))
    .map((record) => {
      const display = getDisplayRecord(record);
      const badge = typeMeta[record.type] || { label: record.typeLabel || record.type, color: "#4d6472" };
      const facilities = display.facilities.length
        ? `<div class="facility-list">${display.facilities.map((item) => `<span class="facility-chip">${escapeHtml(item)}</span>`).join("")}</div>`
        : `<p class="muted">未提供設施資訊</p>`;
      return `
        <article class="detail-card">
          <div class="card-head">
            <div>
              <h3>${escapeHtml(record.name)}</h3>
              <p class="subline">${escapeHtml(display.location)}</p>
            </div>
            <span class="type-badge" style="--badge-color: ${escapeHtml(badge.color)};">${escapeHtml(badge.label)}</span>
          </div>
          <div class="subgrid">
            <div class="subbox">
              <small>機場代碼</small>
              <strong>${escapeHtml(display.airportCodeLabelZh ? `${record.airportCode} ｜ ${display.airportCodeLabelZh}` : record.airportCode)}</strong>
            </div>
            <div class="subbox">
              <small>航廈</small>
              <strong>${escapeHtml(display.terminal)}</strong>
            </div>
            <div class="subbox">
              <small>營業時間</small>
              <strong class="translated-copy">${escapeHtml(display.openingHours)}</strong>
            </div>
            <div class="subbox">
              <small>使用條件摘要</small>
              <strong class="translated-copy">${escapeHtml(display.conditions)}</strong>
            </div>
          </div>
          <div style="margin-top: 12px;">${facilities}</div>
          <div style="margin-top: 14px;">
            <a href="${escapeHtml(record.url)}" target="_blank" rel="noreferrer">查看 Priority Pass 官方頁面</a>
          </div>
        </article>
      `;
    })
    .join("");

  el.detailContent.className = "detail-grid";
  el.detailContent.innerHTML = cards;
}

function selectAirport(code, options = {}) {
  const safeCode = String(code || "").trim().toUpperCase();
  if (!safeCode) return;
  state.selectedAirportCode = safeCode;

  document.querySelectorAll("[data-airport-code]").forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-airport-code") === safeCode);
  });

  const items = filteredRecords();
  const airports = groupAirports(items);
  renderDetail(airports.find((entry) => entry.code === safeCode) || null);

  const marker = markerByCode.get(safeCode);
  if (marker && map) {
    if (options.panToMarker !== false) {
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 6), { animate: true });
    }
    if (options.openPopup) marker.openPopup();
  }
}

function render() {
  renderQuickChips();
  renderFilterOptions();
  const items = filteredRecords();
  const airports = groupAirports(items);
  renderSummary(items, airports);
  renderAirportList(airports);
  renderMap(airports);
  if (state.selectedAirportCode && airports.some((airport) => airport.code === state.selectedAirportCode)) {
    selectAirport(state.selectedAirportCode, { panToMarker: false, openPopup: false });
  }
}

function resetFilters() {
  state.asiaOnly = false;
  state.country = "";
  state.city = "";
  state.type = "";
  state.facility = "";
  state.search = "";
  state.selectedAirportCode = "";
  render();
}

function wireEvents() {
  el.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    state.selectedAirportCode = "";
    render();
  });
  el.countryFilter.addEventListener("change", (event) => {
    state.country = event.target.value;
    state.city = "";
    state.selectedAirportCode = "";
    render();
  });
  el.cityFilter.addEventListener("change", (event) => {
    state.city = event.target.value;
    state.selectedAirportCode = "";
    render();
  });
  el.typeFilter.addEventListener("change", (event) => {
    state.type = event.target.value;
    state.selectedAirportCode = "";
    render();
  });
  el.facilityFilter.addEventListener("change", (event) => {
    state.facility = event.target.value;
    state.selectedAirportCode = "";
    render();
  });
  el.clearButton.addEventListener("click", resetFilters);
}

function renderHeroStats() {
  const showerCount = records.filter((record) => record.facilities.includes("Showers")).length;
  const airportCount = Object.keys(geoByCode).length || Number(recordsMeta.airportCount || 0);
  const countryCount = Number(recordsMeta.countryCount || new Set(records.map((record) => record.country)).size);
  el.heroRecordCount.textContent = formatNumber(records.length);
  el.heroAirportCount.textContent = formatNumber(airportCount);
  el.heroCountryCount.textContent = formatNumber(countryCount);
  el.heroShowerCount.textContent = formatNumber(showerCount);
}

function boot() {
  renderHeroStats();
  wireEvents();
  if (!initMap()) return;
  render();
  if (state.selectedAirportCode) {
    selectAirport(state.selectedAirportCode, { panToMarker: true, openPopup: true });
  }
}

boot();

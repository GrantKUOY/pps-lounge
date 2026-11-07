// W4 深連結產生器：為範圍內機場產生靜態機場頁與貴賓室頁，
// 作為渠道著陸點與 SEO 面；主站（index.html 彈窗）行為不受影響。
//
// 用法：npm run generate
// 輸入：data/lounges.json、data/page-scope.json、data/meta.json、
//       data/localization/city-names-zh-tw.json
// 輸出：airport/{code}/index.html、lounge/{slug}/index.html、sitemap.xml
// 決定性：輸出只由輸入資料決定（查證標籤以 dataUpdatedAt 為基準日），
//         同一份資料重跑產生完全相同的檔案。

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  escapeHtml,
  formatConditions,
  formatFacility,
  formatLocation,
  formatOpeningHours,
  formatTerminal,
  safeExternalUrl,
  verifiedLabel,
} from "../assets/formatters.js";
import {
  configureLocalizedNames,
  displayCityName,
  displayCountryName,
} from "../assets/localized-names.js";
import { matchFirstParty } from "../assets/first-party.js";
import { buildLoungeSlugs } from "./slug.mjs";

const SITE_ORIGIN = "https://pps-lounge.vercel.app";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DISCLAIMER =
  "非官方整理站，入場資格與營業狀態以 Priority Pass 官網及現場公告為準。";
const OG_IMAGE = `${SITE_ORIGIN}/icons/og-1200x630.png`;

const readJson = (relative) =>
  JSON.parse(readFileSync(path.join(ROOT, relative), "utf8"));

const rows = readJson("data/lounges.json");
const scope = readJson("data/page-scope.json");
const firstPartyEntries = readJson("data/first-party.json");
const meta = readJson("data/meta.json");
const dataUpdatedAt = meta.dataUpdatedAt;
const referenceNow = new Date(`${dataUpdatedAt}T00:00:00Z`);

configureLocalizedNames({
  cityNamesZhTw: readJson("data/localization/city-names-zh-tw.json"),
});

const slugs = buildLoungeSlugs(rows);
const rowBySlug = new Map(rows.map((row, index) => [slugs[index], row]));

// 條件節錄：取原始 conditions 前 2 段，沿用主站 formatConditions 的轉換。
function conditionsExcerpt(value) {
  if (!value) return "未提供";
  const text = String(value);
  let segments;
  if (text.includes(" - ")) segments = text.split(/\s+-\s+/);
  else if (text.includes("; ")) segments = text.split(/;\s+/);
  else segments = text.split(/,\s+(?=[A-Z])/);
  const picked = segments.map((s) => s.trim()).filter(Boolean).slice(0, 2);
  return picked.length ? formatConditions(picked.join(" - ")) : "未提供";
}

const multiline = (text) => escapeHtml(text).replaceAll("\n", "<br>");

function officialLink(row) {
  const safeUrl = safeExternalUrl(row.url);
  const officialUrl =
    safeUrl &&
    ["www.prioritypass.com", "my.prioritypass.com"].includes(
      new URL(safeUrl).hostname.toLowerCase(),
    )
      ? safeUrl
      : "";
  return officialUrl
    ? `<a class="official-link" href="${escapeHtml(officialUrl)}" target="_blank" rel="noreferrer noopener">開啟 Priority Pass 官方頁面 ↗</a>`
    : '<p class="official-missing">目前沒有可用的官方詳情連結。</p>';
}

// 第一方實測接線：命中對照檔的據點回連部落格實測文。
function firstPartyFor(row) {
  const entry = matchFirstParty(row, firstPartyEntries);
  if (!entry) return null;
  const url = safeExternalUrl(entry.articleUrl);
  return url ? { ...entry, articleUrl: url } : null;
}

function firstPartyMark(entry) {
  return entry ? ` · <span class="first-party-mark">站長實測</span>` : "";
}

function firstPartyLink(entry, indent = "    ") {
  if (!entry) return "";
  return `\n${indent}<p><a class="official-link" href="${escapeHtml(entry.articleUrl)}" target="_blank" rel="noreferrer noopener">看站長實測：${escapeHtml(entry.articleTitle ?? "")} ↗</a></p>`;
}

function pageHead({ title, description, canonical }) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta name="theme-color" content="#5a1f2b">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22><rect width=%2264%22 height=%2264%22 rx=%2218%22 fill=%22%231d1d1f%22/><text x=%2232%22 y=%2243%22 text-anchor=%22middle%22 font-size=%2236%22 font-family=%22Arial%22 font-weight=%22700%22 fill=%22white%22>P</text></svg>">
  <link rel="stylesheet" href="../../assets/styles.css">
</head>`;
}

const masthead = `  <header class="masthead">
    <a class="journal-wordmark" href="../../">PPS Journal</a>
    <span class="edition">GLOBAL AIRPORT EDIT · 中文</span>
  </header>`;

function airportPage(code, airportRows) {
  const first = airportRows[0];
  const codeLower = code.toLowerCase();
  const canonical = `${SITE_ORIGIN}/airport/${codeLower}/`;
  const sorted = [...airportRows].sort((a, b) =>
    `${a.terminal ?? ""}|${a.name}`.localeCompare(
      `${b.terminal ?? ""}|${b.name}`,
    ),
  );

  const typeCounts = new Map();
  const terminalCounts = new Map();
  for (const row of airportRows) {
    typeCounts.set(row.typeLabel, (typeCounts.get(row.typeLabel) ?? 0) + 1);
    const label = formatTerminal(row.terminal);
    terminalCounts.set(label, (terminalCounts.get(label) ?? 0) + 1);
  }
  const typeSummary = [...typeCounts.entries()]
    .map(([label, count]) => `${label} ${count} 間`)
    .join("、");
  const terminalSummary = [...terminalCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => `${label} ${count} 間`)
    .join("、");

  const listItems = sorted
    .map((row) => {
      const slug = slugs[rows.indexOf(row)];
      const firstParty = firstPartyFor(row);
      const articleLink = firstParty
        ? `\n          <p><a class="text-action" href="${escapeHtml(firstParty.articleUrl)}" target="_blank" rel="noreferrer noopener">看站長實測：${escapeHtml(firstParty.articleTitle ?? "")} →</a></p>`
        : "";
      return `      <article class="result-row">
        <p class="result-kicker">${escapeHtml(formatTerminal(row.terminal))} · ${escapeHtml(row.typeLabel)}${firstPartyMark(firstParty)}</p>
        <div class="result-body"><div>
          <h3><a href="../../lounge/${slug}/">${escapeHtml(row.name)}</a></h3>
          <p>${escapeHtml(formatLocation(row.location))}</p>
        </div></div>
        <p>營業時間：${multiline(formatOpeningHours(row.openingHours))}</p>${articleLink}
      </article>`;
    })
    .join("\n");

  const title = `${code} ${first.airportName}｜Priority Pass 據點一覽 — PPS Lounge`;
  const description = `${first.airportName}（${code}）共 ${airportRows.length} 間 Priority Pass 據點：${typeSummary}。營業時間、航廈分布與使用條件中文整理。`;

  return `${pageHead({ title, description, canonical })}
<body>
${masthead}
  <main>
    <p class="kicker">Airport guide</p>
    <div class="detail-heading">
      <span class="detail-code">${escapeHtml(code)}</span>
      <h2>${escapeHtml(first.airportName)}</h2>
      <p>${escapeHtml(displayCityName(first.city))} · ${escapeHtml(displayCountryName(first.country))}</p>
    </div>
    <p class="data-note">本機場資料整理：${escapeHtml(dataUpdatedAt)}</p>
    <dl class="detail-facts">
      <div class="detail-fact"><dt>據點數</dt><dd>共 ${airportRows.length} 間（${escapeHtml(typeSummary)}）</dd></div>
      <div class="detail-fact"><dt>航廈分布</dt><dd>${escapeHtml(terminalSummary)}</dd></div>
    </dl>
    <section class="results-journal" aria-label="據點營業時間對照">
      <div class="results-heading"><h2>營業時間對照</h2></div>
      <div class="result-list">
${listItems}
      </div>
    </section>
    <p><a class="text-action" href="../../">回主站搜尋更多機場 →</a></p>
    <p class="data-note">${DISCLAIMER}</p>
  </main>
</body>
</html>
`;
}

function loungePage(row, slug) {
  const code = row.airportCode;
  const codeLower = code.toLowerCase();
  const canonical = `${SITE_ORIGIN}/lounge/${slug}/`;
  const facilities =
    row.facilities.map(formatFacility).join("、") || "未提供";
  const title = `${row.name}（${code}）｜Priority Pass 據點 — PPS Lounge`;
  const description = `${row.airportName} 的 ${row.name}：${formatTerminal(row.terminal)}，營業時間 ${formatOpeningHours(row.openingHours).replaceAll("\n", "；")}。設施與使用條件中文整理。`;

  return `${pageHead({ title, description, canonical })}
<body>
${masthead}
  <main>
    <p><a class="text-action" href="../../airport/${codeLower}/">← 回 ${escapeHtml(row.airportName)} 全部據點</a></p>
    <header class="detail-heading">
      <span class="detail-code">${escapeHtml(code)}</span>
      <h2>${escapeHtml(code)} · ${escapeHtml(row.name)}</h2>
      <p>${escapeHtml(row.airportName)} · ${escapeHtml(formatTerminal(row.terminal))}</p>
    </header>
    <p class="data-note">${DISCLAIMER}</p>
    <p class="data-note">${escapeHtml(verifiedLabel(row, referenceNow))}</p>
    <dl class="detail-facts">
      <div class="detail-fact"><dt>位置</dt><dd>${escapeHtml(formatLocation(row.location))}</dd></div>
      <div class="detail-fact"><dt>營業時間</dt><dd>${multiline(formatOpeningHours(row.openingHours))}</dd></div>
      <div class="detail-fact"><dt>設施</dt><dd>${escapeHtml(facilities)}</dd></div>
      <div class="detail-fact"><dt>使用條件（節錄）</dt><dd>${multiline(conditionsExcerpt(row.conditions))}</dd></div>
    </dl>
    <p class="data-note">條件節錄，完整條件以官網為準。</p>
    ${officialLink(row)}${firstPartyLink(firstPartyFor(row))}
    <p><a class="text-action" href="../../airport/${codeLower}/">回 ${escapeHtml(code)} 機場頁 →</a>　<a class="text-action" href="../../">回主站搜尋</a></p>
    <p class="data-note">資料可能變動；出發前請以 Priority Pass 官方頁面及現場公告為準。</p>
  </main>
</body>
</html>
`;
}

// ---- 產生 ----
for (const dir of ["airport", "lounge"]) {
  rmSync(path.join(ROOT, dir), { recursive: true, force: true });
}

const scopeCodes = scope.airports;
const presentCodes = scopeCodes.filter((code) =>
  rows.some((row) => row.airportCode === code),
);
const missingCodes = scopeCodes.filter(
  (code) => !presentCodes.includes(code),
);

const sitemapUrls = [
  { loc: `${SITE_ORIGIN}/` },
  { loc: `${SITE_ORIGIN}/map.html` },
];

let loungePageCount = 0;
for (const code of presentCodes) {
  const codeLower = code.toLowerCase();
  const airportRows = rows.filter((row) => row.airportCode === code);
  const dir = path.join(ROOT, "airport", codeLower);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), airportPage(code, airportRows));
  sitemapUrls.push({
    loc: `${SITE_ORIGIN}/airport/${codeLower}/`,
    lastmod: dataUpdatedAt,
  });

  for (const row of airportRows) {
    const slug = slugs[rows.indexOf(row)];
    const loungeDir = path.join(ROOT, "lounge", slug);
    mkdirSync(loungeDir, { recursive: true });
    writeFileSync(path.join(loungeDir, "index.html"), loungePage(row, slug));
    sitemapUrls.push({
      loc: `${SITE_ORIGIN}/lounge/${slug}/`,
      lastmod: dataUpdatedAt,
    });
    loungePageCount += 1;
  }
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (entry) =>
      `  <url><loc>${entry.loc}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}</url>`,
  )
  .join("\n")}
</urlset>
`;
writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);

console.log(
  JSON.stringify(
    {
      scopeAirports: scopeCodes.length,
      generatedAirports: presentCodes.length,
      missingAirports: missingCodes,
      loungePages: loungePageCount,
      sitemapUrls: sitemapUrls.length,
      sampleSlug: rowBySlug.size ? [...rowBySlug.keys()][0] : null,
    },
    null,
    2,
  ),
);

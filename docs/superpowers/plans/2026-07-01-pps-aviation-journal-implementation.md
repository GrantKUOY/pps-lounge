# PPS Aviation Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 PPS Lounge v2 改造成已核准的「航空編輯誌 × 搜尋工具」，同步正式 KEF／TPE 資料，維持手機搜尋效能並完成可重現驗證。

**Architecture:** 保留 `assets/search.js` 的索引、篩選、排序與分頁核心；新增純函式 `assets/presentation.js` 負責結果、機場摘要與詳情 HTML，讓 `assets/app.js` 專注於狀態及事件。資料仍由可重建腳本產生，但增加人工下架資料與 TPE URL 正規化；視覺以 repo 根目錄 `DESIGN.md` 與 CSS tokens 為唯一來源。

**Tech Stack:** Semantic HTML、CSS custom properties、ES modules、Node.js test runner、Playwright Chromium、靜態 JSON、Python HTTP server。

---

## 實作前提與檔案責任

- `DESIGN.md`：PPS 專屬品牌、tokens、元件與禁止模式；優先於任何外部 skill。
- `index.html`：語意結構、搜尋、結果、篩選、狀態與詳情 dialog。
- `assets/styles.css`：Aviation Journal tokens、響應式與元件樣式。
- `assets/app.js`：資料載入、狀態、事件、debounce 與 DOM 協調。
- `assets/presentation.js`：純函式 HTML 產生器與機場摘要。
- `assets/search.js`：保留既有搜尋、篩選、排序與分頁演算法。
- `scripts/extract-live-data.mjs`：由基準資料產生 `data/lounges.json`，處理人工新增、人工下架與 URL 正規化。
- `data/manual-additions.json`：保留 KEF Elda。
- `data/manual-removals.json`：保存 TPE Zone A 下架依據。
- `tests/presentation.test.mjs`：呈現純函式、跳脫與禁止模式。
- `tests/data.test.mjs`：1,754 筆、TPE 6 筆、KEF 兩筆與現行 URL。
- `tests/ui.spec.mjs`：核心流程、視覺結構、響應式、效能及無障礙。
- `README.md`：資料基準、設計規範、驗證與預覽操作。

## Task 1：安裝設計技能並建立專案 DESIGN.md

**Files:**
- Create: `DESIGN.md`
- Modify: `.gitignore`
- Reference: `docs/superpowers/specs/2026-07-01-pps-aviation-journal-design.md`

- [ ] **Step 1：確認 worktree 與分支隔離**

Run:

```bash
pwd
git branch --show-current
git status --short --branch
```

Expected:

```text
/home/grant/.config/superpowers/worktrees/pps-lounge/redesign-v2
redesign-v2
```

只允許 `.superpowers/` 為既有未追蹤內容；若出現其他未預期修改，停止並回報。

- [ ] **Step 2：安裝核准的設計技能**

Run:

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design -g -y
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines -g -y
npx skills list -g
```

Expected: 全域清單包含 `frontend-design` 與 `web-design-guidelines`。執行任何 skill 前先讀取各自完整 `SKILL.md`；專案 `DESIGN.md` 的 tokens 與元件規則優先。

- [ ] **Step 3：建立根目錄 DESIGN.md**

Create `DESIGN.md` with:

```markdown
# PPS Aviation Journal Design System

## Design thesis

像一本懂機場的旅行刊物，也像一件可靠的隨身工具。

## Source of truth

本文件是 PPS Lounge 的最高視覺依據。外部 Apple、Clean、frontend-design
或 web-design-guidelines 只能協助實作與檢查，不得覆蓋本文件的品牌 tokens、
字體角色、資訊架構與禁止模式。

## Tokens

| Token | Value | Role |
|---|---|---|
| `--paper` | `#F3EFE5` | 主畫布 |
| `--paper-raised` | `#FAF7EF` | 必須區分層級時使用 |
| `--ink` | `#202522` | 主文字與線條 |
| `--ink-muted` | `#65645E` | 次要資料 |
| `--oxblood` | `#8F2639` | 唯一品牌互動色 |
| `--rule` | `#B8B0A1` | 分隔線 |
| `--error` | `#A32D24` | 錯誤 |
| `--success` | `#35624A` | 成功或可用 |

## Typography

- 場所名稱與編輯標題：`Noto Serif TC`, `Source Han Serif TC`, `Georgia`, serif。
- 操作、資料與正文：`Noto Sans TC`, system-ui, sans-serif。
- 機場代碼：無襯線粗體、緊字距，只用於真實機場導航。
- 襯線字不得用於按鈕、表單、密集資料與長條件。

## Layout

- 搜尋優先；390 × 844px 搜尋後首屏看得到第一筆結果。
- 品牌序言最多兩行，不使用巨型 Hero 或自動收合動畫。
- 結果採細線分隔清單，不採卡片牆。
- 詳情採資料列，不採卡片套卡片。
- 主要層級依靠字級、間距與細線。

## Components

- Search：120ms debounce，輸入時不得重建篩選選項。
- Overview：機場代碼、機場名稱、結果數及航廈數。
- Quick filters：只保留全部、貴賓室、餐飲與進階篩選入口。
- Result row：航廈／類型、名稱、位置、時間、最多三項重要設施。
- Detail：位置、營業時間、設施、條件、原文、官方 HTTPS 連結。
- Dialog：只在浮層使用低對比陰影；關閉後焦點回到觸發元件。

## Prohibited patterns

- Apple Action Blue
- 裝飾漸層與玻璃擬態
- 巨型置中 Hero
- 卡片牆與卡片套卡片
- 大量膠囊標籤
- 非浮層陰影
- 虛構期號、假引言或無資料意義的編輯裝飾

## Quality gates

- WCAG 2.2 AA。
- 可見按鈕、輸入與 select 至少 44px。
- 320、375、390、768、1024px 無水平溢出。
- 6 倍 CPU 降速時，輸入至結果可見小於 250ms。
- 快速輸入 `T → TP → TPE` 只渲染一次。
- 支援鍵盤、focus-visible、aria-live 與 reduced-motion。
```

- [ ] **Step 4：忽略 visual companion 暫存目錄**

Append to `.gitignore`:

```gitignore
.superpowers/
```

- [ ] **Step 5：驗證規範內容**

Run:

```bash
rg -n "PPS Aviation Journal|#8F2639|Prohibited patterns|250ms" DESIGN.md
git diff --check
```

Expected: 四個查詢均命中，`git diff --check` 無輸出。

- [ ] **Step 6：提交設計治理**

```bash
git add DESIGN.md .gitignore
git commit -m "docs: add PPS Aviation Journal design system"
```

## Task 2：以 TDD 同步正式 KEF／TPE 資料

**Files:**
- Create: `data/manual-removals.json`
- Modify: `scripts/extract-live-data.mjs:3-94`
- Modify: `scripts/validate-data.mjs:3-8`
- Modify: `tests/data.test.mjs:17-80`
- Modify: `package.json:5-9`
- Modify: `data/lounges.json`（由腳本產生）

- [ ] **Step 1：先把正式資料要求寫入失敗測試**

Replace the first test in `tests/data.test.mjs` and add the TPE test:

```js
test("正式資料固定為 1754 筆且必要欄位存在", async () => {
  const rows = JSON.parse(
    await readFile(new URL("../data/lounges.json", import.meta.url), "utf8"),
  );

  assert.equal(rows.length, 1754);
  for (const row of rows) {
    assert.match(row.airportCode, /^[A-Z0-9]{3}$/);
    assert.equal(typeof row.airportName, "string");
    assert.equal(typeof row.name, "string");
    assert.equal(typeof row.searchText, "string");
    assert.ok(Array.isArray(row.facilities));
  }
});

test("TPE 只保留官方現列 6 筆並使用 taiwan-region URL", async () => {
  const rows = JSON.parse(
    await readFile(new URL("../data/lounges.json", import.meta.url), "utf8"),
  );
  const tpe = rows.filter((row) => row.airportCode === "TPE");

  assert.equal(tpe.length, 6);
  assert.ok(
    !tpe.some((row) => row.name === "Plaza Premium Lounge (Zone A)"),
  );
  for (const row of tpe) {
    assert.match(
      row.url,
      /^https:\/\/www\.prioritypass\.com\/en-GB\/lounges\/taiwan-region\/taiwan-taoyuan-international\//,
    );
  }
});
```

In the URL preservation test, compare against a normalized expected URL:

```js
function canonicalizeOfficialUrl(url) {
  return String(url ?? "").replace(
    "https://my.prioritypass.com/en-GB/lounges/taiwan/",
    "https://www.prioritypass.com/en-GB/lounges/taiwan-region/",
  );
}
```

Replace `assert.equal(row.url, candidates[0].url, ...)` with:

```js
assert.equal(
  row.url,
  canonicalizeOfficialUrl(candidates[0].url),
  `${row.airportCode} ${row.name} 的官方網址不應遺失`,
);
```

- [ ] **Step 2：執行測試並確認 RED**

Run:

```bash
node --test --test-name-pattern="正式資料|TPE|KEF" tests/data.test.mjs
```

Expected: FAIL，現有資料仍為 1,755 筆且 TPE 為 7 筆。

- [ ] **Step 3：建立人工下架依據**

Create `data/manual-removals.json`:

```json
[
  {
    "airportCode": "TPE",
    "type": "LOUNGE",
    "name": "Plaza Premium Lounge (Zone A)",
    "slug": "tpe8-plaza-premium-lounge-zone-a",
    "source": "https://www.prioritypass.com/en-GB/lounges/taiwan-region/taiwan-taoyuan-international",
    "reason": "Priority Pass 官方 TPE 清單於 2026-06-30 已不再列出此貴賓室"
  }
]
```

- [ ] **Step 4：擴充抽取腳本**

Change the argument block in `scripts/extract-live-data.mjs` to:

```js
const source = process.argv[2];
const supplementalSource = process.argv[3];
const manualAdditionsSource = process.argv[4];
const manualRemovalsSource = process.argv[5];

if (
  !source ||
  !supplementalSource ||
  !manualAdditionsSource ||
  !manualRemovalsSource
) {
  throw new Error(
    "usage: node scripts/extract-live-data.mjs <html> <pps-records.js> <manual-additions.json> <manual-removals.json>",
  );
}
```

Change `const rows = JSON.parse(match[1]);` to:

```js
let rows = JSON.parse(match[1]);
```

After URL backfill and before manual additions, insert:

```js
function canonicalizeOfficialUrl(url) {
  return String(url ?? "").replace(
    "https://my.prioritypass.com/en-GB/lounges/taiwan/",
    "https://www.prioritypass.com/en-GB/lounges/taiwan-region/",
  );
}

function rowSlug(row) {
  if (!row.url) return "";
  return new URL(row.url).pathname.split("/").at(-1);
}

for (const row of rows) {
  if (row.airportCode === "TPE") {
    row.url = canonicalizeOfficialUrl(row.url);
  }
}

const manualRemovals = JSON.parse(
  await readFile(manualRemovalsSource, "utf8"),
);
if (!Array.isArray(manualRemovals)) {
  throw new Error("manual removals must be an array");
}
const removalSlugs = new Set(manualRemovals.map((row) => row.slug));
const originalCount = rows.length;
rows = rows.filter((row) => !removalSlugs.has(rowSlug(row)));
const removedRows = originalCount - rows.length;
```

Replace the final log with:

```js
console.log(
  `wrote ${rows.length} rows; backfilled ${backfilledUrls} URLs; removed ${removedRows}; added ${addedRows} manually verified rows`,
);
```

- [ ] **Step 5：更新命令與驗證筆數**

Change `package.json`:

```json
"extract": "node scripts/extract-live-data.mjs .baseline/index.production.html pps-records.js data/manual-additions.json data/manual-removals.json"
```

Change `scripts/validate-data.mjs`:

```js
if (rows.length !== 1754) {
  errors.push(`expected 1754 rows, got ${rows.length}`);
}
```

- [ ] **Step 6：重建資料並確認 GREEN**

Run:

```bash
npm run extract
npm run validate
npm test
```

Expected:

```text
wrote 1754 rows; backfilled 17 URLs; removed 1; added 1 manually verified rows
validated 1754 rows across 752 airports
```

All Node tests pass.

- [ ] **Step 7：驗證抽取冪等**

Run:

```bash
sha256sum data/lounges.json > /tmp/pps-v2-data-before.sha
npm run extract
sha256sum data/lounges.json > /tmp/pps-v2-data-after.sha
diff -u /tmp/pps-v2-data-before.sha /tmp/pps-v2-data-after.sha
```

Expected: `diff` 無輸出。

- [ ] **Step 8：提交資料同步**

```bash
git add data/manual-removals.json data/lounges.json scripts/extract-live-data.mjs scripts/validate-data.mjs tests/data.test.mjs package.json
git commit -m "fix: sync current KEF and TPE data"
```

## Task 3：建立可測試的 Aviation Journal 呈現模組

**Files:**
- Create: `assets/presentation.js`
- Create: `tests/presentation.test.mjs`
- Modify: `assets/app.js:1-18`

- [ ] **Step 1：建立呈現失敗測試**

Create `tests/presentation.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  airportOverview,
  detailHtml,
  resultRowHtml,
  visibleFacilities,
} from "../assets/presentation.js";

const row = {
  _searchOrder: 3,
  airportCode: "TPE",
  airportName: "Taiwan Taoyuan International Airport",
  country: "Taiwan",
  city: "Taipei",
  type: "LOUNGE",
  typeLabel: "貴賓室",
  name: "Oriental <Club>",
  terminal: "Terminal 2",
  location: "Airside, Zone D",
  openingHours: "05:00 - 23:00 daily",
  conditions: "Maximum 3 hour stay",
  facilities: ["Soft drinks", "Wi-Fi", "Showers", "Flight information"],
  url: "https://www.prioritypass.com/example",
};

test("結果列使用編輯式清單且只顯示三項重要設施", () => {
  const html = resultRowHtml(row);
  assert.match(html, /class="result-row"/);
  assert.match(html, /Oriental &lt;Club&gt;/);
  assert.match(html, /Terminal 2/);
  assert.doesNotMatch(html, /result-card|meta-box|type-badge/);
  assert.deepEqual(visibleFacilities(row), [
    "Showers",
    "Wi-Fi",
    "Flight information",
  ]);
});

test("精確機場查詢產生真實機場摘要", () => {
  const overview = airportOverview(
    [row, { ...row, _searchOrder: 4, type: "EAT", terminal: "Terminal 1" }],
    "TPE",
  );
  assert.deepEqual(overview, {
    code: "TPE",
    airportName: "Taiwan Taoyuan International Airport",
    count: 2,
    terminalCount: 2,
    loungeCount: 1,
    diningCount: 1,
  });
  assert.equal(airportOverview([row], "Tai"), null);
});

test("詳情採資料列並只輸出安全官方網址", () => {
  const html = detailHtml(row);
  assert.match(html, /class="detail-fact"/);
  assert.match(html, /開啟 Priority Pass 官方頁面/);
  assert.doesNotMatch(html, /detail-section|meta-box/);

  const unsafe = detailHtml({ ...row, url: "javascript:alert(1)" });
  assert.doesNotMatch(unsafe, /official-link/);
});
```

- [ ] **Step 2：確認測試因模組不存在而失敗**

Run:

```bash
node --test tests/presentation.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3：實作純呈現函式**

Create `assets/presentation.js`:

```js
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
  const officialUrl = safeExternalUrl(row.url);
  const facilities = row.facilities.map(formatFacility).join("、") || "未提供";
  const officialLink = officialUrl
    ? `<a class="official-link" href="${escapeHtml(officialUrl)}" target="_blank" rel="noreferrer noopener">開啟 Priority Pass 官方頁面 ↗</a>`
    : `<p class="official-missing">目前沒有可用的官方詳情連結。</p>`;

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
    <p class="data-note">資料可能變動；出發前請以 Priority Pass 官方頁面及現場公告為準。</p>`;
}
```

- [ ] **Step 4：執行呈現與完整 unit tests**

Run:

```bash
node --test tests/presentation.test.mjs
npm test
```

Expected: 呈現測試 3 項通過，完整 unit suite 全數通過。

- [ ] **Step 5：先提交獨立純函式模組**

```bash
git add assets/presentation.js tests/presentation.test.mjs
git commit -m "feat: add editorial presentation helpers"
```

## Task 4：重構搜尋優先的語意外殼

**Files:**
- Modify: `index.html:13-80`
- Modify: `assets/styles.css:1-85`
- Modify: `tests/ui.spec.mjs`

- [ ] **Step 1：建立外殼結構失敗測試**

Add to `tests/ui.spec.mjs`:

```js
test("首頁使用 PPS Journal 搜尋優先外殼", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("PPS Journal", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", {
    name: "下一段旅程，從機場開始。",
  })).toBeVisible();
  await expect(page.getByLabel("搜尋機場")).toBeVisible();
  await expect(
    page.locator(".brand-mark, .beta, .results-section"),
  ).toHaveCount(0);
});
```

- [ ] **Step 2：確認舊外殼使測試失敗**

Run:

```bash
npx playwright test -g "PPS Journal 搜尋優先外殼"
```

Expected: FAIL，頁面仍顯示 `PPS Lounge`、巨型 Hero 與 `.results-section`。

- [ ] **Step 3：替換 header、intro 與 results 外殼**

Replace `index.html` lines 13–80 with:

```html
<header class="masthead">
  <a class="journal-wordmark" href="./">PPS Journal</a>
  <span class="edition">GLOBAL AIRPORT EDIT · 中文</span>
  <button class="quiet-button" id="download-button" type="button" disabled>匯出 CSV</button>
</header>

<main>
  <section class="intro" aria-labelledby="page-title">
    <p class="kicker">Airport lounge guide</p>
    <h1 id="page-title">下一段旅程，從機場開始。</h1>
    <p>快速查詢全球貴賓室、餐飲與使用條件。</p>
  </section>

  <section class="search-area" aria-label="機場搜尋">
    <div class="search-shell">
      <label for="search">搜尋機場</label>
      <div class="search-control">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input id="search" type="search" inputmode="search" autocomplete="off"
          placeholder="例如 TPE、東京、Narita" disabled>
        <button id="clear-search" class="icon-button" type="button"
          aria-label="清除搜尋" hidden>×</button>
      </div>
      <div id="suggestions" class="suggestions" role="listbox"
        aria-label="搜尋建議" hidden></div>
    </div>
    <div class="recent-wrap" id="recent-wrap" hidden>
      <span>最近搜尋</span>
      <div id="recent-searches" class="recent-list"></div>
    </div>
  </section>

  <section class="results-journal" aria-labelledby="results-title">
    <div class="results-heading">
      <div>
        <p class="kicker">Search results</p>
        <h2 id="results-title">全球機場據點</h2>
      </div>
      <button id="open-filters" class="secondary-button" type="button">進階篩選</button>
    </div>
    <div id="airport-overview" class="airport-overview" hidden>
      <strong id="overview-code"></strong>
      <div><span id="overview-name"></span><small id="overview-meta"></small></div>
    </div>
    <div class="quick-filters" aria-label="快速篩選">
      <button class="quick-filter active" type="button" data-quick-type="">全部</button>
      <button class="quick-filter" type="button" data-quick-type="LOUNGE">貴賓室</button>
      <button class="quick-filter" type="button" data-quick-type="EAT">餐飲</button>
    </div>
    <p id="result-summary" class="result-summary" aria-live="polite">正在載入正式資料…</p>
    <div id="loading-state" class="state-panel">正在載入機場據點資料…</div>
    <div id="error-state" class="state-panel error" hidden>
      <strong>資料載入失敗</strong>
      <p>請檢查連線後重新載入。</p>
      <button id="retry-button" class="primary-button" type="button">重新載入資料</button>
    </div>
    <div id="empty-state" class="state-panel" hidden>
      <strong>找不到符合條件的據點</strong>
      <p>請檢查機場代碼，或清除部分篩選條件。</p>
      <button id="empty-clear" class="secondary-button" type="button">清除篩選</button>
    </div>
    <div id="results" class="result-list" aria-live="polite"></div>
    <nav class="pagination" aria-label="搜尋結果分頁">
      <button id="prev-page" class="secondary-button" type="button" disabled>上一頁</button>
      <span id="page-info">第 1 / 1 頁</span>
      <button id="next-page" class="secondary-button" type="button" disabled>下一頁</button>
    </nav>
  </section>
</main>
```

- [ ] **Step 4：以新系統完整取代舊 CSS，先建立 tokens 與首屏排版**

Delete the existing contents of `assets/styles.css`, then write:

```css
:root {
  color-scheme: light;
  --paper: #f3efe5;
  --paper-raised: #faf7ef;
  --ink: #202522;
  --ink-muted: #65645e;
  --oxblood: #8f2639;
  --rule: #b8b0a1;
  --error: #a32d24;
  --success: #35624a;
  --serif: "Noto Serif TC", "Source Han Serif TC", Georgia, serif;
  --sans: "Noto Sans TC", system-ui, sans-serif;
  font-family: var(--sans);
  font-synthesis: none;
}

* { box-sizing: border-box; }
html { background: var(--paper); color: var(--ink); scroll-behavior: smooth; }
body { min-width: 0; margin: 0; background: var(--paper); }
button, input, select { min-height: 44px; font: inherit; }
button, select { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .45; }
:focus-visible { outline: 3px solid var(--oxblood); outline-offset: 3px; }

.masthead {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: min(1040px, 100%);
  margin: 0 auto;
  padding: 13px clamp(16px, 4vw, 32px);
  border-bottom: 1px solid var(--rule);
  background: color-mix(in srgb, var(--paper) 94%, transparent);
}
.journal-wordmark {
  color: var(--ink);
  font: italic 600 18px/1 var(--serif);
  text-decoration: none;
}
.edition {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .12em;
}
.quiet-button {
  justify-self: end;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--oxblood);
  font-weight: 700;
}
main { width: min(1040px, 100%); margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px) 56px; }
.intro { max-width: 660px; padding: clamp(26px, 6vw, 58px) 0 10px; }
.kicker {
  margin: 0 0 7px;
  color: var(--oxblood);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
}
h1, h2, .result-row h3, .detail-heading h2 {
  font-family: var(--serif);
  font-weight: 500;
}
h1 { margin: 0; font-size: clamp(32px, 6vw, 56px); line-height: 1.02; letter-spacing: -.04em; }
.intro > p:last-child { margin: 12px 0 0; color: var(--ink-muted); line-height: 1.55; }
.search-area { max-width: 720px; padding: 16px 0 34px; }
.search-shell { position: relative; }
.search-shell > label { display: block; margin-bottom: 7px; font-size: 13px; font-weight: 750; }
.search-control {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  border-bottom: 2px solid var(--ink);
}
.search-control input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font-size: 18px;
}
.search-icon { color: var(--oxblood); font-size: 25px; }
.icon-button { width: 44px; padding: 0; border: 0; background: transparent; color: var(--ink-muted); font-size: 22px; }
.suggestions {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 15;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--paper-raised);
  box-shadow: 0 16px 36px rgba(32, 37, 34, .14);
}
.suggestion {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid var(--rule);
  background: transparent;
  color: var(--ink);
  text-align: left;
}
.suggestion:last-child { border-bottom: 0; }
.suggestion small { display: block; margin-top: 3px; color: var(--ink-muted); }
.suggestion-code { font-size: 20px; font-weight: 850; letter-spacing: -.05em; }
.recent-wrap, .recent-list { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.recent-wrap { margin-top: 14px; color: var(--ink-muted); font-size: 12px; }
.recent-list button { border: 0; border-bottom: 1px solid var(--rule); background: transparent; color: var(--ink); }
.results-journal { border-top: 1px solid var(--ink); padding-top: 22px; }
.results-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; }
.results-heading h2 { margin: 0; font-size: clamp(26px, 4vw, 38px); }
```

- [ ] **Step 5：執行外殼測試**

Run:

```bash
npx playwright test -g "PPS Journal 搜尋優先外殼"
```

Expected: PASS。

- [ ] **Step 6：提交外殼**

```bash
git add index.html assets/styles.css tests/ui.spec.mjs
git commit -m "feat: add search-first journal shell"
```

## Task 5：接上機場摘要、結果清單與快速篩選

**Files:**
- Modify: `assets/app.js:1-18, 33-43, 79-190, 290-310`
- Modify: `assets/styles.css`
- Modify: `tests/ui.spec.mjs:10-36`

- [ ] **Step 1：將核心流程測試改為新結果結構**

Replace the TPE test with:

```js
test("TPE 顯示 6 筆編輯式結果並可套用篩選", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await page.getByLabel("搜尋機場").fill("TPE");
  await expect(page.locator("#overview-code")).toHaveText("TPE");
  await expect(page.locator("#overview-meta")).toContainText("6 個據點");
  await expect(page.locator(".result-row")).toHaveCount(6);
  await expect(page.locator(".result-card, .meta-box, .type-badge")).toHaveCount(0);

  await page.getByRole("button", { name: "餐飲" }).click();
  await expect(page.locator(".result-row")).toHaveCount(2);
  await expect(page.locator(".result-row").first()).toContainText("餐飲");

  await page.getByRole("button", { name: "全部" }).click();
  await page.getByRole("button", { name: "進階篩選" }).click();
  await page.getByLabel("設施").selectOption("Showers");
  await page.getByRole("button", { name: "套用篩選" }).click();
  await expect(page.locator("#results")).toContainText("淋浴");
  expect(errors).toEqual([]);
});
```

In the existing empty-state test, replace:

```js
await expect(page.locator(".result-card").first()).toBeVisible();
```

with:

```js
await expect(page.locator(".result-row").first()).toBeVisible();
```

- [ ] **Step 2：確認新結構尚未接線**

Run:

```bash
npx playwright test -g "TPE 顯示 6 筆"
```

Expected: FAIL，`#overview-code` 無內容且結果仍使用舊 `cardHtml()`。

- [ ] **Step 3：匯入呈現函式並登記新元素**

Add to `assets/app.js` imports:

```js
import {
  airportOverview,
  detailHtml,
  resultRowHtml,
} from "./presentation.js";
```

Add these IDs to the `el` array:

```js
"airport-overview", "overview-code", "overview-name", "overview-meta",
```

Remove formatter imports that only belonged to `cardHtml()` and `showDetail()`; retain `escapeHtml` and `formatFacility` for filter options and suggestions.

- [ ] **Step 4：移除 cardHtml 並新增機場摘要渲染**

Delete `cardHtml()` and add:

```js
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
```

In `render()`, replace the old result assignment with:

```js
state.currentRows = computeRows();
renderAirportOverview(state.currentRows);
const page = paginate(state.currentRows, state.page, state.pageSize);
state.page = page.page;
el.results.innerHTML = page.rows.map(resultRowHtml).join("");
```

- [ ] **Step 5：簡化快速篩選事件**

Replace the existing quick-filter listener block with:

```js
document.querySelectorAll("[data-quick-type]").forEach((button) => {
  button.addEventListener("click", () => {
    state.filters.type = button.dataset.quickType;
    state.filters.facility = "";
    state.page = 1;
    document.querySelectorAll("[data-quick-type]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    render();
  });
});
```

In `resetFilters()`, replace `.filter-chip` selectors with:

```js
document.querySelectorAll("[data-quick-type]").forEach((button) => {
  button.classList.toggle("active", button.dataset.quickType === "");
});
```

- [ ] **Step 6：加入結果與摘要樣式**

Append to `assets/styles.css`:

```css
.airport-overview {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 0 16px;
  border-bottom: 1px solid var(--rule);
}
.airport-overview[hidden] { display: none; }
.airport-overview > strong {
  font-size: clamp(42px, 8vw, 72px);
  line-height: .82;
  letter-spacing: -.07em;
}
.airport-overview > div { display: grid; gap: 5px; text-align: right; }
.airport-overview small { color: var(--ink-muted); }
.quick-filters {
  display: flex;
  gap: 18px;
  overflow-x: auto;
  padding: 11px 0;
  border-bottom: 1px solid var(--rule);
}
.quick-filter {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: 13px;
  font-weight: 750;
}
.quick-filter.active { color: var(--oxblood); text-decoration: underline; text-underline-offset: 5px; }
.result-summary { margin: 14px 0 4px; color: var(--ink-muted); font-size: 13px; }
.result-list { border-top: 1px solid var(--rule); }
.result-row { padding: 17px 0; border-bottom: 1px solid var(--rule); }
.result-kicker {
  color: var(--oxblood);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.result-body { display: flex; align-items: start; justify-content: space-between; gap: 20px; }
.result-row h3 { margin: 6px 0 5px; font-size: clamp(19px, 3vw, 24px); line-height: 1.12; }
.result-row p { margin: 0; color: var(--ink-muted); font-size: 13px; line-height: 1.5; }
.result-facilities { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; font-size: 11px; font-weight: 700; }
.result-facilities span:first-child { color: var(--oxblood); }
.text-action {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--oxblood);
  font-size: 12px;
  font-weight: 750;
}
```

- [ ] **Step 7：執行 unit 與新核心流程**

Run:

```bash
npm test
npx playwright test -g "TPE 顯示 6 筆"
```

Expected: 全數通過。

- [ ] **Step 8：提交結果清單**

```bash
git add assets/app.js assets/styles.css tests/ui.spec.mjs
git commit -m "feat: render editorial airport results"
```

## Task 6：重構詳情、篩選與狀態

**Files:**
- Modify: `assets/app.js:192-217, 260-295`
- Modify: `assets/styles.css:101-139`
- Modify: `index.html:83-126`
- Modify: `tests/ui.spec.mjs`

- [ ] **Step 1：建立詳情、焦點與缺網址失敗測試**

Add to `tests/ui.spec.mjs`:

```js
test("詳情採資料列、使用現行官方網址並回復焦點", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("搜尋機場").fill("TPE");
  const trigger = page.locator(".result-row").filter({
    hasText: "Oriental Club Lounge",
  }).getByRole("button", { name: "查看詳情" });
  await trigger.click();

  await expect(page.locator("#detail")).toBeVisible();
  await expect(page.locator(".detail-fact")).toHaveCount(4);
  await expect(page.locator(".detail-section, .meta-box")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "開啟 Priority Pass 官方頁面" }),
  ).toHaveAttribute(
    "href",
    "https://www.prioritypass.com/en-GB/lounges/taiwan-region/taiwan-taoyuan-international/tpe9-oriental-club-lounge",
  );

  await page.getByRole("button", { name: "返回 TPE 的搜尋結果" }).click();
  await expect(page.locator("#detail")).toBeHidden();
  await expect(trigger).toBeFocused();
});
```

- [ ] **Step 2：執行並確認舊詳情失敗**

Run:

```bash
npx playwright test -g "詳情採資料列"
```

Expected: FAIL，舊詳情仍使用 `.detail-section`，且返回按鈕名稱不含機場代碼。

- [ ] **Step 3：使用 detailHtml 並明確管理焦點**

Add near `let searchTimer;` in `assets/app.js`:

```js
let detailTrigger = null;
```

Replace `showDetail()` with:

```js
function showDetail(index, trigger) {
  const row = state.rows.find((item) => item._searchOrder === Number(index));
  if (!row) return;
  state.selected = row;
  detailTrigger = trigger;
  el["close-detail"].textContent = `← 返回 ${row.airportCode} 的搜尋結果`;
  el["detail-content"].innerHTML = detailHtml(row);
  el.detail.showModal();
}

function closeDetail() {
  el.detail.close();
  detailTrigger?.focus();
}
```

Change the result click handler:

```js
el.results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-detail]");
  if (button) showDetail(button.dataset.detail, button);
});
```

Change both close handlers to call `closeDetail`.

- [ ] **Step 4：更新詳情語意結構**

Change the detail header controls in `index.html` to:

```html
<div class="detail-toolbar">
  <button id="close-detail" class="back-button" type="button">← 返回搜尋結果</button>
  <button id="close-detail-icon" class="icon-button" type="button" aria-label="關閉詳情">×</button>
</div>
```

Keep the existing filter labels and IDs so existing form behavior remains stable.

- [ ] **Step 5：替換浮層、詳情與狀態樣式**

Add or replace these rules in `assets/styles.css`:

```css
.state-panel {
  margin: 18px 0;
  padding: 22px 0;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
}
.state-panel p { color: var(--ink-muted); line-height: 1.5; }
.state-panel.error { color: var(--error); }
.primary-button, .secondary-button {
  padding: 0 15px;
  border: 1px solid var(--ink);
  border-radius: 4px;
  background: transparent;
  color: var(--ink);
  font-weight: 750;
}
.primary-button { border-color: var(--oxblood); background: var(--oxblood); color: var(--paper-raised); }
dialog { max-width: none; padding: 0; border: 0; background: transparent; }
dialog::backdrop { background: rgba(32, 37, 34, .42); }
.sheet { width: min(640px, calc(100% - 20px)); margin: auto auto 10px; }
.sheet-panel, .detail-panel {
  max-height: calc(100dvh - 20px);
  overflow-y: auto;
  padding: 22px;
  border-radius: 10px;
  background: var(--paper-raised);
  box-shadow: 0 18px 45px rgba(32, 37, 34, .18);
}
.sheet-header, .detail-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 20px 0; }
.filter-grid label { display: grid; gap: 7px; color: var(--ink-muted); font-size: 12px; font-weight: 700; }
.filter-grid select { width: 100%; min-width: 0; padding: 0 10px; border: 1px solid var(--rule); border-radius: 4px; background: var(--paper-raised); color: var(--ink); }
.detail-dialog { width: min(760px, calc(100% - 20px)); margin: 10px auto; }
.detail-heading { padding: 24px 0 18px; border-bottom: 1px solid var(--rule); }
.detail-code { display: block; font-size: 52px; font-weight: 850; line-height: .9; letter-spacing: -.07em; }
.detail-heading h2 { margin: 12px 0 5px; font-size: clamp(26px, 5vw, 42px); }
.detail-heading p, .data-note { color: var(--ink-muted); }
.detail-facts { margin: 0; }
.detail-fact { display: grid; grid-template-columns: minmax(90px, .35fr) 1fr; gap: 20px; padding: 16px 0; border-bottom: 1px solid var(--rule); }
.detail-fact dt { color: var(--oxblood); font-size: 11px; font-weight: 800; letter-spacing: .1em; }
.detail-fact dd { margin: 0; line-height: 1.6; white-space: pre-line; }
.raw-copy summary { min-height: 44px; display: flex; align-items: center; color: var(--oxblood); cursor: pointer; font-weight: 750; }
.raw-section { padding: 14px 0; border-top: 1px solid var(--rule); }
.official-link { display: inline-flex; align-items: center; min-height: 44px; margin-top: 18px; border-bottom: 1px solid var(--ink); color: var(--ink); text-decoration: none; font-weight: 750; }
.official-missing { color: var(--ink-muted); }
.back-button { padding: 0; border: 0; background: transparent; color: var(--oxblood); font-weight: 750; }
.sheet-actions { display: flex; gap: 12px; }
.sheet-actions button { flex: 1; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 24px; color: var(--ink-muted); font-size: 13px; }
footer { width: min(1040px, 100%); margin: 0 auto; padding: 0 24px 40px; color: var(--ink-muted); text-align: center; font-size: 12px; line-height: 1.6; }
```

- [ ] **Step 6：執行核心、錯誤與鍵盤測試**

Run:

```bash
npx playwright test -g "詳情採資料列|資料載入失敗|鍵盤"
npm test
```

Expected: 全數通過。

- [ ] **Step 7：提交詳情與狀態**

```bash
git add assets/app.js assets/styles.css index.html tests/ui.spec.mjs
git commit -m "feat: refine journal details and states"
```

## Task 7：完成手機密度、響應式與搜尋效能 Gate

**Files:**
- Modify: `assets/styles.css`
- Modify: `tests/ui.spec.mjs`
- Modify: `playwright.config.mjs` only if timeout evidence requires it

- [ ] **Step 1：增加 390px 首屏與快速輸入失敗測試**

Extend `viewports`:

```js
{ name: "mobile-390", width: 390, height: 844 },
```

Add:

```js
test("390px 搜尋後首屏可見第一筆結果", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("搜尋機場").fill("TPE");
  const box = await page.locator(".result-row").first().boundingBox();
  expect(box).not.toBeNull();
  expect(box.y).toBeLessThan(844);
});

test("6 倍 CPU 降速快速輸入只渲染一次且 250ms 內可見", async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("搜尋機場")).toBeEnabled();

  const result = await page.evaluate(async () => {
    const input = document.querySelector("#search");
    const results = document.querySelector("#results");
    let mutations = 0;
    const observer = new MutationObserver(() => { mutations += 1; });
    observer.observe(results, { childList: true });
    let lastInputAt = 0;

    for (const [index, value] of ["T", "TP", "TPE"].entries()) {
      input.value = value;
      if (index === 2) lastInputAt = performance.now();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    while (!results.textContent.includes("Oriental Club Lounge")) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (performance.now() - lastInputAt > 1000) break;
    }
    observer.disconnect();
    return { elapsed: performance.now() - lastInputAt, mutations };
  });

  expect(result.mutations).toBe(1);
  expect(result.elapsed).toBeLessThan(250);
});
```

- [ ] **Step 2：執行並確認首屏密度需要調整**

Run:

```bash
npx playwright test -g "390px 搜尋後|6 倍 CPU"
```

Expected: 效能測試應維持通過；若首筆結果落在 844px 以下，首屏測試 FAIL，證明需壓縮手機垂直間距。

- [ ] **Step 3：完成手機與桌機規則**

Append:

```css
@media (min-width: 760px) {
  .result-list { display: grid; grid-template-columns: 1fr 1fr; column-gap: 34px; }
  .result-row:nth-child(2) { border-top: 0; }
}

@media (max-width: 700px) {
  .masthead { grid-template-columns: 1fr auto; padding: 11px 14px; }
  .edition { display: none; }
  main { padding-left: 14px; padding-right: 14px; }
  .intro { padding-top: 24px; }
  .intro h1 { font-size: 34px; }
  .search-area { padding-bottom: 24px; }
  .results-heading { align-items: center; }
  .airport-overview { padding-top: 20px; }
  .result-body { gap: 12px; }
  .result-body .text-action { align-self: end; }
  .filter-grid { grid-template-columns: 1fr; }
  .sheet { width: calc(100% - 12px); margin-bottom: 6px; }
  .sheet-panel, .detail-panel { padding: 18px 14px; }
  .detail-dialog { width: calc(100% - 12px); margin: 6px auto; }
  .detail-fact { grid-template-columns: 82px 1fr; gap: 12px; }
}

@media (max-width: 360px) {
  .journal-wordmark { font-size: 16px; }
  .quiet-button { font-size: 12px; }
  .intro h1 { font-size: 30px; }
  .airport-overview { align-items: start; }
  .airport-overview > div { text-align: left; }
  .result-body { display: block; }
  .text-action { margin-top: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition: none !important;
    animation: none !important;
  }
}
```

- [ ] **Step 4：執行全部 UI 測試**

Run:

```bash
npm run test:ui
```

Expected: 所有既有與新增 Playwright tests 通過；320、375、390、768、1024px 無水平溢出，44px、鍵盤、首屏與效能 Gate 通過。

- [ ] **Step 5：保存人工審查截圖**

Terminal A:

```bash
python3 -m http.server 4173
```

Terminal B:

```bash
mkdir -p test-results/visual
npx playwright screenshot --device="iPhone 13" http://127.0.0.1:4173/ test-results/visual/home-iphone13.png
```

Then use Playwright interactive script or browser inspection to save:

```text
test-results/visual/tpe-390.png
test-results/visual/filter-390.png
test-results/visual/detail-390.png
test-results/visual/empty-390.png
test-results/visual/error-390.png
test-results/visual/desktop-1024.png
```

Verify each image against `DESIGN.md`: no giant Hero, Apple blue, decorative gradient, card wall, nested cards, pill flood, or non-dialog shadow.

- [ ] **Step 6：提交響應式與效能 Gate**

```bash
git add assets/styles.css tests/ui.spec.mjs playwright.config.mjs
git commit -m "test: enforce mobile density and search performance"
```

Only stage `playwright.config.mjs` if it actually changed.

## Task 8：文件、全套驗證與本機 iPhone 預覽

**Files:**
- Modify: `README.md`
- Modify: `package.json` only if verification scripts were added
- Verify: all implementation files

- [ ] **Step 1：更新 README 的資料與設計說明**

Update the data expectations:

```text
wrote 1754 rows; backfilled 17 URLs; removed 1; added 1 manually verified rows
validated 1754 rows across 752 airports
```

Add:

```markdown
## 視覺規範

新版採 PPS Aviation Journal：高級旅行編輯誌排版與搜尋優先工具。
所有視覺修改先讀取根目錄 `DESIGN.md`；外部 skill 不得覆蓋專案
tokens、字體角色、資訊架構或禁止模式。

## 效能 Gate

- 搜尋 debounce：120ms。
- 390 × 844px 搜尋後首屏可見第一筆結果。
- 6 倍 CPU 降速時，快速輸入只渲染一次且 250ms 內可見。
```

Update the UI test list to include 390px、TPE 6 筆、詳情焦點回復與效能 Gate。

- [ ] **Step 2：執行完整靜態與自動驗證**

Run:

```bash
npm run extract
npm run validate
npm test
npm run test:ui
node --check assets/app.js
node --check assets/presentation.js
node --check assets/search.js
node --check scripts/extract-live-data.mjs
if rg -n "#0066cc|#005bb5|linear-gradient|radial-gradient|result-card|meta-box|type-badge|9999px" index.html assets; then exit 1; fi
git diff --check
git status --short
```

Expected:

- 資料 1,754 筆、752 個機場。
- Unit 與 Playwright 全數通過。
- 既有 `tests/storage.test.mjs` 全數通過，確認 `localStorage` 不可用時仍無害降級。
- 所有 `node --check` 無輸出。
- 禁止模式掃描無輸出。
- `git diff --check` 無輸出。
- `git status` 只包含本任務 README 或已知待提交檔案。

- [ ] **Step 3：啟動 Tailscale iPhone 預覽**

WSL:

```bash
python3 -m http.server 4173
```

Windows PowerShell:

```powershell
tailscale serve --yes --bg --http=4174 4173
```

Grant 使用實體 iPhone Safari 驗證：

1. 開啟 Tailscale URL。
2. 快速輸入 `TPE`，確認鍵盤輸入不凍結。
3. 確認首屏看得到第一筆結果。
4. 切換全部／貴賓室／餐飲。
5. 開啟進階篩選。
6. 開啟 Oriental Club Lounge 詳情與官方網址。
7. 返回結果並確認焦點與捲動位置合理。

- [ ] **Step 4：提交文件**

```bash
git add README.md
git commit -m "docs: document journal design verification"
```

## Task 9：回寫 P_OS_AI 執行文件並停在發布 Gate

**Files:**
- Modify: `/mnt/c/Users/Grant/Desktop/obsidian/P_OS_20260411Ori/P_OS_AI/01_專案中控/02_待執行/20260628-PPS-Lounge-v2-redesign/00_專案主卡.md`
- Modify: `/mnt/c/Users/Grant/Desktop/obsidian/P_OS_20260411Ori/P_OS_AI/01_專案中控/02_待執行/20260628-PPS-Lounge-v2-redesign/03_任務清單.md`
- Modify: `/mnt/c/Users/Grant/Desktop/obsidian/P_OS_20260411Ori/P_OS_AI/01_專案中控/02_待執行/20260628-PPS-Lounge-v2-redesign/05_執行報告.md`

- [ ] **Step 1：更新主卡但維持 DOING**

Set `updated` and `最近更新` to the actual execution date. Add the approved design decision:

```markdown
- 視覺方向：PPS Aviation Journal（航空編輯誌）。
- 圖片策略：無照片。
- 首頁配置：搜尋優先。
- 發布 Gate：實體 iPhone Safari 驗證及 Grant 明確發布核准前維持 `DOING`。
```

- [ ] **Step 2：新增 Aviation Journal 任務區並逐項勾選實際結果**

Add a section covering:

```markdown
## H. PPS Aviation Journal 視覺與工具化重構

- [x] 建立 repo `DESIGN.md` 與技能優先順序
- [x] 同步 KEF／TPE 正式資料
- [x] 建立純呈現模組與測試
- [x] 完成搜尋優先首頁與編輯式結果清單
- [x] 完成詳情、篩選、狀態與無障礙
- [x] 通過 unit、Playwright、響應式與效能 Gate
- [ ] Grant 使用實體 iPhone Safari 完成人工驗證
- [ ] Grant 明確核准 push／Preview／Production
```

只勾選有終端輸出或人工證據的項目。

- [ ] **Step 3：在執行報告記錄可追溯證據**

Record:

- 變更檔案與 commits。
- 資料抽取輸出及 SHA-256。
- Unit／Playwright 通過數量。
- 6 倍 CPU 搜尋時間與渲染次數。
- 320／375／390／768／1024px 結果。
- 截圖位置。
- iPhone Safari 是否完成。
- 已知限制與未解除發布 Gate。

不得寫「已驗收通過」。

- [ ] **Step 4：驗證三份 Markdown 為 UTF-8**

Run:

```bash
python3 - <<'PY'
from pathlib import Path

base = Path("/mnt/c/Users/Grant/Desktop/obsidian/P_OS_20260411Ori/P_OS_AI/01_專案中控/02_待執行/20260628-PPS-Lounge-v2-redesign")
for name in ("00_專案主卡.md", "03_任務清單.md", "05_執行報告.md"):
    path = base / name
    path.read_text(encoding="utf-8", errors="strict")
    print(f"OK UTF-8: {path}")
PY
```

Expected: 三行 `OK UTF-8`。

## 最終完成條件

- `redesign-v2` 包含獨立、可追溯 commits。
- 正式資料為 1,754 筆，TPE 6 筆，KEF 有 Jomfruin 與 Elda。
- Unit、Playwright、靜態語法、UTF-8 與 diff checks 全數通過。
- 6 倍 CPU 降速快速輸入只渲染一次，結果小於 250ms 可見。
- 320／375／390／768／1024px 無水平溢出。
- 視覺截圖符合 `DESIGN.md` 禁止模式。
- P_OS_AI 主卡維持 `DOING`，直到 Grant 完成 iPhone Safari 驗證並另行解除發布 Gate。
- 未經 Grant 明確核准，不 push、不建立 Vercel Preview、不合併 `main`、不修改 Production。

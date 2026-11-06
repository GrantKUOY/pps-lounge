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
  assert.match(html, /TPE · Oriental &lt;Club&gt;/);
  assert.match(html, /第 2 航廈/);
  assert.doesNotMatch(html, /result-card|meta-box|type-badge/);
  assert.deepEqual(visibleFacilities(row), [
    "Showers",
    "Wi-Fi",
    "Flight information",
  ]);
  assert.throws(
    () => resultRowHtml({
      ...row,
      _searchOrder: '0" autofocus onfocus="alert(1)',
    }),
    /_searchOrder must be a non-negative safe integer/,
  );
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
  assert.match(html, /TPE · Oriental &lt;Club&gt;/);
  assert.match(html, /開啟 Priority Pass 官方頁面/);
  assert.doesNotMatch(html, /detail-section|meta-box/);

  const unsafe = detailHtml({ ...row, url: "javascript:alert(1)" });
  assert.doesNotMatch(unsafe, /official-link/);
  assert.match(unsafe, /目前沒有可用的官方詳情連結/);

  const untrusted = detailHtml({ ...row, url: "https://evil.example/lounge" });
  assert.doesNotMatch(untrusted, /official-link/);
  assert.match(untrusted, /目前沒有可用的官方詳情連結/);
});

test("非熱門據點詳情收斂 conditions 呈現並保留官網連結", () => {
  for (const html of [detailHtml(row), detailHtml(row, new Date(), { hot: false })]) {
    assert.doesNotMatch(html, /Maximum 3 hour stay/);
    assert.doesNotMatch(html, /最長可停留 3 小時/);
    assert.doesNotMatch(html, /<h3>Conditions<\/h3>/);
    assert.match(html, /入場條件請查 Priority Pass 官網/);
    assert.match(html, /開啟 Priority Pass 官方頁面/);
    assert.match(html, /Zone D/);
    assert.match(html, /05:00 - 23:00/);
    assert.match(html, /淋浴間/);
  }
});

test("錯誤回報連結：設定合法表單 URL 時詳情恰好出現一次且屬性安全", () => {
  const formUrl = "https://docs.google.com/forms/d/e/TESTFORM/viewform";
  const html = detailHtml(row, new Date(), { errorReportUrl: formUrl });
  assert.equal(html.match(/回報錯誤/g)?.length, 1);
  assert.match(
    html,
    /<a class="official-link" href="https:\/\/docs\.google\.com\/forms\/d\/e\/TESTFORM\/viewform" target="_blank" rel="noreferrer noopener">回報錯誤<\/a>/,
  );
});

test("錯誤回報連結：未設定、空字串或 URL 不合法時不顯示且不影響其他內容", () => {
  for (const html of [
    detailHtml(row),
    detailHtml(row, new Date(), {}),
    detailHtml(row, new Date(), { errorReportUrl: "" }),
    detailHtml(row, new Date(), { errorReportUrl: "   " }),
    detailHtml(row, new Date(), { errorReportUrl: "javascript:alert(1)" }),
    detailHtml(row, new Date(), { errorReportUrl: "http://example.com/form" }),
    detailHtml(row, new Date(), { errorReportUrl: "not a url" }),
  ]) {
    assert.doesNotMatch(html, /回報錯誤/);
    assert.match(html, /開啟 Priority Pass 官方頁面/);
  }
});

test("熱門據點詳情維持 conditions 現行呈現", () => {
  const html = detailHtml(row, new Date(), { hot: true });
  assert.match(html, /最長可停留 3 小時/);
  assert.match(html, /<h3>Conditions<\/h3><p>Maximum 3 hour stay<\/p>/);
  assert.doesNotMatch(html, /入場條件請查 Priority Pass 官網/);
});

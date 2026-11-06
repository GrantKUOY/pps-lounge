import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { matchFirstParty } from "../assets/first-party.js";
import { detailHtml, resultRowHtml } from "../assets/presentation.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relative) =>
  JSON.parse(readFileSync(path.join(ROOT, relative), "utf8"));

const entries = readJson("data/first-party.json");
const rows = readJson("data/lounges.json");

const homeeEntry = entries.find((entry) => entry.nameMatch === "homee");
const orientalEntry = entries.find(
  (entry) => entry.nameMatch === "Oriental Club",
);

test("比對函式：TPE homee KITCHEN 命中 Homee 實測文", () => {
  const row = rows.find(
    (item) => item.airportCode === "TPE" && item.name === "homee KITCHEN",
  );
  assert.equal(matchFirstParty(row, entries), homeeEntry);
});

test("比對函式：TPE Oriental Club Lounge 命中 HSBC 實測文", () => {
  const row = rows.find((item) => item.name === "Oriental Club Lounge");
  assert.equal(matchFirstParty(row, entries), orientalEntry);
});

test("比對函式：未命中一般據點回傳 null", () => {
  const row = rows.find((item) => item.name.startsWith("Plaza Premium"));
  assert.equal(matchFirstParty(row, entries), null);
});

test("比對函式：不同機場同名不命中（機場碼必須相同）", () => {
  // 實資料即有 KHH 的 homee KITCHEN，不得誤標為 TPE 實測涵蓋。
  const khhHomee = rows.find(
    (item) => item.airportCode === "KHH" && item.name === "homee KITCHEN",
  );
  assert.ok(khhHomee);
  assert.equal(matchFirstParty(khhHomee, entries), null);
  assert.equal(
    matchFirstParty(
      { airportCode: "NRT", name: "Oriental Club Lounge" },
      entries,
    ),
    null,
  );
});

test("比對函式：關鍵字與機場碼不分大小寫，空輸入安全", () => {
  assert.equal(
    matchFirstParty({ airportCode: "tpe", name: "HOMEE KITCHEN" }, entries),
    homeeEntry,
  );
  assert.equal(matchFirstParty(null, entries), null);
  assert.equal(
    matchFirstParty({ airportCode: "TPE", name: "homee KITCHEN" }, []),
    null,
  );
  assert.equal(
    matchFirstParty({ airportCode: "TPE", name: "homee KITCHEN" }, null),
    null,
  );
});

test("對照檔實資料：TPE 恰命中 3 筆（homee 兩筆＋Oriental 一筆），其他機場零命中", () => {
  const matched = rows.filter((row) => matchFirstParty(row, entries));
  assert.equal(matched.length, 3);
  assert.ok(matched.every((row) => row.airportCode === "TPE"));
  assert.equal(
    matched.filter((row) => matchFirstParty(row, entries) === homeeEntry)
      .length,
    2,
  );
  assert.equal(
    matched.filter((row) => matchFirstParty(row, entries) === orientalEntry)
      .length,
    1,
  );
});

const renderRow = {
  _searchOrder: 0,
  airportCode: "TPE",
  airportName: "Taiwan Taoyuan International Airport",
  country: "Taiwan",
  city: "Taipei",
  type: "LOUNGE",
  typeLabel: "貴賓室",
  name: "Oriental Club Lounge",
  terminal: "Terminal 2",
  location: "Airside, Zone D",
  openingHours: "05:00 - 23:00 daily",
  conditions: "Maximum 3 hour stay",
  facilities: ["Wi-Fi"],
  url: "https://www.prioritypass.com/example",
};

test("清單列：命中時顯示站長實測標記，未命中不顯示", () => {
  const hit = resultRowHtml(renderRow, { firstParty: orientalEntry });
  assert.match(hit, /class="first-party-mark">站長實測</);
  const miss = resultRowHtml(renderRow);
  assert.doesNotMatch(miss, /first-party-mark|站長實測/);
});

test("詳情：命中時加站長實測回連（含錨點），未命中不加", () => {
  const hit = detailHtml(renderRow, new Date(), { firstParty: orientalEntry });
  assert.match(hit, /看站長實測：HSBC Elite 副卡 2 人免費進 Oriental Club/);
  // href 經 safeExternalUrl 正規化（錨點中文會 percent-encode），解碼後須還原為對照檔 URL。
  const href = hit.match(/href="([^"]*hsbc-elite[^"]*)"/)?.[1];
  assert.ok(href);
  assert.equal(decodeURIComponent(href), orientalEntry.articleUrl);
  assert.match(hit, /target="_blank" rel="noreferrer noopener"/);
  const miss = detailHtml(renderRow);
  assert.doesNotMatch(miss, /看站長實測/);
});

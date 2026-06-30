import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const expectedTpeBase =
  "https://www.prioritypass.com/en-GB/lounges/taiwan-region/taiwan-taoyuan-international/";
const expectedEldaUrl =
  "https://www.prioritypass.com/en-GB/lounges/iceland/keflavik-international/kef1d-elda";

async function loadHtmlRecords() {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const match = html.match(
    /const records = (\[[\s\S]*?\]);\s*const topFacilities/,
  );
  assert.ok(match, "index.html records payload should be parseable");
  return JSON.parse(match[1]);
}

async function loadJsRecords() {
  const source = await readFile(
    new URL("../pps-records.js", import.meta.url),
    "utf8",
  );
  const recordsMatch = source.match(
    /^window\.PPS_RECORDS = (\[[\s\S]*?\]);\s*window\.PPS_RECORDS_META/,
  );
  const metaMatch = source.match(/window\.PPS_RECORDS_META = (\{.*\});/);
  assert.ok(recordsMatch, "pps-records.js records payload should be parseable");
  assert.ok(metaMatch, "pps-records.js metadata should be parseable");
  return {
    rows: JSON.parse(recordsMatch[1]),
    meta: JSON.parse(metaMatch[1]),
  };
}

function assertHotfixRows(rows) {
  assert.equal(rows.length, 1754);

  const kefDining = rows
    .filter((row) => row.airportCode === "KEF" && row.type === "EAT")
    .sort((left, right) => left.name.localeCompare(right.name));
  assert.deepEqual(
    kefDining.map((row) => row.name),
    ["Elda", "Jomfruin"],
  );
  assert.equal(
    kefDining.find((row) => row.name === "Elda")?.url,
    expectedEldaUrl,
  );

  const tpeRows = rows.filter((row) => row.airportCode === "TPE");
  assert.equal(tpeRows.length, 6);
  assert.ok(
    !tpeRows.some((row) => row.name === "Plaza Premium Lounge (Zone A)"),
  );
  for (const row of tpeRows) {
    assert.match(row.url, new RegExp(`^${expectedTpeBase}`));
  }
}

test("正式首頁包含 Elda 且 TPE 使用新版官方網址", async () => {
  assertHotfixRows(await loadHtmlRecords());
});

test("地圖資料與正式首頁同步", async () => {
  const { rows, meta } = await loadJsRecords();
  assertHotfixRows(rows);
  assert.equal(meta.recordCount, 1754);
  assert.equal(meta.typeCounts.EAT, 193);
  assert.equal(meta.typeCounts.LOUNGE, 1412);
});

test("CSV 來源包含 Elda 並同步 TPE 新版官方網址", async () => {
  const csv = await readFile(
    new URL("../PPS_LOUNGE.csv", import.meta.url),
    "utf8",
  );
  assert.match(csv, /^Iceland,KEF,EAT,Elda,/m);
  assert.match(csv, new RegExp(expectedEldaUrl));
  const tpeUrls =
    csv.match(
      /https:\/\/www\.prioritypass\.com\/en-GB\/lounges\/taiwan-region\/taiwan-taoyuan-international\/tpe[^,\s"]+/g,
    ) ?? [];
  assert.equal(new Set(tpeUrls).size, 6);
  assert.doesNotMatch(
    csv,
    /https:\/\/my\.prioritypass\.com\/en-GB\/lounges\/taiwan\/taiwan-taoyuan-international\/tpe/,
  );
  assert.doesNotMatch(
    csv,
    /^Taiwan,TPE,LOUNGE,Plaza Premium Lounge \(Zone A\),/m,
  );
});

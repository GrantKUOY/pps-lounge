import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const identityFields = [
  "airportCode",
  "name",
  "location",
  "openingHours",
  "conditions",
];

function identityKey(row) {
  return identityFields.map((field) => row[field] ?? "").join("\0");
}

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

test("產出資料保留原始資料中可唯一匹配的官方網址", async () => {
  const rows = JSON.parse(
    await readFile(new URL("../data/lounges.json", import.meta.url), "utf8"),
  );
  const sourceText = await readFile(
    new URL("../pps-records.js", import.meta.url),
    "utf8",
  );
  const sourceMatch = sourceText.match(
    /^window\.PPS_RECORDS = (\[[\s\S]*?\]);\s*window\.PPS_RECORDS_META/,
  );
  assert.ok(sourceMatch, "原始 PPS_RECORDS 資料應可解析");

  const sourceRows = JSON.parse(sourceMatch[1]);
  const sourceByIdentity = new Map();
  for (const row of sourceRows) {
    const key = identityKey(row);
    sourceByIdentity.set(key, [...(sourceByIdentity.get(key) ?? []), row]);
  }

  for (const row of rows) {
    const candidates = sourceByIdentity.get(identityKey(row)) ?? [];
    if (candidates.length === 1 && candidates[0].url) {
      assert.equal(
        row.url,
        candidates[0].url,
        `${row.airportCode} ${row.name} 的官方網址不應遺失`,
      );
    }
  }
});

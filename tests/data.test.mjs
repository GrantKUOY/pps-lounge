import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

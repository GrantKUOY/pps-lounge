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

function canonicalizeOfficialUrl(url, airportCode) {
  if (airportCode !== "TPE") return String(url ?? "");
  return String(url ?? "").replace(
    "https://my.prioritypass.com/en-GB/lounges/taiwan/",
    "https://www.prioritypass.com/en-GB/lounges/taiwan-region/",
  );
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

test("人工下架規則可稽核、slug 唯一且精確對應來源資料", async () => {
  const removals = JSON.parse(
    await readFile(
      new URL("../data/manual-removals.json", import.meta.url),
      "utf8",
    ),
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
  const seenSlugs = new Set();

  for (const removal of removals) {
    for (const field of [
      "airportCode",
      "type",
      "name",
      "slug",
      "source",
      "reason",
    ]) {
      assert.equal(
        typeof removal[field],
        "string",
        `人工下架規則 ${field} 必須是字串`,
      );
      assert.ok(removal[field].trim(), `人工下架規則 ${field} 不得為空`);
    }
    assert.ok(!seenSlugs.has(removal.slug), `slug 不得重複：${removal.slug}`);
    seenSlugs.add(removal.slug);

    const matches = sourceRows.filter((row) => {
      if (!row.url) return false;
      return (
        new URL(row.url).pathname.split("/").at(-1) === removal.slug &&
        row.airportCode === removal.airportCode &&
        row.type === removal.type &&
        row.name === removal.name
      );
    });
    assert.equal(matches.length, 1, `${removal.slug} 必須精確命中一筆來源資料`);
  }
});

test("冰島 KEF 餐飲據點包含 Jomfruin 與 Elda", async () => {
  const rows = JSON.parse(
    await readFile(new URL("../data/lounges.json", import.meta.url), "utf8"),
  );
  const kefDining = rows
    .filter((row) => row.airportCode === "KEF" && row.type === "EAT")
    .sort((left, right) => left.name.localeCompare(right.name));

  assert.deepEqual(
    kefDining.map((row) => row.name),
    ["Elda", "Jomfruin"],
  );
  assert.equal(
    kefDining.find((row) => row.name === "Elda")?.url,
    "https://www.prioritypass.com/en-GB/lounges/iceland/keflavik-international/kef1d-elda",
  );
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
        canonicalizeOfficialUrl(candidates[0].url, row.airportCode),
        `${row.airportCode} ${row.name} 的官方網址不應遺失`,
      );
    }
  }
});

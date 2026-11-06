import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildLoungeSlugs, slugifyName } from "../scripts/slug.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relative) =>
  JSON.parse(readFileSync(path.join(ROOT, relative), "utf8"));

const rows = readJson("data/lounges.json");
const scope = readJson("data/page-scope.json");

// 資料本身沒有 OKA（沖繩那霸）與 ISG（石垣）的任何據點，屬已知缺漏；
// 未來資料補上後此清單必須同步更新，測試會提醒。
const KNOWN_MISSING_AIRPORTS = ["ISG", "OKA"];

test("slugifyName：小寫、非英數字元轉連字號、修剪", () => {
  assert.equal(slugifyName("Oriental Club Lounge"), "oriental-club-lounge");
  assert.equal(slugifyName("  Plaza Premium (T2) "), "plaza-premium-t2");
  assert.equal(slugifyName("SATS Premier Lounge"), "sats-premier-lounge");
});

test("slug：全 1,754 筆唯一", () => {
  const slugs = buildLoungeSlugs(rows);
  assert.equal(slugs.length, rows.length);
  assert.equal(new Set(slugs).size, rows.length);
});

test("slug：同輸入同輸出（重跑穩定）", () => {
  assert.deepEqual(buildLoungeSlugs(rows), buildLoungeSlugs(rows));
});

test("slug：格式合法（小寫英數與連字號）且不超長", () => {
  for (const slug of buildLoungeSlugs(rows)) {
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(slug.length <= 72, `slug 過長：${slug}`);
  }
});

test("範圍檔：機場覆蓋盤點（缺漏者列出）", () => {
  const present = new Set(rows.map((row) => row.airportCode));
  const missing = scope.airports.filter((code) => !present.has(code)).sort();
  console.log(
    `page-scope 缺漏機場（資料無據點）：${missing.join(", ") || "無"}`,
  );
  assert.deepEqual(missing, KNOWN_MISSING_AIRPORTS);
});

test("產生頁：範圍內機場頁與貴賓室頁數量與資料一致", () => {
  const presentCodes = scope.airports.filter((code) =>
    rows.some((row) => row.airportCode === code),
  );
  const airportDirs = existsSync(path.join(ROOT, "airport"))
    ? readdirSync(path.join(ROOT, "airport"))
    : [];
  assert.equal(
    airportDirs.length,
    presentCodes.length,
    "機場頁數量不符，請先跑 npm run generate",
  );

  const scopeRowCount = rows.filter((row) =>
    scope.airports.includes(row.airportCode),
  ).length;
  const loungeDirs = existsSync(path.join(ROOT, "lounge"))
    ? readdirSync(path.join(ROOT, "lounge"))
    : [];
  assert.equal(
    loungeDirs.length,
    scopeRowCount,
    "貴賓室頁數量不符，請先跑 npm run generate",
  );

  const sitemap = readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  const urlCount = (sitemap.match(/<url>/g) ?? []).length;
  assert.equal(urlCount, 2 + presentCodes.length + scopeRowCount);
});

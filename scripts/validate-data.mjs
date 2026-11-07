import { readFile } from "node:fs/promises";

const rows = JSON.parse(await readFile("data/lounges.json", "utf8"));
const plans = JSON.parse(await readFile("data/plans.json", "utf8"));
const errors = [];

if (rows.length !== 1754) {
  errors.push(`expected 1754 rows, got ${rows.length}`);
}

for (const [index, row] of rows.entries()) {
  if (!/^[A-Z0-9]{3}$/.test(row.airportCode)) {
    errors.push(`row ${index}: invalid airportCode`);
  }
  for (const key of ["airportName", "name", "searchText"]) {
    if (typeof row[key] !== "string") {
      errors.push(`row ${index}: ${key} must be a string`);
    }
  }
  if (!Array.isArray(row.facilities)) {
    errors.push(`row ${index}: facilities must be an array`);
  }
  if (row.url) {
    try {
      const url = new URL(row.url);
      if (url.protocol !== "https:") {
        errors.push(`row ${index}: url must use https`);
      }
    } catch {
      errors.push(`row ${index}: invalid url`);
    }
  }
  // 資料面守門（wave2）：conditions 英文全文不得出現在公開資料中。
  // 任一筆存在非空 conditions 欄位即視為管線異常（extract 或轉換腳本
  // 未正確剝除），直接報錯；全文母本保留於 .baseline 快照與 vault CSV。
  if (typeof row.conditions === "string" && row.conditions.trim()) {
    errors.push(
      `row ${index}: conditions must not be present in public data (wave2)`,
    );
  }
  // conditions_excerpt 為公開資料唯一的條件欄位：每筆必須存在，
  // 值為 null 或長度 ≤ 200 字元的字串（規則見 scripts/excerpt.mjs）。
  if (!("conditions_excerpt" in row)) {
    errors.push(`row ${index}: conditions_excerpt is missing`);
  } else if (
    row.conditions_excerpt !== null &&
    (typeof row.conditions_excerpt !== "string" ||
      row.conditions_excerpt.length > 200)
  ) {
    errors.push(
      `row ${index}: conditions_excerpt must be null or a string of at most 200 chars`,
    );
  }
  // 查證三欄骨架（last_verified / data_source / status_flag）：
  // 每筆都必須存在此三欄；缺欄視為資料產生流程異常，直接報錯，
  // 不靜默視為未查證，避免重新產生資料時掉欄而無人察覺。
  // 語意說明見 data/SCHEMA.md。
  for (const field of ["last_verified", "data_source", "status_flag"]) {
    if (!(field in row)) {
      errors.push(`row ${index}: ${field} is missing`);
    }
  }
  if ("last_verified" in row && row.last_verified !== null) {
    const value = row.last_verified;
    const validDate =
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (!validDate) {
      errors.push(
        `row ${index}: last_verified must be null or a valid YYYY-MM-DD date`,
      );
    }
  }
  if (
    "data_source" in row &&
    row.data_source !== null &&
    (typeof row.data_source !== "string" || !row.data_source.trim())
  ) {
    errors.push(`row ${index}: data_source must be null or a non-empty string`);
  }
  if (
    "status_flag" in row &&
    row.status_flag !== null &&
    !["ok", "pending", "closed"].includes(row.status_flag)
  ) {
    errors.push(
      `row ${index}: status_flag must be null, "ok", "pending" or "closed"`,
    );
  }
}

// 計畫主表守門（wave2-5a）：每計畫必填欄位齊全、每條差異附官方來源
// （https 原文短引），aspect/display 必須在列舉值內，避免主表悄悄掉欄
// 或混入無出處的規則敘述。
const PLAN_ASPECTS = ["dining", "guests", "enrollment", "exclusions"];
const PLAN_DISPLAYS = ["detail", "detail_dining", "page"];
const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};
const isDateString = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

if (!Array.isArray(plans) || plans.length === 0) {
  errors.push("plans: data/plans.json must be a non-empty array");
}
const seenPlanIds = new Set();
for (const [index, plan] of (Array.isArray(plans) ? plans : []).entries()) {
  for (const key of ["id", "name", "issuer"]) {
    if (typeof plan[key] !== "string" || !plan[key].trim()) {
      errors.push(`plan ${index}: ${key} must be a non-empty string`);
    }
  }
  if (typeof plan.id === "string") {
    if (seenPlanIds.has(plan.id)) {
      errors.push(`plan ${index}: duplicate id ${plan.id}`);
    }
    seenPlanIds.add(plan.id);
  }
  if (!isHttpsUrl(plan.official_url)) {
    errors.push(`plan ${index}: official_url must be an https URL`);
  }
  if (!isDateString(plan.verified_at)) {
    errors.push(`plan ${index}: verified_at must be a valid YYYY-MM-DD date`);
  }
  if (typeof plan.participates_in_hints !== "boolean") {
    errors.push(`plan ${index}: participates_in_hints must be a boolean`);
  }
  if (
    "nature_note" in plan &&
    (typeof plan.nature_note !== "string" || !plan.nature_note.trim())
  ) {
    errors.push(`plan ${index}: nature_note must be a non-empty string when present`);
  }
  if (!Array.isArray(plan.differences) || plan.differences.length === 0) {
    errors.push(`plan ${index}: differences must be a non-empty array`);
    continue;
  }
  for (const [diffIndex, diff] of plan.differences.entries()) {
    if (!PLAN_ASPECTS.includes(diff.aspect)) {
      errors.push(`plan ${index} diff ${diffIndex}: invalid aspect`);
    }
    if (!PLAN_DISPLAYS.includes(diff.display)) {
      errors.push(`plan ${index} diff ${diffIndex}: invalid display`);
    }
    if (typeof diff.summary_zh !== "string" || !diff.summary_zh.trim()) {
      errors.push(`plan ${index} diff ${diffIndex}: summary_zh must be non-empty`);
    }
    if (!isHttpsUrl(diff.source_url)) {
      errors.push(`plan ${index} diff ${diffIndex}: source_url must be an https URL`);
    }
    if (typeof diff.quote !== "string" || !diff.quote.trim()) {
      errors.push(`plan ${index} diff ${diffIndex}: quote must be non-empty`);
    }
  }
}

if (errors.length) {
  console.error(errors.slice(0, 20).join("\n"));
  console.error(`validation failed with ${errors.length} errors`);
  process.exitCode = 1;
} else {
  const airports = new Set(rows.map((row) => row.airportCode)).size;
  console.log(`validated ${rows.length} rows across ${airports} airports`);
  const diffCount = plans.reduce((sum, plan) => sum + plan.differences.length, 0);
  console.log(`validated ${plans.length} plans with ${diffCount} differences`);
}

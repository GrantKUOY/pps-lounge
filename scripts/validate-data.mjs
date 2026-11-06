import { readFile } from "node:fs/promises";

const rows = JSON.parse(await readFile("data/lounges.json", "utf8"));
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

if (errors.length) {
  console.error(errors.slice(0, 20).join("\n"));
  console.error(`validation failed with ${errors.length} errors`);
  process.exitCode = 1;
} else {
  const airports = new Set(rows.map((row) => row.airportCode)).size;
  console.log(`validated ${rows.length} rows across ${airports} airports`);
}

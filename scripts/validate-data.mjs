import { readFile } from "node:fs/promises";

const rows = JSON.parse(await readFile("data/lounges.json", "utf8"));
const errors = [];

if (rows.length !== 1755) {
  errors.push(`expected 1755 rows, got ${rows.length}`);
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
}

if (errors.length) {
  console.error(errors.slice(0, 20).join("\n"));
  console.error(`validation failed with ${errors.length} errors`);
  process.exitCode = 1;
} else {
  const airports = new Set(rows.map((row) => row.airportCode)).size;
  console.log(`validated ${rows.length} rows across ${airports} airports`);
}

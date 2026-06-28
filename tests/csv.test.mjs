import test from "node:test";
import assert from "node:assert/strict";
import { CSV_HEADERS, toCsv } from "../assets/csv.js";

const row = {
  country: "Taiwan",
  city: "Taoyuan",
  airportCode: "TPE",
  airportName: "Taiwan Taoyuan International Airport",
  type: "LOUNGE",
  typeLabel: "貴賓室",
  name: 'A "quoted" lounge',
  location: "Terminal 1",
  openingHours: "24 hours daily",
  conditions: "Maximum 3 hour stay",
  facilities: ["Wi-Fi", "Showers"],
  url: "https://www.prioritypass.com/test",
};

test("CSV 保留正式欄位並正確處理引號與設施", () => {
  const csv = toCsv([row]);
  assert.equal(csv.split("\r\n")[0], CSV_HEADERS.join(","));
  assert.match(csv, /"A ""quoted"" lounge"/);
  assert.match(csv, /"Wi-Fi \| Showers"/);
});

test("空結果不產生 CSV", () => {
  assert.throws(() => toCsv([]), /no rows to export/);
});

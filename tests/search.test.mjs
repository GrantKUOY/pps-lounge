import test from "node:test";
import assert from "node:assert/strict";
import {
  createSearchIndex,
  filterRecords,
  paginate,
  searchRecords,
  sortRecords,
} from "../assets/search.js";

const rows = [
  {
    airportCode: "TSA",
    airportName: "Taipei Songshan Airport",
    city: "Taipei",
    country: "Taiwan",
    name: "Lounge B",
    type: "LOUNGE",
    facilities: [],
    searchText: "台北 松山 taipei",
  },
  {
    airportCode: "TPE",
    airportName: "Taiwan Taoyuan International Airport",
    city: "Taoyuan",
    country: "Taiwan",
    name: "Lounge A",
    type: "LOUNGE",
    facilities: ["Showers", "Wi-Fi"],
    searchText: "台北 桃園 taipei taoyuan",
  },
  {
    airportCode: "NRT",
    airportName: "Narita International Airport",
    city: "Tokyo",
    country: "Japan",
    name: "Lounge C",
    type: "EAT",
    facilities: ["Wi-Fi"],
    searchText: "東京 成田 tokyo narita",
  },
];

const indexed = createSearchIndex(rows);

test("精確機場代碼結果優先", () => {
  assert.equal(searchRecords(indexed, "TPE")[0].airportCode, "TPE");
});

test("有效三碼機場代碼不會誤中 accepted 等英文子字串", () => {
  const trap = createSearchIndex([
    rows[1],
    {
      ...rows[2],
      airportCode: "MPL",
      city: "Montpellier",
      searchText: "montpellier digital card accepted",
    },
  ]);
  assert.deepEqual(
    searchRecords(trap, "TPE").map((row) => row.airportCode),
    ["TPE"],
  );
});

test("中文搜尋別名可找到機場", () => {
  assert.deepEqual(
    searchRecords(indexed, "桃園").map((row) => row.airportCode),
    ["TPE"],
  );
});

test("複合篩選同時套用國家、類型與設施", () => {
  const found = filterRecords(indexed, {
    country: "Taiwan",
    type: "LOUNGE",
    facility: "Showers",
  });
  assert.deepEqual(found.map((row) => row.airportCode), ["TPE"]);
});

test("依機場代碼排序", () => {
  assert.deepEqual(
    sortRecords(indexed, "airportCode").map((row) => row.airportCode),
    ["NRT", "TPE", "TSA"],
  );
});

test("分頁會限制頁碼並回報範圍", () => {
  assert.deepEqual(paginate(indexed, 5, 2), {
    page: 2,
    pageSize: 2,
    totalPages: 2,
    totalItems: 3,
    start: 3,
    end: 3,
    rows: [indexed[2]],
  });
});

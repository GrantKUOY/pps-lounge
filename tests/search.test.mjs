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
  {
    airportCode: "FRA",
    airportName: "Frankfurt Airport",
    city: "Frankfurt",
    country: "Germany",
    name: "Lounge D",
    type: "LOUNGE",
    facilities: ["Wi-Fi"],
    searchText: "法蘭克福 frankfurt",
  },
  {
    airportCode: "JFK",
    airportName: "John F Kennedy International Airport",
    city: "New York",
    country: "United States of America",
    name: "Lounge E",
    type: "LOUNGE",
    facilities: ["Wi-Fi"],
    searchText: "紐約 new york",
  },
  {
    airportCode: "GRU",
    airportName: "Sao Paulo Guarulhos International Airport",
    city: "Sao Paulo",
    country: "Brazil",
    name: "Lounge F",
    type: "EAT",
    facilities: ["Wi-Fi"],
    searchText: "聖保羅 sao paulo",
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

test("地區篩選可與類型篩選疊加", () => {
  const found = filterRecords(indexed, {
    region: "asia",
    type: "LOUNGE",
  });
  assert.deepEqual(found.map((row) => row.airportCode), ["TSA", "TPE"]);
});

test("北美洲與南美洲地區篩選可依國家歸類", () => {
  assert.deepEqual(
    filterRecords(indexed, { region: "north-america" }).map((row) => row.airportCode),
    ["JFK"],
  );
  assert.deepEqual(
    filterRecords(indexed, { region: "south-america" }).map((row) => row.airportCode),
    ["GRU"],
  );
});

test("依機場代碼排序", () => {
  assert.deepEqual(
    sortRecords(indexed, "airportCode").map((row) => row.airportCode),
    ["FRA", "GRU", "JFK", "NRT", "TPE", "TSA"],
  );
});

test("分頁會限制頁碼並回報範圍", () => {
  assert.deepEqual(paginate(indexed, 5, 2), {
    page: 3,
    pageSize: 2,
    totalPages: 3,
    totalItems: 6,
    start: 5,
    end: 6,
    rows: [indexed[4], indexed[5]],
  });
});

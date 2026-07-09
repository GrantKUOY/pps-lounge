import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  configureLocalizedNames,
  displayCityName,
  displayCountryName,
} from "../assets/localized-names.js";

async function readCityNames() {
  return JSON.parse(
    await readFile(
      new URL("../data/localization/city-names-zh-tw.json", import.meta.url),
      "utf8",
    ),
  );
}

test("國家與城市顯示台灣用語中文且保留英文原值", () => {
  assert.equal(displayCountryName("Taiwan"), "Taiwan（台灣）");
  assert.equal(displayCountryName("United States of America"), "United States of America（美國）");
  assert.equal(displayCountryName("South Korea"), "South Korea（韓國）");

  assert.equal(displayCityName("Taoyuan"), "Taoyuan（桃園）");
  assert.equal(displayCityName("Seoul"), "Seoul（首爾）");
  assert.equal(displayCityName("Sydney"), "Sydney（雪梨）");
});

test("沒有可靠台灣譯名時維持英文名稱", () => {
  assert.equal(displayCityName("Aalborg"), "Aalborg");
});

test("目前資料內所有國家與地區都有台灣用語中文顯示", async () => {
  const rows = JSON.parse(
    await readFile(new URL("../data/lounges.json", import.meta.url), "utf8"),
  );
  const missing = [...new Set(rows.map((row) => row.country).filter(Boolean))]
    .filter((country) => !displayCountryName(country).includes("（"))
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

  assert.deepEqual(missing, []);
});

test("高頻機場城市白名單顯示台灣常用中文", () => {
  const expected = new Map([
    ["Abu Dhabi", "阿布達比"],
    ["Amsterdam", "阿姆斯特丹"],
    ["Bangkok", "曼谷"],
    ["Beijing", "北京"],
    ["Doha", "杜哈"],
    ["Dubai", "杜拜"],
    ["Frankfurt", "法蘭克福"],
    ["Hong Kong", "香港"],
    ["Istanbul", "伊斯坦堡"],
    ["Kuala Lumpur", "吉隆坡"],
    ["London", "倫敦"],
    ["Los Angeles", "洛杉磯"],
    ["Melbourne", "墨爾本"],
    ["Narita", "成田"],
    ["New York", "紐約"],
    ["Paris", "巴黎"],
    ["Seoul", "首爾"],
    ["Singapore", "新加坡"],
    ["Sydney", "雪梨"],
    ["Taoyuan", "桃園"],
    ["Tokyo", "東京"],
    ["Vancouver", "溫哥華"],
  ]);

  for (const [city, localized] of expected) {
    assert.equal(displayCityName(city), `${city}（${localized}）`);
  }
});

test("城市中文對照檔可維護且覆蓋目前資料 100%", async () => {
  const [rows, cityNames] = await Promise.all([
    readFile(new URL("../data/lounges.json", import.meta.url), "utf8").then(JSON.parse),
    readCityNames(),
  ]);
  configureLocalizedNames({ cityNamesZhTw: cityNames });

  const cities = [...new Set(rows.map((row) => row.city).filter(Boolean))];
  const translated = cities.filter((city) => displayCityName(city).includes("（"));

  assert.equal(translated.length, cities.length);
  assert.equal(displayCityName("Abu Dhabi"), "Abu Dhabi（阿布達比）");
  assert.equal(displayCityName("São Paulo"), "São Paulo（聖保羅）");
  assert.equal(displayCityName("Kaohsiung (Xiaogang)"), "Kaohsiung (Xiaogang)（高雄小港）");
});

test("城市中文草稿避免明顯的非地名誤配", async () => {
  const cityNames = await readCityNames();
  configureLocalizedNames({ cityNamesZhTw: cityNames });

  assert.equal(displayCityName("Belém"), "Belém（貝倫）");
  assert.equal(displayCityName("Dehong (Mangshi)"), "Dehong (Mangshi)（德宏芒市）");
  assert.equal(displayCityName("Baltimore"), "Baltimore（巴爾的摩）");
  assert.equal(displayCityName("Buffalo"), "Buffalo（水牛城）");
  assert.equal(displayCityName("Bâle / Mulhouse"), "Bâle / Mulhouse（巴塞爾／米盧斯）");
  assert.equal(displayCityName("Bandar Seri Begawan"), "Bandar Seri Begawan（斯里巴加灣市）");
  assert.equal(displayCityName("Bridgetown"), "Bridgetown（布里奇敦）");
});

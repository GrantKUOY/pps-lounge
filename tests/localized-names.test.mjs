import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  displayCityName,
  displayCountryName,
} from "../assets/localized-names.js";

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

import test from "node:test";
import assert from "node:assert/strict";
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
  assert.equal(displayCountryName("Antigua and Barbuda"), "Antigua and Barbuda");
  assert.equal(displayCityName("Aalborg"), "Aalborg");
});

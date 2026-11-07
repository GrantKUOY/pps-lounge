import test from "node:test";
import assert from "node:assert/strict";

import {
  CONDITIONS_EXCERPT_LIMIT,
  conditionsExcerpt,
} from "../scripts/excerpt.mjs";

test("excerpt 上限常數為 200 字元", () => {
  assert.equal(CONDITIONS_EXCERPT_LIMIT, 200);
});

test("無分隔的短字串原樣回傳", () => {
  assert.equal(conditionsExcerpt("Maximum 3 hour stay"), "Maximum 3 hour stay");
});

test("多段依序納入，直到再加一段會超過上限為止", () => {
  const seg1 = "A".repeat(100);
  const seg2 = "B".repeat(90);
  const seg3 = "C".repeat(10);
  // 100 + 3 + 90 = 193 可納入；再加 seg3 為 193 + 3 + 10 = 206 超限捨棄。
  const result = conditionsExcerpt(`${seg1} - ${seg2} - ${seg3}`);
  assert.equal(result, `${seg1} - ${seg2}`);
  assert.equal(result.length, 193);
});

test("總長恰等於上限時該段納入", () => {
  const seg1 = "A".repeat(100);
  const seg2 = "B".repeat(97);
  const result = conditionsExcerpt(`${seg1} - ${seg2}`);
  assert.equal(result, `${seg1} - ${seg2}`);
  assert.equal(result.length, 200);
});

test("加一段會超過上限 1 字元時只取第一段", () => {
  const seg1 = "A".repeat(100);
  const seg2 = "B".repeat(98);
  assert.equal(conditionsExcerpt(`${seg1} - ${seg2}`), seg1);
});

test("單段本身超過上限時硬截至 200 字元", () => {
  const result = conditionsExcerpt("X".repeat(250));
  assert.equal(result, "X".repeat(200));
  assert.equal(result.length, 200);
});

test("第一段超長且有後段時同樣硬截，不含後段", () => {
  const result = conditionsExcerpt(`${"Y".repeat(300)} - short tail`);
  assert.equal(result, "Y".repeat(200));
});

test("空段被跳過、段首尾空白被修剪", () => {
  assert.equal(conditionsExcerpt("Alpha - Beta - "), "Alpha - Beta");
  assert.equal(conditionsExcerpt(" - Alpha"), "Alpha");
  assert.equal(conditionsExcerpt("  Alpha  -  Beta  "), "Alpha - Beta");
});

test("無有效內容時回傳 null", () => {
  assert.equal(conditionsExcerpt(""), null);
  assert.equal(conditionsExcerpt("   "), null);
  assert.equal(conditionsExcerpt(null), null);
  assert.equal(conditionsExcerpt(undefined), null);
  assert.equal(conditionsExcerpt(123), null);
});

test("純函式：同輸入多次呼叫結果相同且不更動輸入", () => {
  const input = `${"A".repeat(50)} - ${"B".repeat(50)}`;
  assert.equal(conditionsExcerpt(input), conditionsExcerpt(input));
  assert.equal(input.length, 103);
});

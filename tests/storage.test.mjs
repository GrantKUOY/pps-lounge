import test from "node:test";
import assert from "node:assert/strict";
import { readRecent, writeRecent } from "../assets/storage.js";

test("最近搜尋去除重複並限制五筆", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(
    writeRecent(["TPE", "NRT", "TPE", "KIX", "MXP", "LHR", "JFK"], storage),
    true,
  );
  assert.deepEqual(readRecent(storage), ["TPE", "NRT", "KIX", "MXP", "LHR"]);
});

test("localStorage 不可用時無害降級", () => {
  const broken = {
    getItem: () => {
      throw new DOMException("blocked");
    },
    setItem: () => {
      throw new DOMException("blocked");
    },
  };

  assert.deepEqual(readRecent(broken), []);
  assert.equal(writeRecent(["TPE"], broken), false);
});

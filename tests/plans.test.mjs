import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { planHints, renderPlanBand } from "../assets/plans.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relative) =>
  JSON.parse(readFileSync(path.join(ROOT, relative), "utf8"));
const readText = (relative) => readFileSync(path.join(ROOT, relative), "utf8");

const plans = readJson("data/plans.json");
const byId = (id) => plans.find((plan) => plan.id === id);

const ASPECTS = ["dining", "guests", "enrollment", "exclusions"];
const DISPLAYS = ["detail", "detail_dining", "page"];

test("plans 資料：6 計畫、id 固定且不重複", () => {
  assert.equal(plans.length, 6);
  assert.deepEqual(
    plans.map((plan) => plan.id),
    [
      "amex-platinum",
      "hsbc-us-elite",
      "venture-x",
      "chase-sapphire-reserve",
      "esun-world-ufirst",
      "hsbc-tw-traveler",
    ],
  );
});

test("plans 資料：必填欄位齊全，每條差異附 https 官方來源與原文引述", () => {
  for (const plan of plans) {
    assert.ok(plan.name.trim());
    assert.ok(plan.issuer.trim());
    assert.equal(new URL(plan.official_url).protocol, "https:");
    assert.equal(plan.verified_at, "2026-11-07");
    assert.equal(typeof plan.participates_in_hints, "boolean");
    assert.ok(plan.differences.length > 0);
    for (const diff of plan.differences) {
      assert.ok(ASPECTS.includes(diff.aspect), `${plan.id}: ${diff.aspect}`);
      assert.ok(DISPLAYS.includes(diff.display), `${plan.id}: ${diff.display}`);
      assert.ok(diff.summary_zh.trim());
      assert.equal(new URL(diff.source_url).protocol, "https:");
      assert.ok(diff.quote.trim());
    }
  }
});

test("plans 資料：參加提示旗標（僅玉山為 false）與性質註記", () => {
  for (const plan of plans) {
    assert.equal(
      plan.participates_in_hints,
      plan.id !== "esun-world-ufirst",
      plan.id,
    );
  }
  assert.match(byId("esun-world-ufirst").nature_note, /並非 Priority Pass 會籍/);
  assert.match(byId("hsbc-tw-traveler").nature_note, /滙豐旅人卡發放/);
});

test("planHints：玉山不參加提示，任何據點類型都回空陣列", () => {
  assert.deepEqual(planHints(byId("esun-world-ufirst"), "EAT"), []);
  assert.deepEqual(planHints(byId("esun-world-ufirst"), "LOUNGE"), []);
  assert.deepEqual(planHints(null, "EAT"), []);
  assert.deepEqual(planHints(undefined, "LOUNGE"), []);
});

test("planHints：dining 條目只在非 LOUNGE 據點出現", () => {
  const hsbcUs = byId("hsbc-us-elite");
  const loungeAspects = planHints(hsbcUs, "LOUNGE").map((diff) => diff.aspect);
  assert.deepEqual(loungeAspects, ["guests"]);
  const eatAspects = planHints(hsbcUs, "EAT").map((diff) => diff.aspect);
  assert.deepEqual(eatAspects, ["dining", "guests"]);
  // 非 LOUNGE 的其他類型（REST、REFRESH 等）同樣包含 dining 條目。
  assert.ok(
    planHints(byId("chase-sapphire-reserve"), "REST").some(
      (diff) => diff.aspect === "dining",
    ),
  );
});

test("planHints：HSBC 台灣在 LOUNGE 含 enrollment 與刷卡門檻條目", () => {
  const hints = planHints(byId("hsbc-tw-traveler"), "LOUNGE");
  const aspects = hints.map((diff) => diff.aspect);
  assert.ok(aspects.includes("enrollment"));
  assert.ok(aspects.includes("guests"));
  assert.ok(!aspects.includes("dining"));
  assert.ok(
    hints.some(
      (diff) =>
        diff.aspect === "exclusions" && diff.summary_zh.includes("刷卡門檻"),
    ),
  );
});

test("renderPlanBand：有命中時產出提示帶，玉山回 null", () => {
  const band = renderPlanBand(byId("venture-x"), "EAT");
  assert.match(band, /你的計畫：Priority Pass（Capital One Venture X 附帶）/);
  assert.match(band, /賓客/);
  assert.match(band, /計畫規則核對：2026-11/);
  assert.match(band, /看計畫比較/);
  assert.equal(renderPlanBand(byId("esun-world-ufirst"), "EAT"), null);
  assert.equal(renderPlanBand(null, "EAT"), null);
});

test("紅線句式掃描：plans 資料與提示相關檔案不得出現入場結論句式", () => {
  const banned = ["你可以進", "不能進", "保證適用", "保證入場"];
  const targets = {
    "data/plans.json": readText("data/plans.json"),
    "assets/plans.js": readText("assets/plans.js"),
    "plans.html": readText("plans.html"),
  };
  for (const [file, content] of Object.entries(targets)) {
    for (const phrase of banned) {
      assert.equal(
        content.includes(phrase),
        false,
        `${file} 不得包含紅線句式「${phrase}」`,
      );
    }
  }
  // 提示帶實際渲染結果同樣不得出現（逐計畫逐類型掃描）。
  for (const plan of plans) {
    for (const type of ["LOUNGE", "EAT", "REST", "REFRESH", "UNWIND"]) {
      const band = renderPlanBand(plan, type) ?? "";
      for (const phrase of banned) {
        assert.equal(band.includes(phrase), false, `${plan.id}/${type}`);
      }
    }
  }
});

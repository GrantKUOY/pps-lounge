import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const notifySource = readFileSync(new URL("../api/notify-report.js", import.meta.url), "utf8");

test("審核通知信使用目前部署 host 產生 admin 與 action URL", () => {
  assert.match(notifySource, /function deploymentOrigin/);
  assert.match(notifySource, /req\.headers\.host/);
  assert.match(notifySource, /adminUrl = `\$\{origin\}\/admin\.html`/);
  assert.match(notifySource, /api\/review-report/);
  assert.match(notifySource, /action=approved/);
  assert.match(notifySource, /action=rejected/);
});

test("email 直接核准與拒絕連結仍需管理 token", () => {
  const reviewSource = readFileSync(new URL("../api/review-report.js", import.meta.url), "utf8");

  assert.match(reviewSource, /process\.env\.PPS_ADMIN_TOKEN/);
  assert.match(reviewSource, /searchParams\.get\("token"\)/);
  assert.match(reviewSource, /action.*approved.*rejected/s);
  assert.match(reviewSource, /supabaseAdmin/);
});

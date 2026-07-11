import test from "node:test";
import assert from "node:assert/strict";

import {
  communityReportsHtml,
  sanitizePublicReport,
  storagePublicUrl,
  validateReportDraft,
  validateReportPhotos,
} from "../assets/community.js";
import { readFileSync } from "node:fs";

test("投稿草稿驗證必填欄位、評分範圍並預設 pending", () => {
  const result = validateReportDraft({
    loungeKey: "taiwan-tpe-oriental-club-lounge",
    airportCode: "TPE",
    loungeName: "Oriental Club Lounge",
    nickname: "GrantK",
    email: "grant@example.com",
    visitDate: "2026-07-10",
    entryResult: "success",
    queueLevel: "short",
    crowdLevel: "busy",
    foodRating: 3,
    overallRating: 4,
    body: "晚上人不少，但還能找到座位。",
  });

  assert.equal(result.valid, true);
  assert.equal(result.data.status, "pending");
  assert.equal(result.data.airportCode, "TPE");
  assert.equal(result.data.email, "grant@example.com");
});

test("投稿草稿拒絕缺少 email、心得與超出範圍的評分", () => {
  const result = validateReportDraft({
    loungeKey: "taiwan-tpe-oriental-club-lounge",
    airportCode: "TPE",
    loungeName: "Oriental Club Lounge",
    nickname: "GrantK",
    visitDate: "2026-07-10",
    entryResult: "success",
    queueLevel: "short",
    crowdLevel: "busy",
    foodRating: 6,
    overallRating: 0,
    body: "",
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, {
    body: "請填寫體驗心得。",
    email: "請填寫有效 email，僅供審核聯絡使用。",
    foodRating: "餐飲評價必須是 1 到 5 分。",
    overallRating: "整體評分必須是 1 到 5 分。",
  });
});

test("照片驗證最多 5 張且只接受 JPEG、PNG、WebP", () => {
  const photos = [
    { name: "1.jpg", type: "image/jpeg", size: 1000 },
    { name: "2.png", type: "image/png", size: 1000 },
    { name: "3.webp", type: "image/webp", size: 1000 },
    { name: "4.jpg", type: "image/jpeg", size: 1000 },
    { name: "5.jpg", type: "image/jpeg", size: 1000 },
    { name: "6.gif", type: "image/gif", size: 1000 },
  ];

  const result = validateReportPhotos(photos);

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    "每筆投稿最多可上傳 5 張照片。",
    "只接受 JPEG、PNG 或 WebP 圖片。",
  ]);
});

test("公開報告資料會移除 email、管理備註與審核者欄位", () => {
  const report = sanitizePublicReport({
    id: "r1",
    loungeKey: "taiwan-tpe-oriental-club-lounge",
    airportCode: "TPE",
    loungeName: "Oriental Club Lounge",
    nickname: "GrantK",
    email: "grant@example.com",
    visitDate: "2026-07-10",
    entryResult: "success",
    queueLevel: "short",
    crowdLevel: "busy",
    foodRating: 3,
    overallRating: 4,
    body: "晚上人不少。",
    status: "approved",
    adminNote: "可公開",
    reviewedBy: "admin",
  });

  assert.equal(report.nickname, "GrantK");
  assert.equal(report.status, "approved");
  assert.equal("email" in report, false);
  assert.equal("adminNote" in report, false);
  assert.equal("reviewedBy" in report, false);
});

test("旅客 Data Points 呈現 approved 投稿且不輸出 email", () => {
  const html = communityReportsHtml([
    {
      id: "r1",
      nickname: "GrantK",
      email: "grant@example.com",
      visitDate: "2026-07-10",
      entryResult: "success",
      queueLevel: "short",
      crowdLevel: "busy",
      foodRating: 3,
      overallRating: 4,
      body: "<script>alert(1)</script>晚上人不少。",
      status: "approved",
      photos: [{ publicUrl: "https://example.com/photo.jpg", alt: "餐點" }],
    },
  ]);

  assert.match(html, /旅客 Data Points/);
  assert.match(html, /成功入場/);
  assert.match(html, /整體 4\/5/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /grant@example.com/);
});

test("Storage 上傳 policy 使用 security definer 檢查 pending report", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260711_lounge_reports.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /create or replace function public\.can_upload_lounge_report_photo/);
  assert.match(migration, /security definer/);
  assert.match(migration, /to anon/);
  assert.match(migration, /public\.can_upload_lounge_report_photo\(storage\.objects\.name\)/);
});

test("Storage path 可轉成公開照片 URL", () => {
  const url = storagePublicUrl(
    "https://example.supabase.co",
    "pending/report-1/0.jpg",
  );

  assert.equal(
    url,
    "https://example.supabase.co/storage/v1/object/public/lounge-report-photos/pending/report-1/0.jpg",
  );
});

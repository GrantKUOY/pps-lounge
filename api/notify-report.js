import { json, readJson } from "./_shared/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.PPS_REVIEW_EMAIL;
  if (!apiKey || !to) return json(res, 202, { ok: true, skipped: "email_env_not_configured" });

  const body = await readJson(req);
  const adminUrl = process.env.PPS_ADMIN_URL || "https://pps-lounge.vercel.app/admin.html";
  const subject = `[PPS] 新投稿待審：${body.airportCode || ""} ${body.loungeName || ""}`.trim();
  const text = [
    "有新的 PPS Lounge 旅客 Data Point 待審。",
    "",
    `機場：${body.airportCode || "未提供"}`,
    `貴賓室：${body.loungeName || "未提供"}`,
    `暱稱：${body.nickname || "未提供"}`,
    `到訪日期：${body.visitDate || "未提供"}`,
    `整體評分：${body.overallRating || "未提供"}/5`,
    "",
    "心得摘要：",
    body.body || "",
    "",
    `審核頁：${adminUrl}`,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.PPS_REVIEW_FROM || "PPS Journal <onboarding@resend.dev>",
      to,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    return json(res, 502, { error: "email_send_failed" });
  }
  return json(res, 200, { ok: true });
}

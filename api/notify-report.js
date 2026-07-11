import { json, readJson } from "./_shared/supabase.js";

function deploymentOrigin(req) {
  const host = req.headers.host;
  const protocol = host?.includes("localhost") ? "http" : "https";
  return host ? `${protocol}://${host}` : "https://pps-lounge.vercel.app";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.PPS_REVIEW_EMAIL;
  if (!apiKey || !to) return json(res, 202, { ok: true, skipped: "email_env_not_configured" });

  const body = await readJson(req);
  const origin = deploymentOrigin(req);
  const adminUrl = `${origin}/admin.html`;
  const actionParams = new URLSearchParams({
    id: body.reportId || "",
    token: process.env.PPS_ADMIN_TOKEN || "",
  });
  const approveUrl = `${origin}/api/review-report?${actionParams.toString()}&action=approved`;
  const rejectUrl = `${origin}/api/review-report?${actionParams.toString()}&action=rejected`;
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
    `核准：${approveUrl}`,
    `拒絕：${rejectUrl}`,
  ].join("\n");
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.55;color:#1f2933">
      <p>有新的 PPS Lounge 旅客 Data Point 待審。</p>
      <p>
        <strong>機場：</strong>${escapeHtml(body.airportCode || "未提供")}<br>
        <strong>貴賓室：</strong>${escapeHtml(body.loungeName || "未提供")}<br>
        <strong>暱稱：</strong>${escapeHtml(body.nickname || "未提供")}<br>
        <strong>到訪日期：</strong>${escapeHtml(body.visitDate || "未提供")}<br>
        <strong>整體評分：</strong>${escapeHtml(body.overallRating || "未提供")}/5
      </p>
      <p><strong>心得摘要：</strong></p>
      <p style="white-space:pre-wrap">${escapeHtml(body.body || "")}</p>
      <p>
        <a href="${approveUrl}" style="display:inline-block;margin-right:8px;padding:10px 14px;background:#245b43;color:#fff;text-decoration:none;border-radius:6px">核准公開</a>
        <a href="${rejectUrl}" style="display:inline-block;margin-right:8px;padding:10px 14px;background:#7a2634;color:#fff;text-decoration:none;border-radius:6px">拒絕</a>
        <a href="${adminUrl}" style="display:inline-block;padding:10px 14px;background:#eef2f6;color:#1f2933;text-decoration:none;border-radius:6px">開啟審核頁</a>
      </p>
    </div>`;

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
      html,
    }),
  });

  if (!response.ok) {
    return json(res, 502, { error: "email_send_failed" });
  }
  return json(res, 200, { ok: true });
}

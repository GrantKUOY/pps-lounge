import { supabaseAdmin } from "./_shared/supabase.js";

function sendHtml(res, status, title, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55;margin:0;padding:32px;background:#f6f3ef;color:#1f2933}
    main{max-width:640px;margin:auto;background:white;border:1px solid #e4ddd4;border-radius:8px;padding:24px}
    a{color:#6f2736}
  </style>
</head>
<body><main><h1>${title}</h1><p>${message}</p><p><a href="/">回 PPS Journal</a></p></main></body>
</html>`);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendHtml(res, 405, "不支援的操作", "這個審核連結只接受 GET。");
  }

  const url = new URL(req.url, "https://pps.local");
  const id = url.searchParams.get("id") || "";
  const action = url.searchParams.get("action") || "";
  const token = url.searchParams.get("token") || "";
  const expected = process.env.PPS_ADMIN_TOKEN || "";

  if (!expected || token !== expected) {
    return sendHtml(res, 401, "審核連結無效", "管理 token 不正確或尚未設定。");
  }

  if (!id || !["approved", "rejected"].includes(action)) {
    return sendHtml(res, 400, "審核參數無效", "缺少投稿 ID，或 action 不是 approved / rejected。");
  }

  try {
    await supabaseAdmin(`/rest/v1/lounge_reports?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        status: action,
        reviewed_at: new Date().toISOString(),
        reviewed_by: "email-action",
      }),
    });
    const label = action === "approved" ? "核准公開" : "拒絕";
    return sendHtml(res, 200, `已${label}`, "這筆旅客 Data Point 已完成審核。");
  } catch (error) {
    return sendHtml(res, 500, "審核失敗", error.message || "請回審核頁手動處理。");
  }
}

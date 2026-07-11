export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function requireAdmin(req, res) {
  const expected = process.env.PPS_ADMIN_TOKEN;
  const header = req.headers.authorization || "";
  if (!expected || header !== `Bearer ${expected}`) {
    json(res, 401, { error: "unauthorized" });
    return false;
  }
  return true;
}

export async function supabaseAdmin(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing_supabase_admin_env");
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`supabase_${response.status}_${text.slice(0, 160)}`);
  }
  return text ? JSON.parse(text) : null;
}

import {
  json,
  readJson,
  requireAdmin,
  supabaseAdmin,
} from "./_shared/supabase.js";

const adminSelect = [
  "id", "lounge_key", "airport_code", "lounge_name", "nickname", "email",
  "visit_date", "airline_flight", "cabin_class", "access_source",
  "entry_result", "queue_level", "crowd_level", "food_rating", "rest_rating",
  "overall_rating", "body", "status", "admin_note", "reviewed_at",
  "reviewed_by", "created_at",
].join(",");

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      const url = new URL(req.url, "https://pps.local");
      const status = url.searchParams.get("status") || "pending";
      const data = await supabaseAdmin(
        `/rest/v1/lounge_reports?status=eq.${encodeURIComponent(status)}&select=${adminSelect}&order=created_at.desc&limit=100`,
      );
      return json(res, 200, { reports: data });
    }

    if (req.method === "PATCH") {
      const body = await readJson(req);
      if (!body.id || !["approved", "rejected"].includes(body.status)) {
        return json(res, 400, { error: "invalid_status_update" });
      }
      await supabaseAdmin(`/rest/v1/lounge_reports?id=eq.${encodeURIComponent(body.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          status: body.status,
          admin_note: body.adminNote || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: "grant-admin",
        }),
      });
      return json(res, 200, { ok: true });
    }

    if (req.method === "DELETE") {
      const body = await readJson(req);
      if (!body.id) return json(res, 400, { error: "missing_id" });
      await supabaseAdmin(`/rest/v1/lounge_reports?id=eq.${encodeURIComponent(body.id)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}

import { json } from "./_shared/supabase.js";

export default function handler(_req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
  json(res, 200, {
    enabled: Boolean(supabaseUrl && supabaseAnonKey),
    supabaseUrl,
    supabaseAnonKey,
    maxPhotoSize: Number(process.env.PPS_REPORT_MAX_PHOTO_SIZE || 5 * 1024 * 1024),
  });
}

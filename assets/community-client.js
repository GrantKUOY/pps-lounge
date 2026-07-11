import {
  loungeKeyForRow,
  sanitizePublicReport,
  storagePublicUrl,
  validateReportDraft,
  validateReportPhotos,
} from "./community.js";

let configPromise;

export async function loadCommunityConfig() {
  if (!configPromise) {
    configPromise = fetch("api/community-config", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null)
      .then((config) => ({
        enabled: Boolean(config?.enabled && config?.supabaseUrl && config?.supabaseAnonKey),
        supabaseUrl: config?.supabaseUrl ?? "",
        supabaseAnonKey: config?.supabaseAnonKey ?? "",
        maxPhotoSize: Number(config?.maxPhotoSize) || 5 * 1024 * 1024,
      }));
  }
  return configPromise;
}

function supabaseHeaders(config, extra = {}) {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    ...extra,
  };
}

async function supabaseFetch(config, path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    ...options,
    headers: supabaseHeaders(config, options.headers),
  });
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Supabase HTTP ${response.status}${errorDetailSuffix(text)}`);
  }
  if (!text) return null;
  return JSON.parse(text);
}

function errorDetailSuffix(value) {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    const message = parsed.message || parsed.error || parsed.msg || "";
    return message ? `：${message}` : "";
  } catch {
    return `：${String(value).slice(0, 120)}`;
  }
}

export async function fetchApprovedReports(row) {
  const config = await loadCommunityConfig();
  if (!config.enabled) return { enabled: false, reports: [] };

  const loungeKey = loungeKeyForRow(row);
  const select = [
    "id", "lounge_key", "airport_code", "lounge_name", "nickname",
    "visit_date", "entry_result", "queue_level", "crowd_level",
    "food_rating", "rest_rating", "overall_rating", "body", "status",
    "created_at",
  ].join(",");
  const reports = await supabaseFetch(
    config,
    `/rest/v1/lounge_reports?lounge_key=eq.${encodeURIComponent(loungeKey)}&status=eq.approved&select=${select}&order=visit_date.desc&limit=12`,
  );
  const reportIds = reports.map((report) => report.id).filter(Boolean);
  const photosByReport = new Map(reportIds.map((id) => [id, []]));
  if (reportIds.length) {
    const photos = await supabaseFetch(
      config,
      `/rest/v1/lounge_report_photos?report_id=in.(${reportIds.map(encodeURIComponent).join(",")})&select=report_id,storage_path,public_url,sort_order&order=sort_order.asc`,
    );
    for (const photo of photos ?? []) {
      const list = photosByReport.get(photo.report_id);
      if (!list) continue;
      list.push({
        publicUrl: photo.public_url || storagePublicUrl(config.supabaseUrl, photo.storage_path),
        public_url: photo.public_url || storagePublicUrl(config.supabaseUrl, photo.storage_path),
      });
    }
  }

  return {
    enabled: true,
    reports: reports.map((report) => sanitizePublicReport({
      ...report,
      loungeKey: report.lounge_key,
      airportCode: report.airport_code,
      loungeName: report.lounge_name,
      visitDate: report.visit_date,
      entryResult: report.entry_result,
      queueLevel: report.queue_level,
      crowdLevel: report.crowd_level,
      foodRating: report.food_rating,
      restRating: report.rest_rating,
      overallRating: report.overall_rating,
      photos: photosByReport.get(report.id) ?? [],
    })),
  };
}

async function uploadPhotos(config, reportId, photos) {
  const uploaded = [];
  for (const [index, photo] of Array.from(photos).entries()) {
    const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    const path = `pending/${reportId}/${index}.${extension}`;
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/lounge-report-photos/${path}`, {
      method: "POST",
      headers: supabaseHeaders(config, {
        "Content-Type": photo.type,
        "x-upsert": "false",
      }),
      body: photo,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const label = photo.name ? ` ${photo.name}` : "";
      throw new Error(`第 ${index + 1} 張照片${label} 上傳失敗（HTTP ${response.status}）${errorDetailSuffix(detail)}`);
    }
    uploaded.push({
      report_id: reportId,
      storage_path: path,
      sort_order: index,
      mime_type: photo.type,
      size_bytes: photo.size,
    });
  }
  return uploaded;
}

export async function submitCommunityReport(row, input, photos = []) {
  const config = await loadCommunityConfig();
  if (!config.enabled) {
    return { ok: false, message: "投稿後端尚未設定，請稍後再試。" };
  }

  const draft = validateReportDraft({
    ...input,
    loungeKey: loungeKeyForRow(row),
    airportCode: row.airportCode,
    loungeName: row.name,
  });
  const photoCheck = validateReportPhotos(photos, { maxSize: config.maxPhotoSize });
  if (!draft.valid || !photoCheck.valid) {
    return { ok: false, errors: draft.errors, photoErrors: photoCheck.errors };
  }

  const reportId = crypto.randomUUID();
  const payload = {
    id: reportId,
    lounge_key: draft.data.loungeKey,
    airport_code: draft.data.airportCode,
    lounge_name: draft.data.loungeName,
    nickname: draft.data.nickname,
    email: draft.data.email,
    visit_date: draft.data.visitDate,
    airline_flight: draft.data.airlineFlight || null,
    cabin_class: draft.data.cabinClass || null,
    access_source: draft.data.accessSource || null,
    entry_result: draft.data.entryResult,
    queue_level: draft.data.queueLevel,
    crowd_level: draft.data.crowdLevel,
    food_rating: draft.data.foodRating,
    rest_rating: draft.data.restRating,
    overall_rating: draft.data.overallRating,
    body: draft.data.body,
    status: "pending",
  };

  await supabaseFetch(config, "/rest/v1/lounge_reports", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(payload),
  });

  const photoRows = await uploadPhotos(config, reportId, photos);
  if (photoRows.length) {
    await supabaseFetch(config, "/rest/v1/lounge_report_photos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(photoRows),
    });
  }

  fetch("api/notify-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reportId,
      airportCode: row.airportCode,
      loungeName: row.name,
      nickname: draft.data.nickname,
      visitDate: draft.data.visitDate,
      overallRating: draft.data.overallRating,
      body: draft.data.body.slice(0, 240),
    }),
  }).catch(() => {});

  return { ok: true, message: "已送出，審核通過後會公開顯示。" };
}

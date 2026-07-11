const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const defaultMaxPhotoSize = 5 * 1024 * 1024;

function trimString(value) {
  return String(value ?? "").trim();
}

function validateRequiredText(errors, key, value, message) {
  const text = trimString(value);
  if (!text) errors[key] = message;
  return text;
}

function validateRating(errors, key, value, message) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors[key] = message;
  }
  return rating;
}

export function validateReportDraft(input = {}) {
  const errors = {};
  const email = trimString(input.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "請填寫有效 email，僅供審核聯絡使用。";
  }

  const data = {
    loungeKey: validateRequiredText(errors, "loungeKey", input.loungeKey, "缺少貴賓室識別。"),
    airportCode: validateRequiredText(errors, "airportCode", input.airportCode, "缺少機場代碼。").toUpperCase(),
    loungeName: validateRequiredText(errors, "loungeName", input.loungeName, "缺少貴賓室名稱。"),
    nickname: validateRequiredText(errors, "nickname", input.nickname, "請填寫暱稱。"),
    email,
    visitDate: validateRequiredText(errors, "visitDate", input.visitDate, "請填寫到訪日期。"),
    airlineFlight: trimString(input.airlineFlight),
    cabinClass: trimString(input.cabinClass),
    accessSource: trimString(input.accessSource),
    entryResult: validateRequiredText(errors, "entryResult", input.entryResult, "請選擇入場結果。"),
    queueLevel: validateRequiredText(errors, "queueLevel", input.queueLevel, "請選擇排隊狀況。"),
    crowdLevel: validateRequiredText(errors, "crowdLevel", input.crowdLevel, "請選擇擁擠程度。"),
    foodRating: validateRating(errors, "foodRating", input.foodRating, "餐飲評價必須是 1 到 5 分。"),
    restRating: input.restRating === "" || input.restRating == null
      ? null
      : validateRating(errors, "restRating", input.restRating, "休息／安靜程度必須是 1 到 5 分。"),
    overallRating: validateRating(errors, "overallRating", input.overallRating, "整體評分必須是 1 到 5 分。"),
    body: validateRequiredText(errors, "body", input.body, "請填寫體驗心得。"),
    status: "pending",
  };

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  };
}

export function validateReportPhotos(
  photos = [],
  { maxCount = 5, maxSize = defaultMaxPhotoSize } = {},
) {
  const list = Array.from(photos ?? []);
  const errors = [];
  if (list.length > maxCount) errors.push(`每筆投稿最多可上傳 ${maxCount} 張照片。`);
  if (list.some((photo) => !allowedPhotoTypes.has(photo.type))) {
    errors.push("只接受 JPEG、PNG 或 WebP 圖片。");
  }
  if (list.some((photo) => Number(photo.size) > maxSize)) {
    errors.push(`單張照片不可超過 ${Math.round(maxSize / 1024 / 1024)} MB。`);
  }
  return { valid: errors.length === 0, errors };
}

export function sanitizePublicReport(report = {}) {
  const {
    email: _email,
    adminNote: _adminNote,
    reviewedBy: _reviewedBy,
    reviewed_at: _reviewedAtSnake,
    reviewed_by: _reviewedBySnake,
    admin_note: _adminNoteSnake,
    ...publicReport
  } = report;
  return publicReport;
}

export function loungeKeyForRow(row = {}) {
  const source = [
    row.country,
    row.airportCode,
    row.name,
    row.terminal || row.location,
  ].map((value) => trimString(value).toLowerCase()).join("-");
  return source
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

export function storagePublicUrl(supabaseUrl, storagePath) {
  const base = trimString(supabaseUrl).replace(/\/+$/, "");
  const path = trimString(storagePath).replace(/^\/+/, "");
  if (!base || !path) return "";
  return `${base}/storage/v1/object/public/lounge-report-photos/${path}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const entryLabels = {
  success: "成功入場",
  denied: "被拒絕入場",
  limited: "有限制入場",
  unknown: "未確認入場狀態",
};

const queueLabels = {
  none: "免排隊",
  short: "短隊伍",
  medium: "排隊中等",
  long: "排隊較久",
};

const crowdLabels = {
  quiet: "安靜",
  normal: "普通",
  busy: "偏多人",
  full: "接近客滿",
};

function formatVisitDate(value) {
  const text = trimString(value);
  return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : "未提供日期";
}

export function communityReportsHtml(reports = []) {
  const approved = reports
    .filter((report) => report.status === "approved")
    .map(sanitizePublicReport);

  if (!approved.length) {
    return `<section class="community-section" data-community-section>
      <div class="community-heading">
        <div>
          <p class="kicker">Traveler data points</p>
          <h3>旅客 Data Points</h3>
        </div>
        <button class="secondary-button" type="button" data-open-report-form>分享你的體驗</button>
      </div>
      <p class="community-empty">目前尚無旅客回報。你可以成為第一位分享者。</p>
    </section>`;
  }

  const average = approved.reduce((sum, report) => sum + Number(report.overallRating || 0), 0) / approved.length;
  const cards = approved.map((report) => {
    const photos = (report.photos ?? []).slice(0, 5).map((photo) => {
      const url = escapeHtml(photo.publicUrl ?? photo.public_url ?? "");
      const alt = escapeHtml(photo.alt || "旅客上傳照片");
      if (!url) return "";
      return `<button class="community-photo-button" type="button" data-lightbox-src="${url}" aria-label="放大照片：${alt}">
        <img src="${url}" alt="${alt}" loading="lazy">
      </button>`;
    }).join("");
    return `<article class="community-report">
      <div class="community-report-meta">
        <span>${escapeHtml(formatVisitDate(report.visitDate ?? report.visit_date))}</span>
        <span>${escapeHtml(entryLabels[report.entryResult ?? report.entry_result] ?? "入場狀態未提供")}</span>
        <span>${escapeHtml(queueLabels[report.queueLevel ?? report.queue_level] ?? "排隊未提供")}</span>
        <span>${escapeHtml(crowdLabels[report.crowdLevel ?? report.crowd_level] ?? "人潮未提供")}</span>
      </div>
      <p class="community-score">餐飲 ${escapeHtml(report.foodRating ?? report.food_rating)}/5 · 整體 ${escapeHtml(report.overallRating ?? report.overall_rating)}/5</p>
      <blockquote>${escapeHtml(report.body)}</blockquote>
      ${photos ? `<div class="community-photos">${photos}</div>` : ""}
      <p class="community-author">by ${escapeHtml(report.nickname)}</p>
    </article>`;
  }).join("");

  return `<section class="community-section" data-community-section>
    <div class="community-heading">
      <div>
        <p class="kicker">Traveler data points</p>
        <h3>旅客 Data Points</h3>
        <p>${approved.length} 則已審核回報 · 平均 ${average.toFixed(1)}/5</p>
      </div>
      <button class="secondary-button" type="button" data-open-report-form>分享你的體驗</button>
    </div>
    <div class="community-list">${cards}</div>
  </section>`;
}

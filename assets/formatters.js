export const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const FACILITY_LABELS = Object.freeze({
  "A la carte menu": "單點餐點",
  "Air conditioning": "空調",
  "Alcoholic drinks (Premium-brand)": "高級酒精飲品",
  "Alcoholic drinks (Standard)": "標準酒精飲品",
  "Conference facilities": "會議空間",
  "Digital card accepted": "支援電子會員卡",
  "Disabled access": "無障礙設施",
  "Fast track lane": "快速通關",
  "Flight information": "航班資訊",
  "Luggage storage": "行李寄放",
  "Massage chairs": "按摩椅",
  "Newspapers / magazines": "報章雜誌",
  "Shoe shine": "擦鞋服務",
  Showers: "淋浴間",
  "Soft drinks": "無酒精飲品",
  Telephone: "電話",
  Televisions: "電視",
  "Wi-Fi": "Wi‑Fi",
});

const DAY_LABELS = Object.freeze({
  Monday: "週一",
  Tuesday: "週二",
  Wednesday: "週三",
  Thursday: "週四",
  Friday: "週五",
  Saturday: "週六",
  Sunday: "週日",
});

export const formatFacility = (value) => FACILITY_LABELS[value] ?? value;

export function formatTerminal(value) {
  if (!value) return "未提供";
  return String(value)
    .replace(/New International Terminal/gi, "新國際航廈")
    .replace(/International Terminal/gi, "國際航廈")
    .replace(/Domestic Terminal/gi, "國內航廈")
    .replace(/Terminal\s+(\d+)/gi, "第 $1 航廈")
    .replace(/Terminal/gi, "航廈")
    .replace(/Landside/gi, "管制區外")
    .replace(/Airside/gi, "管制區內")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function formatLocation(value) {
  if (!value) return "未提供";
  return formatTerminal(value)
    .replace(/Departure Level/gi, "出發樓層")
    .replace(/Arrivals?/gi, "抵達區");
}

function formatHoursLine(line) {
  const value = String(line).trim();
  if (!value) return "";
  const dayMatch = value.match(
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):\s*(.+)$/i,
  );
  if (dayMatch) {
    const day =
      dayMatch[1][0].toUpperCase() + dayMatch[1].slice(1).toLowerCase();
    return `${DAY_LABELS[day]}：${formatHoursLine(dayMatch[2])}`;
  }
  if (/^24 hours daily\.?$/i.test(value)) return "每日 24 小時營業";
  return value
    .replace(
      /THIS LOUNGE IS TEMPORARILY CLOSED UNTIL FURTHER NOTICE\.?/gi,
      "此據點暫時關閉，恢復開放時間另行公告。",
    )
    .replace(
      /(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}) daily\.?/gi,
      "每日 $1 至 $2",
    )
    .replace(
      /(\d{2}:\d{2})\s*-\s*last flight\.?/gi,
      "$1 起至末班機前",
    )
    .replace(/^Note:\s*/i, "備註：")
    .replace(
      /Access may be restricted due to space constraints\.?/gi,
      "若現場客滿，可能限制入場。",
    )
    .trim();
}

export function formatOpeningHours(value) {
  if (!value) return "未提供";
  const output = String(value)
    .split(/\r?\n/)
    .map(formatHoursLine)
    .filter(Boolean);
  return output.join("\n") || "未提供";
}

function formatConditionSegment(segment) {
  const value = String(segment).trim().replace(/^\d+\.\s*/, "");
  if (!value) return "";
  const translated = value
    .replace(/Maximum (\d+) hour stay/gi, "最長可停留 $1 小時")
    .replace(
      /Children under (\d+) years (?:are )?admitted free/gi,
      "$1 歲以下兒童可免費入場",
    )
    .replace(/Children are not admitted\.?/gi, "不開放兒童入場")
    .replace(/No smoking \(including vaping\)/gi, "禁止吸菸與電子煙")
    .replace(/No dress code/gi, "無服裝規定")
    .replace(/Smart casual dress at all times\.?/gi, "請穿著整潔便服")
    .replace(
      /Access may be restricted due to space constraints\.?/gi,
      "若現場客滿，可能限制入場。",
    )
    .trim();

  if (/[A-Za-z][A-Za-z0-9&'(),.\-/:;+ ]{18,}/.test(translated)) {
    return "另有使用限制，請查看原始英文與官方頁面。";
  }
  return translated;
}

export function formatConditions(value) {
  if (!value) return "未提供";
  const segments = String(value).includes(" - ")
    ? String(value).split(/\s+-\s+/)
    : [String(value)];
  const output = segments.map(formatConditionSegment).filter(Boolean);
  return [...new Set(output)].join("\n") || "未提供";
}

export function safeExternalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

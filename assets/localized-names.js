const COUNTRY_NAMES_ZH_TW = new Map([
  ["Australia", "澳洲"],
  ["Canada", "加拿大"],
  ["China", "中國"],
  ["France", "法國"],
  ["Germany", "德國"],
  ["Hong Kong", "香港"],
  ["Iceland", "冰島"],
  ["India", "印度"],
  ["Indonesia", "印尼"],
  ["Italy", "義大利"],
  ["Japan", "日本"],
  ["Macao", "澳門"],
  ["Malaysia", "馬來西亞"],
  ["Netherlands", "荷蘭"],
  ["New Zealand", "紐西蘭"],
  ["Philippines", "菲律賓"],
  ["Singapore", "新加坡"],
  ["South Korea", "韓國"],
  ["Spain", "西班牙"],
  ["Switzerland", "瑞士"],
  ["Taiwan", "台灣"],
  ["Thailand", "泰國"],
  ["Turkey", "土耳其"],
  ["United Arab Emirates", "阿拉伯聯合大公國"],
  ["United Kingdom", "英國"],
  ["United States of America", "美國"],
  ["Vietnam", "越南"],
]);

const CITY_NAMES_ZH_TW = new Map([
  ["Amsterdam", "阿姆斯特丹"],
  ["Auckland", "奧克蘭"],
  ["Bangkok", "曼谷"],
  ["Beijing", "北京"],
  ["Brisbane", "布里斯本"],
  ["Busan", "釜山"],
  ["Dubai", "杜拜"],
  ["Frankfurt", "法蘭克福"],
  ["Hong Kong", "香港"],
  ["Istanbul", "伊斯坦堡"],
  ["Kuala Lumpur", "吉隆坡"],
  ["London", "倫敦"],
  ["Los Angeles", "洛杉磯"],
  ["Melbourne", "墨爾本"],
  ["Narita", "成田"],
  ["New York", "紐約"],
  ["Osaka", "大阪"],
  ["Paris", "巴黎"],
  ["Seoul", "首爾"],
  ["Shanghai", "上海"],
  ["Singapore", "新加坡"],
  ["Sydney", "雪梨"],
  ["Taoyuan", "桃園"],
  ["Tokyo", "東京"],
  ["Vancouver", "溫哥華"],
]);

function withZhTwName(value, names) {
  const localized = names.get(value);
  return localized ? `${value}（${localized}）` : value;
}

export function displayCountryName(value) {
  return withZhTwName(value, COUNTRY_NAMES_ZH_TW);
}

export function displayCityName(value) {
  return withZhTwName(value, CITY_NAMES_ZH_TW);
}

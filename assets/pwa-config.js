export const CACHE_NAME = "pps-journal-v2-1-public-v2";

export const CACHE_URLS = [
  "./",
  "index.html",
  "offline.html",
  "assets/styles.css",
  "assets/app.js",
  "assets/search.js",
  "assets/presentation.js",
  "assets/formatters.js",
  "assets/localized-names.js",
  "assets/storage.js",
  "assets/community.js",
  "assets/pwa-config.js",
  "data/lounges.json",
  "data/localization/city-names-zh-tw.json",
  "manifest.webmanifest",
  "icons/icon-192.svg",
  "icons/icon-512.svg",
];

function isPrivatePath(pathname) {
  return pathname === "/admin" ||
    pathname.endsWith("/admin") ||
    pathname.endsWith("/admin.html") ||
    pathname.startsWith("/api/");
}

export function shouldHandleNavigation(url) {
  return !isPrivatePath(url.pathname);
}

export function shouldRuntimeCache(request) {
  const url = new URL(request.url);
  return request.method === "GET" && !isPrivatePath(url.pathname);
}

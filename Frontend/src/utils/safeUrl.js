// Mirrors the backend's is_safe_media_url check (core/security.py). Used as a
// second line of defense before putting a stored, possibly-old string into an
// <a href> or <img src> — the backend now rejects anything else on save, but
// this guards data saved before that validation existed, and any other path
// a value could reach the DOM.
export function isSafeMediaUrl(value) {
  return typeof value === "string" && (value.startsWith("data:image/") || value.startsWith("https://"))
}

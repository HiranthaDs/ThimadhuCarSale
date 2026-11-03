// Production API requests must stay on the page's origin so browsers can keep
// the HttpOnly session cookie. Vite and the production host proxy /api.
export const BASE_URL = import.meta.env.PROD ? "/api" : (import.meta.env.VITE_API_URL || "/api")

let authEpoch = 0
export function advanceAuthEpoch() { authEpoch += 1 }
export function currentAuthEpoch() { return authEpoch }

export async function apiRequest(path, { method = "GET", body, headers: extraHeaders, signal, notifyOnUnauthorized = true } = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders }
  const requestEpoch = authEpoch

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      credentials: "include",
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }

  // 204 No Content (e.g. DELETE) has no body to parse.
  const isJson = response.headers.get("content-type")?.includes("application/json")
  const text = response.status === 204 ? "" : await response.text()
  let data = null
  if (text && isJson) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (response.ok && response.status !== 204 && !isJson) {
    throw new Error("The API proxy returned a page instead of data. Check the /api rewrite on the frontend host.")
  }

  if (!response.ok) {
    const message = data?.detail || `Request failed (${response.status})`
    if (response.status === 401 && notifyOnUnauthorized && requestEpoch === authEpoch) {
      // The token is missing, expired, or the account was deactivated
      // mid-session — bounce back to the login screen instead of leaving
      // the UI running against a dead session.
      window.dispatchEvent(new CustomEvent("thimadu:unauthorized"))
    }
    const error = new Error(typeof message === "string" ? message : "Request failed")
    error.status = response.status
    throw error
  }

  if (method !== "GET" && method !== "HEAD") {
    window.dispatchEvent(new CustomEvent("thimadu:data-changed"))
  }

  return data
}

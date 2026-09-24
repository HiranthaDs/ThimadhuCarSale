const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export async function apiRequest(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
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

  if (!response.ok) {
    const message = data?.detail || `Request failed (${response.status})`
    if (response.status === 401) {
      // The token is missing, expired, or the account was deactivated
      // mid-session — bounce back to the login screen instead of leaving
      // the UI running against a dead session.
      window.dispatchEvent(new CustomEvent("thimadu:unauthorized"))
    }
    throw new Error(typeof message === "string" ? message : "Request failed")
  }

  return data
}

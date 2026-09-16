import { apiRequest } from "./client"

export function createBlacklistEntry(token, payload) {
  return apiRequest("/blacklist/", { method: "POST", token, body: payload })
}

export function listBlacklistEntries(token, q) {
  const query = q ? `?q=${encodeURIComponent(q)}` : ""
  return apiRequest(`/blacklist/${query}`, { token })
}

export function deleteBlacklistEntry(token, id) {
  return apiRequest(`/blacklist/${id}`, { method: "DELETE", token })
}

import { apiRequest } from "./client"

export function createBlacklistEntry(token, payload) {
  return apiRequest("/blacklist/", { method: "POST", token, body: payload })
}

export function listBlacklistEntries(token, q, page = 0, status) {
  const query = `?limit=200&offset=${page * 200}&q=${encodeURIComponent(q || "")}${status ? `&status=${encodeURIComponent(status)}` : ""}`
  return apiRequest(`/blacklist/${query}`, { token })
}

export function deleteBlacklistEntry(token, id) {
  return apiRequest(`/blacklist/${id}`, { method: "DELETE", token })
}

export function updateBlacklistEntry(token, id, payload) {
  return apiRequest(`/blacklist/${id}`, { method: "PUT", token, body: payload })
}

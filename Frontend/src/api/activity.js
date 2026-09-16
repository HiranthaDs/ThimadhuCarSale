import { apiRequest } from "./client"

export function listActivityLogs(token, limit) {
  const query = limit ? `?limit=${encodeURIComponent(limit)}` : ""
  return apiRequest(`/activity/${query}`, { token })
}

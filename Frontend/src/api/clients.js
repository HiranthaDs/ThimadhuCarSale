import { apiRequest } from "./client"

export function createClientProfile(token, payload) {
  return apiRequest("/clients/", { method: "POST", token, body: payload })
}

export function listClientProfiles(token, q) {
  const query = q ? `?q=${encodeURIComponent(q)}` : ""
  return apiRequest(`/clients/${query}`, { token })
}

export function getClientProfile(token, id) {
  return apiRequest(`/clients/${id}`, { token })
}

export function deleteClientProfile(token, id) {
  return apiRequest(`/clients/${id}`, { method: "DELETE", token })
}

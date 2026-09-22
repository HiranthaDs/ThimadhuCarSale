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

export function updateClientProfile(token, id, payload) {
  return apiRequest(`/clients/${id}`, { method: "PUT", token, body: payload })
}

export function deleteClientProfile(token, id) {
  return apiRequest(`/clients/${id}`, { method: "DELETE", token })
}

export function approveClientProfile(token, id) {
  return apiRequest(`/clients/${id}/approve`, { method: "PATCH", token })
}

export function lookupScanReports(token, vehicleNumber) {
  return apiRequest(`/clients/scan-reports/lookup?vehicle_number=${encodeURIComponent(vehicleNumber)}`, { token })
}

export function listAllScanReports(token) {
  return apiRequest(`/clients/scan-reports/all`, { token })
}

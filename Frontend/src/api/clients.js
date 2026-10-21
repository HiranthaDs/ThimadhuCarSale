import { BASE_URL, apiRequest } from "./client"

export function getClientFormSchema(token) {
  return apiRequest("/clients/form-schema", { token })
}

export function saveClientFormSchema(token, fields, labels, hiddenFields, fieldTypes) {
  return apiRequest("/clients/form-schema", { method: "PUT", token, body: { fields, labels, hidden_fields: hiddenFields, field_types: fieldTypes } })
}

export function createClientProfile(token, payload) {
  return apiRequest("/clients/", { method: "POST", token, body: payload })
}

// awaitingMe: only the profiles waiting for the signed-in user's approval.
export function listClientProfiles(token, q, page = 0, { awaitingMe = false } = {}) {
  const query = `?limit=200&offset=${page * 200}&q=${encodeURIComponent(q || "")}${awaitingMe ? "&awaiting_me=true" : ""}`
  return apiRequest(`/clients/${query}`, { token })
}

export function getClientProfile(token, id) {
  return apiRequest(`/clients/${id}`, { token })
}

export function getFinalizedClientProfile(token, id) {
  return apiRequest(`/clients/${id}/finalized`, { token })
}

export async function getFinalizedClientImage(id, field, index) {
  let response
  try {
    response = await fetch(`${BASE_URL}/clients/${id}/finalized-image/${encodeURIComponent(field)}/${index}`, {
      credentials: "include",
    })
  } catch {
    throw new Error("Could not reach the server while downloading profile images.")
  }
  if (!response.ok) throw new Error(`Could not load a profile image (${response.status}).`)
  return response.blob()
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

export function listAllScanReports(token, q = "") {
  return apiRequest(`/clients/scan-reports/all?limit=50&q=${encodeURIComponent(q)}`, { token })
}

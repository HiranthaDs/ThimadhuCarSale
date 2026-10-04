import { BASE_URL, apiRequest } from "./client"

async function parseResponse(response, fallbackMessage) {
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
    if (response.status === 401) window.dispatchEvent(new CustomEvent("thimadu:unauthorized"))
    const message = data?.detail || `${fallbackMessage} (${response.status})`
    throw new Error(typeof message === "string" ? message : fallbackMessage)
  }

  return data
}

function buildReportFormData(file, meta = {}) {
  const formData = new FormData()
  formData.append("file", file)
  if (meta.registrationNumber) formData.append("registration_number", meta.registrationNumber)
  if (meta.vehicleTitle) formData.append("vehicle_title", meta.vehicleTitle)
  if (meta.buyerName) formData.append("buyer_name", meta.buyerName)
  // Sent as a file part: plain text fields are capped at 1MB by the server, and
  // the form data carries every inspection photo.
  if (meta.formData) {
    const json = new Blob([JSON.stringify(meta.formData)], { type: "application/json" })
    formData.append("form_data", json, "form_data.json")
  }
  return formData
}

export async function uploadReportPdf(token, file, meta = {}) {
  let response
  try {
    response = await fetch(`${BASE_URL}/reports/pdf`, {
      method: "POST",
      credentials: "include",
      body: buildReportFormData(file, meta),
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }
  return parseResponse(response, "Upload failed")
}

export async function replaceReportPdf(token, reportId, file, meta = {}) {
  let response
  try {
    response = await fetch(`${BASE_URL}/reports/${reportId}/pdf`, {
      method: "PUT",
      credentials: "include",
      body: buildReportFormData(file, meta),
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }
  return parseResponse(response, "Failed to update report")
}

export async function getReport(token, reportId) {
  let response
  try {
    response = await fetch(`${BASE_URL}/reports/${reportId}`, {
      credentials: "include",
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }
  return parseResponse(response, "Failed to load report")
}

export async function updateReport(token, reportId, meta = {}) {
  let response
  try {
    response = await fetch(`${BASE_URL}/reports/${reportId}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",

      },
      body: JSON.stringify({
        registration_number: meta.registrationNumber ?? null,
        vehicle_title: meta.vehicleTitle ?? null,
        buyer_name: meta.buyerName ?? null,
      }),
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }
  return parseResponse(response, "Failed to update report")
}

export async function createScan2Report(token, reportId) {
  let response
  try {
    response = await fetch(`${BASE_URL}/reports/${reportId}/scan2`, {
      method: "POST",
      credentials: "include",
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }
  return parseResponse(response, "Failed to create Inspection Report 2 copy")
}

export async function updateReportStatus(token, reportId, status) {
  let response
  try {
    response = await fetch(`${BASE_URL}/reports/${reportId}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",

      },
      body: JSON.stringify({ status }),
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }
  return parseResponse(response, "Failed to update status")
}

export async function deleteReport(token, reportId) {
  let response
  try {
    response = await fetch(`${BASE_URL}/reports/${reportId}`, {
      method: "DELETE",
      credentials: "include",
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }

  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent("thimadu:unauthorized"))
    const isJson = response.headers.get("content-type")?.includes("application/json")
    const data = isJson ? await response.json() : null
    const message = data?.detail || `Failed to delete report (${response.status})`
    throw new Error(typeof message === "string" ? message : "Failed to delete report")
  }
}

export async function downloadReportPdf(token, reportId) {
  let response
  try {
    response = await fetch(`${BASE_URL}/reports/${reportId}/download`, {
      credentials: "include",
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent("thimadu:unauthorized"))
    const isJson = response.headers.get("content-type")?.includes("application/json")
    const data = isJson ? await response.json() : null
    const message = data?.detail || `Failed to download report (${response.status})`
    throw new Error(typeof message === "string" ? message : "Failed to download report")
  }
  return response.blob()
}

export async function listReports(token, q, status, page = 0) {
  const url = new URL(`${BASE_URL}/reports/`, window.location.origin)
  url.searchParams.set("limit", "200")
  url.searchParams.set("offset", String(page * 200))
  if (q) url.searchParams.set("q", q)
  if (status) url.searchParams.set("status", status)

  let response
  try {
    response = await fetch(url, {
      credentials: "include",
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }
  return parseResponse(response, "Failed to load reports")
}

export async function listReportPairs(token, q, page = 0) {
  const pairs = await apiRequest(`/reports/copies?limit=100&offset=${page * 100}&q=${encodeURIComponent(q || "")}`)
  return pairs.flatMap(pair => pair.copy ? [pair.original, pair.copy] : [pair.original])
}

// Opens the PDF in the browser's viewer (a normal link, authenticated by the session cookie).
export function reportViewUrl(reportId) {
  return `${BASE_URL}/reports/${reportId}/view`
}

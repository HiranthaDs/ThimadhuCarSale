const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

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
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }
  return parseResponse(response, "Failed to create Scan 2 copy")
}

export async function updateReportStatus(token, reportId, status) {
  let response
  try {
    response = await fetch(`${BASE_URL}/reports/${reportId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }

  if (!response.ok) {
    const isJson = response.headers.get("content-type")?.includes("application/json")
    const data = isJson ? await response.json() : null
    const message = data?.detail || `Failed to delete report (${response.status})`
    throw new Error(typeof message === "string" ? message : "Failed to delete report")
  }
}

export async function listReports(token, q, status) {
  const url = new URL(`${BASE_URL}/reports/`)
  if (q) url.searchParams.set("q", q)
  if (status) url.searchParams.set("status", status)

  let response
  try {
    response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
  } catch {
    throw new Error("Could not reach the server. Is the backend running?")
  }
  return parseResponse(response, "Failed to load reports")
}

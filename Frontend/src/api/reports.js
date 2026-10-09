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

// Photos are uploaded ahead of the report in small batches and replaced by
// the signed references the server returns, so the final save request holds
// only the PDF and short strings, however many photos the report has.
// Uploaded photos are remembered, so "Retry Save" does not send them again.
const ATTACHMENT_BATCH_CHARS = 8 * 1024 * 1024
const ATTACHMENT_BATCH_COUNT = 20
const uploadedAttachments = new Map()

function collectDataUrls(value, into) {
  if (typeof value === "string") {
    if (value.startsWith("data:")) into.add(value)
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectDataUrls(v, into))
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collectDataUrls(v, into))
  }
}

function replaceDataUrls(value) {
  if (typeof value === "string") return uploadedAttachments.get(value) ?? value
  if (Array.isArray(value)) return value.map(replaceDataUrls)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceDataUrls(v)]))
  }
  return value
}

function pendingAttachments(formData) {
  const found = new Set()
  collectDataUrls(formData, found)
  return [...found].filter((v) => !uploadedAttachments.has(v))
}

async function offloadAttachments(token, formData, onSent) {
  const pending = pendingAttachments(formData)
  let batch = []
  let batchChars = 0
  async function flush() {
    if (batch.length === 0) return
    const { refs } = await apiRequest("/reports/attachments", { method: "POST", token, body: { files: batch } })
    batch.forEach((v, i) => uploadedAttachments.set(v, refs[i]))
    onSent?.(batchChars)
    batch = []
    batchChars = 0
  }
  for (const value of pending) {
    if (batch.length && (batchChars + value.length > ATTACHMENT_BATCH_CHARS || batch.length >= ATTACHMENT_BATCH_COUNT)) await flush()
    batch.push(value)
    batchChars += value.length
  }
  await flush()
  return replaceDataUrls(formData)
}

// Sends a multipart request with XMLHttpRequest, which (unlike fetch) reports
// upload progress, and returns a fetch Response for parseResponse.
function sendWithProgress(method, url, body, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded, e.total)
    xhr.onload = () => {
      const noBody = xhr.status === 204 || xhr.status === 205
      resolve(new Response(noBody ? null : xhr.responseText, {
        status: xhr.status,
        headers: { "content-type": xhr.getResponseHeader("content-type") || "" },
      }))
    }
    xhr.onerror = () => reject(new Error("Could not reach the server. Is the backend running?"))
    xhr.send(body)
  })
}

// Uploads the photos, then the PDF, calling onProgress(0..1) over both.
async function sendReport(token, method, url, file, meta, onProgress, fallbackMessage) {
  const photoChars = meta.formData ? pendingAttachments(meta.formData).reduce((sum, v) => sum + v.length, 0) : 0
  const total = photoChars + file.size || 1
  let sentPhotos = 0
  onProgress?.(0)
  if (meta.formData) {
    const formData = await offloadAttachments(token, meta.formData, (chars) => {
      sentPhotos += chars
      onProgress?.(sentPhotos / total)
    })
    meta = { ...meta, formData }
  }
  const response = await sendWithProgress(method, url, buildReportFormData(file, meta), (loaded, size) => {
    onProgress?.((sentPhotos + (loaded / size) * file.size) / total)
  })
  return parseResponse(response, fallbackMessage)
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

// onProgress, if given, is called with the fraction uploaded (0..1).
export function uploadReportPdf(token, file, meta = {}, onProgress) {
  return sendReport(token, "POST", `${BASE_URL}/reports/pdf`, file, meta, onProgress, "Upload failed")
}

export function replaceReportPdf(token, reportId, file, meta = {}, onProgress) {
  return sendReport(token, "PUT", `${BASE_URL}/reports/${reportId}/pdf`, file, meta, onProgress, "Failed to update report")
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

// [{ original, copy }] — each report with its Inspection Report 2 copy (or null),
// newest first. copiesOnly: only reports that have a copy, newest copy first.
export function listReportPairs(token, q, page = 0, { copiesOnly = false } = {}) {
  const query = `limit=100&offset=${page * 100}&q=${encodeURIComponent(q || "")}${copiesOnly ? "&copies_only=true" : ""}`
  return apiRequest(`/reports/copies?${query}`, { token })
}

// Opens the PDF in the browser's viewer (a normal link, authenticated by the session cookie).
export function reportViewUrl(reportId) {
  return `${BASE_URL}/reports/${reportId}/view`
}

// A role with the Approve tick approves a pending report before the owner checks it.
export function approveReport(token, reportId) {
  return apiRequest(`/reports/${reportId}/approve`, { method: "PATCH", token })
}

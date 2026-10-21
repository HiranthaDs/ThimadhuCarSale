import { useEffect, useState } from "react"
import { apiRequest } from "../../../api/client"
import { listActivityLogs } from "../../../api/activity"

// Existing list APIs are paginated; count every page instead of presenting a
// first-page count as a dealership total. Stop requesting after unmount.
async function summarize(path, current, reportRole) {
  let count = 0, review = 0, approved = 0, pending = 0
  for (let offset = 0; current(); offset += 200) {
    const rows = await apiRequest(`${path}${path.includes("?") ? "&" : "?"}limit=200&offset=${offset}`)
    count += rows.length
    approved += rows.filter(row => row.status === "checked").length
    pending += rows.filter(row => row.status === "pending").length
    review += rows.filter(row => row.status === "pending" && (reportRole === "owner" ? !row.waiting_for?.length : row.waiting_for?.includes(reportRole))).length
    if (rows.length < 200) return { count, review, approved, pending }
  }
  return null
}

async function countRows(path, current, pageSize = 200) {
  let count = 0
  for (let offset = 0; current(); offset += pageSize) {
    const rows = await apiRequest(`${path}${path.includes("?") ? "&" : "?"}limit=${pageSize}&offset=${offset}`)
    count += rows.length
    if (rows.length < pageSize) return count
  }
  return null
}

async function summarizeReport2(current, role) {
  let count = 0, review = 0, approved = 0, pending = 0
  for (let offset = 0; current(); offset += 100) {
    const pairs = await apiRequest(`/reports/copies?copies_only=true&limit=100&offset=${offset}`)
    count += pairs.length
    const copies = pairs.map(pair => pair.copy).filter(Boolean)
    approved += copies.filter(report => report.status === "checked").length
    pending += copies.filter(report => report.status === "pending").length
    review += copies.filter(report => report.status === "pending" && (role === "owner" ? !report.waiting_for?.length : report.waiting_for?.includes(role))).length
    if (pairs.length < 100) return { count, review, approved, pending }
  }
  return null
}

function requestStorageUsage() {
  const controller = new AbortController()
  let timeoutId
  return Promise.race([
    apiRequest("/reports/storage-usage", { signal: controller.signal }),
    new Promise((_, reject) => { timeoutId = window.setTimeout(() => {
      controller.abort()
      reject(new Error("Cloudflare storage check timed out."))
    }, 15000) }),
  ]).finally(() => window.clearTimeout(timeoutId))
}

export default function useOverview({ token, role, permissions }) {
  const approvalsAllowed = (role === "owner" || permissions.includes("clients.view")) && (role === "owner" || permissions.includes("clients.approve"))
  const reportsAllowed = role === "owner" || permissions.includes("reports.view")
  const reportsApprovalAllowed = role === "owner" || permissions.includes("reports.approve")
  const clientsAllowed = role === "owner" || permissions.includes("clients.view")
  const reports2Allowed = role === "owner" || permissions.includes("reports2.view")
  const reports2ApprovalAllowed = role === "owner" || permissions.includes("reports2.approve")
  const blacklistAllowed = role === "owner" || permissions.includes("blacklist.view")
  const activityAllowed = role === "owner" || permissions.includes("activity.view")
  const [state, setState] = useState({ approvals: null, reports: null, clients: null, reports2: null, blacklist: null, activity: null, storageUsage: null, errors: {} })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const refreshAfterChange = () => setRevision(value => value + 1)
    window.addEventListener("thimadu:data-changed", refreshAfterChange)
    return () => window.removeEventListener("thimadu:data-changed", refreshAfterChange)
  }, [])
  useEffect(() => {
    let active = true
    setState({ approvals: null, reports: null, clients: null, reports2: null, blacklist: null, activity: null, storageUsage: null, errors: {} })
    if (!token) return
    const requests = [
      ["approvals", approvalsAllowed, () => summarize("/clients/?awaiting_me=true", () => active)],
      ["reports", reportsAllowed, () => summarize("/reports/", () => active, role)],
      ["clients", clientsAllowed, () => countRows("/clients/", () => active)],
      ["reports2", reports2Allowed, () => summarizeReport2(() => active, role)],
      ["blacklist", blacklistAllowed, () => countRows("/blacklist/", () => active)],
      ["activity", activityAllowed, () => listActivityLogs(token, 4)],
      ["storageUsage", role === "owner", requestStorageUsage],
    ]
    for (const [key, allowed, request] of requests) {
      if (!allowed) continue
      request().then(value => { if (active) setState(prev => ({ ...prev, [key]: value })) }).catch(error => {
        if (active) setState(prev => ({ ...prev, errors: { ...prev.errors, [key]: error.message || "Could not load data." } }))
      })
    }
    return () => { active = false }
  }, [token, role, approvalsAllowed, reportsAllowed, reportsApprovalAllowed, clientsAllowed, reports2Allowed, reports2ApprovalAllowed, blacklistAllowed, activityAllowed, revision])
  return { ...state, approvalsAllowed, reportsAllowed, reportsApprovalAllowed, clientsAllowed, reports2Allowed, reports2ApprovalAllowed, blacklistAllowed, activityAllowed, storageAllowed: role === "owner", retry: () => setRevision(value => value + 1) }
}

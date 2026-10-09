import { useState } from "react"
import { approveReport } from "../../../api/reports"

const ROLE_LABELS = { ceo: "CEO", admin: "Admin", accountant: "Accountant", technician: "Technician" }

export const STATUS_LABELS = {
  pending: "Owner Check Pending",
  checked: "Checked by Owner",
  needs_modifications: "Needs Modifications",
}

export const STATUS_CLASSES = {
  pending: "tp-report-status-pending",
  checked: "tp-report-status-checked",
  needs_modifications: "tp-report-status-modifications",
}

export const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "checked", label: "Checked" },
  { value: "needs_modifications", label: "Needs Modifications" },
]

// waitingFor: roles that still have to approve before the owner can check it.
export function ReportStatusBadge({ status, waitingFor = [] }) {
  const key = status || "pending"
  const label = key === "pending" && waitingFor.length
    ? `Awaiting ${waitingFor.map((r) => ROLE_LABELS[r] || r).join(", ")}`
    : STATUS_LABELS[key] || STATUS_LABELS.pending
  return (
    <span className={`tp-report-status ${STATUS_CLASSES[key] || STATUS_CLASSES.pending}`}>
      {label}
    </span>
  )
}

// Shown only to someone whose role still has to approve this report.
export function ApproveReportButton({ token, report, onApproved, onError }) {
  const [busy, setBusy] = useState(false)
  if (!report.can_approve) return null

  async function handleClick() {
    onError?.("")
    setBusy(true)
    try {
      onApproved(await approveReport(token, report.id))
    } catch (err) {
      onError?.(err.message || "Failed to approve report.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className="tp-reports-btn tp-reports-btn-checked" disabled={busy} onClick={handleClick}>
      {busy ? "Approving…" : "Approve"}
    </button>
  )
}

export function ReportStatusFilter({ value, onChange }) {
  return (
    <div className="tp-status-filter">
      {STATUS_FILTERS.map((opt) => (
        <button
          key={opt.value || "all"}
          type="button"
          className={`tp-status-filter-btn${value === opt.value ? " tp-status-filter-btn-active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

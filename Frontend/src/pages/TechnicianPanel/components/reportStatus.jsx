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

export function ReportStatusBadge({ status }) {
  const key = status || "pending"
  return (
    <span className={`tp-report-status ${STATUS_CLASSES[key] || STATUS_CLASSES.pending}`}>
      {STATUS_LABELS[key] || STATUS_LABELS.pending}
    </span>
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

import { useEffect, useMemo, useState } from "react"
import { listActivityLogs } from "../../../api/activity"

const ROLE_LABELS = {
  owner: "Owner",
  co: "CO",
  accountant: "Accountant",
  technician: "Technician",
}

function roleLabel(role) {
  return ROLE_LABELS[role] || (role ? role[0].toUpperCase() + role.slice(1) : "Other")
}

function actionKind(action) {
  const a = (action || "").toLowerCase()
  if (a.includes("delete")) return "delete"
  if (a.includes("create")) return "create"
  if (a.includes("update") || a.includes("change") || a.includes("edit") || a.includes("activate")) return "update"
  return "other"
}

const CRUD_FILTERS = [
  { value: "all", label: "All" },
  { value: "create", label: "Created" },
  { value: "update", label: "Edited" },
  { value: "delete", label: "Deleted" },
]

function actionLabel(action) {
  if (!action) return "—"
  return action.split(".").join(" ").split("_").join(" ")
}

function ActionBadge({ action }) {
  const kind = actionKind(action)
  return <span className={`tp-activity-badge tp-activity-badge-${kind}`}>{actionLabel(action)}</span>
}

export default function ActivityLog({ token }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [dateFilter, setDateFilter] = useState("")
  const [kindFilter, setKindFilter] = useState("all")

  async function refresh() {
    setLoading(true)
    setError("")
    try {
      setEntries(await listActivityLogs(token))
    } catch (err) {
      setError(err.message || "Could not load activity log.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (kindFilter !== "all" && actionKind(entry.action) !== kindFilter) return false
      if (dateFilter) {
        const entryDate = new Date(entry.created_at)
        if (Number.isNaN(entryDate.getTime())) return false
        const localDate = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}-${String(
          entryDate.getDate()
        ).padStart(2, "0")}`
        if (localDate !== dateFilter) return false
      }
      return true
    })
  }, [entries, kindFilter, dateFilter])

  function clearFilters() {
    setDateFilter("")
    setKindFilter("all")
  }

  return (
    <div>
      <div className="tp-card">
        <div className="tp-card-head">
          <div className="tp-card-title">Activity Log</div>
        </div>

        <div className="tp-activity-filters">
          <div className="tp-activity-filter-group">
            <span className="tp-activity-filter-label">Date</span>
            <input
              type="date"
              className="tp-activity-date-input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          <div className="tp-activity-filter-group">
            <span className="tp-activity-filter-label">Action</span>
            <div className="tp-activity-action-filter">
              {CRUD_FILTERS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`tp-activity-action-btn${
                    kindFilter === opt.value ? ` tp-activity-action-btn-active tp-activity-action-${opt.value}` : ""
                  }`}
                  onClick={() => setKindFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {(dateFilter || kindFilter !== "all") && (
            <button type="button" className="tp-activity-clear-btn" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        {loading && <p>Loading activity…</p>}
        {error && <div className="tp-form-error">{error}</div>}

        {!loading && !error && (
          <table className="tp-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Action</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="tp-muted">
                    No activity matches these filters.
                  </td>
                </tr>
              )}
              {filteredEntries.map((entry) => (
                <tr key={entry.id}>
                  <td className="tp-muted">{new Date(entry.created_at).toLocaleString()}</td>
                  <td>{entry.actor_name}</td>
                  <td style={{ textTransform: "capitalize" }}>{roleLabel(entry.actor_role)}</td>
                  <td>
                    <ActionBadge action={entry.action} />
                  </td>
                  <td>{entry.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

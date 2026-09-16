import { useEffect, useState } from "react"
import { listActivityLogs } from "../../../api/activity"

const ROLE_LABELS = {
  owner: "Owner",
  staff: "Staff",
  technician: "Technician",
}

function roleLabel(role) {
  return ROLE_LABELS[role] || (role ? role[0].toUpperCase() + role.slice(1) : "Other")
}

export default function ActivityLog({ token }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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

  return (
    <div>
      <div className="tp-card">
        <div className="tp-card-head">
          <div className="tp-card-title">Activity Log</div>
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
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="tp-muted">
                    No activity recorded yet.
                  </td>
                </tr>
              )}
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="tp-muted">{new Date(entry.created_at).toLocaleString()}</td>
                  <td>{entry.actor_name}</td>
                  <td style={{ textTransform: "capitalize" }}>{roleLabel(entry.actor_role)}</td>
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

import { useEffect, useState } from "react"
import { deleteBlacklistEntry, listBlacklistEntries } from "../../../api/blacklist"
import { confirmDialog } from "../../../components/ConfirmDialog"
import VehicleBlacklistForm from "./VehicleBlacklistForm"
import VehicleBlacklistViewer from "./VehicleBlacklistViewer"
import "./VehicleBlacklist.css"

// Everyone with blacklist access can view and edit entries; only the owner can delete.
export default function VehicleBlacklist({ token, role }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [viewing, setViewing] = useState(null) // { entry, index }
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [actionError, setActionError] = useState("")
  const isOwner = role === "owner"

  async function refresh(q) {
    setLoading(true)
    setError("")
    try {
      setEntries(await listBlacklistEntries(token, q))
    } catch (err) {
      setError(err.message || "Could not load blacklist entries.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    const timer = setTimeout(() => refresh(search), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search])

  function handleCreated() {
    setShowForm(false)
    refresh(search)
  }

  function handleUpdated(updated) {
    setEditing(null)
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }

  async function handleDelete(entry) {
    const confirmed = await confirmDialog({
      title: "Delete blacklist entry?",
      message: `${entry.vehicle_number || entry.chassis_number || "This vehicle"} will be removed from the blacklist. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    })
    if (!confirmed) return
    setActionError("")
    setDeletingId(entry.id)
    try {
      await deleteBlacklistEntry(token, entry.id)
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))
    } catch (err) {
      setActionError(err.message || "Could not delete blacklist entry.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      {!showForm && (
        <button type="button" className="tp-inspection-btn" onClick={() => setShowForm(true)}>
          + Add Blacklisted Vehicle
        </button>
      )}

      {showForm && (
        <div className="vb-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <VehicleBlacklistForm token={token} onClose={() => setShowForm(false)} onCreated={handleCreated} />
        </div>
      )}

      {editing && (
        <div className="vb-overlay" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}>
          <VehicleBlacklistForm
            key={editing.id}
            token={token}
            entry={editing}
            onClose={() => setEditing(null)}
            onUpdated={handleUpdated}
          />
        </div>
      )}

      {viewing && (
        <VehicleBlacklistViewer entry={viewing.entry} startIndex={viewing.index} onClose={() => setViewing(null)} />
      )}

      {actionError && <div className="tp-form-error">{actionError}</div>}

      <div className="tp-card">
        <div className="tp-card-head">
          <div className="tp-card-title">Vehicle Blacklist</div>
        </div>

        <div className="cp-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search by vehicle number, chassis number, remarks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading && <p>Loading blacklist…</p>}
        {error && <div className="tp-form-error">{error}</div>}

        {!loading && !error && (
          <table className="tp-table">
            <thead>
              <tr>
                <th>Vehicle Number</th>
                <th>Chassis Number</th>
                <th>Remarks</th>
                <th>Images</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="tp-muted">
                    {search ? "No blacklist entries match your search." : "No blacklisted vehicles yet."}
                  </td>
                </tr>
              )}
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.vehicle_number || "—"}</td>
                  <td className="tp-muted">{entry.chassis_number || "—"}</td>
                  <td className="tp-muted">{entry.remarks || "—"}</td>
                  <td>
                    {entry.images.length > 0 ? (
                      <div className="tp-form-photo-strip vb-table-thumbs">
                        {entry.images.map((img, i) => (
                          <img
                            key={img.id}
                            src={img.image}
                            alt=""
                            title="Click to view"
                            onClick={() => setViewing({ entry, index: i })}
                          />
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="tp-muted">{new Date(entry.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="tp-reports-actions">
                      <button type="button" className="tp-reports-btn" onClick={() => setViewing({ entry, index: 0 })}>
                        View
                      </button>
                      <button type="button" className="tp-reports-btn" onClick={() => setEditing(entry)}>
                        Edit
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          className="tp-reports-btn tp-reports-btn-danger"
                          disabled={deletingId === entry.id}
                          onClick={() => handleDelete(entry)}
                        >
                          {deletingId === entry.id ? (
                            <>
                              <span className="tp-btn-spinner" aria-hidden="true" />
                              Deleting…
                            </>
                          ) : (
                            "Delete"
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

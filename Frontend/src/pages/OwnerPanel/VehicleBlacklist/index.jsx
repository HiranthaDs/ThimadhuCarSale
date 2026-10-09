import { useEffect, useRef, useState } from "react"
import { deleteBlacklistEntry, listBlacklistEntries } from "../../../api/blacklist"
import { confirmDialog } from "../../../components/ConfirmDialog"
import VehicleBlacklistForm from "./VehicleBlacklistForm"
import VehicleBlacklistViewer from "./VehicleBlacklistViewer"
import "./VehicleBlacklist.css"

// `can(permission)` says which actions the signed-in role may use; the owner
// panel leaves it out, giving full access.
const allowAll = () => true

export default function VehicleBlacklist({ token, can = allowAll }) {
  const requestNumber = useRef(0)
  const [page, setPage] = useState(0)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [viewing, setViewing] = useState(null) // { entry, index }
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [actionError, setActionError] = useState("")

  async function refresh(q) {
    setLoading(true)
    const requestId = ++requestNumber.current
    setError("")
    try {
      const data = await listBlacklistEntries(token, q, page)
      if (requestId === requestNumber.current) setEntries(data)
    } catch (err) {
      if (requestId === requestNumber.current) setError(err.message || "Could not load blacklist entries.")
    } finally {
      if (requestId === requestNumber.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    const timer = setTimeout(() => refresh(search), 300)
    return () => { clearTimeout(timer); requestNumber.current += 1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search, page])

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
      message: `${entry.vehicle_number || "This vehicle"} will be removed from the blacklist. This cannot be undone.`,
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
      {!showForm && can("blacklist.create") && (
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

        <div className="vb-search">
          <svg className="vb-search-icon" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search by vehicle number, mileage, remarks…"
            aria-label="Search blacklist"
            value={search}
            onChange={(e) => { setPage(0); setSearch(e.target.value) }}
          />
          {search && (
            <button type="button" className="vb-search-clear" aria-label="Clear search" onClick={() => { setPage(0); setSearch("") }}>
              ×
            </button>
          )}
        </div>

        {loading && <p>Loading blacklist…</p>}
        {error && <div className="tp-form-error">{error}</div>}

        {!loading && !error && (
          <table className="tp-table">
            <thead>
              <tr>
                <th>Vehicle Number</th>
                <th>Mileage</th>
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
                  <td className="tp-muted">{entry.mileage || "—"}</td>
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
                      {can("blacklist.edit") && (
                        <button type="button" className="tp-reports-btn" onClick={() => setEditing(entry)}>
                          Edit
                        </button>
                      )}
                      {can("blacklist.delete") && (
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

import { useEffect, useState } from "react"
import { listBlacklistEntries } from "../../../api/blacklist"
import VehicleBlacklistForm from "./VehicleBlacklistForm"

export default function VehicleBlacklist({ token }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")

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

  return (
    <div>
      {!showForm && (
        <button type="button" className="tp-inspection-btn" onClick={() => setShowForm(true)}>
          + Add Blacklisted Vehicle
        </button>
      )}

      {showForm && (
        <VehicleBlacklistForm token={token} onClose={() => setShowForm(false)} onCreated={handleCreated} />
      )}

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
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="tp-muted">
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
                      <div className="tp-form-photo-strip">
                        {entry.images.map((img) => (
                          <img key={img.id} src={img.image} alt="" />
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="tp-muted">{new Date(entry.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

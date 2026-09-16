import { useEffect, useState } from "react"
import { listClientProfiles } from "../../../api/clients"
import ClientProfileForm from "./ClientProfileForm"

export default function ClientProfiles({ token }) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")

  async function refresh(q) {
    setLoading(true)
    setError("")
    try {
      setProfiles(await listClientProfiles(token, q))
    } catch (err) {
      setError(err.message || "Could not load client profiles.")
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
          + Create Client Profile
        </button>
      )}

      {showForm && (
        <ClientProfileForm token={token} onClose={() => setShowForm(false)} onCreated={handleCreated} />
      )}

      <div className="tp-card">
        <div className="tp-card-head">
          <div className="tp-card-title">Client Profiles</div>
        </div>

        <div className="cp-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search by client name, phone, NIC, vehicle number, chassis, country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading && <p>Loading client profiles…</p>}
        {error && <div className="tp-form-error">{error}</div>}

        {!loading && !error && (
          <table className="tp-table">
            <thead>
              <tr>
                <th>Local Client</th>
                <th>Foreign Client</th>
                <th>NIC</th>
                <th>Vehicle No.</th>
                <th>Chassis No.</th>
                <th>Department</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={7} className="tp-muted">
                    {search ? "No client profiles match your search." : "No client profiles yet."}
                  </td>
                </tr>
              )}
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.has_local_client ? (
                      <>
                        {p.local_client_name}
                        {p.local_client_phone ? <div className="tp-muted">{p.local_client_phone}</div> : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {p.has_foreign_client ? (
                      <>
                        {p.foreign_client_name}
                        {p.foreign_client_country ? ` (${p.foreign_client_country})` : ""}
                        {p.foreign_client_phone ? <div className="tp-muted">{p.foreign_client_phone}</div> : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="tp-muted">{p.previous_owner_nic || "—"}</td>
                  <td>{p.vehicle_number || "—"}</td>
                  <td className="tp-muted">{p.chassis_number || "—"}</td>
                  <td style={{ textTransform: "capitalize" }}>{p.department || "—"}</td>
                  <td className="tp-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

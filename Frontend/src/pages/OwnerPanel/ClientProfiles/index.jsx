import { useEffect, useState } from "react"
import { approveClientProfile, deleteClientProfile, getClientProfile, listClientProfiles } from "../../../api/clients"
import ClientProfileForm from "./ClientProfileForm"

const STATUS_LABELS = {
  pending_accountant: "Awaiting Accountant",
  pending_owner: "Awaiting Owner",
  approved: "Approved",
}

const STATUS_CLASSES = {
  pending_accountant: "tp-report-status-pending",
  pending_owner: "tp-report-status-modifications",
  approved: "tp-report-status-checked",
}

export default function ClientProfiles({ token, role, statusFilter, title = "Client Profiles", emptyLabel }) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [openProfile, setOpenProfile] = useState(null)
  const [openMode, setOpenMode] = useState("view")
  const [openLoadError, setOpenLoadError] = useState("")
  const [actionError, setActionError] = useState("")

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

  function handleUpdated() {
    setOpenProfile(null)
    refresh(search)
  }

  async function openProfileIn(id, mode) {
    setOpenLoadError("")
    try {
      setOpenProfile(await getClientProfile(token, id))
      setOpenMode(mode)
    } catch (err) {
      setOpenLoadError(err.message || "Could not load client profile.")
    }
  }

  async function handleApprove(id) {
    setActionError("")
    try {
      await approveClientProfile(token, id)
      refresh(search)
    } catch (err) {
      setActionError(err.message || "Could not approve client profile.")
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this client profile? This cannot be undone.")) return
    setActionError("")
    try {
      await deleteClientProfile(token, id)
      refresh(search)
    } catch (err) {
      setActionError(err.message || "Could not delete client profile.")
    }
  }

  const visibleProfiles = statusFilter ? profiles.filter((p) => p.status === statusFilter) : profiles

  return (
    <div>
      {!statusFilter && !showForm && (
        <button type="button" className="tp-inspection-btn" onClick={() => setShowForm(true)}>
          + Create Client Profile
        </button>
      )}

      {actionError && <div className="tp-form-error">{actionError}</div>}

      {openLoadError && <div className="tp-form-error">{openLoadError}</div>}

      {showForm && (
        <div className="cp-form-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <ClientProfileForm token={token} onClose={() => setShowForm(false)} onCreated={handleCreated} />
        </div>
      )}

      {openProfile && (
        <div className="cp-form-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpenProfile(null)}>
          <ClientProfileForm
            token={token}
            profile={openProfile}
            readOnly={openMode === "view"}
            onClose={() => setOpenProfile(null)}
            onUpdated={handleUpdated}
          />
        </div>
      )}

      <div className="tp-card">
        <div className="tp-card-head">
          <div className="tp-card-title">{title}</div>
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
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleProfiles.length === 0 && (
                <tr>
                  <td colSpan={9} className="tp-muted">
                    {search
                      ? "No client profiles match your search."
                      : emptyLabel || "No client profiles yet."}
                  </td>
                </tr>
              )}
              {visibleProfiles.map((p) => {
                const canEdit = role === "owner" || p.status !== "approved"
                const canApprove =
                  (role === "accountant" && p.status === "pending_accountant") ||
                  (role === "owner" && p.status === "pending_owner")
                return (
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
                    <td>
                      <span className={`tp-report-status ${STATUS_CLASSES[p.status] || ""}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="tp-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="tp-reports-actions">
                        <button type="button" className="tp-reports-btn" onClick={() => openProfileIn(p.id, "view")}>
                          View
                        </button>
                        {canEdit && (
                          <button type="button" className="tp-reports-btn" onClick={() => openProfileIn(p.id, "edit")}>
                            Edit
                          </button>
                        )}
                        {canApprove && (
                          <button
                            type="button"
                            className="tp-reports-btn tp-reports-btn-checked"
                            onClick={() => handleApprove(p.id)}
                          >
                            Approve
                          </button>
                        )}
                        {role === "owner" && (
                          <button
                            type="button"
                            className="tp-reports-btn tp-reports-btn-danger"
                            onClick={() => handleDelete(p.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

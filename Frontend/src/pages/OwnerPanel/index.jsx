import { useEffect, useState } from "react"
import Sidebar from "../TechnicianPanel/components/Sidebar"
import Hero from "../TechnicianPanel/components/Hero"
import { createUser, listUsers, setUserActive } from "../../api/auth"
import ClientProfiles from "./ClientProfiles"
import VehicleBlacklist from "./VehicleBlacklist"
import ActivityLog from "./ActivityLog"
import "../TechnicianPanel/TechnicianPanel.css"
import "./ClientProfiles/ClientProfiles.css"

const initialForm = { email: "", fullName: "", password: "", role: "technician" }

export default function OwnerPanel({ username, token, onLogout }) {
  const [view, setView] = useState("dashboard")
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [listError, setListError] = useState("")

  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [formSuccess, setFormSuccess] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)

  async function refreshUsers() {
    setLoadingUsers(true)
    setListError("")
    try {
      setUsers(await listUsers(token))
    } catch (err) {
      setListError(err.message || "Could not load accounts.")
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    if (token) refreshUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setFormError("")
    setFormSuccess("")
    setSubmitting(true)
    try {
      await createUser(token, form)
      setFormSuccess(`Account created for ${form.email}.`)
      setForm(initialForm)
      setShowCreateForm(false)
      refreshUsers()
    } catch (err) {
      setFormError(err.message || "Could not create account.")
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(user) {
    const nextActive = !user.is_active
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: nextActive } : u)))
    try {
      await setUserActive(token, user.id, nextActive)
    } catch (err) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: user.is_active } : u)))
      setListError(err.message || "Could not update account.")
    }
  }

  return (
    <div className="tp-app">
      <Sidebar role="owner" username={username} onLogout={onLogout} activeView={view} onNavigate={setView} />

      <main className="tp-main">
        <Hero name={username || "Owner"} desc="Here's an overview of your dealership today." />

        {view === "clients" ? (
          <ClientProfiles token={token} />
        ) : view === "blacklist" ? (
          <VehicleBlacklist token={token} />
        ) : view === "activity" ? (
          <ActivityLog token={token} />
        ) : (
          <>
        {!showCreateForm && (
          <button
            type="button"
            className="tp-inspection-btn"
            onClick={() => {
              setFormError("")
              setFormSuccess("")
              setShowCreateForm(true)
            }}
          >
            + Create Staff / Technician Account
          </button>
        )}

        {showCreateForm && (
          <div className="tp-card" style={{ maxWidth: 640, marginBottom: 20 }}>
            <div className="tp-card-head">
              <div className="tp-card-title">Create Staff / Technician Account</div>
              <button
                type="button"
                className="tp-form-close"
                onClick={() => setShowCreateForm(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="tp-form-grid">
                <label className="tp-form-group">
                  <span>Full Name</span>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => updateForm("fullName", e.target.value)}
                  />
                </label>
                <label className="tp-form-group">
                  <span>Role</span>
                  <select value={form.role} onChange={(e) => updateForm("role", e.target.value)}>
                    <option value="technician">Technician</option>
                    <option value="staff">Staff</option>
                  </select>
                </label>
                <label className="tp-form-group">
                  <span>Email</span>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                  />
                </label>
                <label className="tp-form-group">
                  <span>Temporary Password</span>
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => updateForm("password", e.target.value)}
                  />
                </label>
              </div>

              {formError && <div className="tp-form-error">{formError}</div>}
              {formSuccess && <div className="tp-form-success">{formSuccess}</div>}

              <div className="tp-form-actions" style={{ gridTemplateColumns: "1fr", marginTop: 15 }}>
                <button type="submit" className="tp-form-btn tp-form-btn-primary" disabled={submitting}>
                  {submitting ? "Creating…" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="tp-card" style={{ maxWidth: 780 }}>
          <div className="tp-card-head">
            <div className="tp-card-title">Team Accounts</div>
          </div>

          {loadingUsers && <p>Loading accounts…</p>}
          {listError && <div className="tp-form-error">{listError}</div>}

          {!loadingUsers && !listError && (
            <table className="tp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td className="tp-muted">{u.email}</td>
                    <td style={{ textTransform: "capitalize" }}>{u.role}</td>
                    <td>
                      {u.role !== "owner" ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={u.is_active}
                          aria-label={u.is_active ? "Deactivate account" : "Activate account"}
                          className={`tp-switch${u.is_active ? " tp-switch-on" : ""}`}
                          onClick={() => toggleActive(u)}
                        >
                          <span className="tp-switch-knob" />
                        </button>
                      ) : (
                        <span className="tp-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
          </>
        )}
      </main>
    </div>
  )
}

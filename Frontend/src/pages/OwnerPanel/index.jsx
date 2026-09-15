import { useEffect, useState } from "react"
import Sidebar from "../TechnicianPanel/components/Sidebar"
import Hero from "../TechnicianPanel/components/Hero"
import { createUser, listUsers, setUserActive } from "../../api/auth"
import "../TechnicianPanel/TechnicianPanel.css"

const initialForm = { email: "", fullName: "", password: "", role: "technician" }

export default function OwnerPanel({ username, token, onLogout }) {
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [listError, setListError] = useState("")

  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [formSuccess, setFormSuccess] = useState("")

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
      refreshUsers()
    } catch (err) {
      setFormError(err.message || "Could not create account.")
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(user) {
    try {
      await setUserActive(token, user.id, !user.is_active)
      refreshUsers()
    } catch (err) {
      setListError(err.message || "Could not update account.")
    }
  }

  return (
    <div className="tp-app">
      <Sidebar role="owner" username={username} onLogout={onLogout} />

      <main className="tp-main">
        <Hero name={username || "Owner"} desc="Here's an overview of your dealership today." />

        <div className="tp-card" style={{ maxWidth: 640, marginBottom: 20 }}>
          <div className="tp-card-head">
            <div className="tp-card-title">Create Staff / Technician Account</div>
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
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td className="tp-muted">{u.email}</td>
                    <td style={{ textTransform: "capitalize" }}>{u.role}</td>
                    <td>
                      <span className={`tp-status ${u.is_active ? "tp-status-completed" : "tp-status-pending"}`}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      {u.role !== "owner" && (
                        <button
                          type="button"
                          className="tp-form-btn tp-form-btn-secondary"
                          style={{ padding: "6px 12px", fontSize: 12 }}
                          onClick={() => toggleActive(u)}
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}

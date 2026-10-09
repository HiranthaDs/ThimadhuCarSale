import { useEffect, useMemo, useState } from "react"
import { getAccessOverview, resetEmployeeAccess, unlockCustomize, updateEmployeeAccess } from "../../../api/permissions"
import "../../../components/ConfirmDialog.css"
import "./Customize.css"

const ROLE_LABELS = { owner: "Owner", ceo: "CEO", admin: "Admin", accountant: "Accountant", technician: "Technician" }

function sameKeys(a, b) {
  return a.size === b.size && [...a].every((k) => b.has(k))
}

// The owner re-enters their password, picks an employee, then ticks what that
// person can do. The owner always has full access; the CEO starts with full
// access until the owner changes it.
export default function Customize({ onCancel }) {
  // Short-lived pass from the server; kept only while this page is open.
  const [unlockToken, setUnlockToken] = useState(null)
  const [notice, setNotice] = useState("")

  if (!unlockToken) {
    return (
      <UnlockDialog
        notice={notice}
        onCancel={onCancel}
        onUnlocked={(t) => { setNotice(""); setUnlockToken(t) }}
      />
    )
  }
  return (
    <AccessDirectory
      unlockToken={unlockToken}
      onLocked={() => {
        setUnlockToken(null)
        setNotice("Your Customize session has ended. Enter your password again.")
      }}
    />
  )
}

// Centered password popup, styled like the app's confirm dialogs.
function UnlockDialog({ notice, onCancel, onUnlocked }) {
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel])

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      const { unlock_token: unlockToken } = await unlockCustomize(password)
      onUnlocked(unlockToken)
    } catch (err) {
      setError(err.message || "Could not check your password.")
      setPassword("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cd-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="cd-dialog" role="dialog" aria-modal="true" aria-labelledby="cz-unlock-title" onSubmit={handleSubmit}>
        <div className="cd-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
        <h2 id="cz-unlock-title" className="cd-title">Owner password required</h2>
        <p className="cd-message">Enter your password to open Customize.</p>
        {notice && <div className="tp-form-error cz-unlock-msg">{notice}</div>}
        <input
          type="password"
          className="cz-unlock-input"
          aria-label="Password"
          placeholder="Password"
          autoComplete="current-password"
          autoFocus
          required
          maxLength={72}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="tp-form-error cz-unlock-msg">{error}</div>}
        <div className="cd-actions cz-unlock-actions">
          <button type="button" className="cd-btn cd-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="cd-btn cd-btn-primary" disabled={busy || !password}>
            {busy ? "Checking…" : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  )
}

function AccessDirectory({ unlockToken, onLocked }) {
  const [catalog, setCatalog] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    let active = true
    getAccessOverview(unlockToken)
      .then((data) => {
        if (!active) return
        setCatalog(data.catalog)
        setEmployees(data.employees)
      })
      .catch((err) => {
        if (!active) return
        if (err.status === 403) onLocked()
        else setError(err.message || "Could not load employees.")
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockToken])

  const selected = employees.find((e) => e.id === selectedId)

  function handleSaved(updated) {
    setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }

  if (selected) {
    return (
      <EmployeeAccess
        key={selected.id}
        unlockToken={unlockToken}
        onLocked={onLocked}
        employee={selected}
        catalog={catalog}
        onBack={() => setSelectedId(null)}
        onSaved={handleSaved}
      />
    )
  }

  return (
    <div className="tp-card cz-card">
      <div className="tp-card-head">
        <div>
          <div className="tp-card-title">Customize Access</div>
          <div className="tp-muted cz-sub">Choose an employee to set what they can do.</div>
        </div>
      </div>

      {loading && <p>Loading employees…</p>}
      {error && <div className="tp-form-error">{error}</div>}

      {!loading && !error && (
        <table className="tp-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td>{e.full_name}</td>
                <td className="tp-muted">{e.email}</td>
                <td>{ROLE_LABELS[e.role] || e.role}</td>
                <td className="cz-row-action">
                  {e.full_access ? (
                    <span className="tp-muted">Full access</span>
                  ) : (
                    <button type="button" className="tp-reports-btn" onClick={() => setSelectedId(e.id)}>
                      Access
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function EmployeeAccess({ unlockToken, onLocked, employee, catalog, onBack, onSaved }) {
  const saved = useMemo(() => new Set(employee.permissions), [employee.permissions])
  const [draft, setDraft] = useState(saved)
  const [busy, setBusy] = useState(null) // "save" | "reset"
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const sections = useMemo(() => {
    const grouped = new Map()
    // Some actions only exist in the owner panel, which only the CEO shares.
    for (const perm of catalog.filter((p) => employee.role === "ceo" || !p.ceo_only)) {
      if (!grouped.has(perm.section)) grouped.set(perm.section, [])
      grouped.get(perm.section).push(perm)
    }
    return [...grouped.entries()]
  }, [catalog, employee.role])

  function toggle(perm) {
    setSuccess("")
    setDraft((prev) => {
      const keys = new Set(prev)
      if (keys.has(perm.key)) {
        keys.delete(perm.key)
        // Turning off "View" also turns off everything that needs it.
        for (const other of catalog) if (other.requires === perm.key) keys.delete(other.key)
      } else {
        keys.add(perm.key)
        if (perm.requires) keys.add(perm.requires)
      }
      return keys
    })
  }

  async function run(action, request, message) {
    setError("")
    setSuccess("")
    setBusy(action)
    try {
      const updated = await request()
      onSaved(updated)
      setDraft(new Set(updated.permissions))
      setSuccess(message)
    } catch (err) {
      if (err.status === 403) return onLocked()
      setError(err.message || "Could not save access.")
    } finally {
      setBusy(null)
    }
  }

  const dirty = !sameKeys(saved, draft)
  const roleLabel = ROLE_LABELS[employee.role] || employee.role

  return (
    <div className="tp-card cz-card">
      <button type="button" className="cz-back" onClick={onBack}>
        ← All employees
      </button>

      <div className="tp-card-head">
        <div>
          <div className="tp-card-title">{employee.full_name}</div>
          <div className="tp-muted cz-sub">
            {roleLabel} · {employee.email} ·{" "}
            {employee.customized ? "Custom access" : `Using the default ${roleLabel} access`}
          </div>
        </div>
      </div>

      <table className="tp-table cz-table">
        <thead>
          <tr>
            <th>Permission</th>
            <th className="cz-role">Allowed</th>
          </tr>
        </thead>
        {sections.map(([section, perms]) => (
          <tbody key={section}>
            <tr className="cz-section">
              <td colSpan={2}>{section}</td>
            </tr>
            {perms.map((perm) => (
              <tr key={perm.key}>
                <td className="cz-label">{perm.label}</td>
                <td className="cz-check">
                  <input
                    type="checkbox"
                    aria-label={`${section} – ${perm.label}`}
                    checked={draft.has(perm.key)}
                    onChange={() => toggle(perm)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>

      <div className="cz-actions">
        {employee.customized && (
          <button
            type="button"
            className="tp-form-btn tp-form-btn-secondary cz-reset"
            disabled={busy !== null}
            onClick={() => run("reset", () => resetEmployeeAccess(unlockToken, employee.id), `Reset to the default ${roleLabel} access.`)}
          >
            {busy === "reset" ? "Resetting…" : `Reset to ${roleLabel} default`}
          </button>
        )}
        <button
          type="button"
          className="tp-form-btn tp-form-btn-secondary"
          disabled={!dirty || busy !== null}
          onClick={() => { setDraft(saved); setSuccess("") }}
        >
          Discard changes
        </button>
        <button
          type="button"
          className="tp-form-btn tp-form-btn-primary"
          disabled={!dirty || busy !== null}
          onClick={() => run(
            "save",
            () => updateEmployeeAccess(unlockToken, employee.id, [...draft]),
            `Saved. ${employee.full_name} sees the change the next time they open or refresh the app.`,
          )}
        >
          {busy === "save" ? "Saving…" : "Save changes"}
        </button>
      </div>

      {error && <div className="tp-form-error">{error}</div>}
      {success && <div className="tp-form-success">{success}</div>}
    </div>
  )
}

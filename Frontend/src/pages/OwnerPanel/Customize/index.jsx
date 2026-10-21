import { useEffect, useMemo, useRef, useState } from "react"
import { getAccessOverview, resetEmployeeAccess, unlockCustomize, updateEmployeeAccess } from "../../../api/permissions"
import { getReportFormSchema, saveReportFormSchema } from "../../../api/reports"
import { DEFAULT_SECTIONS } from "../../TechnicianPanel/components/inspectionSchema"
import { confirmDialog } from "../../../components/ConfirmDialog"
import ClientFormEditor from "../ClientProfiles/ClientFormEditor"
import "../../../components/ConfirmDialog.css"
import "./Customize.css"

const ROLE_LABELS = { owner: "Owner", ceo: "CEO", admin: "Admin", accountant: "Accountant", technician: "Technician" }

function sameKeys(a, b) {
  return a.size === b.size && [...a].every((k) => b.has(k))
}

// The owner re-enters their password, picks an employee, then ticks what that
// person can do. The owner always has full access; the CEO starts with full
// access until the owner changes it.
const CUSTOMIZE_TABS = [
  { key: "access", label: "Customize Access" },
  { key: "inspection", label: "Inspection Report" },
  { key: "client", label: "Edit Client Profile" },
]

export default function Customize({ onCancel, token }) {
  // Short-lived pass from the server; kept only while this page is open.
  const [unlockToken, setUnlockToken] = useState(null)
  const [notice, setNotice] = useState("")
  const [activeTab, setActiveTab] = useState("access")
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(["access"]))

  function selectTab(next) {
    if (next === activeTab) return
    setVisitedTabs((previous) => previous.has(next) ? previous : new Set([...previous, next]))
    setActiveTab(next)
  }

  return (
    <div className="cz-workspace">
      <nav className="cz-subnav" aria-label="Customize sections">
        {CUSTOMIZE_TABS.map((tab) => <button
          key={tab.key}
          type="button"
          className={`cz-subnav-item${activeTab === tab.key ? " cz-subnav-item-active" : ""}`}
          aria-current={activeTab === tab.key ? "page" : undefined}
          onClick={() => selectTab(tab.key)}
        >{tab.label}</button>)}
      </nav>
      <div hidden={activeTab !== "access"}>
        {unlockToken ? <AccessDirectory
          unlockToken={unlockToken}
          onLocked={() => {
            setUnlockToken(null)
            setNotice("Your Customize session has ended. Enter your password again.")
          }}
        /> : activeTab === "access" && <UnlockDialog
          notice={notice}
          onCancel={onCancel}
          onUnlocked={(nextToken) => { setNotice(""); setUnlockToken(nextToken) }}
        />}
      </div>
      {visitedTabs.has("inspection") && <div hidden={activeTab !== "inspection"}><ReportFormEditor /></div>}
      {visitedTabs.has("client") && <div hidden={activeTab !== "client"}><ClientFormEditor token={token} /></div>}
    </div>
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
      <form className="cd-dialog cz-access-unlock" role="dialog" aria-modal="true" aria-labelledby="cz-unlock-title" onSubmit={handleSubmit}>
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
    <div className="tp-card cz-card cz-access-editor">
      <div className="tp-card-head">
        <div>
          <div className="tp-card-title">Customize Access</div>
          <div className="tp-muted cz-sub">Choose an employee to set what they can do.</div>
        </div>
      </div>

      {loading && <p>Loading employees…</p>}
      {error && <div className="tp-form-error">{error}</div>}

      {!loading && !error && (
        <div className="cz-table-scroll"><table className="tp-table">
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
        </table></div>
      )}
    </div>
  )
}

const FIELD_TYPES = ["text", "number", "date", "datetime", "textarea", "status", "yesno", "select", "multiphoto", "file", "signature"]

export function ReportFormEditor() {
  const topRef = useRef(null)
  const bottomRef = useRef(null)
  const [sections, setSections] = useState(DEFAULT_SECTIONS)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    let active = true
    getReportFormSchema().then((result) => {
      if (active && result.sections) setSections(result.sections)
    }).catch((err) => {
      setError(err.message || "Could not load the report form.")
    }).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  function patchField(si, fi, changes) {
    setSuccess("")
    setSections((prev) => prev.map((section, i) => i !== si ? section : {
      ...section, fields: section.fields.map((field, j) => j !== fi ? field : { ...field, ...changes }),
    }))
  }

  function addField(si) {
    const keyBase = `custom_${Date.now().toString(36)}`
    setSections((prev) => prev.map((section, i) => i !== si ? section : {
      ...section, fields: [...section.fields, { key: keyBase, label: "New field", type: "text" }],
    }))
  }

  function removeField(si, fi) {
    setSections((prev) => prev.map((section, i) => i !== si ? section : { ...section, fields: section.fields.filter((_, j) => j !== fi) }))
  }

  async function removeSection(si) {
    const confirmed = await confirmDialog({
      title: "Remove inspection section?",
      message: "This removes the section and all its fields from the form when you save. Existing saved reports keep their layout.",
      confirmLabel: "Remove section",
      danger: true,
    })
    if (!confirmed) return
    setSuccess("")
    setSections((prev) => prev.filter((_, index) => index !== si))
  }

  async function save() {
    setError(""); setSuccess(""); setBusy(true)
    try {
      await saveReportFormSchema(sections)
      setSuccess("Inspection report form saved. New reports will use these fields.")
    } catch (err) {
      setError(err.message || "Could not save the report form.")
    } finally { setBusy(false) }
  }

  async function resetToDefault() {
    const confirmed = await confirmDialog({
      title: "Reset inspection report form?",
      message: "This restores the original form fields and removes your custom changes. Existing saved reports will keep their saved form layout.",
      confirmLabel: "Reset form",
      danger: true,
    })
    if (!confirmed) return
    setError(""); setSuccess(""); setBusy(true)
    try {
      await saveReportFormSchema(DEFAULT_SECTIONS)
      setSections(DEFAULT_SECTIONS)
      setSuccess("Inspection report form restored to the default.")
    } catch (err) {
      setError(err.message || "Could not reset the report form.")
    } finally { setBusy(false) }
  }

  return <div className="tp-card cz-card cz-report-editor cz-inspection-editor">
    <div className="tp-card-head" ref={topRef}><div><div className="tp-card-title">Edit Inspection Report</div><div className="tp-muted cz-sub">Edit the existing form, add fields, and choose what type of answer each field accepts.</div></div>
      <button type="button" className="cz-jump-bottom" onClick={() => bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" })} aria-label="Go to bottom of inspection report editor" title="Go to bottom">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v13m-5-5 5 5 5-5M5 21h14" /></svg>
        <span>Bottom</span>
      </button>
    </div>
    {loading ? <p>Loading report form…</p> : <>
      {sections.map((section, si) => <div className="cz-form-section" key={si}>
        <div className="cz-section-heading">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>
          <input className="cz-section-name" aria-label="Section name" value={section.title} onChange={(e) => setSections((prev) => prev.map((s, i) => i === si ? { ...s, title: e.target.value } : s))} />
          {(section.custom === true || si >= DEFAULT_SECTIONS.length) && <button type="button" className="cz-remove-section" onClick={() => removeSection(si)} aria-label={`Remove ${section.title} section`}>Remove section</button>}
        </div>
        {section.fields.map((field, fi) => <div className="cz-form-field" key={field.key}>
          <input aria-label="Field name" value={field.label} onChange={(e) => patchField(si, fi, { label: e.target.value })} />
          <select aria-label="Field type" value={field.type} onChange={(e) => patchField(si, fi, { type: e.target.value, ...(e.target.value === "select" ? { options: field.options?.length ? field.options : ["Option 1", "Option 2"] } : {}) })}>
          {[...FIELD_TYPES, ...(!FIELD_TYPES.includes(field.type) ? [field.type] : [])].map((type) => <option key={type} value={type}>{type === "multiphoto" ? "Image upload (multiple)" : type === "file" ? "Image / file upload" : type}</option>)}
          </select>
          {field.type === "select" ? <input aria-label="Options, comma separated" value={(field.options || []).join(", ")} onChange={(e) => patchField(si, fi, { options: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} placeholder="Options, comma separated" /> : <span className="cz-options-spacer" aria-hidden="true" />}
          <button type="button" className="tp-form-btn tp-form-btn-secondary cz-remove-field" onClick={() => removeField(si, fi)}>Remove</button>
        </div>)}
        <button type="button" className="tp-reports-btn cz-add-field" onClick={() => addField(si)}><span className="cz-add-icon" aria-hidden="true">+</span> Add field</button>
      </div>)}
      <button type="button" className="tp-reports-btn cz-add-section" onClick={() => setSections((prev) => [...prev, { title: "New section", fields: [], custom: true }])}><span className="cz-add-icon" aria-hidden="true">+</span> Add section</button>
      <div className="cz-actions">
        <button type="button" className="cz-jump-bottom cz-jump-top" onClick={() => topRef.current?.scrollIntoView({ behavior: "auto", block: "start" })} aria-label="Go to top of inspection report editor" title="Go to top">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V7m-5 5 5-5 5 5M5 3h14" /></svg>
          <span>Top</span>
        </button>
        <button type="button" className="tp-form-btn tp-form-btn-secondary" disabled={busy} onClick={resetToDefault}>Reset to default</button>
        <button type="button" className="tp-form-btn tp-form-btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save inspection form"}</button>
      </div>
    </>}
    {error && <div className="tp-form-error">{error}</div>}{success && <div className="tp-form-success">{success}</div>}
    <div ref={bottomRef} aria-hidden="true" />
  </div>
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
    <div className="tp-card cz-card cz-access-editor">
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

      <div className="cz-table-scroll"><table className="tp-table cz-table">
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
      </table></div>

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

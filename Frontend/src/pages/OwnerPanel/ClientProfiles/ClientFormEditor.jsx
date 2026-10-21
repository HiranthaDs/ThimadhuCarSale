import { useEffect, useRef, useState } from "react"
import { getClientFormSchema, saveClientFormSchema } from "../../../api/clients"
import { TABS } from "./clientProfileSchema"
import { BUILTIN_FIELDS, builtinInputTypes, builtinKey, defaultBuiltinType } from "./clientProfileBuiltins"
import { confirmDialog } from "../../../components/ConfirmDialog"
import { useUnsavedChanges } from "../../../components/unsavedChanges"
import "../Customize/Customize.css"
import "./ClientProfiles.css"

const TYPES = [
  ["text", "Text"], ["email", "Email"], ["tel", "Phone"], ["number", "Number"],
  ["date", "Date"], ["textarea", "Long text"], ["checkbox", "Checkbox"],
  ["radio", "Radio buttons"], ["select", "Dropdown"], ["image", "Image upload"],
  ["multi_image", "Multiple images"], ["file", "Image / PDF upload"],
]

export default function ClientFormEditor({ token }) {
  const topRef = useRef(null)
  const bottomRef = useRef(null)
  const [fields, setFields] = useState([])
  const [labels, setLabels] = useState({})
  const [hiddenFields, setHiddenFields] = useState([])
  const [fieldTypes, setFieldTypes] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  useUnsavedChanges(dirty, "client profile form")

  useEffect(() => {
    let active = true
    getClientFormSchema(token).then((data) => {
      if (active) {
        setFields(data.fields || [])
        setLabels(data.labels || {})
        setHiddenFields(data.hidden_fields || [])
        setFieldTypes(data.field_types || {})
      }
    }).catch((err) => {
      if (active) setError(err.message || "Could not load the client profile form.")
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  function change(next) {
    setFields(next)
    setDirty(true)
    setSuccess("")
  }

  function patch(key, changes) {
    change(fields.map((field) => field.key === key ? { ...field, ...changes } : field))
  }

  function patchLabel(key, value) {
    setLabels((previous) => ({ ...previous, [key]: value }))
    setDirty(true)
    setSuccess("")
  }

  function patchBuiltinType(key, value) {
    setFieldTypes((previous) => ({ ...previous, [key]: value }))
    setDirty(true)
    setSuccess("")
  }

  async function toggleBuiltin(key) {
    if (hiddenFields.includes(key)) {
      setHiddenFields((previous) => previous.filter((item) => item !== key))
    } else {
      const confirmed = await confirmDialog({
        title: "Remove field from new profiles?",
        message: "The field will disappear from new profile forms. Existing saved profiles keep their data.",
        confirmLabel: "Remove field",
        danger: true,
      })
      if (!confirmed) return
      setHiddenFields((previous) => [...previous, key])
    }
    setDirty(true)
    setSuccess("")
  }

  function add(tab) {
    const key = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    change([...fields, { key, tab, label: "New field", type: "text", options: [] }])
  }

  async function remove(key) {
    const confirmed = await confirmDialog({
      title: "Remove field from new profiles?",
      message: "Existing client profiles keep their saved answers and can still show this field.",
      confirmLabel: "Remove field",
      danger: true,
    })
    if (confirmed) change(fields.filter((field) => field.key !== key))
  }

  async function save() {
    setError("")
    setSuccess("")
    setBusy("save")
    try {
      const saved = await saveClientFormSchema(token, fields, labels, hiddenFields, fieldTypes)
      setFields(saved.fields)
      setLabels(saved.labels)
      setHiddenFields(saved.hidden_fields)
      setFieldTypes(saved.field_types)
      setDirty(false)
      setSuccess("Client profile form saved. New profiles will use these fields and settings.")
      window.dispatchEvent(new CustomEvent("thimadu:client-form-schema-changed"))
    } catch (err) {
      setError(err.message || "Could not save the client profile form.")
    } finally { setBusy(null) }
  }

  async function resetToDefault() {
    const confirmed = await confirmDialog({
      title: "Reset client profile form?",
      message: "This restores the original fields, labels, and input types, and removes added fields from new profiles. Existing saved profiles keep their data.",
      confirmLabel: "Reset form",
      danger: true,
    })
    if (!confirmed) return
    setError("")
    setSuccess("")
    setBusy("reset")
    try {
      const saved = await saveClientFormSchema(token, [], {}, [], {})
      setFields(saved.fields)
      setLabels(saved.labels)
      setHiddenFields(saved.hidden_fields)
      setFieldTypes(saved.field_types)
      setDirty(false)
      setSuccess("Client profile form restored to its defaults. New profiles will use the original fields.")
      window.dispatchEvent(new CustomEvent("thimadu:client-form-schema-changed"))
    } catch (err) {
      setError(err.message || "Could not reset the client profile form.")
    } finally { setBusy(null) }
  }

  return <div className="tp-card cz-card cz-report-editor cp-form-editor">
    <div className="tp-card-head" ref={topRef}><div>
      <div className="tp-card-title">Edit Client Profile</div>
      <div className="tp-muted cz-sub">Edit or remove existing fields, and add new fields to any step. Saved profiles keep their data.</div>
    </div>
      <button type="button" className="cz-jump-bottom" onClick={() => bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" })} aria-label="Go to bottom of client profile editor" title="Go to bottom">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v13m-5-5 5 5 5-5M5 21h14" /></svg>
        <span>Bottom</span>
      </button>
    </div>
    {loading ? <p>Loading client profile form…</p> : TABS.map((tab) => <section className="cz-form-section" key={tab.key}>
      <h3>{tab.label}</h3>
      <h4 className="cp-editor-group-title">Existing fields</h4>
      {(BUILTIN_FIELDS[tab.key] || []).map(([defaultLabel, type]) => {
        const key = builtinKey(tab.key, defaultLabel)
        const allowedTypes = builtinInputTypes(type)
        const removed = hiddenFields.includes(key)
        return <div className={`cp-editor-field cp-editor-builtin${removed ? " cp-editor-removed" : ""}`} key={key}>
          <input aria-label={`${defaultLabel} label`} value={labels[key] ?? defaultLabel} maxLength={120} onChange={(e) => patchLabel(key, e.target.value)} />
          <select aria-label={`${defaultLabel} input type`} value={fieldTypes[key] || defaultBuiltinType(type)} disabled={allowedTypes.length === 1} onChange={(e) => patchBuiltinType(key, e.target.value)}>
            {allowedTypes.map((value) => <option key={value} value={value}>{TYPES.find(([candidate]) => candidate === value)?.[1] || type}</option>)}
          </select>
          <button type="button" className={`tp-form-btn tp-form-btn-secondary${removed ? " cp-editor-restore" : ""}`} onClick={() => toggleBuiltin(key)}>{removed ? "Restore" : "Remove"}</button>
        </div>
      })}
      <h4 className="cp-editor-group-title">Added fields</h4>
      {fields.filter((field) => field.tab === tab.key).map((field) => <div className="cp-editor-field" key={field.key}>
        <input aria-label="Field name" value={field.label} maxLength={120} onChange={(e) => patch(field.key, { label: e.target.value })} />
        <select aria-label="Field type" value={field.type} onChange={(e) => patch(field.key, {
          type: e.target.value,
          options: ["radio", "select"].includes(e.target.value) ? (field.options?.length ? field.options : ["Option 1", "Option 2"]) : [],
        })}>
          {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {["radio", "select"].includes(field.type) && <input aria-label="Options, comma separated" placeholder="Options, comma separated" value={(field.options || []).join(", ")} onChange={(e) => patch(field.key, { options: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} />}
        <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={() => remove(field.key)}>Remove</button>
      </div>)}
      <button type="button" className="tp-reports-btn" onClick={() => add(tab.key)}>+ Add field</button>
    </section>)}
    <div className="cz-actions">
      <button type="button" className="cz-jump-bottom cz-jump-top" onClick={() => topRef.current?.scrollIntoView({ behavior: "auto", block: "start" })} aria-label="Go to top of client profile editor" title="Go to top">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V7m-5 5 5-5 5 5M5 3h14" /></svg>
        <span>Top</span>
      </button>
      <button type="button" className="tp-form-btn tp-form-btn-secondary" disabled={Boolean(busy) || loading} onClick={resetToDefault}>{busy === "reset" ? "Resetting…" : "Reset to default"}</button>
      <button type="button" className="tp-form-btn tp-form-btn-primary" disabled={Boolean(busy) || loading || !dirty} onClick={save}>{busy === "save" ? "Saving…" : "Save client form"}</button>
    </div>
    {error && <div className="tp-form-error">{error}</div>}
    {success && <div className="tp-form-success">{success}</div>}
    <div ref={bottomRef} aria-hidden="true" />
  </div>
}

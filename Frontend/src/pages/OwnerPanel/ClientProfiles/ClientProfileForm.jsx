import { useEffect, useRef, useState } from "react"
import { createClientProfile, listAllScanReports, updateClientProfile } from "../../../api/clients"
import { confirmCloseForm, confirmDiscard, useUnsavedChanges } from "../../../components/unsavedChanges"
import { TABS, buildSubmitPayload, initialFormState, mapProfileToForm, validateClientTypes } from "./clientProfileSchema"
import { COUNTRIES } from "./countries"
import { isSafeMediaUrl } from "../../../utils/safeUrl"
import { compressImage, prepareUpload } from "../../../utils/image"
import DatePicker from "../../../components/DatePicker"

function TextField({ label, value, onChange, type = "text", required, placeholder }) {
  if (type === "date") {
    return (
      <div className="tp-form-group">
        <span>{label}</span>
        <DatePicker value={value} onChange={onChange} />
      </div>
    )
  }
  return (
    <label className="tp-form-group">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function CountrySelect({ label, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const boxRef = useRef(null)

  const selected = COUNTRIES.find((c) => c.name === value)
  const matches = COUNTRIES.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 50)

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  return (
    <label className="tp-form-group" ref={boxRef}>
      <span>{label}</span>
      <div className="cp-country-select">
        <button
          type="button"
          className="cp-country-trigger"
          onClick={() => {
            setOpen((o) => !o)
            setQuery("")
          }}
        >
          {selected ? (
            <>
              <img src={selected.flagImage} alt="" className="cp-country-flag" />
              <span>{selected.name}</span>
            </>
          ) : (
            <span className="cp-country-placeholder">Select country…</span>
          )}
        </button>

        {open && (
          <div className="cp-country-dropdown">
            <input
              type="text"
              autoFocus
              className="cp-country-search"
              placeholder="Search country…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="cp-country-list">
              {matches.length === 0 && <div className="cp-country-empty">No countries match.</div>}
              {matches.map((c) => (
                <button
                  type="button"
                  key={c.code}
                  className={`cp-country-option${c.name === value ? " cp-country-option-active" : ""}`}
                  onClick={() => {
                    onChange(c.name)
                    setOpen(false)
                    setQuery("")
                  }}
                >
                  <img src={c.flagImage} alt="" className="cp-country-flag" />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </label>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="tp-form-group">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function RadioField({ label, value, onChange, options }) {
  return (
    <div className="tp-form-group">
      <span>{label}</span>
      <div className="cp-radio-row">
        {options.map((opt) => (
          <label key={opt.value} className="cp-radio-option">
            <input
              type="radio"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  )
}

// A document field holds one image as a plain string, several as a JSON array string
// (the backend stores and validates it the same way).
function parseImages(value) {
  if (!value) return []
  if (typeof value === "string" && value.startsWith("[")) {
    try {
      const items = JSON.parse(value)
      if (Array.isArray(items)) return items.filter(Boolean)
    } catch { /* fall through: treat as a single image */ }
  }
  return [value]
}

function packImages(items) {
  if (items.length === 0) return ""
  return items.length === 1 ? items[0] : JSON.stringify(items)
}

// Several images in one field, up to `max`. Keep `max` in step with MULTI_IMAGE_LIMITS in Backend/core/media.py.
function MultiImageField({ label, value, onChange, max, full }) {
  const images = parseImages(value)
  const remaining = max - images.length
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState("")

  async function handleFiles(e) {
    const picked = Array.from(e.target.files || [])
    e.target.value = ""
    if (picked.length === 0) return
    const accepted = picked.slice(0, Math.max(remaining, 0))
    setNotice(accepted.length < picked.length ? `Only ${max} image${max === 1 ? "" : "s"} allowed here — ${picked.length - accepted.length} not added.` : "")
    if (accepted.length === 0) return
    setAdding(true)
    try {
      const urls = await Promise.all(accepted.map(compressImage))
      onChange(packImages([...images, ...urls]))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className={`tp-form-group${full ? " tp-form-group-full" : ""}`}>
      <span>
        {label} <small className="tp-photo-count">({images.length}/{max})</small>
      </span>
      <input type="file" accept="image/*" multiple={max > 1} disabled={remaining <= 0 || adding} onChange={handleFiles} />
      {adding && <small className="tp-muted">Adding images…</small>}
      {notice && <small className="tp-photo-notice">{notice}</small>}
      {images.length > 0 && (
        <div className="tp-form-photo-strip">
          {images.map((src, i) => (
            <div key={i} className="tp-photo-thumb">
              <img src={src} alt={label} />
              <button
                type="button"
                className="tp-photo-remove"
                aria-label="Remove image"
                onClick={() => {
                  setNotice("")
                  onChange(packImages(images.filter((_, idx) => idx !== i)))
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ImageField({ label, value, onChange, full }) {
  return (
    <label className={`tp-form-group${full ? " tp-form-group-full" : ""}`}>
      <span>{label}</span>
      <input
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          onChange(await compressImage(file))
        }}
      />
      {value && (
        <div className="tp-form-photo-strip">
          <img src={value} alt={label} />
        </div>
      )}
    </label>
  )
}

// A PDF or image upload. A freshly picked file is still a data: URL, which browsers
// refuse to open in a new tab, so it is previewed through a temporary blob: URL
// until the profile is saved (the backend then returns a signed R2 link).
function FileField({ label, value, onChange, full, readOnly }) {
  const [picked, setPicked] = useState(null)

  useEffect(() => {
    if (!picked) return
    return () => URL.revokeObjectURL(picked.url)
  }, [picked])

  const pickedIsCurrent = picked && picked.dataUrl === value
  const viewUrl = pickedIsCurrent ? picked.url : value && isSafeMediaUrl(value) ? value : null

  return (
    <div className={`tp-form-group${full ? " tp-form-group-full" : ""}`}>
      <span>{label}</span>
      {!readOnly && (
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            const dataUrl = await prepareUpload(file)
            setPicked({ url: URL.createObjectURL(file), name: file.name, dataUrl })
            onChange(dataUrl)
          }}
        />
      )}
      {value && (
        <div className="cp-scan-report-row">
          {pickedIsCurrent && <small className="tp-muted">{picked.name}</small>}
          {viewUrl && (
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="tp-form-btn tp-form-btn-secondary">
              View
            </a>
          )}
          {!readOnly && (
            <button
              type="button"
              className="tp-form-btn tp-form-btn-secondary"
              onClick={() => {
                setPicked(null)
                onChange("")
              }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function scanReportNameFromUrl(url) {
  if (!url) return null
  try {
    const filename = decodeURIComponent(new URL(url).pathname.split("/").pop() || "")
    return filename.replace(/\.pdf$/i, "") || null
  } catch {
    return null
  }
}

function ScanReportField({ token, label, value, onChange, vehicleNumber, readOnly }) {
  const valueName = scanReportNameFromUrl(value)
  const [query, setQuery] = useState("")
  const [all, setAll] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const term = query.trim()
  useEffect(() => {
    let active = true
    if (!open || !term) return
    const timer = setTimeout(() => {
      setLoading(true)
      setError("")
      listAllScanReports(token, term).then(found => { if (active) setAll(found) })
        .catch(err => { if (active) setError(err.message || "Could not load reports.") })
        .finally(() => { if (active) setLoading(false) })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [token, term, open])
  const matches = all || []

  function handlePick(resource) {
    onChange(resource.secure_url, resource.filename)
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="tp-form-group" ref={boxRef}>
      <span>{label}{valueName ? " (report selected)" : ""}</span>
      {!readOnly && (
        <div className="cp-scan-report-search-box">
          <input
            type="text"
            className="cp-scan-report-search"
            placeholder="Type a letter to see matching PDFs…"
            value={query}
            onChange={(e) => {
              setAll([])
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              setOpen(true)
            }}
          />
          {loading && <div className="cp-scan-report-hint">Loading PDFs…</div>}
          {open && term && (
            <div className="cp-scan-report-results">
              {matches.length > 0 ? (
                matches.map((r) => (
                  <button
                    type="button"
                    key={r.public_id}
                    className="cp-scan-report-result"
                    onClick={() => handlePick(r)}
                  >
                    {r.format && !r.filename.toLowerCase().endsWith(`.${r.format}`) ? `${r.filename}.${r.format}` : r.filename}
                  </button>
                ))
              ) : (
                !loading && <div className="cp-scan-report-hint">No PDF starting with "{query.trim()}".</div>
              )}
            </div>
          )}
          {error && <div className="tp-form-error">{error}</div>}
        </div>
      )}
      {value && isSafeMediaUrl(value) && (
        <div className="cp-scan-report-row">
          <a href={value} target="_blank" rel="noopener noreferrer" className="tp-form-btn tp-form-btn-secondary">
            View
          </a>
        </div>
      )}
    </div>
  )
}

const DOCUMENT_KINDS = [
  { key: "nic", label: "NIC" },
  { key: "passport", label: "Passport" },
  { key: "other", label: "Other document" },
]

const DOCUMENT_IMAGE_LIMITS = { nic: 2, passport: 5, other: 10 }

function DocumentPicker({ prefix, form, set }) {
  const typesKey = `${prefix}_client_document_types`
  const types = form[typesKey]

  function toggle(kind, checked) {
    set(typesKey, checked ? [...types, kind] : types.filter((t) => t !== kind))
  }

  return (
    <div className="tp-form-group">
      <span>Identification Document</span>
      <div className="cp-radio-row">
        {DOCUMENT_KINDS.map((d) => (
          <label key={d.key} className="cp-radio-option">
            <input type="checkbox" checked={types.includes(d.key)} onChange={(e) => toggle(d.key, e.target.checked)} />
            {d.label}
          </label>
        ))}
        <label className="cp-radio-option">
          <input type="checkbox" checked={types.length === 0} onChange={() => set(typesKey, [])} />
          No document
        </label>
      </div>
      {DOCUMENT_KINDS.filter((d) => types.includes(d.key)).map((d) => (
        <div className="tp-form-row" key={d.key}>
          <TextField
            label={`${d.label} Number`}
            value={form[`${prefix}_client_${d.key}_number`]}
            onChange={(v) => set(`${prefix}_client_${d.key}_number`, v)}
          />
          <MultiImageField
            label={`${d.label} Photo`}
            max={DOCUMENT_IMAGE_LIMITS[d.key]}
            value={form[`${prefix}_client_${d.key}_image`]}
            onChange={(v) => set(`${prefix}_client_${d.key}_image`, v)}
          />
        </div>
      ))}
    </div>
  )
}

export default function ClientProfileForm({ token, profile, readOnly = false, onClose, onCreated, onUpdated }) {
  const isEdit = Boolean(profile)
  const [activeTab, setActiveTab] = useState("client_details")
  const [form, setForm] = useState(() => (isEdit ? mapProfileToForm(profile) : initialFormState))
  const [dirty, setDirty] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  useUnsavedChanges(dirty && !readOnly, "client profile")

  function set(field, value) {
    setDirty(true)
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleClose() {
    if (await confirmDiscard()) onClose()
  }

  async function handleCloseButton() {
    if (readOnly || (await confirmCloseForm("client profile"))) onClose()
  }

  function setExtraDepartment(index, field, value) {
    set(
      "extra_departments",
      form.extra_departments.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")

    const validationError = validateClientTypes(form)
    if (validationError) {
      setError(validationError)
      setActiveTab("client_details")
      return
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        const updated = await updateClientProfile(token, profile.id, buildSubmitPayload(form))
        onUpdated?.(updated)
      } else {
        const created = await createClientProfile(token, buildSubmitPayload(form))
        onCreated?.(created)
      }
    } catch (err) {
      setError(err.message || `Could not ${isEdit ? "update" : "create"} client profile.`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="tp-card cp-form-card">
      <div className="tp-card-head">
        <div className="tp-card-title">
          {readOnly ? "View Client Profile" : isEdit ? "Edit Client Profile" : "Create Client Profile"}
        </div>
        <button type="button" className="tp-form-close" onClick={handleCloseButton} aria-label="Close">
          ×
        </button>
      </div>

      <div className="cp-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`cp-tab${activeTab === tab.key ? " cp-tab-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="tp-inspection-form">
        <fieldset disabled={readOnly} className="cp-fieldset">
        {activeTab === "client_details" && (
          <div className="tp-form-section">
            <label className="cp-radio-option cp-client-toggle">
              <input
                type="checkbox"
                checked={form.has_local_client}
                onChange={(e) => set("has_local_client", e.target.checked)}
              />
              Local Client
            </label>
            {form.has_local_client && (
              <div className="cp-client-block">
                <div className="tp-form-row">
                  <TextField
                    label="Client Name"
                    value={form.local_client_name}
                    onChange={(v) => set("local_client_name", v)}
                  />
                  <TextField
                    label="Phone Number"
                    value={form.local_client_phone}
                    onChange={(v) => set("local_client_phone", v)}
                  />
                </div>
                <DocumentPicker prefix="local" form={form} set={set} />
                <div className="tp-form-row cp-handover-row">
                  <ImageField
                    label="Handover Selfie"
                    value={form.local_client_handover_selfie_image}
                    onChange={(v) => set("local_client_handover_selfie_image", v)}
                  />
                </div>
              </div>
            )}

            <label className="cp-radio-option cp-client-toggle">
              <input
                type="checkbox"
                checked={form.has_foreign_client}
                onChange={(e) => set("has_foreign_client", e.target.checked)}
              />
              Foreign Client
            </label>
            {form.has_foreign_client && (
              <div className="cp-client-block">
                <div className="tp-form-row">
                  <TextField
                    label="Client Name"
                    value={form.foreign_client_name}
                    onChange={(v) => set("foreign_client_name", v)}
                  />
                  <CountrySelect
                    label="Country"
                    value={form.foreign_client_country}
                    onChange={(v) => set("foreign_client_country", v)}
                  />
                  <TextField
                    label="Phone Number"
                    value={form.foreign_client_phone}
                    onChange={(v) => set("foreign_client_phone", v)}
                  />
                </div>
                <DocumentPicker prefix="foreign" form={form} set={set} />
                <div className="tp-form-row cp-handover-row">
                  <ImageField
                    label="Handover Selfie"
                    value={form.foreign_client_handover_selfie_image}
                    onChange={(v) => set("foreign_client_handover_selfie_image", v)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "document" && (
          <div className="tp-form-section">
            <div className="tp-form-row">
              <MultiImageField label="CR Document" max={2} value={form.cr_document_image} onChange={(v) => set("cr_document_image", v)} />
              <MultiImageField
                label="Revenue License"
                max={2}
                value={form.revenue_license_image}
                onChange={(v) => set("revenue_license_image", v)}
              />
            </div>
            <div className="tp-form-row">
              <TextField label="Type" value={form.vehicle_type} onChange={(v) => set("vehicle_type", v)} />
              <TextField label="Chassis Number" value={form.chassis_number} onChange={(v) => set("chassis_number", v)} />
              <TextField label="Vehicle Number" value={form.vehicle_number} onChange={(v) => set("vehicle_number", v)} />
            </div>
          </div>
        )}

        {activeTab === "previous_owner" && (
          <div className="tp-form-section">
            <div className="tp-form-row">
              <TextField label="Previous Owner Name" value={form.previous_owner_name} onChange={(v) => set("previous_owner_name", v)} />
              <TextField label="NIC" value={form.previous_owner_nic} onChange={(v) => set("previous_owner_nic", v)} />
              <TextField label="Phone Number" value={form.previous_owner_phone} onChange={(v) => set("previous_owner_phone", v)} />
              <RadioField
                label="Registration Status"
                value={form.registration_type}
                onChange={(v) => set("registration_type", v)}
                options={[
                  { value: "registered", label: "Registered" },
                  { value: "open_book", label: "Open Book" },
                ]}
              />
            </div>
            <div className="tp-form-row">
              <ImageField
                label="Detailed Selfie Photo"
                value={form.previous_owner_selfie_image}
                onChange={(v) => set("previous_owner_selfie_image", v)}
              />
              <ImageField
                label="In-Writing Letter"
                value={form.in_writing_letter_image}
                onChange={(v) => set("in_writing_letter_image", v)}
              />
            </div>
            <div className="tp-form-row">
              <ScanReportField
                token={token}
                label="Inspection Report 1"
                value={form.scan_report_1_image}
                onChange={(v) => set("scan_report_1_image", v)}
                vehicleNumber={form.vehicle_number}
                readOnly={readOnly}
              />
              <ScanReportField
                token={token}
                label="Inspection Report 2"
                value={form.scan_report_2_image}
                onChange={(v) => set("scan_report_2_image", v)}
                vehicleNumber={form.vehicle_number}
                readOnly={readOnly}
              />
            </div>
            <div className="tp-form-row">
              <FileField
                label="Scan Report 1 (Upload)"
                value={form.scan_report_1_upload}
                onChange={(v) => set("scan_report_1_upload", v)}
                readOnly={readOnly}
              />
              <FileField
                label="Scan Report 2 (Upload)"
                value={form.scan_report_2_upload}
                onChange={(v) => set("scan_report_2_upload", v)}
                readOnly={readOnly}
              />
            </div>
            <div className="tp-form-row">
              <MultiImageField label="Garage Bill" max={10} value={form.garage_bill_image} onChange={(v) => set("garage_bill_image", v)} />
              <MultiImageField label="Modification" max={10} value={form.modification_image} onChange={(v) => set("modification_image", v)} />
            </div>
            <label className="tp-form-group tp-form-group-full">
              <span>Others</span>
              <textarea rows={2} value={form.other_notes} onChange={(e) => set("other_notes", e.target.value)} />
            </label>
            <RadioField
              label="Third Person Involved?"
              value={form.third_person_involved ? "yes" : "no"}
              onChange={(v) => set("third_person_involved", v === "yes")}
              options={[
                { value: "no", label: "No" },
                { value: "yes", label: "Yes" },
              ]}
            />
            {form.third_person_involved && (
              <div className="tp-form-row">
                <ImageField
                  label="Third Person Document"
                  value={form.third_person_image}
                  onChange={(v) => set("third_person_image", v)}
                />
                <ImageField
                  label="Handover Selfie"
                  value={form.handover_selfie_image}
                  onChange={(v) => set("handover_selfie_image", v)}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "department" && (
          <div className="tp-form-section">
            {[
              { key: "marketing", label: "Marketing" },
              { key: "technical", label: "Technical" },
              { key: "purchasing", label: "Purchasing" },
            ].map((d) => (
              <div className="tp-form-row" key={d.key}>
                <TextField
                  label={d.label}
                  placeholder="Person's name"
                  value={form[`${d.key}_person_name`]}
                  onChange={(v) => set(`${d.key}_person_name`, v)}
                />
              </div>
            ))}
            {form.extra_departments.map((d, i) => (
              <div className="tp-form-row cp-extra-department" key={i}>
                <TextField
                  label="Department"
                  placeholder="Department name"
                  value={d.department}
                  onChange={(v) => setExtraDepartment(i, "department", v)}
                />
                <TextField
                  label="Person's Name"
                  placeholder="Person's name"
                  value={d.person_name}
                  onChange={(v) => setExtraDepartment(i, "person_name", v)}
                />
                {!readOnly && (
                  <button
                    type="button"
                    className="tp-form-btn tp-form-btn-secondary cp-extra-department-remove"
                    onClick={() => set("extra_departments", form.extra_departments.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <button
                type="button"
                className="tp-form-btn tp-form-btn-secondary"
                onClick={() => set("extra_departments", [...form.extra_departments, { department: "", person_name: "" }])}
              >
                + Add Department
              </button>
            )}
          </div>
        )}

        {activeTab === "payment" && (
          <div className="tp-form-section">
            <div className="tp-form-row">
              <TextField label="Leasing Company" value={form.leasing_company} onChange={(v) => set("leasing_company", v)} />
              <TextField label="Bank Officer Name" value={form.bank_officer_name} onChange={(v) => set("bank_officer_name", v)} />
            </div>
            <div className="tp-form-row">
              <TextField type="date" label="File Signed Date" value={form.file_signed_date} onChange={(v) => set("file_signed_date", v)} />
              <TextField type="date" label="Payment Date" value={form.payment_date} onChange={(v) => set("payment_date", v)} />
              <TextField type="date" label="DO Date" value={form.do_date} onChange={(v) => set("do_date", v)} />
            </div>
            <div className="tp-form-row">
              <TextField
                type="date"
                label="Customer Advanced Date"
                value={form.customer_advanced_date}
                onChange={(v) => set("customer_advanced_date", v)}
              />
              <TextField
                type="date"
                label="Vehicle Handover Date"
                value={form.vehicle_handover_date}
                onChange={(v) => set("vehicle_handover_date", v)}
              />
              <TextField type="date" label="Purchasing Date" value={form.purchasing_date} onChange={(v) => set("purchasing_date", v)} />
            </div>
            <div className="tp-form-row">
              <TextField type="number" label="Selling Price" value={form.selling_price} onChange={(v) => set("selling_price", v)} />
              <TextField type="number" label="Loan Amount" value={form.loan_amount} onChange={(v) => set("loan_amount", v)} />
              <TextField
                type="number"
                label="Customer Down Payment"
                value={form.customer_down_payment}
                onChange={(v) => set("customer_down_payment", v)}
              />
            </div>
          </div>
        )}
        </fieldset>

        {error && <div className="tp-form-error">{error}</div>}

        <div className="tp-form-actions">
          <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={handleClose}>
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly && (
            <button type="submit" className="tp-form-btn tp-form-btn-primary" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Save Client Profile"}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

import { useEffect, useRef, useState } from "react"
import { createClientProfile, listAllScanReports, updateClientProfile } from "../../../api/clients"
import { TABS, buildSubmitPayload, initialFormState, mapProfileToForm, validateClientTypes } from "./clientProfileSchema"
import { COUNTRIES } from "./countries"
import { isSafeMediaUrl } from "../../../utils/safeUrl"

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function TextField({ label, value, onChange, type = "text", required, placeholder }) {
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
          onChange(await fileToDataUrl(file))
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

let scanReportsCache = null
function fetchAllScanReports(token) {
  if (!scanReportsCache) {
    scanReportsCache = listAllScanReports(token).catch((err) => {
      scanReportsCache = null
      throw err
    })
  }
  return scanReportsCache
}

function scanReportNameFromUrl(url) {
  if (!url) return null
  try {
    const filename = decodeURIComponent(url.split("/").pop() || "")
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

  async function ensureLoaded() {
    if (all || loading) return
    setLoading(true)
    setError("")
    try {
      const found = await fetchAllScanReports(token)
      setAll(found)
    } catch (err) {
      setError(err.message || "Could not load PDFs.")
    } finally {
      setLoading(false)
    }
  }

  const term = query.trim().toLowerCase()
  const matches = term && all ? all.filter((r) => r.filename.toLowerCase().startsWith(term)) : []

  function handlePick(resource) {
    onChange(resource.secure_url, resource.filename)
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="tp-form-group" ref={boxRef}>
      <span>{valueName ? `${label}: ${valueName}` : label}</span>
      {!readOnly && (
        <div className="cp-scan-report-search-box">
          <input
            type="text"
            className="cp-scan-report-search"
            placeholder="Type a letter to see matching PDFs…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              ensureLoaded()
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

const DOCUMENT_OPTIONS = [
  { value: "nic", label: "NIC" },
  { value: "passport", label: "Passport" },
  { value: "other", label: "Other document" },
  { value: "none", label: "No document" },
]

export default function ClientProfileForm({ token, profile, readOnly = false, onClose, onCreated, onUpdated }) {
  const isEdit = Boolean(profile)
  const [activeTab, setActiveTab] = useState("client_details")
  const [form, setForm] = useState(() => (isEdit ? mapProfileToForm(profile) : initialFormState))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
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
        <button type="button" className="tp-form-close" onClick={onClose} aria-label="Close">
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
                <RadioField
                  label="Identification Document"
                  value={form.local_client_document_type}
                  onChange={(v) => set("local_client_document_type", v)}
                  options={DOCUMENT_OPTIONS}
                />
                {form.local_client_document_type !== "none" && (
                  <div className="tp-form-row">
                    <ImageField
                      label="Document Photo"
                      value={form.local_client_document_image}
                      onChange={(v) => set("local_client_document_image", v)}
                    />
                  </div>
                )}
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
                <RadioField
                  label="Identification Document"
                  value={form.foreign_client_document_type}
                  onChange={(v) => set("foreign_client_document_type", v)}
                  options={DOCUMENT_OPTIONS}
                />
                {form.foreign_client_document_type !== "none" && (
                  <div className="tp-form-row">
                    <ImageField
                      label="Document Photo"
                      value={form.foreign_client_document_image}
                      onChange={(v) => set("foreign_client_document_image", v)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "document" && (
          <div className="tp-form-section">
            <div className="tp-form-row">
              <ImageField label="CR Document" value={form.cr_document_image} onChange={(v) => set("cr_document_image", v)} />
              <ImageField
                label="Revenue License"
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
                label="Scan Report 1"
                value={form.scan_report_1_image}
                onChange={(v) => set("scan_report_1_image", v)}
                vehicleNumber={form.vehicle_number}
                readOnly={readOnly}
              />
              <ScanReportField
                token={token}
                label="Scan Report 2"
                value={form.scan_report_2_image}
                onChange={(v) => set("scan_report_2_image", v)}
                vehicleNumber={form.vehicle_number}
                readOnly={readOnly}
              />
            </div>
            <div className="tp-form-row">
              <ImageField label="Garage Bill" value={form.garage_bill_image} onChange={(v) => set("garage_bill_image", v)} />
              <ImageField label="Modification" value={form.modification_image} onChange={(v) => set("modification_image", v)} />
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
            <div className="tp-form-row">
              <SelectField
                label="Department"
                value={form.department}
                onChange={(v) => set("department", v)}
                options={[
                  { value: "marketing", label: "Marketing" },
                  { value: "technical", label: "Technical" },
                  { value: "purchasing", label: "Purchasing" },
                ]}
              />
              <TextField
                label="Person's Name"
                value={form.department_person_name}
                onChange={(v) => set("department_person_name", v)}
              />
            </div>
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
          <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={onClose}>
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

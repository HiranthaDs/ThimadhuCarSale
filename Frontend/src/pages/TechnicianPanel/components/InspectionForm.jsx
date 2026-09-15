import { useState } from "react"
import { SECTIONS, STATUS_OPTIONS, buildInitialData } from "./inspectionSchema"

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function Field({ field, value, onChange, reasonValue, onReasonChange }) {
  const { key, label, type, options } = field

  if (type === "status") {
    const isFail = value === "Fail"
    return (
      <label className={`tp-form-group${isFail ? " tp-form-group-full" : ""}`}>
        <span>{label}</span>
        <select value={value} onChange={(e) => onChange(key, e.target.value)}>
          <option value="">Select…</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {isFail && (
          <div className="tp-fail-reason">
            <span>Reason for failing</span>
            <textarea
              rows={2}
              placeholder="Describe why this failed…"
              value={reasonValue || ""}
              onChange={(e) => onReasonChange(`${key}Reason`, e.target.value)}
            />
          </div>
        )}
      </label>
    )
  }

  if (type === "yesno") {
    return (
      <label className="tp-form-group">
        <span>{label}</span>
        <select value={value} onChange={(e) => onChange(key, e.target.value)}>
          <option value="">Select…</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </label>
    )
  }

  if (type === "select") {
    return (
      <label className="tp-form-group">
        <span>{label}</span>
        <select value={value} onChange={(e) => onChange(key, e.target.value)}>
          <option value="">Select…</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>
    )
  }

  if (type === "textarea") {
    return (
      <label className="tp-form-group tp-form-group-full">
        <span>{label}</span>
        <textarea rows={3} value={value} onChange={(e) => onChange(key, e.target.value)} />
      </label>
    )
  }

  if (type === "photo") {
    return (
      <label className="tp-form-group">
        <span>{label}</span>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            onChange(key, await fileToDataUrl(file))
          }}
        />
        {value && (
          <a className="tp-form-file-preview" href={value} target="_blank" rel="noreferrer">
            Preview attached file
          </a>
        )}
      </label>
    )
  }

  if (type === "multiphoto") {
    return (
      <label className="tp-form-group tp-form-group-full">
        <span>{label}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={async (e) => {
            const files = Array.from(e.target.files || [])
            const urls = await Promise.all(files.map(fileToDataUrl))
            onChange(key, urls)
          }}
        />
        {Array.isArray(value) && value.length > 0 && (
          <div className="tp-form-photo-strip">
            {value.map((src, i) => (
              <img key={i} src={src} alt="" />
            ))}
          </div>
        )}
      </label>
    )
  }

  return (
    <label className="tp-form-group">
      <span>{label}</span>
      <input
        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        value={value}
        onChange={(e) => onChange(key, e.target.value)}
      />
    </label>
  )
}

export default function InspectionForm({ onClose, onSubmit }) {
  const [data, setData] = useState(buildInitialData)

  function update(key, value) {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit?.(data)
  }

  return (
    <div className="tp-card tp-inspection-form">
      <div className="tp-card-head">
        <div className="tp-card-title">New Inspection Report</div>
        <button type="button" className="tp-form-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {SECTIONS.map((section) => (
          <div className="tp-form-section" key={section.title}>
            <div className="tp-form-section-title">{section.title}</div>
            <div className="tp-form-grid">
              {section.fields.map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  value={data[field.key]}
                  onChange={update}
                  reasonValue={data[`${field.key}Reason`]}
                  onReasonChange={update}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="tp-form-actions">
          <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={() => setData(buildInitialData())}>
            Reset
          </button>
          <button type="submit" className="tp-form-btn tp-form-btn-primary">
            Generate Report
          </button>
        </div>
      </form>
    </div>
  )
}

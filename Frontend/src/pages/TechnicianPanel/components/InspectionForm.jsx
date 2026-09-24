import { useState } from "react"
import { MAX_PHOTOS_PER_FIELD, SECTIONS, STATUS_OPTIONS, buildInitialData, toPhotoList, withDefaults } from "./inspectionSchema"

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Phone photos are several MB each; with up to 60 per field the report would
// get far too big, so each image is scaled down to 1600px JPEG before it is kept.
const MAX_IMAGE_SIDE = 1600

function compressImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL("image/jpeg", 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(fileToDataUrl(file))
    }
    img.src = url
  })
}

function MultiPhotoField({ field, value, onChange }) {
  const { key, label } = field
  const photos = toPhotoList(value)
  const remaining = MAX_PHOTOS_PER_FIELD - photos.length
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState("")

  async function handleFiles(e) {
    const picked = Array.from(e.target.files || [])
    e.target.value = ""
    if (picked.length === 0) return
    const accepted = picked.slice(0, Math.max(remaining, 0))
    setNotice(
      accepted.length < picked.length
        ? `Only ${MAX_PHOTOS_PER_FIELD} photos are allowed per field — ${picked.length - accepted.length} were not added.`
        : "",
    )
    if (accepted.length === 0) return
    setAdding(true)
    try {
      const urls = await Promise.all(accepted.map(compressImage))
      onChange(key, [...photos, ...urls])
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="tp-form-group tp-form-group-full">
      <span>
        {label}{" "}
        <small className="tp-photo-count">
          ({photos.length}/{MAX_PHOTOS_PER_FIELD})
        </small>
      </span>
      <input type="file" accept="image/*" multiple disabled={remaining <= 0 || adding} onChange={handleFiles} />
      {adding && <small className="tp-muted">Adding photos…</small>}
      {notice && <small className="tp-photo-notice">{notice}</small>}
      {photos.length > 0 && (
        <div className="tp-form-photo-strip">
          {photos.map((src, i) => (
            <div key={i} className="tp-photo-thumb">
              <img src={src} alt="" />
              <button
                type="button"
                className="tp-photo-remove"
                aria-label="Remove photo"
                onClick={() => {
                  setNotice("")
                  onChange(key, photos.filter((_, idx) => idx !== i))
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

  if (type === "file") {
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
    return <MultiPhotoField field={field} value={value} onChange={onChange} />
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

export default function InspectionForm({ onClose, onSubmit, initialData }) {
  const [data, setData] = useState(() => withDefaults(initialData))

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
        <div className="tp-card-title">{initialData ? "Edit Inspection Report" : "New Inspection Report"}
          {data.scanNumber === 2 ? " — Scan 2" : ""}</div>
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
          <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={() => setData({ ...buildInitialData(), scanNumber: data.scanNumber })}>
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

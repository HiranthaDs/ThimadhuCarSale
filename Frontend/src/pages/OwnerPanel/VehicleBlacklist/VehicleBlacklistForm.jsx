import { useState } from "react"
import { createBlacklistEntry } from "../../../api/blacklist"

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const initialForm = { vehicle_number: "", chassis_number: "", remarks: "", images: [] }

export default function VehicleBlacklistForm({ token, onClose, onCreated }) {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const payload = {
        vehicle_number: form.vehicle_number || null,
        chassis_number: form.chassis_number || null,
        remarks: form.remarks || null,
        images: form.images,
      }
      const created = await createBlacklistEntry(token, payload)
      onCreated?.(created)
    } catch (err) {
      setError(err.message || "Could not add blacklist entry.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="tp-card" style={{ maxWidth: 780, marginBottom: 20 }}>
      <div className="tp-card-head">
        <div className="tp-card-title">Add Blacklisted Vehicle</div>
        <button type="button" className="tp-form-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="tp-form-row">
          <label className="tp-form-group">
            <span>Vehicle Number</span>
            <input
              type="text"
              value={form.vehicle_number}
              onChange={(e) => set("vehicle_number", e.target.value)}
            />
          </label>
          <label className="tp-form-group">
            <span>Chassis Number</span>
            <input
              type="text"
              value={form.chassis_number}
              onChange={(e) => set("chassis_number", e.target.value)}
            />
          </label>
        </div>

        <label className="tp-form-group tp-form-group-full">
          <span>Images</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={async (e) => {
              const files = Array.from(e.target.files || [])
              const urls = await Promise.all(files.map(fileToDataUrl))
              set("images", [...form.images, ...urls])
            }}
          />
          {form.images.length > 0 && (
            <div className="tp-form-photo-strip">
              {form.images.map((src, i) => (
                <div key={i} className="cp-thumb-wrap">
                  <img src={src} alt="" />
                  <button
                    type="button"
                    className="cp-thumb-remove"
                    onClick={() => set("images", form.images.filter((_, idx) => idx !== i))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </label>

        <label className="tp-form-group tp-form-group-full">
          <span>Remarks</span>
          <textarea rows={3} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
        </label>

        {error && <div className="tp-form-error">{error}</div>}

        <div className="tp-form-actions" style={{ marginTop: 15 }}>
          <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="tp-form-btn tp-form-btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Add to Blacklist"}
          </button>
        </div>
      </form>
    </div>
  )
}

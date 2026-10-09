import { useState } from "react"
import { createBlacklistEntry, updateBlacklistEntry } from "../../../api/blacklist"
import CameraButton from "../../../components/CameraCapture"
import { compressImage } from "../../../utils/image"

const initialForm = { vehicle_number: "", mileage: "", remarks: "", images: [] }

function formFromEntry(entry) {
  if (!entry) return initialForm
  return {
    vehicle_number: entry.vehicle_number || "",
    mileage: entry.mileage || "",
    remarks: entry.remarks || "",
    images: entry.images.map((img) => img.image),
  }
}

// Pass `entry` to edit an existing blacklist entry; omit it to add a new one.
export default function VehicleBlacklistForm({ token, entry, onClose, onCreated, onUpdated }) {
  const isEdit = Boolean(entry)
  const [form, setForm] = useState(() => formFromEntry(entry))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function addImages(urls) {
    setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const payload = {
        vehicle_number: form.vehicle_number || null,
        mileage: form.mileage || null,
        remarks: form.remarks || null,
        images: form.images,
      }
      if (isEdit) {
        onUpdated?.(await updateBlacklistEntry(token, entry.id, payload))
      } else {
        onCreated?.(await createBlacklistEntry(token, payload))
      }
    } catch (err) {
      setError(err.message || (isEdit ? "Could not update blacklist entry." : "Could not add blacklist entry."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="tp-card vb-form-card">
      <div className="tp-card-head">
        <div className="tp-card-title">{isEdit ? "Edit Blacklisted Vehicle" : "Add Blacklisted Vehicle"}</div>
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
            <span>Mileage (km)</span>
            <input
              type="text"
              value={form.mileage}
              onChange={(e) => set("mileage", e.target.value)}
            />
          </label>
        </div>

        <div className="tp-form-group tp-form-group-full">
          <span>Images</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={async (e) => {
              const files = Array.from(e.target.files || [])
              e.target.value = ""
              addImages(await Promise.all(files.map(compressImage)))
            }}
          />
          <CameraButton onCapture={addImages} onFiles={async (files) => addImages(await Promise.all(files.map(compressImage)))} />
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
        </div>

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
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add to Blacklist"}
          </button>
        </div>
      </form>
    </div>
  )
}

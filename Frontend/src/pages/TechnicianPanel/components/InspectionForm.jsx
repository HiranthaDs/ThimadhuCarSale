import { useEffect, useId, useRef, useState } from "react"
import DatePicker from "../../../components/DatePicker"
import CameraButton from "../../../components/CameraCapture"
import { confirmCloseForm, confirmDiscard, useUnsavedChanges } from "../../../components/unsavedChanges"
import { compressImage, fileToDataUrl, prepareUpload } from "../../../utils/image"
import carDiagram from "../../../assets/car-diagram.png"
import { MAX_PHOTOS_PER_FIELD, SECTIONS, STATUS_OPTIONS, buildInitialData, isFieldVisible, toPhotoList, withDefaults } from "./inspectionSchema"

function MultiPhotoField({ field, value, onChange }) {
  const { key, label } = field
  const photos = toPhotoList(value)
  const limit = field.max || MAX_PHOTOS_PER_FIELD
  const remaining = limit - photos.length
  // Camera shots arrive one by one, faster than the form re-renders.
  const photosRef = useRef(photos)
  photosRef.current = photos
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState("")

  async function addFiles(picked) {
    if (picked.length === 0) return
    const accepted = picked.slice(0, Math.max(remaining, 0))
    setNotice(
      accepted.length < picked.length
        ? `Only ${limit} photos are allowed per field — ${picked.length - accepted.length} were not added.`
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
          ({photos.length}/{limit})
        </small>
      </span>
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={remaining <= 0 || adding}
        onChange={(e) => {
          const picked = Array.from(e.target.files || [])
          e.target.value = ""
          addFiles(picked)
        }}
      />
      <CameraButton
        remaining={remaining}
        disabled={adding}
        onFiles={addFiles}
        onCapture={(urls) => {
          setNotice("")
          photosRef.current = [...photosRef.current, ...urls].slice(0, limit)
          onChange(key, photosRef.current)
        }}
      />
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

// Signatures only need to be legible at a small print size, so uploads are
// scaled down hard — a full-resolution photo would print far too large.
const SIGNATURE_MAX_WIDTH = 500
const SIGNATURE_MAX_HEIGHT = 200

function compressSignatureImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, SIGNATURE_MAX_WIDTH / img.width, SIGNATURE_MAX_HEIGHT / img.height)
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL("image/png"))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(fileToDataUrl(file))
    }
    img.src = url
  })
}

function SignatureField({ field, value, onChange }) {
  const { key, label } = field
  const [mode, setMode] = useState("upload")
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)

  function pointerPos(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const point = e.touches ? e.touches[0] : e
    return {
      x: ((point.clientX - rect.left) * canvas.width) / rect.width,
      y: ((point.clientY - rect.top) * canvas.height) / rect.height,
    }
  }

  function startDraw(e) {
    e.preventDefault()
    const canvas = canvasRef.current
    const { x, y } = pointerPos(e, canvas)
    const ctx = canvas.getContext("2d")
    ctx.beginPath()
    ctx.moveTo(x, y)
    drawingRef.current = true
  }

  function moveDraw(e) {
    if (!drawingRef.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const { x, y } = pointerPos(e, canvas)
    const ctx = canvas.getContext("2d")
    ctx.strokeStyle = "#141c2e"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function endDraw() {
    if (!drawingRef.current) return
    drawingRef.current = false
    onChange(key, canvasRef.current.toDataURL("image/png"))
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    canvas?.getContext("2d").clearRect(0, 0, canvas.width, canvas.height)
    onChange(key, "")
  }

  return (
    <div className="tp-form-group tp-form-group-full">
      <span>{label}</span>
      <div className="tp-signature-tabs">
        <button
          type="button"
          className={`tp-signature-tab${mode === "upload" ? " tp-signature-tab-active" : ""}`}
          onClick={() => setMode("upload")}
        >
          Upload Image
        </button>
        <button
          type="button"
          className={`tp-signature-tab${mode === "draw" ? " tp-signature-tab-active" : ""}`}
          onClick={() => setMode("draw")}
        >
          Draw Signature
        </button>
      </div>

      {mode === "upload" && (
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            onChange(key, await compressSignatureImage(file))
          }}
        />
      )}

      {mode === "draw" && (
        <div className="tp-signature-pad">
          <canvas
            ref={canvasRef}
            width={SIGNATURE_MAX_WIDTH}
            height={SIGNATURE_MAX_HEIGHT}
            className="tp-signature-canvas"
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={moveDraw}
            onTouchEnd={endDraw}
          />
          <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={clearCanvas}>
            Clear
          </button>
        </div>
      )}

      {value && (
        <div className="tp-signature-preview">
          <img src={value} alt="Signature preview" />
        </div>
      )}
    </div>
  )
}

const DIAGRAM_W = 1000
const DIAGRAM_H = 637
const DIAGRAM_COLORS = [
  { name: "Repainted", color: "#e53935" },
  { name: "Faded", color: "#1e30e8" },
  { name: "Scratch", color: "#3f9b2f" },
  { name: "Chip", color: "#f5cf4a" },
  { name: "Dent", color: "#5b1fa8" },
  { name: "Rust", color: "#e08a2e" },
]

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Editable car diagram: pick a color, mark damage, and the flattened picture is saved as the field value.
function DiagramField({ field, marksValue, onChange }) {
  const { key, label } = field
  const baseRef = useRef(null)
  const marksRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const lastMarks = useRef("")
  const history = useRef([])
  const [color, setColor] = useState(DIAGRAM_COLORS[0].color)
  const [size, setSize] = useState(10)
  const [erasing, setErasing] = useState(false)
  const [, setReady] = useState(0)

  useEffect(() => {
    loadImage(carDiagram).then((img) => {
      if (!img) return
      const ctx = baseRef.current.getContext("2d")
      ctx.fillStyle = "#fff"
      ctx.fillRect(0, 0, DIAGRAM_W, DIAGRAM_H)
      ctx.drawImage(img, 0, 0, DIAGRAM_W, DIAGRAM_H)
      setReady((n) => n + 1)
    })
  }, [])

  // Load saved marks on mount, and when the form is reset or loaded from outside.
  useEffect(() => {
    if ((marksValue || "") === lastMarks.current) return
    lastMarks.current = marksValue || ""
    const ctx = marksRef.current.getContext("2d")
    ctx.clearRect(0, 0, DIAGRAM_W, DIAGRAM_H)
    if (marksValue) loadImage(marksValue).then((img) => img && ctx.drawImage(img, 0, 0))
  }, [marksValue])

  function point(e) {
    const rect = marksRef.current.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * DIAGRAM_W, y: ((e.clientY - rect.top) / rect.height) * DIAGRAM_H }
  }

  function stroke(from, to) {
    const ctx = marksRef.current.getContext("2d")
    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over"
    ctx.strokeStyle = color
    ctx.lineWidth = erasing ? size * 2 : size
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x + 0.01, to.y)
    ctx.stroke()
  }

  function start(e) {
    e.preventDefault()
    marksRef.current.setPointerCapture?.(e.pointerId)
    history.current.push(marksRef.current.toDataURL())
    if (history.current.length > 20) history.current.shift()
    drawing.current = true
    last.current = point(e)
    stroke(last.current, last.current)
  }

  function move(e) {
    if (!drawing.current) return
    const p = point(e)
    stroke(last.current, p)
    last.current = p
  }

  function save() {
    const marks = marksRef.current.toDataURL("image/png")
    const out = document.createElement("canvas")
    out.width = DIAGRAM_W
    out.height = DIAGRAM_H + 40
    const ctx = out.getContext("2d")
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(baseRef.current, 0, 0)
    ctx.drawImage(marksRef.current, 0, 0)
    ctx.font = "600 18px sans-serif"
    let x = 20
    DIAGRAM_COLORS.forEach((c) => {
      ctx.fillStyle = c.color
      ctx.fillRect(x, DIAGRAM_H + 10, 20, 20)
      ctx.fillStyle = "#111827"
      ctx.fillText(c.name, x + 28, DIAGRAM_H + 27)
      x += 48 + ctx.measureText(c.name).width
    })
    lastMarks.current = marks
    onChange(`${key}Marks`, marks)
    onChange(key, out.toDataURL("image/jpeg", 0.9))
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    save()
  }

  function undo() {
    const prev = history.current.pop()
    if (prev === undefined) return
    const ctx = marksRef.current.getContext("2d")
    ctx.globalCompositeOperation = "source-over"
    ctx.clearRect(0, 0, DIAGRAM_W, DIAGRAM_H)
    loadImage(prev).then((img) => { if (img) ctx.drawImage(img, 0, 0); save() })
  }

  function clearAll() {
    history.current.push(marksRef.current.toDataURL())
    marksRef.current.getContext("2d").clearRect(0, 0, DIAGRAM_W, DIAGRAM_H)
    lastMarks.current = ""
    onChange(`${key}Marks`, "")
    onChange(key, "")
  }

  return (
    <div className="tp-form-group tp-form-group-full">
      <span>{label}</span>
      <div className="tp-diagram-tools">
        {DIAGRAM_COLORS.map((c) => (
          <button
            key={c.color}
            type="button"
            className={`tp-diagram-swatch${!erasing && color === c.color ? " is-active" : ""}`}
            onClick={() => { setColor(c.color); setErasing(false) }}
          >
            <i style={{ background: c.color }} />{c.name}
          </button>
        ))}
        <label className="tp-diagram-swatch" title="Custom color">
          <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setErasing(false) }} />Custom
        </label>
        <button type="button" className={`tp-diagram-swatch${erasing ? " is-active" : ""}`} onClick={() => setErasing(true)}>Eraser</button>
        <label className="tp-diagram-size">
          Size
          <input type="range" min="3" max="30" value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
        <button type="button" className="tp-diagram-swatch" onClick={undo}>Undo</button>
        <button type="button" className="tp-diagram-swatch" onClick={clearAll}>Clear</button>
      </div>
      <div className="tp-diagram-stage">
        <canvas ref={baseRef} width={DIAGRAM_W} height={DIAGRAM_H} />
        <canvas
          ref={marksRef}
          width={DIAGRAM_W}
          height={DIAGRAM_H}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label={`${label} drawing area`}
        />
      </div>
    </div>
  )
}

// Radio buttons shown instead of a dropdown on phones and tablets (see TechnicianPanel.css).
function RadioOptions({ name, label, options, value, onChange }) {
  return (
    <div className="tp-status-radios" role="radiogroup" aria-label={label}>
      {options.map((opt) => (
        <label key={opt} className={`tp-status-radio${value === opt ? " is-checked" : ""}`}>
          <input type="radio" name={name} value={opt} checked={value === opt} onChange={() => onChange(opt)} />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  )
}

function Field({ field, value, onChange, reasonValue, onReasonChange, marksValue }) {
  const { key, label, type, options } = field

  if (type === "status") {
    const isFail = value === "Fail"
    return (
      <div className={`tp-form-group${isFail ? " tp-form-group-full" : ""}`}>
        <span>{label}</span>
        <select className="tp-status-select" value={value} onChange={(e) => onChange(key, e.target.value)}>
          <option value="">Select…</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <RadioOptions name={key} label={label} options={STATUS_OPTIONS} value={value} onChange={(v) => onChange(key, v)} />
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
      </div>
    )
  }

  if (type === "yesno") {
    return (
      <div className="tp-form-group">
        <span>{label}</span>
        <select className="tp-status-select" value={value} onChange={(e) => onChange(key, e.target.value)}>
          <option value="">Select…</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
        <RadioOptions name={key} label={label} options={["Yes", "No"]} value={value} onChange={(v) => onChange(key, v)} />
      </div>
    )
  }

  if (type === "select") {
    return (
      <div className="tp-form-group">
        <span>{label}</span>
        <select className="tp-status-select" value={value} onChange={(e) => onChange(key, e.target.value)}>
          <option value="">Select…</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <RadioOptions name={key} label={label} options={options} value={value} onChange={(v) => onChange(key, v)} />
      </div>
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
          accept={field.accept || "image/*,.pdf"}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            onChange(key, await prepareUpload(file))
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

  if (type === "reference") {
    return (
      <div className="tp-form-group tp-form-group-full">
        <span>{label}</span>
        <img className="tp-reference-image" src={field.image} alt={label} />
      </div>
    )
  }

  if (type === "diagram") {
    return <DiagramField field={field} marksValue={marksValue} onChange={onChange} />
  }

  if (type === "signature") {
    return <SignatureField field={field} value={value} onChange={onChange} />
  }

  if (type === "datetime") {
    const [datePart = "", timePart = ""] = String(value || "").split("T")
    const [hour = "", minute = ""] = timePart.split(":")
    const emit = (d, h, m) => onChange(key, d || h || m ? `${d}T${h || "00"}:${m || "00"}` : "")
    return (
      <div className="tp-form-group">
        <span>{label}</span>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
          <DatePicker value={datePart} onChange={(v) => emit(v, hour, minute)} />
          <select aria-label={`${label} hour`} value={hour} onChange={(e) => emit(datePart, e.target.value, minute)}>
            <option value="">HH</option>
            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <select aria-label={`${label} minute`} value={minute} onChange={(e) => emit(datePart, hour, e.target.value)}>
            <option value="">MM</option>
            {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
    )
  }

  if (type === "date") {
    return (
      <div className="tp-form-group">
        <span>{label}</span>
        <DatePicker value={value} onChange={(v) => onChange(key, v)} />
      </div>
    )
  }

  return (
    <label className="tp-form-group">
      <span>{label}</span>
      <input
        type={type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(key, e.target.value)}
      />
    </label>
  )
}

export default function InspectionForm({ onClose, onSubmit, initialData }) {
  const [data, setData] = useState(() => withDefaults(initialData))
  const [dirty, setDirty] = useState(false)
  const formId = useId()
  useUnsavedChanges(dirty, "inspection report")

  function update(key, value) {
    setDirty(true)
    setData((prev) => ({ ...prev, [key]: value }))
  }

  async function handleClose() {
    if (await confirmCloseForm("inspection report")) onClose()
  }

  async function handleReset() {
    if (!(await confirmDiscard())) return
    setData({ ...buildInitialData(), scanNumber: data.scanNumber })
    setDirty(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit?.(data)
  }

  const form = (
    <div className="tp-card tp-inspection-form">
      <div className="tp-card-head">
        <div className="tp-card-title">{initialData ? "Edit Inspection Report" : "New Inspection Report"}
          {data.scanNumber === 2 ? " — Inspection Report 2" : ""}</div>
        <div className="tp-form-head-actions">
          {/* Same as the button at the bottom, so a long form needn't be scrolled to the end. */}
          <button type="submit" form={formId} className="tp-form-btn tp-form-btn-primary tp-form-head-submit">
            Generate Report
          </button>
          <button type="button" className="tp-form-close" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      <form id={formId} onSubmit={handleSubmit}>
        {SECTIONS.map((section) => (
          <div className="tp-form-section" key={section.title}>
            <div className="tp-form-section-title">{section.title}</div>
            <div className="tp-form-grid">
              {section.fields.filter((field) => isFieldVisible(field, data)).map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  value={data[field.key]}
                  onChange={update}
                  reasonValue={data[`${field.key}Reason`]}
                  marksValue={data[`${field.key}Marks`]}
                  onReasonChange={update}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="tp-form-actions">
          <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={handleReset}>
            Reset
          </button>
          <button type="submit" className="tp-form-btn tp-form-btn-primary">
            Generate Report
          </button>
        </div>
      </form>
    </div>
  )

  // When editing, the form fills the content area and scrolls on its own; the
  // page behind it stays put (see .tp-edit-panel).
  return initialData ? <div className="tp-edit-panel">{form}</div> : form
}

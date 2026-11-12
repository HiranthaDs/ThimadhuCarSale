import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { uploadReportPdf } from "../../../api/reports"

function UploadIcon() {
  return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 35H12a8 8 0 0 1-1-16 13 13 0 0 1 25-2 9 9 0 0 1 0 18h-3" />
    <path d="M24 38V22m-6 6 6-6 6 6" />
  </svg>
}

export default function UploadInspectionReport({ token, onUploaded }) {
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const close = useCallback(() => {
    setOpen(false)
    setFile(null)
    setPreviewUrl("")
    setName("")
    setError("")
    setProgress(0)
    setDragging(false)
  }, [])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event) {
      if (event.key === "Escape" && !busy) close()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, busy, close])

  function chooseFile(selected) {
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith(".pdf") || (selected.type && selected.type !== "application/pdf")) {
      setError("Select a PDF file.")
      return
    }
    const pdf = selected.type ? selected : new File([selected], selected.name, { type: "application/pdf" })
    setFile(pdf)
    setPreviewUrl(URL.createObjectURL(pdf))
    setName(selected.name.replace(/\.pdf$/i, ""))
    setError("")
    setProgress(0)
  }

  async function submit(event) {
    event.preventDefault()
    const chosenName = name.trim().replace(/\.pdf$/i, "").trim()
    if (!chosenName || chosenName.length > 200 || /[\\/:*?"<>|]/.test(chosenName) || [...chosenName].some(char => char.charCodeAt(0) < 32)) {
      setError("Enter a name of up to 200 characters without /, \\, :, *, ?, quotes, <, >, or |.")
      return
    }
    setBusy(true)
    setError("")
    try {
      await uploadReportPdf(token, file, { fileName: chosenName }, setProgress)
      setBusy(false)
      close()
      onUploaded?.()
    } catch (err) {
      setError(err.message || "Could not upload the report.")
      setBusy(false)
    }
  }

  return <>
    <button type="button" className="tp-inspection-btn tp-inspection-btn-upload" onClick={() => setOpen(true)}>
      Upload Inspection Reports
    </button>
    {open && createPortal(
      <div className="tp-upload-modal-backdrop" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) close() }}>
        <section className="tp-upload-modal" role="dialog" aria-modal="true" aria-labelledby="tp-upload-modal-title">
          <div className="tp-upload-modal-header">
            <span className="tp-upload-modal-icon"><UploadIcon /></span>
            <div>
              <h2 id="tp-upload-modal-title">Upload inspection report</h2>
              <p>Select a PDF, preview it, and choose its saved name.</p>
            </div>
            <button type="button" className="tp-upload-modal-close" aria-label="Close upload dialog" disabled={busy} onClick={close}>×</button>
          </div>
          <div className="tp-upload-modal-body">
            <input ref={inputRef} className="tp-upload-report-input" type="file" accept="application/pdf,.pdf" onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = "" }} aria-label="Choose inspection report PDF" />
            <div className={`tp-upload-dropzone${dragging ? " tp-upload-dropzone-active" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
              onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) chooseFile(event.dataTransfer.files?.[0]) }}>
              <UploadIcon />
              <strong>Choose a PDF or drag and drop it here</strong>
              <span>PDF format only</span>
              <button type="button" disabled={busy} autoFocus onClick={() => inputRef.current?.click()}>Browse file</button>
            </div>
            {file && <form className="tp-upload-selection" onSubmit={submit}>
              <div className="tp-upload-file-heading">
                <span className="tp-upload-pdf-badge">PDF</span>
                <div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></div>
                <button type="button" aria-label="Remove selected PDF" disabled={busy} onClick={() => { setFile(null); setPreviewUrl(""); setError("") }}>×</button>
              </div>
              <label htmlFor="inspection-upload-name">Save as</label>
              <div className="tp-upload-report-name-row">
                <input id="inspection-upload-name" type="text" value={name} onChange={(event) => setName(event.target.value)} maxLength={204} disabled={busy} autoFocus />
                <span>.pdf</span>
              </div>
              <div className="tp-upload-preview-heading">PDF preview <span>Review the document before saving</span></div>
              {previewUrl && <iframe className="tp-upload-preview" title="Selected inspection report PDF preview" src={previewUrl} />}
              <div className="tp-upload-modal-actions">
                <button type="button" className="tp-upload-cancel" disabled={busy} onClick={close}>Cancel</button>
                <button type="submit" className="tp-upload-save" disabled={busy || !previewUrl}>{busy ? `Uploading ${Math.round(progress * 100)}%` : "Save report"}</button>
              </div>
            </form>}
            {error && <p className="tp-inspections-status tp-inspections-error" role="alert">{error}</p>}
          </div>
        </section>
      </div>, document.body)}
  </>
}

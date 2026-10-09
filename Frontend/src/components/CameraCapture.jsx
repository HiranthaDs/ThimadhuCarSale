import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { sourceToJpeg } from "../utils/image"
import "./CameraCapture.css"

function cameraSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)
}

// Live camera in a modal. "Capture" freezes the frame for a check; "Use Photo"
// puts it straight into the form's photo list (handed to onCapture as a
// one-item list of JPEG data URLs) and returns to the live view for more.
// Closing with a captured-but-unconfirmed photo still keeps it.
function CameraModal({ remaining, onCapture, onClose }) {
  const videoRef = useRef(null)
  const [facing, setFacing] = useState("environment")
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)
  const [preview, setPreview] = useState(null)
  const [added, setAdded] = useState([])
  const [toast, setToast] = useState("")
  const previewRef = useRef(null)
  previewRef.current = preview
  const closeRef = useRef(null)
  closeRef.current = () => {
    if (previewRef.current) onCapture([previewRef.current])
    previewRef.current = null
    onClose()
  }
  const close = () => closeRef.current()

  useEffect(() => {
    let stream
    let cancelled = false
    setReady(false)
    setError("")
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        videoRef.current.srcObject = s
        return videoRef.current.play().then(() => setReady(true))
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err?.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access for this site in your browser settings."
            : err?.name === "NotFoundError"
              ? "No camera was found on this device."
              : "Could not start the camera.",
        )
      })
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facing])

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") closeRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // The form's limit is reached: nothing more can be added, so close.
  useEffect(() => {
    if (remaining <= 0) onClose()
  }, [remaining, onClose])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(""), 1800)
    return () => clearTimeout(timer)
  }, [toast])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth || remaining <= 0) return
    setPreview(sourceToJpeg(video, video.videoWidth, video.videoHeight))
  }

  function usePhoto() {
    if (!preview) return
    onCapture([preview])
    setAdded((prev) => [...prev, preview])
    setPreview(null)
    setToast("✓ Photo added to the form")
  }

  return createPortal(
    <div className="cc-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="cc-dialog" role="dialog" aria-modal="true" aria-label="Take photo">
        <div className="cc-head">
          <span>Take Photo</span>
          <span className="cc-count">
            {[added.length > 0 && `${added.length} added`, Number.isFinite(remaining) && `${remaining} left`].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className="cc-stage">
          <video ref={videoRef} playsInline muted className={facing === "user" ? "cc-mirror" : ""} />
          {preview && <img className="cc-preview" src={preview} alt="Captured photo" />}
          {!ready && !error && <div className="cc-status">Starting camera…</div>}
          {error && <div className="cc-status cc-error">{error}</div>}
          {toast && <div className="cc-toast">{toast}</div>}
        </div>
        <div className="cc-bar">
          {preview ? (
            <>
              <button type="button" className="cc-btn" onClick={() => setPreview(null)}>
                Retake
              </button>
              <button type="button" className="cc-btn cc-btn-primary" onClick={usePhoto}>
                ✓ Use Photo
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="cc-btn"
                onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                disabled={Boolean(error)}
              >
                Flip
              </button>
              <button type="button" className="cc-btn cc-btn-primary" onClick={capture} disabled={!ready || remaining <= 0}>
                📸 Capture
              </button>
            </>
          )}
          <button type="button" className="cc-btn" onClick={close}>
            {added.length > 0 || preview ? "Finish" : "Close"}
          </button>
        </div>
        {added.length > 0 && (
          <div className="cc-strip" aria-label="Photos added to the form">
            {added.map((src, i) => (
              <img key={i} src={src} alt="" />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// "Take Photo" button. Uses the live camera where the browser allows it, and
// falls back to the phone's own camera app (capture input) where it doesn't.
// Leave `remaining` out when the field has no photo limit.
export default function CameraButton({ remaining = Infinity, disabled, onCapture, onFiles }) {
  const [open, setOpen] = useState(false)
  const fallbackRef = useRef(null)
  const close = useCallback(() => setOpen(false), [])

  function start() {
    if (cameraSupported()) setOpen(true)
    else fallbackRef.current?.click()
  }

  return (
    <>
      <button type="button" className="tp-form-btn tp-form-btn-secondary cc-open" disabled={disabled || remaining <= 0} onClick={start}>
        📷 Take Photo
      </button>
      <input
        ref={fallbackRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          e.target.value = ""
          if (files.length) onFiles(files)
        }}
      />
      {open && <CameraModal remaining={remaining} onCapture={onCapture} onClose={close} />}
    </>
  )
}

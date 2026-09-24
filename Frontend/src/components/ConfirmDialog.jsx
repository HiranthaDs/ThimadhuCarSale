import { useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import "./ConfirmDialog.css"

// In-app replacement for window.confirm(), which the browser labels
// "localhost:5173 says". Usage:
//   if (!(await confirmDialog({ title: "Delete report?", message: "...", danger: true }))) return

function Dialog({ title, message, confirmLabel, cancelLabel, danger, onResult }) {
  const confirmRef = useRef(null)

  useEffect(() => {
    confirmRef.current?.focus()
    function onKey(e) {
      if (e.key === "Escape") onResult(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onResult])

  return (
    <div className="cd-overlay" onMouseDown={(e) => e.target === e.currentTarget && onResult(false)}>
      <div className="cd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cd-title">
        <div className={`cd-icon${danger ? " cd-icon-danger" : ""}`} aria-hidden="true">
          {danger ? "!" : "?"}
        </div>
        <h2 id="cd-title" className="cd-title">{title}</h2>
        {message && <p className="cd-message">{message}</p>}
        <div className="cd-actions">
          <button type="button" className="cd-btn cd-btn-cancel" onClick={() => onResult(false)}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`cd-btn ${danger ? "cd-btn-danger" : "cd-btn-primary"}`}
            onClick={() => onResult(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function confirmDialog({
  title = "Are you sure?",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = createRoot(host)

    function onResult(value) {
      root.unmount()
      host.remove()
      resolve(value)
    }

    root.render(
      <Dialog
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        danger={danger}
        onResult={onResult}
      />,
    )
  })
}

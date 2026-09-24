import { useEffect, useState } from "react"
import { isSafeMediaUrl } from "../../../utils/safeUrl"

// Read-only view of a blacklist entry. Images are shown one at a time, large,
// with prev/next arrows, ←/→ keys and a thumbnail strip to jump around.
export default function VehicleBlacklistViewer({ entry, startIndex = 0, onClose }) {
  const images = entry.images
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(images.length - 1, 0)))

  function go(delta) {
    if (images.length === 0) return
    setIndex((i) => (i + delta + images.length) % images.length)
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft") go(-1)
      else if (e.key === "ArrowRight") go(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, onClose])

  const current = images[index]

  return (
    <div className="vb-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tp-card vb-viewer">
        <div className="tp-card-head">
          <div className="tp-card-title">Blacklisted Vehicle — {entry.vehicle_number || entry.chassis_number || "Details"}</div>
          <button type="button" className="tp-form-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <dl className="vb-details">
          <div>
            <dt>Vehicle Number</dt>
            <dd>{entry.vehicle_number || "—"}</dd>
          </div>
          <div>
            <dt>Chassis Number</dt>
            <dd>{entry.chassis_number || "—"}</dd>
          </div>
          <div>
            <dt>Added</dt>
            <dd>{new Date(entry.created_at).toLocaleString()}</dd>
          </div>
          <div className="vb-details-full">
            <dt>Remarks</dt>
            <dd>{entry.remarks || "—"}</dd>
          </div>
        </dl>

        {images.length === 0 ? (
          <p className="tp-muted">No images uploaded.</p>
        ) : (
          <>
            <div className="vb-stage">
              {images.length > 1 && (
                <button type="button" className="vb-nav vb-nav-prev" onClick={() => go(-1)} aria-label="Previous image">
                  ‹
                </button>
              )}
              {isSafeMediaUrl(current.image) ? (
                <a href={current.image} target="_blank" rel="noreferrer" title="Open full size">
                  <img key={current.id} src={current.image} alt={`Image ${index + 1} of ${images.length}`} />
                </a>
              ) : (
                <img key={current.id} src={current.image} alt={`Image ${index + 1} of ${images.length}`} />
              )}
              {images.length > 1 && (
                <button type="button" className="vb-nav vb-nav-next" onClick={() => go(1)} aria-label="Next image">
                  ›
                </button>
              )}
              <span className="vb-counter">
                {index + 1} / {images.length}
              </span>
            </div>

            {images.length > 1 && (
              <div className="vb-thumbs">
                {images.map((img, i) => (
                  <button
                    type="button"
                    key={img.id}
                    className={`vb-thumb${i === index ? " vb-thumb-active" : ""}`}
                    onClick={() => setIndex(i)}
                    aria-label={`Show image ${i + 1}`}
                  >
                    <img src={img.image} alt="" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

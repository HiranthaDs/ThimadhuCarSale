import { Fragment, useEffect, useRef, useState } from "react"
import html2pdf from "html2pdf.js"
import { SECTIONS, toPhotoList } from "./inspectionSchema"
import { replaceReportPdf, uploadReportPdf } from "../../../api/reports"
import reportLogo from "../../../assets/logo-light.png"

function FieldValue({ field, value }) {
  if (field.type === "signature") {
    if (!value) return <span className="ir-empty">—</span>
    return <img className="ir-signature" src={value} alt={field.label} />
  }
  if (field.type === "file") {
    if (!value) return <span className="ir-empty">—</span>
    if (typeof value === "string" && value.startsWith("data:application/pdf")) {
      return <a href={value} target="_blank" rel="noreferrer">Click to Download</a>
    }
    return <img className="ir-photo" src={value} alt={field.label} />
  }
  if (field.type === "multiphoto") {
    const photos = toPhotoList(value)
    if (photos.length === 0) return <span className="ir-empty">—</span>
    return (
      <div className="ir-photo-grid">
        {photos.map((src, i) => (
          <img key={i} className="ir-photo" src={src} alt={`${field.label} ${i + 1}`} />
        ))}
      </div>
    )
  }
  if (!value) return <span className="ir-empty">—</span>
  return <span>{value}</span>
}

export default function InspectionReport({ data, vehicleTitle, token, reportId, onClose, onPrint, onSaved }) {
  const pageRef = useRef(null)
  const autoSaveStarted = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState(null)
  const [uploadError, setUploadError] = useState(null)

  const today = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

  useEffect(() => {
    // .ir-overlay is a fixed, full-screen scroll container with its own
    // scrollbar; without this the page underneath keeps scrolling too,
    // producing a second, useless scrollbar next to it.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  async function handleSaveToCloud() {
    if (!pageRef.current) return
    setUploading(true)
    setUploadError(null)
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready
      }

      const logoImg = new Image()
      logoImg.src = reportLogo
      if (!logoImg.complete) {
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve
          logoImg.onerror = reject
        })
      }

      // Reserve room at the top/bottom of every page for the header and
      // footer band drawn below; the in-DOM .ir-header is only there for
      // on-screen viewing and browser Print, so it's hidden for this capture.
      const pdf = await html2pdf()
        .set({
          margin: [30, 10, 16, 10],
          filename: "inspection-report.pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            // html2canvas renders the page inside its own cloned iframe, which
            // doesn't inherit the live document's CSS custom properties
            // (var(--tp-navy) etc.) reliably and has to re-fetch the Inter
            // webfont on its own — so without forcing plain values here it
            // silently falls back to the browser's default serif font and
            // black headings, unlike the on-screen report.
            onclone: async (clonedDoc) => {
              const style = clonedDoc.createElement("style")
              style.textContent = `
                .ir-page, .ir-page * {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
                }
                .ir-header { display: none !important; }
                .ir-title { color: #141c2e !important; margin-top: 0 !important; }
                .ir-section-title { color: #1a56db !important; }
              `
              clonedDoc.head.appendChild(style)
              if (clonedDoc.fonts?.ready) {
                await clonedDoc.fonts.ready
              }
            },
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(pageRef.current)
        .toPdf()
        .get("pdf")

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const marginX = 10
      const logoHeight = 16
      const logoWidth = logoHeight * (logoImg.naturalWidth / logoImg.naturalHeight || 3)
      const totalPages = pdf.internal.getNumberOfPages()

      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)

        // Header: logo on the left, submission date + company on the right.
        pdf.addImage(logoImg, "PNG", marginX, 6, logoWidth, logoHeight)
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(9)
        pdf.setTextColor(107, 114, 128)
        pdf.text(`Date Submitted: ${today}`, pageWidth - marginX, 12, { align: "right" })
        pdf.text("Thimadu Automobile Private Limited", pageWidth - marginX, 16.5, { align: "right" })
        pdf.setDrawColor(230, 232, 240)
        pdf.setLineWidth(0.3)
        pdf.line(marginX, 24, pageWidth - marginX, 24)

        // Footer: brand name on the left, page count on the right.
        pdf.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13)
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(9.5)
        pdf.setTextColor(20, 28, 46)
        pdf.text("Thimadu Auto Trading", marginX, pageHeight - 7)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(107, 114, 128)
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 7, { align: "right" })
      }

      const blob = pdf.output("blob")

      const registrationNumber = data.registrationNumber || ""
      const fileName = `${registrationNumber || vehicleTitle || "inspection-report"}.pdf`
      const file = new File([blob], fileName, { type: "application/pdf" })
      const buyerName = [data.buyerFirstName, data.buyerLastName].filter(Boolean).join(" ")
      const meta = { registrationNumber, vehicleTitle, buyerName, formData: data }
      const result = reportId
        ? await replaceReportPdf(token, reportId, file, meta)
        : await uploadReportPdf(token, file, meta)
      setUploadedUrl(result.url)
      onSaved?.(result)
    } catch (err) {
      setUploadError(err.message || "Failed to upload PDF.")
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    if (autoSaveStarted.current) return
    autoSaveStarted.current = true
    handleSaveToCloud()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="ir-overlay">
      <div className="ir-toolbar no-print">
        <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={onClose}>
          Back to Editing
        </button>
        <button type="button" className="tp-form-btn tp-form-btn-primary" onClick={onPrint}>
          Print / Save as PDF
        </button>

        {uploading && <span className="ir-cloud-status">Saving to cloud…</span>}

        {!uploading && uploadedUrl && (
          <a className="ir-cloud-link" href={uploadedUrl} target="_blank" rel="noreferrer">
            ✓ Saved — View PDF
          </a>
        )}

        {!uploading && uploadError && (
          <>
            <span className="ir-cloud-error">{uploadError}</span>
            <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={handleSaveToCloud}>
              Retry Save
            </button>
          </>
        )}
      </div>

      <div className="ir-page" ref={pageRef}>
        <header className="ir-header">
          <img className="ir-logo" src={reportLogo} alt="Thimadu Auto Trading" />
          <div className="ir-header-meta">
            <div>Date Submitted: {today}</div>
            <div>Thimadu Automobile Private Limited</div>
          </div>
        </header>

        <h1 className="ir-title">
          Thimadu Vehicle Inspection Report{data.scanNumber === 2 ? " (Scan 2)" : ""}
          {vehicleTitle ? ` — ${vehicleTitle}` : ""}
        </h1>

        {SECTIONS.map((section) => (
          <section className="ir-section" key={section.title}>
            <h2 className="ir-section-title">{section.title}</h2>
            <table className="ir-table">
              <tbody>
                {section.fields
                  .filter((field) => field.key !== "legalText")
                  .map((field) => (
                  <Fragment key={field.key}>
                    <tr>
                      <th>{field.label}</th>
                      <td>
                        <FieldValue field={field} value={data[field.key]} />
                      </td>
                    </tr>
                    {field.type === "status" && data[field.key] === "Fail" && data[`${field.key}Reason`] && (
                      <tr>
                        <th>Reason</th>
                        <td>{data[`${field.key}Reason`]}</td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <section className="ir-section">
          <h2 className="ir-section-title">Legal</h2>
          {(data.legalText || "").split("\n").map((line, i) =>
            line ? (
              <p className="ir-legal" key={i}>
                {line}
              </p>
            ) : null
          )}
        </section>

        <footer className="ir-footer">
          <span>Buy used vehicles with confidence.</span>
          <span>Thimadu Vehicle Inspection Report{data.scanNumber === 2 ? " — Scan 2" : ""}</span>
        </footer>
      </div>
    </div>
  )
}

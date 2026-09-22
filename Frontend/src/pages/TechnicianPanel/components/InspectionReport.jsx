import { Fragment, useEffect, useRef, useState } from "react"
import html2pdf from "html2pdf.js"
import { SECTIONS } from "./inspectionSchema"
import { BrandMark } from "../Icons"
import { replaceReportPdf, uploadReportPdf } from "../../../api/reports"

function FieldValue({ field, value }) {
  if (field.type === "photo") {
    if (!value) return <span className="ir-empty">—</span>
    if (typeof value === "string" && value.startsWith("data:application/pdf")) {
      return <a href={value} target="_blank" rel="noreferrer">Click to Download</a>
    }
    return <img className="ir-photo" src={value} alt={field.label} />
  }
  if (field.type === "multiphoto") {
    if (!Array.isArray(value) || value.length === 0) return <span className="ir-empty">—</span>
    return (
      <div className="ir-photo-grid">
        {value.map((src, i) => (
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

  async function handleSaveToCloud() {
    if (!pageRef.current) return
    setUploading(true)
    setUploadError(null)
    try {
      const blob = await html2pdf()
        .set({
          margin: 10,
          filename: "inspection-report.pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(pageRef.current)
        .outputPdf("blob")

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
          <BrandMark iconSize={46} />
          <div className="ir-header-meta">
            <div>Date Submitted: {today}</div>
            <div>Thimadhu Automobile Private Limited</div>
          </div>
        </header>

        <h1 className="ir-title">
          Thimadhu Vehicle Inspection Report{vehicleTitle ? ` — ${vehicleTitle}` : ""}
        </h1>

        {SECTIONS.map((section) => (
          <section className="ir-section" key={section.title}>
            <h2 className="ir-section-title">{section.title}</h2>
            <table className="ir-table">
              <tbody>
                {section.fields.map((field) => (
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
          <p className="ir-legal">
            The above report is offered on behalf of Thimadhu Automobile Private Limited, following a detailed
            visual inspection of the structural integrity of the vehicle. The visual inspection is carried out
            without dissembling or dismantling any parts of the vehicle. Information such as verification of the
            registration, police, insurance, maintenance records of the respective vehicle or other private and
            public records, information and data have not been assessed by Thimadhu. The information and
            recommendations provided by us do not amount to approval or acceptance of the concerning matter. The
            validity of this certificate is only at the time, date, mileage and place of inspection as stated
            above.
          </p>
          <p className="ir-legal">I certify that all the categories in the report have been inspected.</p>
        </section>

        <footer className="ir-footer">
          <span>Buy used vehicles with confidence.</span>
          <span>Thimadhu Vehicle Inspection Report</span>
        </footer>
      </div>
    </div>
  )
}

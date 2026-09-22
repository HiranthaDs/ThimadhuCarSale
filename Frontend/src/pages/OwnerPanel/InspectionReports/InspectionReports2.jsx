import { useEffect, useState } from "react"
import { getReport, listReports } from "../../../api/reports"
import { ReportStatusBadge, ReportStatusFilter } from "../../TechnicianPanel/components/reportStatus"
import InspectionForm from "../../TechnicianPanel/components/InspectionForm"
import InspectionReport from "../../TechnicianPanel/components/InspectionReport"

// "Inspection Report 2" — search created inspection reports, pick one, and
// edit it. The original report row and PDF are never modified: every pick
// loads a copy of the original's form data into the same form used on the
// technician side, and saving always creates a brand-new report (reportId
// is left null so the PDF upload creates a new record instead of replacing
// the original — important once an owner has approved/checked a report).

// Copies get a distinguishing registration number: "CED-2345" -> "CED-2345-2".
// If the source is already a numbered copy ("...-2"), the next copy bumps
// the trailing number ("...-3") instead of stacking suffixes.
function nextCopyRegistrationNumber(registrationNumber) {
  if (!registrationNumber) return registrationNumber
  const match = registrationNumber.match(/^(.*)-(\d+)$/)
  if (match) {
    const [, base, num] = match
    return `${base}-${parseInt(num, 10) + 1}`
  }
  return `${registrationNumber}-2`
}

export default function InspectionReports2({ token }) {
  const [reports, setReports] = useState([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [pickedReport, setPickedReport] = useState(null)
  const [pickLoading, setPickLoading] = useState(false)
  const [pickError, setPickError] = useState("")
  const [formData, setFormData] = useState(null)
  const [reportData, setReportData] = useState(null)

  function loadReports() {
    setLoading(true)
    setError(null)
    listReports(token, query, statusFilter)
      .then(setReports)
      .catch((err) => setError(err.message || "Failed to load inspection reports."))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const handle = setTimeout(loadReports, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, query, statusFilter])

  async function handlePick(report) {
    setPickError("")
    setPickLoading(true)
    try {
      const detail = await getReport(token, report.id)
      const copiedFormData = { ...(detail.form_data || {}) }
      copiedFormData.registrationNumber = nextCopyRegistrationNumber(copiedFormData.registrationNumber)
      setPickedReport(report)
      setFormData(copiedFormData)
      setReportData(null)
    } catch (err) {
      setPickError(err.message || "Failed to load report for editing.")
    } finally {
      setPickLoading(false)
    }
  }

  function reset() {
    setPickedReport(null)
    setFormData(null)
    setReportData(null)
    setPickError("")
  }

  const vehicleTitle = reportData
    ? [reportData.year, reportData.make, reportData.model].filter(Boolean).join(" ")
    : ""

  if (pickedReport && formData && !reportData) {
    return <InspectionForm initialData={formData} onClose={reset} onSubmit={setReportData} />
  }

  if (pickedReport && reportData) {
    return (
      <InspectionReport
        data={reportData}
        vehicleTitle={vehicleTitle}
        token={token}
        reportId={null}
        onSaved={loadReports}
        onClose={reset}
        onPrint={() => window.print()}
      />
    )
  }

  return (
    <section className="tp-inspections">
      <div className="tp-inspections-header">
        <h2>Inspection Report 2 — Search &amp; Edit</h2>
        <input
          type="text"
          className="tp-inspections-search"
          placeholder="Search by registration number, vehicle, buyer..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <ReportStatusFilter value={statusFilter} onChange={setStatusFilter} />

      {pickError && <p className="tp-inspections-status tp-inspections-error">{pickError}</p>}
      {loading && <p className="tp-inspections-status">Loading…</p>}
      {!loading && error && <p className="tp-inspections-status tp-inspections-error">{error}</p>}
      {!loading && !error && reports.length === 0 && (
        <p className="tp-inspections-status">No inspection reports found.</p>
      )}

      {!loading && !error && reports.length > 0 && (
        <ul className="tp-reports-list">
          {reports.map((report) => (
            <li key={report.id} className="tp-reports-item">
              <div className="tp-reports-item-top">
                <div className="tp-reports-item-main">
                  <span className="tp-inspections-name">
                    {report.registration_number || report.vehicle_title || "Untitled Report"}
                  </span>
                  <span className="tp-inspections-meta">
                    {report.vehicle_title}
                    {report.buyer_name ? ` — ${report.buyer_name}` : ""}
                    {report.technician_name ? ` · Submitted by ${report.technician_name}` : ""}
                  </span>
                </div>

                <div className="tp-reports-item-side">
                  <ReportStatusBadge status={report.status} />
                  <span className="tp-inspections-date">
                    {new Date(report.created_at).toLocaleString("en-US", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <a className="tp-inspections-link" href={report.url} target="_blank" rel="noreferrer">
                    View PDF
                  </a>
                </div>
              </div>

              <div className="tp-reports-actions">
                <button
                  type="button"
                  className="tp-reports-btn"
                  disabled={pickLoading}
                  onClick={() => handlePick(report)}
                >
                  {pickLoading ? "Loading…" : "Select & Edit"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

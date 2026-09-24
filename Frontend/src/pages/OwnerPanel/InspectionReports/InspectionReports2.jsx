import { useEffect, useState } from "react"
import { createScan2Report, getReport, listReports } from "../../../api/reports"
import { ReportStatusBadge } from "../../TechnicianPanel/components/reportStatus"
import InspectionForm from "../../TechnicianPanel/components/InspectionForm"
import InspectionReport from "../../TechnicianPanel/components/InspectionReport"

// "Inspection Report 2" — Scan 2 of an already-approved inspection.
//
// Once the owner has approved (checked) a report such as "CBE-1245", it is
// locked, and it still has to go to the client unchanged. When a second scan
// is needed, "Create a Copy" asks the backend to duplicate it into a new
// report named "CBE-1245-Scan2". Only that copy is edited; it goes back to
// the owner for approval and is locked in turn once approved.

const SCAN2_SUFFIX = "-scan2"

function isScan2(report) {
  return (report.registration_number || "").toLowerCase().endsWith(SCAN2_SUFFIX)
}

function scan2Key(registrationNumber) {
  return `${(registrationNumber || "").trim().toLowerCase()}${SCAN2_SUFFIX}`
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function InspectionReports2({ token }) {
  const [reports, setReports] = useState([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState("")
  const [busyId, setBusyId] = useState(null)

  // The Scan 2 report currently being edited.
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(null)
  const [reportData, setReportData] = useState(null)

  function loadReports() {
    if (!query.trim()) {
      setReports([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    listReports(token, query.trim())
      .then(setReports)
      .catch((err) => setError(err.message || "Failed to load inspection reports."))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const handle = setTimeout(loadReports, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, query])

  async function openScan2(scan2Id) {
    const detail = await getReport(token, scan2Id)
    setEditingId(scan2Id)
    setFormData(detail.form_data || {})
    setReportData(null)
  }

  async function handleCreateCopy(original) {
    setActionError("")
    setBusyId(original.id)
    try {
      const copy = await createScan2Report(token, original.id)
      loadReports()
      await openScan2(copy.id)
    } catch (err) {
      setActionError(err.message || "Failed to create Scan 2 copy.")
    } finally {
      setBusyId(null)
    }
  }

  async function handleEditScan2(scan2) {
    setActionError("")
    setBusyId(scan2.id)
    try {
      await openScan2(scan2.id)
    } catch (err) {
      setActionError(err.message || "Failed to load Scan 2 report.")
    } finally {
      setBusyId(null)
    }
  }

  function closeEditor() {
    setEditingId(null)
    setFormData(null)
    setReportData(null)
  }

  if (editingId && formData && !reportData) {
    return <InspectionForm initialData={formData} onClose={closeEditor} onSubmit={setReportData} />
  }

  if (editingId && reportData) {
    const vehicleTitle = [reportData.year, reportData.make, reportData.model].filter(Boolean).join(" ")
    return (
      <InspectionReport
        data={reportData}
        vehicleTitle={vehicleTitle}
        token={token}
        reportId={editingId}
        onSaved={loadReports}
        onClose={() => {
          // Same as Scan 1: once generated, go back to the Scan 2 list, not the form.
          closeEditor()
          loadReports()
        }}
        onPrint={() => window.print()}
      />
    )
  }

  const scan2ByReg = new Map(reports.filter(isScan2).map((r) => [r.registration_number.toLowerCase(), r]))
  const originals = reports.filter((r) => !isScan2(r) && r.registration_number)

  return (
    <section className="tp-inspections">
      <div className="tp-inspections-header">
        <h2>Inspection Report 2 - Scan 2</h2>
        <input
          type="text"
          className="tp-inspections-search"
          placeholder="Search by registration number, e.g. CBE-1245"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {actionError && <p className="tp-inspections-status tp-inspections-error">{actionError}</p>}
      {!query.trim() && (
        <p className="tp-inspections-status">
          Search for a vehicle's registration number to create or edit its Scan 2 report.
        </p>
      )}
      {loading && <p className="tp-inspections-status">Loading…</p>}
      {!loading && error && <p className="tp-inspections-status tp-inspections-error">{error}</p>}
      {!loading && !error && query.trim() && originals.length === 0 && (
        <p className="tp-inspections-status">No inspection reports found.</p>
      )}

      {!loading && !error && originals.length > 0 && (
        <ul className="tp-reports-list">
          {originals.map((report) => {
            const scan2 = scan2ByReg.get(scan2Key(report.registration_number))
            const approved = report.status === "checked"
            return (
              <li key={report.id} className="tp-reports-item">
                <div className="tp-reports-item-top">
                  <div className="tp-reports-item-main">
                    <span className="tp-inspections-name">{report.registration_number}</span>
                    <span className="tp-inspections-meta">
                      {report.vehicle_title}
                      {report.buyer_name ? ` — ${report.buyer_name}` : ""}
                      {report.technician_name ? ` · Submitted by ${report.technician_name}` : ""}
                    </span>
                  </div>

                  <div className="tp-reports-item-side">
                    <ReportStatusBadge status={report.status} />
                    <span className="tp-inspections-date">{formatDate(report.created_at)}</span>
                    <a className="tp-inspections-link" href={report.url} target="_blank" rel="noreferrer">
                      View Scan 1 PDF
                    </a>
                  </div>
                </div>

                {scan2 ? (
                  <div className="tp-reports-item-top">
                    <div className="tp-reports-item-main">
                      <span className="tp-inspections-name">{scan2.registration_number}</span>
                      <span className="tp-inspections-meta">
                        {scan2.technician_name ? `Scan 2 by ${scan2.technician_name}` : "Scan 2"}
                      </span>
                    </div>
                    <div className="tp-reports-item-side">
                      {scan2.status !== "checked" && (
                        <button
                          type="button"
                          className="tp-reports-btn"
                          disabled={busyId === scan2.id}
                          onClick={() => handleEditScan2(scan2)}
                        >
                          {busyId === scan2.id ? "Loading…" : "Edit Scan 2"}
                        </button>
                      )}
                      <ReportStatusBadge status={scan2.status} />
                      <span className="tp-inspections-date">{formatDate(scan2.created_at)}</span>
                      <a className="tp-inspections-link" href={scan2.url} target="_blank" rel="noreferrer">
                        View Scan 2 PDF
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="tp-reports-actions">
                    <button
                      type="button"
                      className="tp-reports-btn"
                      disabled={!approved || busyId === report.id}
                      title={approved ? "" : "The owner must approve this report before a Scan 2 copy can be made."}
                      onClick={() => handleCreateCopy(report)}
                    >
                      {busyId === report.id ? "Creating…" : "Create a Copy"}
                    </button>
                    {!approved && (
                      <span className="tp-inspections-meta">Waiting for owner approval before a Scan 2 can be made.</span>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

import { useEffect, useRef, useState } from "react"
import { createScan2Report, getReport, listReportPairs, reportViewUrl } from "../../../api/reports"
import { ApproveReportButton, ReportStatusBadge } from "../../TechnicianPanel/components/reportStatus"
import ApprovedBy from "../../../components/ApprovedBy"
import InspectionForm from "../../TechnicianPanel/components/InspectionForm"
import InspectionReport from "../../TechnicianPanel/components/InspectionReport"

// "Inspection Report 2" — Scan 2 of an already-approved inspection.
//
// Once the owner has approved (checked) a report such as "CBE-1245", it is
// locked, and it still has to go to the client unchanged. When a second scan
// is needed, "Create a Copy" asks the backend to duplicate it into a new
// report named "CBE-1245-Inspection Report 2". Only that copy is edited; it goes back to
// the owner for approval and is locked in turn once approved.

const VIEWS = [
  { value: "all", label: "All" },
  { value: "report1", label: "Inspection Report" },
  { value: "report2", label: "Inspection Report 2" },
]

function formatDate(value) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function InspectionReports2({ token, canCreate = true }) {
  const requestNumber = useRef(0)
  const [page, setPage] = useState(0)
  const [pairs, setPairs] = useState([])
  const [query, setQuery] = useState("")
  // all: each report with its copy; report1: original reports only; report2: copies only.
  const [view, setView] = useState("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState("")
  const [busyId, setBusyId] = useState(null)

  // The Inspection Report 2 currently being edited.
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(null)
  const [reportData, setReportData] = useState(null)

  function loadReports() {
    setLoading(true)
    setError(null)
    const requestId = ++requestNumber.current
    listReportPairs(token, query.trim(), page, { copiesOnly: view === "report2" })
      .then(data => { if (requestId === requestNumber.current) setPairs(data) })
      .catch((err) => { if (requestId === requestNumber.current) setError(err.message || "Failed to load inspection reports.") })
      .finally(() => { if (requestId === requestNumber.current) setLoading(false) })
  }

  useEffect(() => {
    const handle = setTimeout(loadReports, 300)
    return () => { clearTimeout(handle); requestNumber.current += 1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, query, page, view])

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
      setActionError(err.message || "Failed to create Inspection Report 2 copy.")
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
      setActionError(err.message || "Failed to load Inspection Report 2.")
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
          // Same as Scan 1: once generated, go back to the Inspection Report 2 list, not the form.
          closeEditor()
          loadReports()
        }}
        onPrint={() => window.print()}
      />
    )
  }

  function originalRow(report) {
    return (
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
          <ReportStatusBadge status={report.status} waitingFor={report.waiting_for} />
          <span className="tp-inspections-date-link">
            <span className="tp-inspections-date">{formatDate(report.created_at)}</span>
            <a className="tp-inspections-link" href={reportViewUrl(report.id)} target="_blank" rel="noreferrer">
              View Inspection Report 1 PDF
            </a>
          </span>
        </div>
      </div>
    )
  }

  function copyRow(scan2) {
    return (
      <div className="tp-reports-item-top">
        <div className="tp-reports-item-main">
          <span className="tp-inspections-name">{scan2.registration_number}</span>
          <span className="tp-inspections-meta">
            {scan2.technician_name ? `Inspection Report 2 by ${scan2.technician_name}` : "Inspection Report 2"}
          </span>
          <ApprovedBy approvals={scan2.role_approvals} />
        </div>
        <div className="tp-reports-item-side">
          {canCreate && scan2.editable && (
            <button
              type="button"
              className="tp-reports-btn"
              disabled={busyId === scan2.id}
              onClick={() => handleEditScan2(scan2)}
            >
              {busyId === scan2.id ? "Loading…" : "Edit Inspection Report 2"}
            </button>
          )}
          <ApproveReportButton
            token={token}
            report={scan2}
            onApproved={() => loadReports()}
            onError={setActionError}
          />
          <ReportStatusBadge status={scan2.status} waitingFor={scan2.waiting_for} />
          <span className="tp-inspections-date-link">
            <span className="tp-inspections-date">{formatDate(scan2.created_at)}</span>
            <a className="tp-inspections-link" href={reportViewUrl(scan2.id)} target="_blank" rel="noreferrer">
              View Inspection Report 2 PDF
            </a>
          </span>
        </div>
      </div>
    )
  }

  function createCopyActions(report) {
    if (!canCreate) return null
    const approved = report.status === "checked"
    return (
      <div className="tp-reports-actions">
        <button
          type="button"
          className="tp-reports-btn"
          disabled={!approved || busyId === report.id}
          title={approved ? "" : "The owner must approve this report before an Inspection Report 2 copy can be made."}
          onClick={() => handleCreateCopy(report)}
        >
          {busyId === report.id ? "Creating…" : "Create a Copy"}
        </button>
        {!approved && (
          <span className="tp-inspections-meta">Waiting for owner approval before an Inspection Report 2 can be made.</span>
        )}
      </div>
    )
  }

  return (
    <section className="tp-inspections">
      <div className="tp-inspections-header">
        <h2>Inspection Report 2</h2>
        <input
          type="text"
          className="tp-inspections-search"
          placeholder="Search by registration number, vehicle, buyer..."
          value={query}
          onChange={(e) => { setPage(0); setQuery(e.target.value) }}
        />
      </div>

      <div className="tp-status-filter">
        {VIEWS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`tp-status-filter-btn${view === opt.value ? " tp-status-filter-btn-active" : ""}`}
            onClick={() => { setPage(0); setView(opt.value) }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {actionError && <p className="tp-inspections-status tp-inspections-error">{actionError}</p>}
      {loading && <p className="tp-inspections-status">Loading…</p>}
      {!loading && error && <p className="tp-inspections-status tp-inspections-error">{error}</p>}
      {!loading && !error && pairs.length === 0 && (
        <p className="tp-inspections-status">
          {view === "report2" ? "No Inspection Report 2 copies found." : "No inspection reports found."}
        </p>
      )}

      {!loading && !error && pairs.length > 0 && (
        <ul className="tp-reports-list">
          {pairs.map(({ original, copy }) => (
            <li key={original.id} className="tp-reports-item">
              {view === "report2" ? (
                copy && copyRow(copy)
              ) : view === "report1" ? (
                <>
                  {originalRow(original)}
                  {copy ? (
                    <span className="tp-inspections-meta">Inspection Report 2 already created.</span>
                  ) : createCopyActions(original)}
                </>
              ) : (
                <>
                  {originalRow(original)}
                  {copy ? copyRow(copy) : createCopyActions(original)}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

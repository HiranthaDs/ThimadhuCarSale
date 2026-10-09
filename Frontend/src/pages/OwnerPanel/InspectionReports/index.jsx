import { useEffect, useRef, useState } from "react"
import { deleteReport, downloadReportPdf, getReport, listReports, reportViewUrl, updateReport, updateReportStatus } from "../../../api/reports"
import { ApproveReportButton, ReportStatusBadge, ReportStatusFilter } from "../../TechnicianPanel/components/reportStatus"
import { confirmDialog } from "../../../components/ConfirmDialog"
import ApprovedBy from "../../../components/ApprovedBy"
import { DownloadIcon } from "../../TechnicianPanel/Icons"
import InspectionForm from "../../TechnicianPanel/components/InspectionForm"
import InspectionReport from "../../TechnicianPanel/components/InspectionReport"

// canReview: may edit, mark checked / needs modifications, and delete any report.
export default function InspectionReports({ token, canReview = true }) {
  const requestNumber = useRef(0)
  const [page, setPage] = useState(0)
  const [reports, setReports] = useState([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ registrationNumber: "", vehicleTitle: "", buyerName: "" })
  const [savingEdit, setSavingEdit] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [busyAction, setBusyAction] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  // Full edit: the saved report reopened in the inspection form, then rebuilt
  // as a new PDF that replaces the old one.
  const [fullEditId, setFullEditId] = useState(null)
  const [formData, setFormData] = useState(null)
  const [reportData, setReportData] = useState(null)

  function loadReports() {
    setLoading(true)
    setError(null)
    const requestId = ++requestNumber.current
    listReports(token, query, statusFilter, page)
      .then(data => { if (requestId === requestNumber.current) setReports(data) })
      .catch((err) => { if (requestId === requestNumber.current) setError(err.message || "Failed to load inspection reports.") })
      .finally(() => { if (requestId === requestNumber.current) setLoading(false) })
  }

  useEffect(() => {
    const handle = setTimeout(loadReports, 300)
    return () => { clearTimeout(handle); requestNumber.current += 1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, query, statusFilter, page])

  async function handleStatusChange(report, status) {
    setActionError("")
    setBusyId(report.id)
    setBusyAction(status)
    try {
      const updated = await updateReportStatus(token, report.id, status)
      setReports((prev) => prev.map((r) => (r.id === report.id ? updated : r)))
    } catch (err) {
      setActionError(err.message || "Failed to update status.")
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(report) {
    const confirmed = await confirmDialog({
      title: "Delete inspection report?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    })
    if (!confirmed) return
    setActionError("")
    setBusyId(report.id)
    setBusyAction("delete")
    try {
      await deleteReport(token, report.id)
      setReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch (err) {
      setActionError(err.message || "Failed to delete report.")
    } finally {
      setBusyId(null)
    }
  }

  async function startEdit(report) {
    setActionError("")
    setBusyId(report.id)
    setBusyAction("edit")
    try {
      const detail = await getReport(token, report.id)
      if (detail.form_data && Object.keys(detail.form_data).length > 0) {
        setEditingId(null)
        setFullEditId(report.id)
        setFormData(detail.form_data)
        setReportData(null)
        return
      }
    } catch (err) {
      setActionError(err.message || "Failed to load report for editing.")
      return
    } finally {
      setBusyId(null)
    }
    // Reports saved before the form data was stored can't be reopened in the
    // form (it would start empty and overwrite them), so only their details
    // can be changed.
    setEditingId(report.id)
    setEditForm({
      registrationNumber: report.registration_number || "",
      vehicleTitle: report.vehicle_title || "",
      buyerName: report.buyer_name || "",
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(report) {
    setSavingEdit(true)
    setActionError("")
    try {
      const updated = await updateReport(token, report.id, editForm)
      setReports((prev) => prev.map((r) => (r.id === report.id ? updated : r)))
      setEditingId(null)
    } catch (err) {
      setActionError(err.message || "Failed to update report.")
    } finally {
      setSavingEdit(false)
    }
  }

  function closeFullEdit() {
    setFullEditId(null)
    setFormData(null)
    setReportData(null)
  }

  async function handleDownload(report) {
    setActionError("")
    setDownloadingId(report.id)
    try {
      const blob = await downloadReportPdf(token, report.id)
      const fileName = `${report.registration_number || report.vehicle_title || "inspection-report"}.pdf`
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      setActionError(err.message || "Failed to download report.")
    } finally {
      setDownloadingId(null)
    }
  }

  if (fullEditId && formData && !reportData) {
    return <InspectionForm initialData={formData} onClose={closeFullEdit} onSubmit={setReportData} />
  }

  if (fullEditId && reportData) {
    const vehicleTitle = [reportData.year, reportData.make, reportData.model].filter(Boolean).join(" ")
    return (
      <InspectionReport
        data={reportData}
        vehicleTitle={vehicleTitle}
        token={token}
        reportId={fullEditId}
        onSaved={loadReports}
        onClose={() => {
          closeFullEdit()
          loadReports()
        }}
        onPrint={() => window.print()}
      />
    )
  }

  return (
    <section className="tp-inspections">
      <div className="tp-inspections-header">
        <h2>Inspection Reports</h2>
        <input
          type="text"
          className="tp-inspections-search"
          placeholder="Search by registration number, vehicle, buyer..."
          value={query}
          onChange={(e) => { setPage(0); setQuery(e.target.value) }}
        />
      </div>

      <ReportStatusFilter value={statusFilter} onChange={(value) => { setPage(0); setStatusFilter(value) }} />

      {actionError && <p className="tp-inspections-status tp-inspections-error">{actionError}</p>}
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
                  <ApprovedBy approvals={report.role_approvals} />
                </div>

                <div className="tp-reports-item-side">
                  <ApproveReportButton
                    token={token}
                    report={report}
                    onApproved={(updated) => setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
                    onError={setActionError}
                  />
                  <ReportStatusBadge status={report.status} waitingFor={report.waiting_for} />
                  <span className="tp-inspections-date-link">
                    <span className="tp-inspections-date">
                      {new Date(report.created_at).toLocaleString("en-US", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <a className="tp-inspections-link" href={reportViewUrl(report.id)} target="_blank" rel="noreferrer">
                      View PDF
                    </a>
                    {report.status === "checked" && (
                      <button
                        type="button"
                        className="tp-inspections-download"
                        disabled={downloadingId === report.id}
                        onClick={() => handleDownload(report)}
                      >
                        <DownloadIcon />
                        {downloadingId === report.id ? "Downloading…" : "Download"}
                      </button>
                    )}
                  </span>
                </div>
              </div>

              {canReview && (
              <div className="tp-reports-actions">
                <button
                  type="button"
                  className="tp-reports-btn"
                  disabled={busyId === report.id || (report.status === "checked" && editingId !== report.id)}
                  title={report.status === "checked" ? "Approved reports are locked. Use Inspection Report 2 to make changes." : undefined}
                  onClick={() => (editingId === report.id ? cancelEdit() : startEdit(report))}
                >
                  {busyId === report.id && busyAction === "edit" ? (
                    <>
                      <span className="tp-btn-spinner" aria-hidden="true" />
                      Opening…
                    </>
                  ) : editingId === report.id ? (
                    "Cancel Edit"
                  ) : (
                    "Edit"
                  )}
                </button>
                <button
                  type="button"
                  className="tp-reports-btn tp-reports-btn-checked"
                  disabled={busyId === report.id || report.status === "checked" || report.waiting_for?.length > 0}
                  title={report.waiting_for?.length ? "Every role with the Approve tick has to approve this report first." : undefined}
                  onClick={() => handleStatusChange(report, "checked")}
                >
                  {busyId === report.id && busyAction === "checked" ? (
                    <>
                      <span className="tp-btn-spinner" aria-hidden="true" />
                      Saving…
                    </>
                  ) : (
                    "Mark Checked"
                  )}
                </button>
                <button
                  type="button"
                  className="tp-reports-btn tp-reports-btn-modifications"
                  disabled={busyId === report.id || report.status === "needs_modifications"}
                  onClick={() => handleStatusChange(report, "needs_modifications")}
                >
                  {busyId === report.id && busyAction === "needs_modifications" ? (
                    <>
                      <span className="tp-btn-spinner" aria-hidden="true" />
                      Saving…
                    </>
                  ) : (
                    "Needs Modifications"
                  )}
                </button>
                <button
                  type="button"
                  className="tp-reports-btn tp-reports-btn-danger"
                  disabled={busyId === report.id}
                  onClick={() => handleDelete(report)}
                >
                  {busyId === report.id && busyAction === "delete" ? (
                    <>
                      <span className="tp-btn-spinner" aria-hidden="true" />
                      Deleting…
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
              )}

              {editingId === report.id && (
                <div className="tp-reports-edit-form">
                  <label>
                    <span>Registration Number</span>
                    <input
                      type="text"
                      value={editForm.registrationNumber}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, registrationNumber: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Vehicle Title</span>
                    <input
                      type="text"
                      value={editForm.vehicleTitle}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, vehicleTitle: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Buyer Name</span>
                    <input
                      type="text"
                      value={editForm.buyerName}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, buyerName: e.target.value }))}
                    />
                  </label>
                  <div className="tp-reports-edit-actions">
                    <button
                      type="button"
                      className="tp-form-btn tp-form-btn-primary"
                      disabled={savingEdit}
                      onClick={() => saveEdit(report)}
                    >
                      {savingEdit ? "Saving…" : "Save Changes"}
                    </button>
                    <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

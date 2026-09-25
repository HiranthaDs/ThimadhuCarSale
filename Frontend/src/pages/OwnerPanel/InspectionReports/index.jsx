import { useEffect, useState } from "react"
import { deleteReport, downloadReportPdf, listReports, updateReport, updateReportStatus } from "../../../api/reports"
import { ReportStatusBadge, ReportStatusFilter } from "../../TechnicianPanel/components/reportStatus"
import { confirmDialog } from "../../../components/ConfirmDialog"
import { DownloadIcon } from "../../TechnicianPanel/Icons"

export default function InspectionReports({ token }) {
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

  function startEdit(report) {
    setActionError("")
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

  return (
    <section className="tp-inspections">
      <div className="tp-inspections-header">
        <h2>Inspection Reports</h2>
        <input
          type="text"
          className="tp-inspections-search"
          placeholder="Search by registration number, vehicle, buyer..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <ReportStatusFilter value={statusFilter} onChange={setStatusFilter} />

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
                </div>

                <div className="tp-reports-item-side">
                  <ReportStatusBadge status={report.status} />
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
                    <a className="tp-inspections-link" href={report.url} target="_blank" rel="noreferrer">
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

              <div className="tp-reports-actions">
                <button
                  type="button"
                  className="tp-reports-btn"
                  onClick={() => (editingId === report.id ? cancelEdit() : startEdit(report))}
                >
                  {editingId === report.id ? "Cancel Edit" : "Edit"}
                </button>
                <button
                  type="button"
                  className="tp-reports-btn tp-reports-btn-checked"
                  disabled={busyId === report.id || report.status === "checked"}
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

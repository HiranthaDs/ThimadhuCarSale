import { useEffect, useRef, useState } from "react"
import { deleteReport, downloadReportPdf, listReports, reportViewUrl } from "../../../api/reports"
import { ReportStatusBadge, ReportStatusFilter } from "./reportStatus"
import { confirmDialog } from "../../../components/ConfirmDialog"
import { DownloadIcon } from "../Icons"

export default function Inspections({ token, onEdit }) {
  const requestNumber = useRef(0)
  const [page, setPage] = useState(0)
  const [reports, setReports] = useState([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState("")
  const [busyId, setBusyId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true)
      setError(null)
      const requestId = ++requestNumber.current
      listReports(token, query, statusFilter, page)
        .then(data => { if (requestId === requestNumber.current) setReports(data) })
        .catch((err) => { if (requestId === requestNumber.current) setError(err.message || "Failed to load inspection reports.") })
        .finally(() => { if (requestId === requestNumber.current) setLoading(false) })
    }, 300)
    return () => { clearTimeout(handle); requestNumber.current += 1 }
  }, [token, query, statusFilter, page])

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
    try {
      await deleteReport(token, report.id)
      setReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch (err) {
      setActionError(err.message || "Failed to delete report.")
    } finally {
      setBusyId(null)
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
                <div className="tp-inspections-item-main">
                  <span className="tp-inspections-name">
                    {report.registration_number || report.vehicle_title || "Untitled Report"}
                  </span>
                  <span className="tp-inspections-meta">
                    {report.vehicle_title}
                    {report.buyer_name ? ` — ${report.buyer_name}` : ""}
                  </span>
                </div>
                <div className="tp-reports-item-side">
                  {report.status !== "checked" && (
                    <button
                      type="button"
                      className="tp-reports-btn"
                      onClick={() => onEdit?.(report)}
                    >
                      Edit
                    </button>
                  )}
                  {report.status === "pending" && (
                    <button
                      type="button"
                      className="tp-reports-btn tp-reports-btn-danger"
                      disabled={busyId === report.id}
                      onClick={() => handleDelete(report)}
                    >
                      {busyId === report.id ? "Deleting…" : "Delete"}
                    </button>
                  )}
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
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

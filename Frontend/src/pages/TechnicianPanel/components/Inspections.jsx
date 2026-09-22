import { useEffect, useState } from "react"
import { listReports } from "../../../api/reports"
import { ReportStatusBadge, ReportStatusFilter } from "./reportStatus"

export default function Inspections({ token, onEdit }) {
  const [reports, setReports] = useState([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true)
      setError(null)
      listReports(token, query, statusFilter)
        .then(setReports)
        .catch((err) => setError(err.message || "Failed to load inspection reports."))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [token, query, statusFilter])

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

      {loading && <p className="tp-inspections-status">Loading…</p>}
      {!loading && error && <p className="tp-inspections-status tp-inspections-error">{error}</p>}
      {!loading && !error && reports.length === 0 && (
        <p className="tp-inspections-status">No inspection reports found.</p>
      )}

      {!loading && !error && reports.length > 0 && (
        <ul className="tp-inspections-list">
          {reports.map((report) => (
            <li key={report.id} className="tp-inspections-item">
              <div className="tp-inspections-item-main">
                <span className="tp-inspections-name">
                  {report.registration_number || report.vehicle_title || "Untitled Report"}
                </span>
                <span className="tp-inspections-meta">
                  {report.vehicle_title}
                  {report.buyer_name ? ` — ${report.buyer_name}` : ""}
                </span>
              </div>
              <div className="tp-inspections-item-side">
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
                {report.status !== "checked" && (
                  <button
                    type="button"
                    className="tp-reports-btn"
                    onClick={() => onEdit?.(report)}
                  >
                    Edit
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

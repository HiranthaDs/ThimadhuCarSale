import { useState } from "react"
import Sidebar from "./components/Sidebar"
import Hero from "./components/Hero"
import InspectionForm from "./components/InspectionForm"
import InspectionReport from "./components/InspectionReport"
import Inspections from "./components/Inspections"
import Settings from "./components/Settings"
import InspectionReports2 from "../OwnerPanel/InspectionReports/InspectionReports2"
import VehicleBlacklist from "../OwnerPanel/VehicleBlacklist"
import { getReport } from "../../api/reports"
import "./TechnicianPanel.css"

export default function TechnicianPanel({ username, token, onLogout }) {
  const [view, setView] = useState("dashboard")
  const [showForm, setShowForm] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [editingReportId, setEditingReportId] = useState(null)
  const [editError, setEditError] = useState("")

  function handleSubmit(data) {
    setReportData(data)
    setShowForm(false)
  }

  function closeForm() {
    setShowForm(false)
    setEditingReportId(null)
    setReportData(null)
  }

  async function handleEditReport(report) {
    setEditError("")
    try {
      const detail = await getReport(token, report.id)
      setReportData(detail.form_data || {})
      setEditingReportId(report.id)
      setView("dashboard")
      setShowForm(true)
    } catch (err) {
      setEditError(err.message || "Failed to load report for editing.")
    }
  }

  const vehicleTitle = reportData
    ? [reportData.year, reportData.make, reportData.model].filter(Boolean).join(" ")
    : ""

  return (
    <div className="tp-app">
      <Sidebar role="technician" username={username} onLogout={onLogout} activeView={view} onNavigate={setView} />

      <main className="tp-main">
        <Hero name={username || "Technician"} desc="Here's what's happening with your inspections today." />

        {view === "dashboard" && (
          <>
            <button
              type="button"
              className="tp-inspection-btn"
              onClick={() => {
                if (showForm) {
                  closeForm()
                } else {
                  setEditingReportId(null)
                  setReportData(null)
                  setShowForm(true)
                }
              }}
            >
              {showForm ? "Close Inspection Report" : "+ Inspection Report"}
            </button>

            {editError && <div className="tp-form-error">{editError}</div>}

            {showForm && (
              <InspectionForm
                onClose={closeForm}
                onSubmit={handleSubmit}
                initialData={editingReportId ? reportData : null}
              />
            )}
          </>
        )}

        {view === "inspections" && <Inspections token={token} onEdit={handleEditReport} />}

        {view === "reports2" && <InspectionReports2 token={token} />}

        {view === "blacklist" && <VehicleBlacklist token={token} />}

        {view === "settings" && <Settings token={token} />}
      </main>

      {reportData && !showForm && (
        <InspectionReport
          data={reportData}
          vehicleTitle={vehicleTitle}
          token={token}
          reportId={editingReportId}
          onClose={() => {
            setReportData(null)
            setEditingReportId(null)
          }}
          onPrint={() => window.print()}
        />
      )}
    </div>
  )
}

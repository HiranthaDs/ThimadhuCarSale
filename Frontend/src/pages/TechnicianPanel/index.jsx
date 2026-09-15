import { useState } from "react"
import Sidebar from "./components/Sidebar"
import Hero from "./components/Hero"
import InspectionForm from "./components/InspectionForm"
import InspectionReport from "./components/InspectionReport"
import "./TechnicianPanel.css"

export default function TechnicianPanel({ username, onLogout }) {
  const [showForm, setShowForm] = useState(false)
  const [reportData, setReportData] = useState(null)

  function handleSubmit(data) {
    setReportData(data)
    setShowForm(false)
  }

  const vehicleTitle = reportData
    ? [reportData.year, reportData.make, reportData.model].filter(Boolean).join(" ")
    : ""

  return (
    <div className="tp-app">
      <Sidebar role="technician" username={username} onLogout={onLogout} />

      <main className="tp-main">
        <Hero name={username || "Technician"} desc="Here's what's happening with your inspections today." />

        <button type="button" className="tp-inspection-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close Inspection Report" : "+ Inspection Report"}
        </button>

        {showForm && <InspectionForm onClose={() => setShowForm(false)} onSubmit={handleSubmit} />}
      </main>

      {reportData && (
        <InspectionReport
          data={reportData}
          vehicleTitle={vehicleTitle}
          onClose={() => setReportData(null)}
          onPrint={() => window.print()}
        />
      )}
    </div>
  )
}

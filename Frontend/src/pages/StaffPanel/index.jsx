import { useState } from "react"
import Sidebar, { navItemsFor } from "../TechnicianPanel/components/Sidebar"
import Hero from "../TechnicianPanel/components/Hero"
import InspectionForm from "../TechnicianPanel/components/InspectionForm"
import InspectionReport from "../TechnicianPanel/components/InspectionReport"
import Inspections from "../TechnicianPanel/components/Inspections"
import Settings from "../TechnicianPanel/components/Settings"
import ActivityLog from "../OwnerPanel/ActivityLog"
import ClientProfiles from "../OwnerPanel/ClientProfiles"
import InspectionReports2 from "../OwnerPanel/InspectionReports/InspectionReports2"
import VehicleBlacklist from "../OwnerPanel/VehicleBlacklist"
import { getReport } from "../../api/reports"
import { confirmDiscard } from "../../components/unsavedChanges"
import "../TechnicianPanel/TechnicianPanel.css"
import "../OwnerPanel/ClientProfiles/ClientProfiles.css"

const VIEW_TAGS = {
  dashboard: "Vehicle Inspection Report",
  inspections: "Inspections",
  reports2: "Inspection Reports",
  clients: "Client Profiles",
  approvals: "Profile Approvals",
  blacklist: "Vehicle Blacklist",
  activity: "Activity Log",
  settings: "Settings",
}

// The panel for admins, accountants and technicians. Which sections and
// actions appear comes from the permissions the owner set in Customize.
export default function StaffPanel({ role, permissions = [], username, token, onLogout }) {
  const can = (key) => permissions.includes(key)
  const allowedViews = navItemsFor(role, permissions).map((item) => item.view)
  const [selectedView, setSelectedView] = useState(null)
  // Fall back to the first allowed section if the owner has since removed this one.
  const view = allowedViews.includes(selectedView) ? selectedView : allowedViews[0]

  const [mobileOpen, setMobileOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [editingReportId, setEditingReportId] = useState(null)
  const [editError, setEditError] = useState("")

  function handleSubmit(data) {
    setReportData(data)
    setShowForm(false)
  }

  async function navigate(next) {
    if (await confirmDiscard()) setSelectedView(next)
  }

  async function closeForm() {
    if (!(await confirmDiscard())) return
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
      setSelectedView("dashboard")
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
      <Sidebar
        role={role}
        permissions={permissions}
        username={username}
        onLogout={onLogout}
        activeView={view}
        onNavigate={navigate}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      <main className="tp-main">
        <Hero
          name={username || "User"}
          desc={role === "technician" ? "Here's what's happening with your inspections today." : "Here's what needs your attention today."}
          token={token}
          tag={VIEW_TAGS[view]}
          onMenuClick={() => setMobileOpen(true)}
        />

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

        {view === "inspections" && (
          <Inspections token={token} canEdit={can("reports.create")} onEdit={handleEditReport} />
        )}

        {view === "reports2" && <InspectionReports2 token={token} canCreate={can("reports2.create")} />}

        {view === "clients" && <ClientProfiles token={token} role={role} can={can} />}

        {view === "approvals" && (
          <ClientProfiles
            token={token}
            role={role}
            can={can}
            awaitingMe
            title="Profile Approvals"
            emptyLabel="No client profiles are waiting for your approval."
          />
        )}

        {view === "blacklist" && <VehicleBlacklist token={token} can={can} />}

        {view === "activity" && <ActivityLog token={token} />}

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

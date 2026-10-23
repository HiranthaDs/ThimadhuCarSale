import { useEffect, useState } from "react"
import Sidebar, { navItemsFor } from "../TechnicianPanel/components/Sidebar"
import Hero from "../TechnicianPanel/components/Hero"
import InspectionForm from "../TechnicianPanel/components/InspectionForm"
import { ReportFormEditor } from "../OwnerPanel/Customize"
import InspectionReport from "../TechnicianPanel/components/InspectionReport"
import Inspections from "../TechnicianPanel/components/Inspections"
import Settings from "../TechnicianPanel/components/Settings"
import ActivityLog from "../OwnerPanel/ActivityLog"
import ClientProfiles from "../OwnerPanel/ClientProfiles"
import ClientFormEditor from "../OwnerPanel/ClientProfiles/ClientFormEditor"
import InspectionReports2 from "../OwnerPanel/InspectionReports/InspectionReports2"
import VehicleBlacklist from "../OwnerPanel/VehicleBlacklist"
import Dashboard from "../OwnerPanel/Dashboard"
import useOverview from "../OwnerPanel/Dashboard/useOverview"
import { getReport } from "../../api/reports"
import { confirmDiscard } from "../../components/unsavedChanges"
import RefreshPageButton from "../../components/RefreshPageButton"
import "../TechnicianPanel/TechnicianPanel.css"
import "../OwnerPanel/ClientProfiles/ClientProfiles.css"
import "../OwnerPanel/Dashboard/Dashboard.css"
import "../OwnerPanel/Dashboard/Greeting.css"

// The panel for admins, accountants and technicians. Which sections and
// actions appear comes from the permissions the owner set in Customize.
export default function StaffPanel({ role, permissions = [], username, token, onLogout, onNameChanged }) {
  const can = (key) => permissions.includes(key)
  const navItems = navItemsFor(role, permissions)
  const allowedViews = navItems.map((item) => item.view)
  const [selectedView, setSelectedView] = useState(null)
  const [visitedViews, setVisitedViews] = useState(() => new Set(["dashboard"]))
  const [refreshRevision, setRefreshRevision] = useState(0)
  // Fall back to the first allowed section if the owner has since removed this one.
  const view = allowedViews.includes(selectedView) ? selectedView : allowedViews[0]
  const accessKey = `${role}:${permissions.join(",")}`
  useEffect(() => {
    setVisitedViews((previous) => {
      const next = new Set([...previous].filter((visited) => allowedViews.includes(visited)))
      next.add(view)
      return next.size === previous.size && [...previous].every((visited) => next.has(visited)) ? previous : next
    })
  }, [view, accessKey])
  const overview = useOverview({ token, role, permissions })

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
    if (!(await confirmDiscard())) return
    setVisitedViews((previous) => previous.has(next) ? previous : new Set([...previous, next]))
    setSelectedView(next)
  }

  async function refreshPage() {
    if (!(await confirmDiscard())) return
    if (view === "inspections") {
      setShowForm(false)
      setReportData(null)
      setEditingReportId(null)
      setEditError("")
    }
    overview.retry()
    setRefreshRevision(value => value + 1)
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
      setSelectedView("inspections")
      setShowForm(true)
    } catch (err) {
      setEditError(err.message || "Failed to load report for editing.")
    }
  }

  const vehicleTitle = reportData
    ? [reportData.year, reportData.make, reportData.model].filter(Boolean).join(" ")
    : ""

  return (
    <div className="tp-app od-app">
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
          key={refreshRevision}
          variant="dashboard"
          role={role}
          name={username || "User"}
          desc="Here's an overview of your work today."
          token={token}
          tag={navItems.find((item) => item.view === view)?.label}
          onMenuClick={() => setMobileOpen(true)}
        />
        <RefreshPageButton onRefresh={refreshPage} />

        {visitedViews.has("dashboard") && <div key={`dashboard:${view === "dashboard" ? refreshRevision : 0}`} hidden={view !== "dashboard"}>
            <Dashboard
              users={[]}
              loading={false}
              error=""
              retryUsers={() => {}}
              overview={overview}
              onNavigate={navigate}
              reportsView="inspections"
              userRole={role}
              permissions={permissions}
            />
        </div>}

        {visitedViews.has("inspections") && <div key={`inspections:${view === "inspections" ? refreshRevision : 0}`} hidden={view !== "inspections"}>
            {editError && <div className="tp-form-error">{editError}</div>}
            {can("reports.create") && <button
              type="button"
              className="tp-inspection-btn"
              onClick={() => {
                if (showForm) closeForm()
                else {
                  setEditingReportId(null)
                  setReportData(null)
                  setShowForm(true)
                }
              }}
            >
              {showForm ? "Close Inspection Report" : "+ Inspection Report"}
            </button>}
            {showForm ? (
              <InspectionForm
                active={view === "inspections"}
                onClose={closeForm}
                onSubmit={handleSubmit}
                initialData={editingReportId ? reportData : null}
              />
            ) : (
              <Inspections token={token} canEdit={can("reports.create")} onEdit={handleEditReport} />
            )}
        </div>}

        {visitedViews.has("reports2") && <div key={`reports2:${view === "reports2" ? refreshRevision : 0}`} hidden={view !== "reports2"}><InspectionReports2 token={token} canCreate={can("reports2.create")} /></div>}
        {visitedViews.has("report-form") && <div key={`report-form:${view === "report-form" ? refreshRevision : 0}`} hidden={view !== "report-form"}><ReportFormEditor /></div>}
        {can("clients.form.edit") && visitedViews.has("client-form") && <div key={`client-form:${view === "client-form" ? refreshRevision : 0}`} hidden={view !== "client-form"}><ClientFormEditor token={token} /></div>}

        {visitedViews.has("clients") && <div key={`clients:${view === "clients" ? refreshRevision : 0}`} hidden={view !== "clients"}><ClientProfiles token={token} role={role} can={can} /></div>}

        {visitedViews.has("approvals") && <div key={`approvals:${view === "approvals" ? refreshRevision : 0}`} hidden={view !== "approvals"}>
          <ClientProfiles
            token={token}
            role={role}
            can={can}
            awaitingMe
            title="Profile Approvals"
            emptyLabel="No client profiles are waiting for your approval."
          />
        </div>}

        {visitedViews.has("blacklist") && <div key={`blacklist:${view === "blacklist" ? refreshRevision : 0}`} hidden={view !== "blacklist"}><VehicleBlacklist token={token} can={can} /></div>}

        {visitedViews.has("activity") && <div key={`activity:${view === "activity" ? refreshRevision : 0}`} hidden={view !== "activity"}><ActivityLog token={token} /></div>}

        {visitedViews.has("settings") && <div key={`settings:${view === "settings" ? refreshRevision : 0}`} hidden={view !== "settings"}><Settings token={token} currentName={username} onNameChanged={onNameChanged} /></div>}
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

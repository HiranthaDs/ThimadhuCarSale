import { useEffect, useState } from "react"
import Sidebar, { navItemsFor } from "../TechnicianPanel/components/Sidebar"
import Hero from "../TechnicianPanel/components/Hero"
import { createUser, deleteUser, listUsers, setUserActive } from "../../api/auth"
import { confirmDialog } from "../../components/ConfirmDialog"
import ClientProfiles from "./ClientProfiles"
import ClientFormEditor from "./ClientProfiles/ClientFormEditor"
import VehicleBlacklist from "./VehicleBlacklist"
import ActivityLog from "./ActivityLog"
import Customize, { ReportFormEditor } from "./Customize"
import { confirmDiscard } from "../../components/unsavedChanges"
import RefreshPageButton from "../../components/RefreshPageButton"
import InspectionReports from "./InspectionReports"
import InspectionReports2 from "./InspectionReports/InspectionReports2"
import InspectionForm from "../TechnicianPanel/components/InspectionForm"
import InspectionReport from "../TechnicianPanel/components/InspectionReport"
import Settings from "../TechnicianPanel/components/Settings"
import "../TechnicianPanel/TechnicianPanel.css"
import "./ClientProfiles/ClientProfiles.css"
import Dashboard from "./Dashboard"
import useOverview from "./Dashboard/useOverview"
import "./Dashboard/Dashboard.css"
import "./Dashboard/Greeting.css"

const initialForm = { email: "", fullName: "", password: "", role: "technician" }

// Used by the owner (full access) and the CEO (only what the owner allowed in Customize).
export default function OwnerPanel({ role: userRole = "owner", permissions = [], username, token, onLogout, onNameChanged }) {
  const can = (key) => userRole === "owner" || permissions.includes(key)
  const navItems = navItemsFor(userRole, permissions)
  const allowedViews = navItems.map((item) => item.view)
  const [selectedView, setView] = useState("dashboard")
  const [visitedViews, setVisitedViews] = useState(() => new Set(["dashboard"]))
  const [refreshRevision, setRefreshRevision] = useState(0)
  // Where to go back to if the owner cancels Customize's password popup.
  const [viewBeforeCustomize, setViewBeforeCustomize] = useState("dashboard")
  // Fall back to the first allowed section if the owner has since removed this one.
  const view = allowedViews.includes(selectedView) ? selectedView : allowedViews[0]
  const accessKey = `${userRole}:${permissions.join(",")}`
  const canManageAccounts = can("accounts.manage")
  useEffect(() => {
    setVisitedViews((previous) => {
      const next = new Set([...previous].filter((visited) => allowedViews.includes(visited)))
      next.add(view)
      return next.size === previous.size && [...previous].every((visited) => next.has(visited)) ? previous : next
    })
  }, [view, accessKey])

  async function navigate(next) {
    if (!(await confirmDiscard())) return false
    if (next === "customize" && view !== "customize") setViewBeforeCustomize(view)
    setVisitedViews((previous) => previous.has(next) ? previous : new Set([...previous, next]))
    setView(next)
    return true
  }

  async function refreshPage() {
    if (!(await confirmDiscard())) return
    if (view === "reports") {
      setShowReportForm(false)
      setReportData(null)
    }
    if (view === "accounts") {
      setShowCreateForm(false)
      refreshUsers()
    }
    overview.retry()
    setRefreshRevision(value => value + 1)
  }
  const [mobileOpen, setMobileOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [listError, setListError] = useState("")

  const [deletingId, setDeletingId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const overview = useOverview({ token, role: userRole, permissions })

  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [formSuccess, setFormSuccess] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)

  const [showReportForm, setShowReportForm] = useState(false)
  const [reportData, setReportData] = useState(null)

  function handleReportSubmit(data) {
    setReportData(data)
    setShowReportForm(false)
  }

  async function closeReportForm() {
    if (!(await confirmDiscard())) return
    setShowReportForm(false)
    setReportData(null)
  }

  const reportVehicleTitle = reportData
    ? [reportData.year, reportData.make, reportData.model].filter(Boolean).join(" ")
    : ""

  async function refreshUsers() {
    setLoadingUsers(true)
    setListError("")
    try {
      setUsers(await listUsers(token))
    } catch (err) {
      setListError(err.message || "Could not load accounts.")
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    if (token && canManageAccounts) refreshUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canManageAccounts])

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setFormError("")
    setFormSuccess("")
    setSubmitting(true)
    try {
      await createUser(token, form)
      setFormSuccess(`Account created for ${form.email}.`)
      setForm(initialForm)
      setShowCreateForm(false)
      refreshUsers()
    } catch (err) {
      setFormError(err.message || "Could not create account.")
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(user) {
    if (updatingId) return
    setUpdatingId(user.id)
    const nextActive = !user.is_active
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: nextActive } : u)))
    try {
      await setUserActive(token, user.id, nextActive)
    } catch (err) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: user.is_active } : u)))
      setListError(err.message || "Could not update account.")
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDeleteUser(user) {
    const confirmed = await confirmDialog({
      title: "Delete account?",
      message: `This permanently deletes ${user.full_name}'s account (${user.email}). This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    })
    if (!confirmed) return
    setListError("")
    setDeletingId(user.id)
    try {
      await deleteUser(token, user.id)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch (err) {
      setListError(err.message || "Could not delete account.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="tp-app od-app">
      <Sidebar
        role={userRole}
        permissions={permissions}
        username={username}
        onLogout={onLogout}
        activeView={view}
        onNavigate={navigate}
        approvalCount={overview.approvals?.count}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      <main className="tp-main">
        <Hero
          key={refreshRevision}
          variant="dashboard"
          role={userRole}
          name={username || "Owner"}
          desc="Here's an overview of your dealership today."
          token={token}
          tag={navItems.find((item) => item.view === view)?.label}
          onMenuClick={() => setMobileOpen(true)}
          menuOpen={mobileOpen}
        />
        <RefreshPageButton onRefresh={refreshPage} />

        {visitedViews.has("clients") && <div key={`clients:${view === "clients" ? refreshRevision : 0}`} hidden={view !== "clients"}>
          <ClientProfiles token={token} role={userRole} can={can} />
        </div>}
        {visitedViews.has("approvals") && <div key={`approvals:${view === "approvals" ? refreshRevision : 0}`} hidden={view !== "approvals"}>
          <ClientProfiles
            token={token}
            role={userRole}
            can={can}
            awaitingMe
            title="Profile Approvals"
            emptyLabel="No client profiles are waiting for your approval."
          />
        </div>}
        {visitedViews.has("reports") && <div key={`reports:${view === "reports" ? refreshRevision : 0}`} hidden={view !== "reports"}>
          {can("reports.create") && (
            <button
              type="button"
              className="tp-inspection-btn"
              onClick={() => {
                if (showReportForm) closeReportForm()
                else { setReportData(null); setShowReportForm(true) }
              }}
            >
              {showReportForm ? "Close Inspection Report" : "+ Inspection Report"}
            </button>
          )}
          {showReportForm && <InspectionForm active={view === "reports"} onClose={closeReportForm} onSubmit={handleReportSubmit} />}
          {!showReportForm && !reportData && <InspectionReports token={token} canReview={can("reports.review")} canCheck={userRole === "owner"} />}
        </div>}
        {visitedViews.has("reports2") && <div key={`reports2:${view === "reports2" ? refreshRevision : 0}`} hidden={view !== "reports2"}>
          <InspectionReports2 token={token} canCreate={can("reports2.create")} />
        </div>}
        {visitedViews.has("report-form") && <div key={`report-form:${view === "report-form" ? refreshRevision : 0}`} hidden={view !== "report-form"}><ReportFormEditor /></div>}
        {can("clients.form.edit") && visitedViews.has("client-form") && <div key={`client-form:${view === "client-form" ? refreshRevision : 0}`} hidden={view !== "client-form"}><ClientFormEditor token={token} /></div>}
        {visitedViews.has("blacklist") && <div key={`blacklist:${view === "blacklist" ? refreshRevision : 0}`} hidden={view !== "blacklist"}>
          <VehicleBlacklist token={token} can={can} />
        </div>}
        {visitedViews.has("activity") && <div key={`activity:${view === "activity" ? refreshRevision : 0}`} hidden={view !== "activity"}>
          <ActivityLog token={token} />
        </div>}
        {view === "customize" && <div key={`customize:${refreshRevision}`}>
          <Customize token={token} onCancel={() => setView(viewBeforeCustomize)} />
        </div>}
        {visitedViews.has("settings") && <div key={`settings:${view === "settings" ? refreshRevision : 0}`} hidden={view !== "settings"}>
          <Settings token={token} currentName={username} onNameChanged={(user) => { onNameChanged?.(user); if (canManageAccounts) refreshUsers() }} />
        </div>}
        {(visitedViews.has("dashboard") || visitedViews.has("accounts")) && <div key={`dashboard-accounts:${view === "dashboard" || view === "accounts" ? refreshRevision : 0}`} hidden={view !== "dashboard" && view !== "accounts"}>
        {view === "accounts" && showCreateForm && (
          <div className="tp-card" style={{ maxWidth: 640, marginBottom: 20 }}>
            <div className="tp-card-head">
              <div className="tp-card-title">Create Account</div>
              <button
                type="button"
                className="tp-form-close"
                onClick={() => setShowCreateForm(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="tp-form-grid">
                <label className="tp-form-group">
                  <span>Full Name</span>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => updateForm("fullName", e.target.value)}
                  />
                </label>
                <label className="tp-form-group">
                  <span>Role</span>
                  <select value={form.role} onChange={(e) => updateForm("role", e.target.value)}>
                    <option value="technician">Technician</option>
                    <option value="ceo">CEO</option>
                    <option value="admin">Admin</option>
                    <option value="accountant">Accountant</option>
                  </select>
                </label>
                <label className="tp-form-group">
                  <span>Email</span>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                  />
                </label>
                <label className="tp-form-group">
                  <span>Temporary Password</span>
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => updateForm("password", e.target.value)}
                  />
                </label>
              </div>

              {formError && <div className="tp-form-error">{formError}</div>}
              {formSuccess && <div className="tp-form-success">{formSuccess}</div>}

              <div className="tp-form-actions" style={{ gridTemplateColumns: "1fr", marginTop: 15 }}>
                <button type="submit" className="tp-form-btn tp-form-btn-primary" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        )}

        <Dashboard users={users} loading={loadingUsers} error={listError} retryUsers={refreshUsers}
          overview={overview} onNavigate={navigate}
          userRole={userRole} permissions={permissions}
          accountsOnly={view === "accounts"} success={formSuccess}
          onCreate={() => { setFormError(""); setFormSuccess(""); setShowCreateForm(true) }}
          onToggle={toggleActive} onDelete={handleDeleteUser} deletingId={deletingId} updatingId={updatingId} />
        </div>}
      </main>

      {reportData && !showReportForm && (
        <InspectionReport
          data={reportData}
          vehicleTitle={reportVehicleTitle}
          token={token}
          reportId={null}
          onClose={() => setReportData(null)}
          onPrint={() => window.print()}
        />
      )}
    </div>
  )
}

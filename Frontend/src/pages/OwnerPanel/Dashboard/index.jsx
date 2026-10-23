import { useEffect, useRef, useState } from "react"
import { CustomersIcon, UsersIcon, ClipboardIcon, CheckBadgeIcon, SearchIcon } from "../../TechnicianPanel/Icons"

const roles = { owner: "Owner", ceo: "CEO", admin: "Admin", accountant: "Accountant", technician: "Technician" }
function ClockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></svg> }
function StorageIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" /></svg> }
const initials = name => (name || "?").split(/\s+/).map(word => word[0]).slice(0, 2).join("").toUpperCase()
const formatStorage = bytes => bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(2)} GB` : `${(bytes / 1_000_000).toFixed(1)} MB`

export default function Dashboard({ users, loading, error, retryUsers, overview, onNavigate, reportsView = "reports", onCreate, onToggle, onDelete, deletingId, updatingId, accountsOnly, success, userRole = "owner", permissions = [] }) {
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("")
  const [page, setPage] = useState(0)
  const [menuId, setMenuId] = useState(null)
  const tableRef = useRef(null)
  useEffect(() => {
    const close = event => { if (!event.target.closest?.(".od-account-actions")) setMenuId(null) }
    const key = event => { if (event.key === "Escape") { tableRef.current?.querySelector(`[data-account-id="${menuId}"]`)?.focus(); setMenuId(null) } }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", key)
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key) }
  }, [menuId])
  const filtered = users.filter(user => (!role || user.role === role) && `${user.full_name} ${user.former_name || ""} ${user.email}`.toLowerCase().includes(search.toLowerCase()))
  const pages = Math.max(1, Math.ceil(filtered.length / 8))
  const currentPage = Math.min(page, pages - 1)
  const rows = filtered.slice(currentPage * 8, currentPage * 8 + 8)
  const can = key => userRole === "owner" || permissions.includes(key)
  const stats = [
    ...(can("accounts.manage") ? [
      { label: "Team accounts", value: loading || error ? "—" : users.length, detail: "Total team members", icon: CustomersIcon, color: "blue" },
      { label: "Active accounts", value: loading || error ? "—" : users.filter(user => user.is_active).length, detail: "Currently active", icon: UsersIcon, color: "green" },
    ] : []),
    ...(overview.clientsAllowed ? [{ label: "Client profiles", value: overview.clients ?? "—", detail: "Profiles in the system", icon: CustomersIcon, color: "blue" }] : []),
    ...(overview.approvalsAllowed ? [{ label: "Pending approvals", value: overview.approvals?.count ?? "—", detail: "Client profiles awaiting review", icon: ClockIcon, color: "amber" }] : []),
    ...(overview.reportsAllowed ? [{ label: "Inspection reports", value: overview.reports?.count ?? "—", detail: "Reports in the system", icon: ClipboardIcon, color: "purple" }] : []),
    ...(overview.reports2Allowed ? [{ label: "Inspection Report 2", value: overview.reports2?.count ?? "—", detail: "Inspection Report 2 records", icon: ClipboardIcon, color: "green" }] : []),
    ...(overview.blacklistAllowed ? [{ label: "Blacklisted vehicles", value: overview.blacklist ?? "—", detail: "Vehicles on the blacklist", icon: CheckBadgeIcon, color: "red" }] : []),
    ...(overview.storageAllowed ? [{ label: "Cloudflare storage", storage: true, value: overview.storageUsage ? formatStorage(overview.storageUsage.used_bytes) : overview.errors.storageUsage ? "Unavailable" : "Loading…", detail: overview.storageUsage ? `${formatStorage(overview.storageUsage.remaining_included_bytes)} remaining of 10 GB` : overview.errors.storageUsage ? "Could not load usage" : "Checking R2 usage", icon: StorageIcon, color: "blue" }] : []),
  ]
  const report1Pending = overview.reportsApprovalAllowed ? overview.reports?.review : overview.reports?.pending
  const report2Pending = overview.reports2ApprovalAllowed ? overview.reports2?.review : overview.reports2?.pending
  return <div className={`od-dashboard${accountsOnly ? "" : " od-overview"}`}>
    {!accountsOnly && stats.length > 0 && <div className="od-stats">{stats.map(({ label, value, detail, icon: Icon, color, storage }) => <article className={`od-stat${storage ? " od-storage-stat" : ""}`} key={label}><span className={`od-stat-icon od-${color}`}><Icon /></span><div><h2>{label}</h2><strong>{value}</strong>{storage && overview.storageUsage && <div className="od-stat-storage-track" role="progressbar" aria-label="Used portion of included R2 storage allowance" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(overview.storageUsage.used_bytes / overview.storageUsage.included_free_bytes * 100))}><span style={{ width: `${Math.min(100, overview.storageUsage.used_bytes / overview.storageUsage.included_free_bytes * 100)}%` }} /></div>}<p>{detail}</p>{storage && overview.errors.storageUsage && <button className="od-text-button" onClick={overview.retry}>Retry</button>}</div></article>)}</div>}
    <div className={`od-dashboard-grid${accountsOnly ? " od-accounts-only" : ""}`}>
      {accountsOnly && <section className="od-card od-team" aria-labelledby="od-team-title">
        <div className="od-card-heading"><div><h2 id="od-team-title">Team accounts</h2><p>Manage your team and access permissions.</p></div><button className="od-button od-primary" onClick={onCreate}><span aria-hidden="true">+</span> Create account</button></div>
        <div className="od-filters"><label className="od-search"><SearchIcon /><input aria-label="Search team members" placeholder="Search team members..." value={search} onChange={event => { setSearch(event.target.value); setPage(0); setMenuId(null) }} /></label><select aria-label="Filter by role" value={role} onChange={event => { setRole(event.target.value); setPage(0); setMenuId(null) }}><option value="">All roles</option>{Object.entries(roles).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>
        {success && <p className="od-success" role="status">{success}</p>}
        {error && <div className="od-error" role="alert">{error} <button onClick={retryUsers}>Retry</button></div>}
        <div className="od-table-scroll" ref={tableRef}>
          <table className="od-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th className="od-action-heading">Actions</th></tr></thead><tbody>
            {loading ? <tr><td colSpan={5} className="od-empty" role="status">Loading team accounts...</td></tr> : rows.length === 0 ? <tr><td colSpan={5} className="od-empty">{error ? "Accounts are unavailable." : "No team members match your search."}</td></tr> : rows.map(user => <tr key={user.id}>
              <td><div className="od-person"><span className="od-avatar">{initials(user.full_name)}</span><span>{user.full_name}{user.former_name && user.former_name !== user.full_name ? ` (formerly ${user.former_name})` : ""}</span></div></td><td className="od-email">{user.email}</td><td><span className={`od-role od-role-${user.role}`}>{roles[user.role] || user.role}</span></td><td><span className={`od-status ${user.role === "owner" ? "od-protected" : user.is_active ? "od-active" : "od-inactive"}`}><span aria-hidden="true">{user.role === "owner" ? "\u25a3" : "\u25cf"}</span>{user.role === "owner" ? "Protected" : user.is_active ? "Active" : "Inactive"}</span></td>
              <td className="od-account-actions">{user.role === "owner" ? <span className="od-protected-dash" aria-label="Owner account is protected">—</span> : <><button className="od-more" data-account-id={user.id} aria-label={`Actions for ${user.full_name}`} aria-expanded={menuId === user.id} onClick={() => setMenuId(menuId === user.id ? null : user.id)} disabled={deletingId === user.id || updatingId === user.id}>&#8942;</button>{menuId === user.id && <div className="od-row-menu"><button onClick={() => { setMenuId(null); onToggle(user) }}>{user.is_active ? "Deactivate account" : "Activate account"}</button><button className="od-danger" onClick={() => { setMenuId(null); onDelete(user) }}>Delete account</button></div>}</>}</td>
            </tr>)}
          </tbody></table>
        </div>
        <div className="od-table-footer"><span>{filtered.length} team member{filtered.length === 1 ? "" : "s"}{search || role ? ` of ${users.length}` : ""}</span><div className="od-pagination"><button aria-label="Previous page" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setMenuId(null) }}>‹</button><span aria-label={`Page ${currentPage + 1} of ${pages}`}>{currentPage + 1}</span><button aria-label="Next page" disabled={currentPage >= pages - 1} onClick={() => { setPage(currentPage + 1); setMenuId(null) }}>›</button></div></div>
      </section>}
      {!accountsOnly && <div className="od-right-column">
        <section className="od-card od-attention" aria-labelledby="od-attention-title"><h2 id="od-attention-title">Needs attention</h2><p className="od-section-description">Your next steps, all in one place.</p>
          {overview.approvalsAllowed && <div className="od-attention-item"><span className="od-round-icon od-red"><UsersIcon /></span><div><h3>{overview.approvals ? `${overview.approvals.count} profiles awaiting approval` : overview.errors.approvals ? "Approvals unavailable" : "Loading approvals..."}</h3><p>New client profiles need your review.</p><button className="od-button od-primary" onClick={() => onNavigate("approvals")}>Review profiles</button></div></div>}
          {overview.reportsAllowed && <div className="od-attention-item"><span className="od-round-icon od-amber"><ClipboardIcon /></span><div><h3>Inspection Report 1</h3>{overview.reports ? <div className="od-report-counts"><span><strong>{overview.reports.approved}</strong>Approved</span><span><strong>{report1Pending}</strong>{overview.reportsApprovalAllowed ? "Pending your approval" : "Pending"}</span></div> : <p>{overview.errors.reports ? "Report counts unavailable." : "Loading report counts..."}</p>}<button className="od-button od-secondary" onClick={() => onNavigate(reportsView)}>{overview.reportsApprovalAllowed ? "Review reports" : "View reports"}</button></div></div>}
          {overview.reports2Allowed && <div className="od-attention-item"><span className="od-round-icon od-green"><CheckBadgeIcon /></span><div><h3>Inspection Report 2</h3>{overview.reports2 ? <div className="od-report-counts"><span><strong>{overview.reports2.approved}</strong>Approved</span><span><strong>{report2Pending}</strong>{overview.reports2ApprovalAllowed ? "Pending your approval" : "Pending"}</span></div> : <p>{overview.errors.reports2 ? "Report counts unavailable." : "Loading report counts..."}</p>}<button className="od-button od-secondary" onClick={() => onNavigate("reports2")}>{overview.reports2ApprovalAllowed ? "Review Report 2" : "View Report 2"}</button></div></div>}
          {!overview.approvalsAllowed && !overview.reportsAllowed && !can("reports2.approve") && <p className="od-empty">No assigned actions need attention right now.</p>}
          {Object.values(overview.errors).some(Boolean) && <button className="od-text-button" onClick={overview.retry}>Retry dashboard data</button>}
        </section>
        {overview.activityAllowed && <section className="od-card od-activity"><div className="od-card-heading"><h2>Recent activity</h2><button className="od-text-button" onClick={() => onNavigate("activity")}>View all</button></div>
          {overview.errors.activity ? <div className="od-error">Could not load activity. <button onClick={overview.retry}>Retry</button></div> : !overview.activity ? <p className="od-empty" role="status">Loading activity...</p> : overview.activity.length === 0 ? <p className="od-empty">No recent activity yet.</p> : <ol>{overview.activity.map(entry => <li key={entry.id}><span className={`od-round-icon ${entry.action?.includes("approv") ? "od-green" : entry.action?.includes("user") ? "od-purple" : "od-blue"}`}>{entry.action?.includes("approv") ? <CheckBadgeIcon /> : <ClipboardIcon />}</span><div><div className="od-activity-title"><h3>{entry.action?.replace(/[._]/g, " ") || "Workspace updated"}</h3><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></div><p>{entry.description}</p></div></li>)}</ol>}
        </section>}
      </div>}
    </div>
    {!accountsOnly && error && <div className="od-error" role="alert">Team totals are unavailable. <button onClick={retryUsers}>Retry</button></div>}
  </div>
}

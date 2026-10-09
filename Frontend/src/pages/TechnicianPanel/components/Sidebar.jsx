import { useState } from "react"
import {
  DashboardIcon,
  ClipboardIcon,
  CheckBadgeIcon,
  ReportsIcon,
  UsersIcon,
  SettingsIcon,
  SlidersIcon,
  ChevronIcon,
  LogoutIcon,
} from "../Icons"
import logo from "../../../assets/logo.png"

// The owner sees everything; the CEO uses the same panel but only sees what
// the owner allowed them in Customize, and never Customize itself.
const ownerNav = [
  { label: "Dashboard", icon: DashboardIcon, view: "dashboard", permission: "accounts.manage" },
  { label: "Client Profiles", icon: ClipboardIcon, view: "clients", permission: "clients.view" },
  { label: "Profile Approvals", icon: CheckBadgeIcon, view: "approvals", permission: "clients.approve" },
  { label: "Inspection Reports", icon: ReportsIcon, view: "reports", permission: "reports.view" },
  { label: "Inspection Report 2", icon: ReportsIcon, view: "reports2", permission: "reports2.view" },
  { label: "Vehicle Blacklist", icon: CheckBadgeIcon, view: "blacklist", permission: "blacklist.view" },
  { label: "Activity Log", icon: ReportsIcon, view: "activity", permission: "activity.view" },
  { label: "Customize", icon: SlidersIcon, view: "customize", ownerOnly: true },
  { label: "Settings", icon: SettingsIcon, view: "settings" },
]

// Admins, accountants and technicians see the sections the owner ticked for
// their role in Customize; `permission` is the key that unlocks each item.
const staffNav = [
  { label: "Dashboard", icon: DashboardIcon, view: "dashboard", permission: "reports.create" },
  { label: "Inspections", icon: ClipboardIcon, view: "inspections", permission: "reports.view" },
  { label: "Inspection Report 2", icon: ReportsIcon, view: "reports2", permission: "reports2.view" },
  { label: "Client Profiles", icon: ClipboardIcon, view: "clients", permission: "clients.view" },
  { label: "Profile Approvals", icon: CheckBadgeIcon, view: "approvals", permission: "clients.approve" },
  { label: "Vehicle Blacklist", icon: CheckBadgeIcon, view: "blacklist", permission: "blacklist.view" },
  { label: "Activity Log", icon: ReportsIcon, view: "activity", permission: "activity.view" },
  { label: "Settings", icon: SettingsIcon, view: "settings" },
]

export function navItemsFor(role, permissions = []) {
  if (role === "owner") return ownerNav
  const items = role === "ceo" ? ownerNav.filter((item) => !item.ownerOnly) : staffNav
  return items.filter((item) => !item.permission || permissions.includes(item.permission))
}

export default function Sidebar({ role = "technician", permissions, username, onLogout, activeView, onNavigate, mobileOpen: mobileOpenProp, onMobileOpenChange }) {
  const navItems = navItemsFor(role, permissions)
  const [mobileOpenState, setMobileOpenState] = useState(false)
  const mobileOpen = mobileOpenProp ?? mobileOpenState
  const setMobileOpen = onMobileOpenChange ?? setMobileOpenState

  return (
    <>
      {mobileOpen && (
        <div className="tp-sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside className={`tp-sidebar${mobileOpen ? " tp-sidebar-open" : ""}`}>
        <div className="tp-brand">
          <div className="tp-brand-icon">
            <img src={logo} alt="Thimadu Auto Trading" />
          </div>
          <div className="tp-brand-text">
            <div className="tp-name">Thimadu</div>
            <div className="tp-tag">Auto Trading</div>
          </div>
          <button
            type="button"
            className="tp-sidebar-close"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="tp-nav">
          {navItems.map(({ label, icon: Icon, view, chevron }) => {
            const isActive = view ? view === activeView : label === "Dashboard" && !activeView
            return (
              <a
                key={label}
                className={`tp-nav-item${isActive ? " tp-nav-item-active" : ""}`}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (view && onNavigate) onNavigate(view)
                  setMobileOpen(false)
                }}
              >
                <Icon />
                {label}
                {chevron && <ChevronIcon className="tp-chev" />}
              </a>
            )
          })}
        </nav>

        <div className="tp-sidebar-user">
          <div className="tp-sidebar-user-info">
            <div className="tp-sidebar-user-name">{username || "User"}</div>
            <div className="tp-sidebar-user-role">{role}</div>
          </div>
          <button type="button" className="tp-logout-btn" onClick={onLogout} aria-label="Log out">
            <LogoutIcon />
          </button>
        </div>
      </aside>
    </>
  )
}

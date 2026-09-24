import {
  DashboardIcon,
  InventoryIcon,
  ClipboardIcon,
  CheckBadgeIcon,
  ReportsIcon,
  UsersIcon,
  SettingsIcon,
  ChevronIcon,
  LogoutIcon,
} from "../Icons"
import logo from "../../../assets/logo.png"

const navByRole = {
  owner: [
    { label: "Dashboard", icon: DashboardIcon, view: "dashboard" },
    { label: "Client Profiles", icon: ClipboardIcon, view: "clients" },
    { label: "Profile Approvals", icon: CheckBadgeIcon, view: "approvals" },
    { label: "Inspection Reports", icon: ReportsIcon, view: "reports" },
    { label: "Inspection Report 2", icon: ReportsIcon, view: "reports2" },
    { label: "Vehicle Blacklist", icon: CheckBadgeIcon, view: "blacklist" },
    { label: "Activity Log", icon: ReportsIcon, view: "activity" },
    { label: "Settings", icon: SettingsIcon, view: "settings" },
  ],
  technician: [
    { label: "Dashboard", icon: DashboardIcon, view: "dashboard" },
    { label: "Inspections", icon: ClipboardIcon, view: "inspections" },
    { label: "Inspection Report 2", icon: ReportsIcon, view: "reports2" },
    { label: "Vehicle Blacklist", icon: CheckBadgeIcon, view: "blacklist" },
    { label: "Equipment", icon: InventoryIcon },
    { label: "Settings", icon: SettingsIcon, view: "settings" },
  ],
  co: [
    { label: "Dashboard", icon: DashboardIcon, view: "dashboard" },
    { label: "Client Profiles", icon: ClipboardIcon, view: "clients" },
    { label: "Vehicle Blacklist", icon: CheckBadgeIcon, view: "blacklist" },
    { label: "Settings", icon: SettingsIcon, view: "settings" },
  ],
  accountant: [
    { label: "Dashboard", icon: DashboardIcon, view: "dashboard" },
    { label: "Client Profiles", icon: ClipboardIcon, view: "clients" },
    { label: "Vehicle Blacklist", icon: CheckBadgeIcon, view: "blacklist" },
    { label: "Settings", icon: SettingsIcon, view: "settings" },
  ],
}

export default function Sidebar({ role = "technician", username, onLogout, activeView, onNavigate }) {
  const navItems = navByRole[role] ?? navByRole.technician

  return (
    <aside className="tp-sidebar">
      <div className="tp-brand">
        <div className="tp-brand-icon">
          <img src={logo} alt="Thimadu Auto Trading" />
        </div>
        <div className="tp-brand-text">
          <div className="tp-name">Thimadu</div>
          <div className="tp-tag">Auto Trading</div>
        </div>
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
  )
}

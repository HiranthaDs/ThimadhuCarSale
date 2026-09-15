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

const navByRole = {
  owner: [
    { label: "Dashboard", icon: DashboardIcon, active: true },
    { label: "Users", icon: UsersIcon, chevron: true },
    { label: "Activity Log", icon: ReportsIcon },
    { label: "Settings", icon: SettingsIcon },
  ],
  technician: [
    { label: "Dashboard", icon: DashboardIcon, active: true },
    { label: "Inspections", icon: ClipboardIcon, chevron: true },
    { label: "Equipment", icon: InventoryIcon },
    { label: "Settings", icon: SettingsIcon },
  ],
  staff: [
    { label: "Dashboard", icon: DashboardIcon, active: true },
    { label: "Pending Reviews", icon: CheckBadgeIcon, chevron: true },
    { label: "Approved Reports", icon: ReportsIcon },
    { label: "Settings", icon: SettingsIcon },
  ],
}

export default function Sidebar({ role = "technician", username, onLogout }) {
  const navItems = navByRole[role] ?? navByRole.technician

  return (
    <aside className="tp-sidebar">
      <div className="tp-brand">
        <div className="tp-brand-icon">
          <CarIconWithTail />
        </div>
        <div className="tp-brand-text">
          <div className="tp-name">
            Auto<span>Mart</span>
          </div>
          <div className="tp-tag">Drive Your Future</div>
        </div>
      </div>

      <nav className="tp-nav">
        {navItems.map(({ label, icon: Icon, active, chevron }) => (
          <a key={label} className={`tp-nav-item${active ? " tp-nav-item-active" : ""}`} href="#">
            <Icon />
            {label}
            {chevron && <ChevronIcon className="tp-chev" />}
          </a>
        ))}
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

function CarIconWithTail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h-2v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
      <path d="M9 17h6" />
    </svg>
  )
}

import { useState } from "react"
import Sidebar from "../TechnicianPanel/components/Sidebar"
import Hero from "../TechnicianPanel/components/Hero"
import Settings from "../TechnicianPanel/components/Settings"
import ClientProfiles from "../OwnerPanel/ClientProfiles"
import VehicleBlacklist from "../OwnerPanel/VehicleBlacklist"
import "../TechnicianPanel/TechnicianPanel.css"
import "../OwnerPanel/ClientProfiles/ClientProfiles.css"

export default function StaffPanel({ role, username, token, onLogout }) {
  const [view, setView] = useState("dashboard")
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="tp-app">
      <Sidebar
        role={role}
        username={username}
        onLogout={onLogout}
        activeView={view}
        onNavigate={setView}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      <main className="tp-main">
        <Hero
          name={username || "User"}
          desc="Here's what needs your attention today."
          token={token}
          onMenuClick={() => setMobileOpen(true)}
        />

        {view === "clients" ? (
          <ClientProfiles token={token} role={role} />
        ) : view === "blacklist" ? (
          <VehicleBlacklist token={token} role={role} />
        ) : view === "settings" ? (
          <Settings token={token} />
        ) : null}
      </main>
    </div>
  )
}

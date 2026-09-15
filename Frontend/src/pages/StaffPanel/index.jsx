import Sidebar from "../TechnicianPanel/components/Sidebar"
import Hero from "../TechnicianPanel/components/Hero"
import "../TechnicianPanel/TechnicianPanel.css"

export default function StaffPanel({ username, onLogout }) {
  return (
    <div className="tp-app">
      <Sidebar role="staff" username={username} onLogout={onLogout} />

      <main className="tp-main">
        <Hero name={username || "Staff"} desc="Here's what needs your review today." />
      </main>
    </div>
  )
}

import { useState } from "react"
import Login from "./pages/Login"
import TechnicianPanel from "./pages/TechnicianPanel"
import OwnerPanel from "./pages/OwnerPanel"
import StaffPanel from "./pages/StaffPanel"

const panels = {
  owner: OwnerPanel,
  technician: TechnicianPanel,
  co: StaffPanel,
  accountant: StaffPanel,
}

const SESSION_KEY = "thimadhu_session"

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function App() {
  const [session, setSession] = useState(loadSession)

  function handleLogin(nextSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession))
    setSession(nextSession)
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  if (!session) {
    return <Login onLogin={handleLogin} />
  }

  const ActivePanel = panels[session.role] ?? TechnicianPanel

  return (
    <ActivePanel
      role={session.role}
      username={session.fullName || session.username}
      token={session.token}
      onLogout={handleLogout}
    />
  )
}

export default App

import { lazy, Suspense, useEffect, useState } from "react"
import Login from "./pages/Login"
const TechnicianPanel = lazy(() => import("./pages/TechnicianPanel"))
const OwnerPanel = lazy(() => import("./pages/OwnerPanel"))
const StaffPanel = lazy(() => import("./pages/StaffPanel"))
import { me, logout } from "./api/auth"

// The CEO has the same access as the owner, so uses the owner panel.
const panels = { owner: OwnerPanel, technician: TechnicianPanel, ceo: OwnerPanel, accountant: StaffPanel }

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    // Remove credentials saved by older versions. Sessions now use an HttpOnly cookie.
    try { localStorage.removeItem("thimadu_session") } catch { /* Storage may be disabled. */ }
    const expired = () => { setSession(null); setError("") }
    window.addEventListener("thimadu:unauthorized", expired)
    me().then(user => {
      if (active) setSession({ role: user.role, username: user.email, fullName: user.full_name })
    }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false; window.removeEventListener("thimadu:unauthorized", expired) }
  }, [])

  async function handleLogout() {
    try {
      await logout()
      setSession(null)
      setError("")
    } catch (err) {
      setError(`Could not sign out: ${err.message}`)
    }
  }

  if (loading) return <p role="status">Loading your account...</p>
  if (!session) return <Login onLogin={setSession} />
  const ActivePanel = panels[session.role] ?? TechnicianPanel
  return <>
    {error && <div role="alert">{error}</div>}
    {/* Panels use this flag for an authenticated view; it contains no credential. */}
    <Suspense fallback={<p role="status">Loading workspace...</p>}>
    <ActivePanel role={session.role} username={session.fullName || session.username}
      token={true} onLogout={handleLogout} />
    </Suspense>
  </>
}

export default App

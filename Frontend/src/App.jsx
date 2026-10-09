import { lazy, Suspense, useEffect, useState } from "react"
import Login from "./pages/Login"
const OwnerPanel = lazy(() => import("./pages/OwnerPanel"))
const StaffPanel = lazy(() => import("./pages/StaffPanel"))
import { me, logout } from "./api/auth"
import { confirmLogout } from "./components/unsavedChanges"

// The CEO uses the owner panel, limited to what the owner allows in Customize.
// Every other role uses the staff panel, shaped by the same permissions.
const panels = { owner: OwnerPanel, ceo: OwnerPanel }

function toSession(user) {
  return { role: user.role, username: user.email, fullName: user.full_name, permissions: user.permissions || [] }
}

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
      if (active) setSession(toSession(user))
    }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    // Pick up permission changes the owner made while this tab was in the background.
    const refresh = () => {
      if (document.visibilityState !== "visible") return
      me().then(user => { if (active) setSession(prev => prev && toSession(user)) }).catch(() => {})
    }
    document.addEventListener("visibilitychange", refresh)
    return () => {
      active = false
      window.removeEventListener("thimadu:unauthorized", expired)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [])

  async function handleLogout() {
    if (!(await confirmLogout())) return
    try {
      await logout()
      setSession(null)
      setError("")
    } catch (err) {
      setError(`Could not sign out: ${err.message}`)
    }
  }

  if (loading) return <p role="status">Loading your account...</p>
  if (!session) return <Login onLogin={(user) => setSession(toSession(user))} />
  const ActivePanel = panels[session.role] ?? StaffPanel
  return <>
    {error && <div role="alert">{error}</div>}
    {/* Panels use this flag for an authenticated view; it contains no credential. */}
    <Suspense fallback={<p role="status">Loading workspace...</p>}>
    <ActivePanel role={session.role} permissions={session.permissions} username={session.fullName || session.username}
      token={true} onLogout={handleLogout} />
    </Suspense>
  </>
}

export default App

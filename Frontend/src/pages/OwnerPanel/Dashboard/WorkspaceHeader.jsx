import { useEffect, useRef, useState } from "react"
import { SearchIcon, BellIcon, ChevronIcon } from "../../TechnicianPanel/Icons"

export default function WorkspaceHeader({ label, navItems, navigate, username, onLogout, onMenuClick, pending }) {
  const [query, setQuery] = useState("")
  const [menu, setMenu] = useState("")
  const ref = useRef(null)
  useEffect(() => {
    const close = event => { if (!ref.current?.contains(event.target)) setMenu("") }
    const key = event => { if (event.key === "Escape") { setMenu(""); setQuery("") } }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", key)
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key) }
  }, [])
  const initials = (username || "User").split(/\s+/).map(word => word[0]).slice(0, 2).join("").toUpperCase()
  const go = view => { navigate(view); setMenu(""); setQuery("") }
  return <header className="od-topbar" ref={ref}>
    <button type="button" className="od-menu-button od-icon-button" onClick={onMenuClick} aria-label="Open navigation">&#9776;</button>
    <div className="od-breadcrumb"><span>Workspace</span><span>/</span><strong>{label}</strong></div>
    <div className="od-header-actions">
      <div className="od-header-search">
        <label className="od-search"><SearchIcon /><input aria-label="Search workspace pages" placeholder="Search workspace..." value={query} onFocus={() => setMenu("search")} onChange={event => { setQuery(event.target.value); setMenu("search") }} /></label>
        {menu === "search" && query && <div className="od-dropdown">{navItems.filter(item => item.label.toLowerCase().includes(query.toLowerCase())).map(item => <button key={item.view} onClick={() => go(item.view)}>{item.label}</button>)}{!navItems.some(item => item.label.toLowerCase().includes(query.toLowerCase())) && <p>No matching pages.</p>}</div>}
      </div>
      <div className="od-menu-wrap"><button className="od-icon-button" aria-label="Notifications" aria-expanded={menu === "notifications"} onClick={() => setMenu(menu === "notifications" ? "" : "notifications")}><BellIcon />{pending > 0 && <i className="od-notification-dot" />}</button>{menu === "notifications" && <div className="od-dropdown od-notifications"><strong>Needs attention</strong>{pending > 0 ? <button onClick={() => go("approvals")}>{pending} profiles awaiting approval &rarr;</button> : <p>No pending profile notifications.</p>}</div>}</div>
      <div className="od-menu-wrap"><button className="od-profile-button" aria-label="Account menu" aria-expanded={menu === "account"} onClick={() => setMenu(menu === "account" ? "" : "account")}><span className="od-avatar">{initials}</span><ChevronIcon /></button>{menu === "account" && <div className="od-dropdown"><strong>{username}</strong><button onClick={() => go("settings")}>Settings</button><button onClick={onLogout}>Sign out</button></div>}</div>
    </div>
  </header>
}

import { SearchIcon, BellIcon, ChevronIcon } from "../Icons"

export default function Topbar() {
  return (
    <div className="tp-topbar">
      <div className="tp-search">
        <SearchIcon />
        <input type="text" placeholder="Search cars, customers, or VIN..." />
      </div>
      <div className="tp-topbar-right">
        <button className="tp-icon-btn" aria-label="Notifications">
          <BellIcon />
          <span className="tp-badge">3</span>
        </button>
        <div className="tp-profile">
          <img className="tp-avatar" src="https://i.pravatar.cc/80?img=13" alt="Admin avatar" />
          <span className="tp-profile-name">Admin</span>
          <ChevronIcon />
        </div>
      </div>
    </div>
  )
}

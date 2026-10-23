import "./RefreshPageButton.css"

export default function RefreshPageButton({ onRefresh }) {
  return <div className="page-refresh-bar">
    <button type="button" className="page-refresh-button" onClick={onRefresh}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 11a8 8 0 1 0-2.3 6.7" />
        <path d="M20 4v7h-7" />
      </svg>
      Refresh page
    </button>
  </div>
}

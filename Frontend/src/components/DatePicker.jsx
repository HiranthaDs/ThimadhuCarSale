import { useEffect, useRef, useState } from "react"
import "./DatePicker.css"

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const pad = (n) => String(n).padStart(2, "0")
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`

function parseIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "")
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) }
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" strokeWidth="2.4" />
    </svg>
  )
}

function Chevron({ dir }) {
  const d = { left: "m15 6-6 6 6 6", right: "m9 6 6 6-6 6", down: "m6 9 6 6 6-6" }[dir]
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export default function DatePicker({ value, onChange, placeholder = "dd/mm/yyyy", className = "" }) {
  const selected = parseIso(value)
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => ({
    y: selected?.y ?? today.getFullYear(),
    m: selected?.m ?? today.getMonth(),
  }))
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  function toggle() {
    if (!open) {
      const base = parseIso(value)
      setView({ y: base?.y ?? today.getFullYear(), m: base?.m ?? today.getMonth() })
    }
    setOpen((o) => !o)
  }

  function shiftMonth(delta) {
    setView((v) => {
      const total = v.y * 12 + v.m + delta
      return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 }
    })
  }

  function pick(iso) {
    onChange(iso)
    setOpen(false)
  }

  const firstWeekday = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const prevMonthDays = new Date(view.y, view.m, 0).getDate()
  const cells = []
  for (let i = 0; i < 42; i++) {
    const dayNum = i - firstWeekday + 1
    if (dayNum < 1) {
      const date = new Date(view.y, view.m - 1, prevMonthDays + dayNum)
      cells.push({ iso: toIso(date.getFullYear(), date.getMonth(), date.getDate()), day: date.getDate(), outside: true })
    } else if (dayNum > daysInMonth) {
      const date = new Date(view.y, view.m + 1, dayNum - daysInMonth)
      cells.push({ iso: toIso(date.getFullYear(), date.getMonth(), date.getDate()), day: date.getDate(), outside: true })
    } else {
      cells.push({ iso: toIso(view.y, view.m, dayNum), day: dayNum, outside: false })
    }
  }
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate())
  const display = selected ? `${pad(selected.d)}/${pad(selected.m + 1)}/${selected.y}` : ""

  return (
    <div className={`dp-root ${className}`} ref={boxRef}>
      <button type="button" className={`dp-trigger${open ? " dp-trigger-open" : ""}`} onClick={toggle}>
        <span className="dp-trigger-icon">
          <CalendarIcon />
        </span>
        <span className={display ? "dp-trigger-value" : "dp-trigger-placeholder"}>{display || placeholder}</span>
        <span className={`dp-trigger-chevron${open ? " dp-trigger-chevron-open" : ""}`}>
          <Chevron dir="down" />
        </span>
      </button>

      {open && (
        <div className="dp-popup" role="dialog" aria-label="Choose date">
          <div className="dp-header">
            <button type="button" className="dp-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <Chevron dir="left" />
            </button>
            <div className="dp-title">
              {MONTHS[view.m]} {view.y}
            </div>
            <button type="button" className="dp-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
              <Chevron dir="right" />
            </button>
          </div>

          <div className="dp-body">
            <div className="dp-grid dp-weekdays">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="dp-grid">
              {cells.map((c) => (
                <button
                  type="button"
                  key={c.iso}
                  className={`dp-day${c.outside ? " dp-day-outside" : ""}${c.iso === value ? " dp-day-selected" : ""}${
                    c.iso === todayIso && c.iso !== value ? " dp-day-today" : ""
                  }`}
                  onClick={() => pick(c.iso)}
                >
                  {c.day}
                </button>
              ))}
            </div>
          </div>

          <div className="dp-footer">
            <button type="button" className="dp-footer-btn dp-footer-today" onClick={() => pick(todayIso)}>
              <CalendarIcon />
              Today
            </button>
            <button type="button" className="dp-footer-btn dp-footer-clear" onClick={() => pick("")}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from "react"
import { CalendarIcon, BrandMark } from "../Icons"
import ReminderCalendar, { hasUrgentReminder } from "./ReminderCalendar"
import { listReminders } from "../../../api/reminders"

// Must match the CSS transition duration on .rc-panel, plus a small buffer,
// so the panel is unmounted only after its collapse animation has finished.
const PANEL_CLOSE_MS = 300

function greetingForHour(hour) {
  if (hour < 5 || hour >= 21) return "Good Night,"
  if (hour < 12) return "Good Morning,"
  if (hour < 17) return "Good Afternoon,"
  return "Good Evening,"
}

// Optional artwork: the empty slot produces no broken image or network request.
const carAssets = import.meta.glob("../../../assets/welcome-sports-car/*.{webp,png}", { eager: true, query: "?url", import: "default" })
const welcomeCar = Object.values(carAssets)[0]
const roleLabels = { owner: "Owner", ceo: "CEO", admin: "Admin", accountant: "Accountant", technician: "Technical Officer" }

function GreetingIcon({ period }) {
  return <span className={`od-greeting-symbol od-greeting-${period}`} aria-hidden="true">
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {period === "night" ? <><path fill="currentColor" fillOpacity=".12" d="M24 21A11 11 0 0 1 11 7a11 11 0 1 0 13 14Z" /><path d="m23 5 .8 2.2L26 8l-2.2.8L23 11l-.8-2.2L20 8l2.2-.8ZM28 15v3m-1.5-1.5h3" /></>
        : period === "evening" ? <><path fill="currentColor" fillOpacity=".18" d="M8 21a8 8 0 0 1 16 0" /><path d="M4 22h24M8 26h16M16 5v4M4 13l3 2m18 0 3-2M16 12v6m-2-2 2 2 2-2" /></>
          : <><circle cx="16" cy="16" r="6" fill="currentColor" fillOpacity=".22" /><path className="od-sun-rays" d="M16 3v3m0 20v3M3 16h3m20 0h3M7 7l2 2m14 14 2 2M7 25l2-2M23 9l2-2" /></>}
    </svg>
  </span>
}

export default function Hero({ name = "Admin", role, desc = "Here's what's happening with your dealership today.", token, tag, onMenuClick, variant }) {
  const [now, setNow] = useState(() => new Date())
  const [reminders, setReminders] = useState([])
  const [mounted, setMounted] = useState(false) // panel is in the DOM
  const [open, setOpen] = useState(false) // panel is slid into view
  const wrapRef = useRef(null)
  const closeTimer = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    listReminders(token)
      .then((data) => !cancelled && setReminders(data))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token])

  function openPanel() {
    clearTimeout(closeTimer.current)
    setMounted(true)
    // Mount first, then flip the visibility class on the next frame so the
    // slide-in transition actually plays instead of snapping straight open.
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
  }

  function closePanel() {
    clearTimeout(closeTimer.current)
    setOpen(false)
    closeTimer.current = setTimeout(() => setMounted(false), PANEL_CLOSE_MS)
  }

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) closePanel()
    }
    function onKey(e) {
      if (e.key === "Escape") closePanel()
    }
    document.addEventListener("mousedown", onPointerDown)
    window.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  function handleReminderChanged(saved) {
    setReminders((prev) => {
      if (saved._deleted) return prev.filter((r) => r.id !== saved.id)
      const exists = prev.some((r) => r.id === saved.id)
      return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved]
    })
  }

  const dateLabel = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const dayLabel = now.toLocaleDateString("en-US", { weekday: "long" })
  const timeLabel = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const urgent = hasUrgentReminder(reminders, now)
  const dashboard = variant === "dashboard"
  const hour = now.getHours()
  const period = hour < 5 || hour >= 21 ? "night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"
  const roleLabel = roleLabels[role] || role?.replace(/[_-]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()) || name
  const clockParts = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).formatToParts(now)
  const clockPart = type => clockParts.find(part => part.type === type)?.value

  return (
    <section className={`tp-hero${dashboard ? " od-greeting od-welcome-banner" : ""}`}>
      {dashboard && <div className="od-welcome-art" aria-hidden="true">
        <span className="od-welcome-ribbon" /><span className="od-welcome-highlight" />
        <div className="od-welcome-car-slot">{welcomeCar && <img src={welcomeCar} alt="" className="od-welcome-car" />}</div>
      </div>}
      <button
        type="button"
        className={`tp-hero-menu-btn${mounted ? " tp-hero-menu-btn-hidden" : ""}`}
        aria-label="Open menu"
        onClick={onMenuClick}
      >
        <span />
        <span />
        <span />
      </button>

      <div className="tp-hero-brand">
        <BrandMark tag={tag} />
      </div>

      {dashboard ? <div className="od-welcome-copy">
        <GreetingIcon period={period} />
        <div><p className="od-welcome-salutation">{greetingForHour(hour)}</p><h1 className="od-welcome-name">{roleLabel}</h1><p className="od-welcome-description">Here's an overview of your dealership today.</p></div>
      </div> : <div className="tp-hero-center">
        <div className="tp-hero-greet">{greetingForHour(now.getHours())}</div>
        <div className="tp-hero-name">{name}</div>
        <div className="tp-hero-desc">{desc}</div>
      </div>}

      {dashboard && <div className="od-welcome-quote"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 5h7v7H7c0 3 1 4 4 5v2c-5-1-7-4-7-9Zm10 0h7v7h-4c0 3 1 4 4 5v2c-5-1-7-4-7-9Z" /></svg><p>Drive your business forward,<br />one connected workspace.</p></div>}

      <div className="tp-hero-date-wrap" ref={wrapRef}>
        {dashboard ? <button type="button" className={`od-datetime${urgent ? " od-datetime-urgent" : ""}`} onClick={() => (open ? closePanel() : openPanel())} aria-expanded={open} title="Open reminders calendar">
          <span className="od-date-tile"><span>{now.toLocaleDateString("en-US", { month: "short" })}</span><strong>{now.getDate()}</strong><CalendarIcon /></span>
          <span className="od-datetime-content">
            <span className="od-date-heading">{dayLabel}<span className="od-calendar-arrow" aria-hidden="true">&#8599;</span></span>
            <span className="od-date-detail">{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}{urgent && <span className="od-reminder-dot" title="Upcoming reminders" />}</span>
            <time className="od-live-clock" dateTime={now.toISOString()}><span>{clockPart("hour")}:{clockPart("minute")}<span className="od-clock-seconds">:{clockPart("second")}</span></span><span className="od-clock-period">{clockPart("dayPeriod")}</span></time>
          </span>
        </button> : <button
          type="button"
          className={`tp-hero-date${urgent ? " tp-hero-date-urgent" : ""}`}
          onClick={() => (open ? closePanel() : openPanel())}
          title="Open reminders calendar"
          aria-expanded={open}
        >
          <CalendarIcon />
          <div>
            <div className="tp-d1">{dateLabel}</div>
            <div className="tp-d2">{dayLabel}</div>
            <time className="tp-d3" dateTime={now.toISOString()}>{timeLabel}</time>
          </div>
        </button>}

        {mounted && (
          <ReminderCalendar
            token={token}
            reminders={reminders}
            visible={open}
            onReminderChanged={handleReminderChanged}
            onClose={closePanel}
          />
        )}
      </div>
    </section>
  )
}

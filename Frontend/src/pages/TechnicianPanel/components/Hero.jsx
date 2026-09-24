import { useEffect, useRef, useState } from "react"
import { CalendarIcon, BrandMark } from "../Icons"
import ReminderCalendar, { hasUrgentReminder } from "./ReminderCalendar"
import { listReminders } from "../../../api/reminders"

// Must match the CSS transition duration on .rc-panel, plus a small buffer,
// so the panel is unmounted only after its collapse animation has finished.
const PANEL_CLOSE_MS = 300

function greetingForHour(hour) {
  if (hour < 12) return "Good Morning,"
  if (hour < 17) return "Good Afternoon,"
  return "Good Evening,"
}

export default function Hero({ name = "Admin", desc = "Here's what's happening with your dealership today.", token }) {
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

  return (
    <section className="tp-hero">
      <div className="tp-hero-brand">
        <BrandMark iconSize={34} />
      </div>

      <div className="tp-hero-center">
        <div className="tp-hero-greet">{greetingForHour(now.getHours())}</div>
        <div className="tp-hero-name">{name}</div>
        <div className="tp-hero-desc">{desc}</div>
      </div>

      <div className="tp-hero-date-wrap" ref={wrapRef}>
        <button
          type="button"
          className={`tp-hero-date${urgent ? " tp-hero-date-urgent" : ""}`}
          onClick={() => (open ? closePanel() : openPanel())}
          title="Open reminders calendar"
        >
          <CalendarIcon />
          <div>
            <div className="tp-d1">{dateLabel}</div>
            <div className="tp-d2">{dayLabel}</div>
            <div className="tp-d3">{timeLabel}</div>
          </div>
        </button>

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

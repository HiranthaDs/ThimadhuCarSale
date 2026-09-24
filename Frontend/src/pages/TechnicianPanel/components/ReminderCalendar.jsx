import { useMemo, useState } from "react"
import { acknowledgeReminder, createReminder, deleteReminder, updateReminder } from "../../../api/reminders"
import { confirmDialog } from "../../../components/ConfirmDialog"

const MAX_REMARK_WORDS = 50
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function toKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function wordCount(text) {
  const trimmed = (text || "").trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

// Reminder dates carry no time of day (just a calendar date), so "within 24
// hours" is treated as: due today, or due tomorrow.
export function daysUntil(dateKey, now = new Date()) {
  const [y, m, d] = dateKey.split("-").map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86400000)
}

// A reminder still counts as urgent (and drives the siren glow) unless
// someone has hit its green "OK" button.
export function hasUrgentReminder(reminders, now = new Date()) {
  return reminders.some((r) => {
    if (r.acknowledged) return false
    const days = daysUntil(r.remind_date, now)
    return days >= 0 && days <= 1
  })
}

function ReminderForm({ initial, dateKey, onCancel, onSaved, token }) {
  const [title, setTitle] = useState(initial?.title || "")
  const [remark, setRemark] = useState(initial?.remark || "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const words = wordCount(remark)
  const wordsOk = words >= 1 && words <= MAX_REMARK_WORDS

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) {
      setError("Title is required.")
      return
    }
    if (words === 0) {
      setError("Remark is required.")
      return
    }
    if (words > MAX_REMARK_WORDS) {
      setError(`Remark must be at most ${MAX_REMARK_WORDS} words (currently ${words}).`)
      return
    }
    setError("")
    setSaving(true)
    try {
      const payload = { remind_date: dateKey, title: title.trim(), remark: remark.trim() }
      const saved = initial ? await updateReminder(token, initial.id, payload) : await createReminder(token, payload)
      onSaved(saved)
    } catch (err) {
      setError(err.message || "Could not save reminder.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="rc-form" onSubmit={handleSubmit}>
      <label className="rc-field">
        <span>Title</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Inspect CBE-1245" />
      </label>
      <label className="rc-field">
        <span>
          Remark <small className={`rc-word-count${wordsOk ? " rc-word-count-ok" : ""}`}>({words}/{MAX_REMARK_WORDS} words max)</small>
        </span>
        <textarea
          rows={5}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Describe what needs to be done, up to 50 words…"
        />
      </label>
      {error && <div className="tp-form-error">{error}</div>}
      <div className="rc-form-actions">
        <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="tp-form-btn tp-form-btn-primary" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save Changes" : "Add Reminder"}
        </button>
      </div>
    </form>
  )
}

// Slides in from the right edge of the screen, next to the calendar button in
// the Hero. `visible` toggles the open/closed transform (mount/unmount timing
// with the transition is owned by the parent, so the collapse animation can
// play before the panel is removed from the DOM).
export default function ReminderCalendar({ token, reminders, visible, onReminderChanged, onClose }) {
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedKey, setSelectedKey] = useState(() => toKey(new Date()))
  const [mode, setMode] = useState(null) // null | "add" | { editing: reminder }
  const [ackingId, setAckingId] = useState(null)

  const byDate = useMemo(() => {
    const map = new Map()
    reminders.forEach((r) => {
      if (!map.has(r.remind_date)) map.set(r.remind_date, [])
      map.get(r.remind_date).push(r)
    })
    return map
  }, [reminders])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = toKey(new Date())

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))

  const selectedReminders = byDate.get(selectedKey) || []

  function selectDay(date) {
    setSelectedKey(toKey(date))
    setMode(null)
  }

  function handleSaved(saved) {
    onReminderChanged(saved)
    setMode(null)
  }

  async function handleAcknowledge(reminder) {
    setAckingId(reminder.id)
    try {
      onReminderChanged(await acknowledgeReminder(token, reminder.id))
    } finally {
      setAckingId(null)
    }
  }

  async function handleDelete(reminder) {
    const confirmed = await confirmDialog({
      title: "Delete reminder?",
      message: reminder.title,
      confirmLabel: "Delete",
      danger: true,
    })
    if (!confirmed) return
    await deleteReminder(token, reminder.id)
    onReminderChanged({ id: reminder.id, _deleted: true })
  }

  return (
    <div className={`rc-panel${visible ? " rc-panel-visible" : ""}`}>
      <div className="rc-panel-head">
        <span className="rc-panel-title">Reminders</span>
        <button type="button" className="tp-form-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="rc-grid-pane">
        <div className="rc-month-head">
          <button type="button" className="rc-nav-btn" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month">
            ‹
          </button>
          <span className="rc-month-label">{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
          <button type="button" className="rc-nav-btn" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month">
            ›
          </button>
        </div>

        <div className="rc-weekdays">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div className="rc-days">
          {cells.map((date, i) => {
            if (!date) return <span key={`blank-${i}`} className="rc-day rc-day-blank" />
            const key = toKey(date)
            const count = (byDate.get(key) || []).length
            const urgent = hasUrgentReminder(byDate.get(key) || [])
            return (
              <button
                type="button"
                key={key}
                className={`rc-day${key === selectedKey ? " rc-day-selected" : ""}${key === todayKey ? " rc-day-today" : ""}${urgent ? " rc-day-urgent" : ""}`}
                onClick={() => selectDay(date)}
              >
                {date.getDate()}
                {count > 0 && <span className="rc-day-dot" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rc-detail-pane">
        <div className="rc-detail-head">
          <span>{new Date(`${selectedKey}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
        </div>

        {mode === "add" || mode?.editing ? (
          <ReminderForm
            token={token}
            dateKey={selectedKey}
            initial={mode?.editing}
            onCancel={() => setMode(null)}
            onSaved={handleSaved}
          />
        ) : (
          <>
            {selectedReminders.length === 0 ? (
              <p className="tp-muted rc-empty">No reminders for this day.</p>
            ) : (
              <ul className="rc-reminder-list">
                {selectedReminders.map((r) => {
                  const days = daysUntil(r.remind_date)
                  const dueSoon = days >= 0 && days <= 1
                  return (
                    <li key={r.id} className="rc-reminder-item">
                      <div className="rc-reminder-item-head">
                        <span className="rc-reminder-title">{r.title}</span>
                        {dueSoon && (r.acknowledged ? (
                          <span className="rc-ack-tag">Glow stopped</span>
                        ) : (
                          <span className="rc-urgent-tag">Due soon</span>
                        ))}
                      </div>
                      <p className="rc-reminder-remark">{r.remark}</p>
                      {dueSoon && !r.acknowledged && (
                        <button
                          type="button"
                          className="rc-ack-btn"
                          disabled={ackingId === r.id}
                          onClick={() => handleAcknowledge(r)}
                          title="Stop the calendar from glowing for this reminder"
                        >
                          {ackingId === r.id ? "Saving…" : "✓ OK, stop glowing"}
                        </button>
                      )}
                      <div className="rc-reminder-actions">
                        <button type="button" className="tp-reports-btn" onClick={() => setMode({ editing: r })}>
                          Edit
                        </button>
                        <button type="button" className="tp-reports-btn tp-reports-btn-danger" onClick={() => handleDelete(r)}>
                          Delete
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <button type="button" className="tp-form-btn tp-form-btn-primary rc-add-btn" onClick={() => setMode("add")}>
              + Add Reminder
            </button>
          </>
        )}
      </div>
    </div>
  )
}

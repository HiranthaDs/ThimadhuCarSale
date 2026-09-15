import { useEffect, useState } from "react"
import { CalendarIcon, BrandMark } from "../Icons"

function greetingForHour(hour) {
  if (hour < 12) return "Good Morning,"
  if (hour < 17) return "Good Afternoon,"
  return "Good Evening,"
}

export default function Hero({ name = "Admin", desc = "Here's what's happening with your dealership today." }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dateLabel = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const dayLabel = now.toLocaleDateString("en-US", { weekday: "long" })
  const timeLabel = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })

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

      <div className="tp-hero-date">
        <CalendarIcon />
        <div>
          <div className="tp-d1">{dateLabel}</div>
          <div className="tp-d2">{dayLabel}</div>
          <div className="tp-d3">{timeLabel}</div>
        </div>
      </div>
    </section>
  )
}

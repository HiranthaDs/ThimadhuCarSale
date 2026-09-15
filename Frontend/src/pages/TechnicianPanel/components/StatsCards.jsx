import { statCards } from "../data"
import { CarIcon, UsersIcon, TagIcon, CalendarIcon } from "../Icons"

const iconMap = { car: CarIcon, users: UsersIcon, tag: TagIcon, cal: CalendarIcon }

export default function StatsCards() {
  return (
    <section className="tp-stats">
      {statCards.map((stat) => {
        const Icon = iconMap[stat.icon]
        return (
          <div className="tp-stat-card" key={stat.label}>
            <div className="tp-stat-top">
              <div className={`tp-stat-icon tp-stat-icon-${stat.tone}`}>
                <Icon />
              </div>
            </div>
            <div className="tp-stat-label">{stat.label}</div>
            <div className="tp-stat-value">{stat.value}</div>
            <div className="tp-stat-change">
              <span className={stat.up ? "tp-up" : "tp-down"}>
                {stat.up ? "↑" : "↓"} {stat.change}
              </span>
              <span className="tp-vs">vs. last month</span>
            </div>
          </div>
        )
      })}
    </section>
  )
}

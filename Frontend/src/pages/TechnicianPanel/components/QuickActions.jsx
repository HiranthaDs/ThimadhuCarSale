import { CarIcon, CustomersIcon, TagIcon, CalendarIcon } from "../Icons"

const actions = [
  { label: "Add New Car", icon: CarIcon, primary: true },
  { label: "Add Customer", icon: CustomersIcon },
  { label: "Record Sale", icon: TagIcon },
  { label: "Book Appointment", icon: CalendarIcon },
]

export default function QuickActions({ onAction }) {
  return (
    <div className="tp-card">
      <div className="tp-card-head">
        <div className="tp-card-title">Quick Actions</div>
      </div>
      <div className="tp-qa-grid">
        {actions.map(({ label, icon: Icon, primary }) => (
          <button
            key={label}
            type="button"
            className={`tp-qa-btn${primary ? " tp-qa-btn-primary" : ""}`}
            onClick={() => onAction?.(label)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

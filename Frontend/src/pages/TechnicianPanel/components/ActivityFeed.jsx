import { activities } from "../data"
import { activityIcon } from "../Icons"

export default function ActivityFeed() {
  return (
    <div className="tp-card">
      <div className="tp-card-head">
        <div className="tp-card-title">Recent Activity</div>
        <a className="tp-link-all" href="#">
          View All
        </a>
      </div>
      <div className="tp-activity-list">
        {activities.map((activity, i) => {
          const Icon = activityIcon[activity.type]
          return (
            <div className="tp-activity-row" key={i}>
              <div className={`tp-act-icon tp-act-icon-${activity.icon}`}>
                <Icon />
              </div>
              <div className="tp-act-body">
                <div className="tp-act-title-row">
                  <span className="tp-act-title">{activity.title}</span>
                  <span className="tp-act-time">{activity.time}</span>
                </div>
                <div className="tp-act-sub">{activity.sub}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

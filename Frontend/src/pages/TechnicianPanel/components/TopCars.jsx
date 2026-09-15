import { topCars } from "../data"

const maxSold = Math.max(...topCars.map((c) => c.sold))

export default function TopCars() {
  return (
    <div className="tp-card">
      <div className="tp-card-head">
        <div className="tp-card-title">Top Selling Cars</div>
        <a className="tp-link-all" href="#">
          View All
        </a>
      </div>
      <div className="tp-top-cars">
        {topCars.map((car, i) => (
          <div className="tp-car-row" key={car.name}>
            <div className="tp-car-rank">{i + 1}</div>
            <img className="tp-car-thumb" src={car.img} alt={car.name} />
            <div className="tp-car-info">
              <div className="tp-car-info-top">
                <span className="tp-car-name">{car.name}</span>
                <span className="tp-car-sold">{car.sold} sold</span>
              </div>
              <div className="tp-progress-track">
                <div className="tp-progress-fill" style={{ width: `${Math.round((car.sold / maxSold) * 100)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

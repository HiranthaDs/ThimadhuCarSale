import { recentSales } from "../data"

export default function RecentSales() {
  return (
    <div className="tp-card">
      <div className="tp-card-head">
        <div className="tp-card-title">Recent Sales</div>
        <a className="tp-link-all" href="#">
          View All
        </a>
      </div>
      <table className="tp-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Customer</th>
            <th>Car</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {recentSales.map((sale) => (
            <tr key={sale.id}>
              <td className="tp-muted">{sale.id}</td>
              <td>
                <div className="tp-cust-cell">
                  <img src={sale.img} alt={sale.name} />
                  <span>{sale.name}</span>
                </div>
              </td>
              <td>{sale.car}</td>
              <td className="tp-muted">{sale.date}</td>
              <td className="tp-amount">{sale.amount}</td>
              <td>
                <span className={`tp-status tp-status-${sale.status.toLowerCase()}`}>{sale.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

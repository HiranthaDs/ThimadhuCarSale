import { useEffect, useRef } from "react"
import Chart from "chart.js/auto"
import { donutData } from "../data"

export default function InventoryDonut() {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d")
    chartRef.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: donutData.labels,
        datasets: [
          {
            data: donutData.values,
            backgroundColor: donutData.colors,
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
      },
    })

    return () => chartRef.current?.destroy()
  }, [])

  return (
    <div className="tp-card tp-donut-wrap">
      <div className="tp-card-head tp-card-head-full">
        <div className="tp-card-title">Inventory by Type</div>
      </div>
      <div className="tp-donut-canvas-box">
        <canvas ref={canvasRef} />
        <div className="tp-donut-center">
          <div className="tp-num">248</div>
          <div className="tp-lbl">Total Cars</div>
        </div>
      </div>
      <div className="tp-legend">
        {donutData.labels.map((label, i) => (
          <div className="tp-legend-row" key={label}>
            <span className="tp-dot" style={{ background: donutData.colors[i] }} />
            <span className="tp-legend-name">{label}</span>
            <span className="tp-pct">{donutData.values[i]}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

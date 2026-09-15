import { useEffect, useRef } from "react"
import Chart from "chart.js/auto"
import { salesLabels, salesData } from "../data"
import { ChevronIcon } from "../Icons"

export default function SalesChart() {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d")
    const gradient = ctx.createLinearGradient(0, 0, 0, 230)
    gradient.addColorStop(0, "rgba(232,52,44,0.28)")
    gradient.addColorStop(1, "rgba(232,52,44,0)")

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: salesLabels,
        datasets: [
          {
            data: salesData,
            borderColor: "#e8342c",
            backgroundColor: gradient,
            borderWidth: 2.5,
            pointBackgroundColor: "#e8342c",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#141c2e",
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 11 },
            bodyFont: { size: 12, weight: "600" },
            callbacks: { label: (c) => "$" + c.parsed.y.toLocaleString() },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 40000,
            ticks: {
              stepSize: 10000,
              callback: (v) => (v === 0 ? "0" : v / 1000 + "K"),
              color: "#9aa1ae",
              font: { size: 11 },
            },
            grid: { color: "#f0f1f5" },
            border: { display: false },
          },
          x: {
            ticks: { color: "#9aa1ae", font: { size: 11 } },
            grid: { display: false },
            border: { display: false },
          },
        },
      },
    })

    return () => chartRef.current?.destroy()
  }, [])

  return (
    <div className="tp-card">
      <div className="tp-card-head">
        <div className="tp-card-title">Sales Overview</div>
        <div className="tp-dropdown">
          Last 7 Days
          <ChevronIcon />
        </div>
      </div>
      <div className="tp-chart-wrap">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

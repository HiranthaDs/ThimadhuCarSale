import { SECTIONS } from "./inspectionSchema"
import { BrandMark } from "../Icons"

function FieldValue({ field, value }) {
  if (field.type === "photo") {
    if (!value) return <span className="ir-empty">—</span>
    if (typeof value === "string" && value.startsWith("data:application/pdf")) {
      return <a href={value} target="_blank" rel="noreferrer">Click to Download</a>
    }
    return <img className="ir-photo" src={value} alt={field.label} />
  }
  if (field.type === "multiphoto") {
    if (!Array.isArray(value) || value.length === 0) return <span className="ir-empty">—</span>
    return (
      <div className="ir-photo-grid">
        {value.map((src, i) => (
          <img key={i} className="ir-photo" src={src} alt={`${field.label} ${i + 1}`} />
        ))}
      </div>
    )
  }
  if (!value) return <span className="ir-empty">—</span>
  return <span>{value}</span>
}

export default function InspectionReport({ data, vehicleTitle, onClose, onPrint }) {
  const today = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="ir-overlay">
      <div className="ir-toolbar no-print">
        <button type="button" className="tp-form-btn tp-form-btn-secondary" onClick={onClose}>
          Back to Editing
        </button>
        <button type="button" className="tp-form-btn tp-form-btn-primary" onClick={onPrint}>
          Print / Save as PDF
        </button>
      </div>

      <div className="ir-page">
        <header className="ir-header">
          <BrandMark iconSize={46} />
          <div className="ir-header-meta">
            <div>Date Submitted: {today}</div>
            <div>Thimadhu Automobile Private Limited</div>
          </div>
        </header>

        <h1 className="ir-title">
          Thimadhu Vehicle Inspection Report{vehicleTitle ? ` — ${vehicleTitle}` : ""}
        </h1>

        {SECTIONS.map((section) => (
          <section className="ir-section" key={section.title}>
            <h2 className="ir-section-title">{section.title}</h2>
            <table className="ir-table">
              <tbody>
                {section.fields.map((field) => (
                  <tr key={field.key}>
                    <th>{field.label}</th>
                    <td>
                      <FieldValue field={field} value={data[field.key]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <section className="ir-section">
          <h2 className="ir-section-title">Legal</h2>
          <p className="ir-legal">
            The above report is offered on behalf of Thimadhu Automobile Private Limited, following a detailed
            visual inspection of the structural integrity of the vehicle. The visual inspection is carried out
            without dissembling or dismantling any parts of the vehicle. Information such as verification of the
            registration, police, insurance, maintenance records of the respective vehicle or other private and
            public records, information and data have not been assessed by Thimadhu. The information and
            recommendations provided by us do not amount to approval or acceptance of the concerning matter. The
            validity of this certificate is only at the time, date, mileage and place of inspection as stated
            above.
          </p>
          <p className="ir-legal">I certify that all the categories in the report have been inspected.</p>
        </section>

        <footer className="ir-footer">
          <span>Buy used vehicles with confidence.</span>
          <span>Thimadhu Vehicle Inspection Report</span>
        </footer>
      </div>
    </div>
  )
}

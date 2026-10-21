import { InventoryFeatureIcon, CustomersFeatureIcon, WrenchIcon } from "./icons"
import vehicle from "../../assets/thimadu-sedan-login.webp"
import "./BrandingPanel.css"

const features = [
  { icon: InventoryFeatureIcon, text: "Vehicle Inventory" },
  { icon: CustomersFeatureIcon, text: "Customer Management" },
  { icon: WrenchIcon, text: "Service & Inspections" },
]

export default function BrandingPanel() {
  return (
    <section className="lg-branding" aria-label="Thimadu Auto Trading">
      <div className="lg-brand-curves" aria-hidden="true">
        <i className="lg-ribbon-top" /><i className="lg-ribbon-bottom" />
        <i className="lg-flow-line lg-flow-line-one" /><i className="lg-flow-line lg-flow-line-two" />
      </div>
      <div className="lg-brand-identity">
        <img className="lg-official-logo" src="/favicon.png" alt="Thimadu Auto Trading" fetchPriority="high" />
        <p className="lg-brand-tagline">DRIVEN BY TRUST<span>POWERED FOR TOMORROW</span></p>
      </div>
      <div className="lg-vehicle-scene" aria-hidden="true">
        <img src={vehicle} alt="" decoding="async" />
        <div className="lg-vehicle-light" />
      </div>
      <div className="lg-brand-bottom">
        <ul className="lg-brand-features">
          {features.map(({ icon: Icon, text }) => <li key={text}>
            <span className="lg-feature-symbol" aria-hidden="true"><Icon /></span>
            <span>{text}</span>
          </li>)}
        </ul>
        <p className="lg-brand-statement">YOUR DEALERSHIP. ONE CONNECTED WORKSPACE.</p>
      </div>
    </section>
  )
}


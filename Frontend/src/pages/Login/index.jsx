import { useState } from "react"
import {
  CarIcon,
  InventoryFeatureIcon,
  CustomersFeatureIcon,
  WrenchIcon,
  UsersIcon,
  StaffIcon,
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
  ShieldIcon,
} from "./icons"
import { login } from "../../api/auth"
import "./Login.css"

const roles = [
  { key: "owner", label: "Owner", icon: UsersIcon },
  { key: "staff", label: "Staff", icon: StaffIcon },
  { key: "technician", label: "Technician", icon: WrenchIcon },
]

export default function Login({ onLogin }) {
  const [role, setRole] = useState("owner")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    const form = new FormData(e.target)
    const email = form.get("email")
    const password = form.get("password")
    if (!email || !password) return

    setLoading(true)
    try {
      const { access_token: token, user } = await login(email, password)
      if (user.role !== role) {
        setError(`This account is registered as "${user.role}", not "${role}". Logging you in to the correct portal.`)
      }
      onLogin({ role: user.role, username: user.email, fullName: user.full_name, token })
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="lg-screen">
      <div className="lg-hero-bg" />
      <div className="lg-hero-overlay" />
      <div className="lg-hero-glow" />

      <div className="lg-hero-content">
        <div className="lg-brand">
          <CarIcon className="lg-brand-icon" />
          <div className="lg-brand-text">
            <div className="lg-brand-name">
              Auto<span>Mart</span>
            </div>
            <div className="lg-brand-tag">Drive Your Success</div>
          </div>
        </div>

        <div className="lg-signage">
          Premium Cars
          <br />
          Better Journeys
          <div className="lg-signage-bar" />
        </div>

        <div className="lg-hero-main">
          <div className="lg-eyebrow">WELCOME BACK</div>
          <h1 className="lg-hero-title">
            Manage, Sell, Grow
            <br />
            Together
          </h1>
          <p className="lg-hero-desc">
            Your all-in-one platform to manage inventory, customers, service requests and more — all in one place.
          </p>
        </div>

        <div className="lg-features">
          <div className="lg-feature">
            <div className="lg-feature-icon">
              <InventoryFeatureIcon />
            </div>
            <div className="lg-feature-title">Manage Inventory</div>
            <div className="lg-feature-desc">Keep track of all vehicles in your stock.</div>
          </div>
          <div className="lg-feature">
            <div className="lg-feature-icon">
              <CustomersFeatureIcon />
            </div>
            <div className="lg-feature-title">Serve Customers</div>
            <div className="lg-feature-desc">Deliver a seamless buying experience.</div>
          </div>
          <div className="lg-feature">
            <div className="lg-feature-icon">
              <WrenchIcon />
            </div>
            <div className="lg-feature-title">Streamline Service</div>
            <div className="lg-feature-desc">Keep your cars in top condition.</div>
          </div>
        </div>
      </div>

      <div className="lg-panel-wrap">
        <div className="lg-panel-top">
          <div>
            <div className="lg-eyebrow-mission">
              <b>Different Roles</b> . Same Mission
            </div>
            <div className="lg-mission-bar" />
          </div>
        </div>

        <form className="lg-card" onSubmit={handleSubmit}>
          <div className="lg-card-brand">
            <CarIcon className="lg-card-brand-icon" />
            <div className="lg-card-brand-text">
              <div className="lg-brand-name">
                Auto<span>Mart</span>
              </div>
              <div className="lg-brand-tag">Drive Your Success</div>
            </div>
          </div>

          <div className="lg-welcome-title">Welcome Back!</div>
          <div className="lg-welcome-sub">Sign in to your account to continue</div>

          <span className="lg-field-label">Select Your Role</span>
          <div className="lg-role-group">
            {roles.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`lg-role-btn${role === key ? " lg-role-btn-active" : ""}`}
                onClick={() => setRole(key)}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>

          <div className="lg-input-group">
            <span className="lg-field-label">Email Address</span>
            <div className="lg-input-wrap">
              <MailIcon />
              <input name="email" type="email" placeholder="Enter your email" required />
            </div>
          </div>

          <div className="lg-input-group">
            <span className="lg-field-label">Password</span>
            <div className="lg-input-wrap">
              <LockIcon />
              <input name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" required />
              <button
                type="button"
                className="lg-eye-btn"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="lg-row-between">
            <label className="lg-remember">
              <input type="checkbox" /> Remember me
            </label>
            <a className="lg-forgot" href="#">
              Forgot password?
            </a>
          </div>

          {error && <div className="lg-error">{error}</div>}

          <button type="submit" className="lg-login-btn" disabled={loading}>
            {loading ? "Signing in…" : "Login"}
            <ArrowRightIcon />
          </button>

          <hr className="lg-divider" />
          <div className="lg-secure">
            <ShieldIcon />
            Secure Login
          </div>
        </form>
      </div>
    </div>
  )
}

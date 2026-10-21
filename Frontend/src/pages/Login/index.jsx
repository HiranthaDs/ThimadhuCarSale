import { useState } from "react"
import { WrenchIcon, UsersIcon, StaffIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, ArrowRightIcon, ShieldIcon } from "./icons"
import PasswordReset from "../../components/PasswordReset"
import { login } from "../../api/auth"
import BrandingPanel from "./BrandingPanel"
import "./Login.css"

const roles = [
  { key: "owner", label: "Owner", icon: UsersIcon },
  { key: "ceo", label: "CEO", icon: StaffIcon },
  { key: "admin", label: "Admin", icon: ShieldIcon },
  { key: "accountant", label: "Accountant", icon: CalculatorIcon },
  { key: "technician", label: "Technician", icon: WrenchIcon },
]

function CalculatorIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="3" /><path d="M8 6h8M8 11h1m6 0h1m-8 4h1m6 0h1m-8 4h1m6 0h1" /></svg>
}

export default function Login({ onLogin }) {
  const [resetting, setResetting] = useState(false)
  const [email, setEmail] = useState("")
  const [resetSuccess, setResetSuccess] = useState("")
  const [role, setRole] = useState("owner")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading) return
    setError("")
    const form = new FormData(event.currentTarget)
    setLoading(true)
    try {
      const { user } = await login(form.get("email"), form.get("password"))
      // The authenticated account determines permissions and its destination.
      onLogin(user)
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="lg-screen">
      <div className="lg-shell">
        <BrandingPanel />

        <section className="lg-panel-wrap" aria-label="Account access">
          <div className="lg-panel-top"><span className="lg-access-badge" aria-label="Authorized personnel only. Sign in to verify access."><span aria-hidden="true" /> Authorized Access</span></div>
          {resetting ? (
            <div className="lg-card lg-reset-card">
              <PasswordReset initialEmail={email} onCancel={() => setResetting(false)} onSuccess={(message) => {
                setResetting(false)
                setError("")
                setResetSuccess(message)
              }} />
            </div>
          ) : (
            <form className="lg-card" onSubmit={handleSubmit} aria-labelledby="lg-welcome" aria-busy={loading}>
              <div className="lg-form-eyebrow">WELCOME BACK</div>
              <h2 id="lg-welcome">Sign in to your<br />workspace<span>.</span></h2>
              <p className="lg-welcome-sub">Access your Thimadu Auto Trading account and continue managing your dealership.</p>

              <div className="lg-input-group">
                <label className="lg-field-label" htmlFor="login-email">Email address</label>
                <div className="lg-input-wrap"><MailIcon /><input id="login-email" name="email" type="email" autoComplete="username" placeholder="you@thimadu.com" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} /></div>
              </div>
              <div className="lg-input-group">
                <div className="lg-label-row"><label className="lg-field-label" htmlFor="login-password">Password</label><button className="lg-forgot" type="button" disabled={loading} onClick={() => { setResetSuccess(""); setResetting(true) }}>Forgot password?</button></div>
                <div className="lg-input-wrap"><LockIcon /><input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required disabled={loading} /><button type="button" className="lg-eye-btn" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button></div>
              </div>
              {resetSuccess && <div className="password-reset-message" role="status">{resetSuccess}</div>}
              {error && <div className="lg-error" role="alert">{error}</div>}
              <button type="submit" className="lg-login-btn" disabled={loading}>{loading ? <><span className="lg-spinner" /> Signing in...</> : <>Sign in as {roles.find((item) => item.key === role).label}<ArrowRightIcon /></>}</button>
              <fieldset className="lg-role-fieldset" disabled={loading}>
                <legend className="lg-role-legend">CHOOSE YOUR ROLE</legend>
                <div className="lg-role-group">
                  {roles.map(({ key, label, icon: Icon }) => (
                    <label key={key} className={`lg-role-btn${role === key ? " lg-role-btn-active" : ""}`}>
                      <input type="radio" name="role" value={key} checked={role === key} onChange={() => setRole(key)} />
                      <Icon /><span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="lg-secure"><LockIcon /><span>Secure access to your team's workspace</span></div>
            </form>
          )}
          <footer className="lg-panel-footer"><span>Thimadu Auto Trading</span><span>Built for the road ahead.</span></footer>
        </section>
      </div>
    </main>
  )
}

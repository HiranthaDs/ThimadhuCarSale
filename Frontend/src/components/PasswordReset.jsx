import { useEffect, useState } from "react"
import { requestPasswordOtp, resetPasswordWithOtp } from "../api/auth"
import "./PasswordReset.css"

export default function PasswordReset({ token, initialEmail = "", onCancel, onSuccess }) {
  const [email, setEmail] = useState(initialEmail)
  const [sent, setSent] = useState(false)
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [retryAt, setRetryAt] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [retryAt])

  async function sendCode(event) {
    event?.preventDefault()
    if (busy || remaining > 0) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const result = await requestPasswordOtp({ token, email })
      setSent(true)
      setOtp("")
      setRetryAt(Date.now() + result.resend_after_seconds * 1000)
      setMessage(result.message + " Codes expire after " + Math.ceil(result.expires_in_seconds / 60) + " minutes.")
    } catch (err) {
      setError(err.message || "Could not send a code.")
    } finally {
      setBusy(false)
    }
  }

  async function submitReset(event) {
    event.preventDefault()
    if (busy) return
    setError("")
    if (!/^[0-9]{6}$/.test(otp)) {
      setError("Enter the six-digit code from your email.")
      return
    }
    if (newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72 ||
        !/\p{L}/u.test(newPassword) || !/\p{N}/u.test(newPassword)) {
      setError("Use at least 8 characters with a letter and a number, up to 72 bytes.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.")
      return
    }
    setBusy(true)
    try {
      const result = await resetPasswordWithOtp({ token, email, otp, newPassword })
      setMessage(result.message)
      setOtp("")
      setNewPassword("")
      setConfirmPassword("")
      setDone(true)
    } catch (err) {
      setError(err.message || "Could not reset your password.")
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return <div className="password-reset">
      <h2>Password updated</h2>
      <p role="status">{message}</p>
      <button type="button" className="password-reset-primary" onClick={() => onSuccess(message)}>Back to login</button>
    </div>
  }

  return (
    <div className="password-reset">
      <h2>{token ? "Forgot current password?" : "Reset your password"}</h2>
      <p>{token
        ? "Send a verification code to your account email to set a new password."
        : "Enter your account email to receive a verification code."}</p>
      <form onSubmit={sent ? submitReset : sendCode}>
        {!token && <label>
          Email address
          <input type="email" autoComplete="email" required value={email} readOnly={sent}
            disabled={busy} onChange={(event) => setEmail(event.target.value)} />
        </label>}
        {message && <div className="password-reset-message" role="status">{message}</div>}
        {sent && <>
          <label>
            Verification code
            <input type="text" inputMode="numeric" autoComplete="one-time-code"
              pattern="[0-9]{6}" maxLength={6} required value={otp} disabled={busy}
              placeholder="6-digit code" onChange={(event) => setOtp(event.target.value.replace(/[^0-9]/g, ""))} />
          </label>
          <label>
            New password
            <input type="password" autoComplete="new-password" minLength={8} maxLength={72}
              required value={newPassword} disabled={busy} onChange={(event) => setNewPassword(event.target.value)} />
          </label>
          <small>At least 8 characters, including a letter and a number.</small>
          <label>
            Confirm new password
            <input type="password" autoComplete="new-password" minLength={8} maxLength={72}
              required value={confirmPassword} disabled={busy} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
        </>}
        {error && <div className="password-reset-error" role="alert">{error}</div>}
        <button className="password-reset-primary" type="submit" disabled={busy || (!sent && remaining > 0)}>
          {busy ? "Please wait..." : sent ? "Verify code and update password" :
            remaining > 0 ? "Send code in " + remaining + "s" : "Send verification code"}
        </button>
        {sent && <button type="button" disabled={busy || remaining > 0} onClick={sendCode}>
          {remaining > 0 ? "Resend code in " + remaining + "s" : "Resend code"}
        </button>}
        {sent && <small>Use the latest code. If no email arrives after repeated requests, wait an hour before trying again.</small>}
        {sent && !token && <button type="button" disabled={busy} onClick={() => {
          setSent(false)
          setOtp("")
          setError("")
          setMessage("")
        }}>Use a different email</button>}
        <button type="button" disabled={busy} onClick={onCancel}>
          {token ? "Use current password instead" : "Back to login"}
        </button>
      </form>
    </div>
  )
}

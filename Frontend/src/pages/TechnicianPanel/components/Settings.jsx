import { useState } from "react"
import PasswordReset from "../../../components/PasswordReset"
import { changePassword } from "../../../api/auth"

export default function Settings({ token }) {
  const [resetting, setResetting] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (newPassword.length < 8 || !/\p{L}/u.test(newPassword) || !/\p{N}/u.test(newPassword)) {
      setError("New password must be at least 8 characters and contain letters and numbers.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.")
      return
    }

    setSubmitting(true)
    try {
      await changePassword(token, { currentPassword, newPassword })
      setSuccess("Password updated successfully. Please sign in again.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      setError(err.message || "Could not update password.")
    } finally {
      setSubmitting(false)
    }
  }

  if (resetting) {
    return <div className="tp-card" style={{ maxWidth: 480 }}>
      <PasswordReset token={token} onCancel={() => setResetting(false)}
        onSuccess={() => window.dispatchEvent(new CustomEvent("thimadu:unauthorized"))} />
    </div>
  }

  if (success) {
    return <div className="tp-card" style={{ maxWidth: 480 }}>
      <p role="status">{success}</p>
      <button type="button" className="tp-form-btn tp-form-btn-primary"
        onClick={() => window.dispatchEvent(new CustomEvent("thimadu:unauthorized"))}>Back to login</button>
    </div>
  }

  return (
    <div className="tp-card" style={{ maxWidth: 480 }}>
      <div className="tp-card-head">
        <div className="tp-card-title">Change Password</div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="tp-form-grid" style={{ gridTemplateColumns: "1fr" }}>
          <label className="tp-form-group">
            <span>Current Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <button type="button" className="tp-form-btn" disabled={submitting} onClick={() => {
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
            setError("")
            setSuccess("")
            setResetting(true)
          }}>Forgot current password? Send an email code</button>
          <label className="tp-form-group">
            <span>New Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label className="tp-form-group">
            <span>Confirm New Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
        </div>

        {error && <div className="tp-form-error">{error}</div>}
        {success && <div className="tp-form-success">{success}</div>}

        <div className="tp-form-actions" style={{ gridTemplateColumns: "1fr", marginTop: 15 }}>
          <button type="submit" className="tp-form-btn tp-form-btn-primary" disabled={submitting}>
            {submitting ? "Updating…" : "Update Password"}
          </button>
        </div>
      </form>
    </div>
  )
}

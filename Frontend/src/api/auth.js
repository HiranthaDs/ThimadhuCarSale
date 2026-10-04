import { apiRequest } from "./client"

export function login(email, password) {
  return apiRequest("/auth/login", { method: "POST", body: { email, password } })
}

export function me(token) {
  return apiRequest("/auth/me", { token })
}

export function createUser(token, { email, fullName, password, role }) {
  return apiRequest("/auth/users", {
    method: "POST",
    token,
    body: { email, full_name: fullName, password, role },
  })
}

export function listUsers(token) {
  return apiRequest("/auth/users", { token })
}

export function setUserActive(token, userId, active) {
  return apiRequest(`/auth/users/${userId}/${active ? "activate" : "deactivate"}`, {
    method: "PATCH",
    token,
  })
}

export function deleteUser(token, userId) {
  return apiRequest(`/auth/users/${userId}`, { method: "DELETE", token })
}

export function changePassword(token, { currentPassword, newPassword }) {
  return apiRequest("/auth/change-password", {
    method: "PATCH",
    token,
    body: { current_password: currentPassword, new_password: newPassword },
  })
}


export function requestPasswordOtp({ token, email }) {
  return apiRequest(token ? "/auth/password-otp" : "/auth/forgot-password", {
    method: "POST",
    token,
    body: token ? undefined : { email },
  })
}

export function resetPasswordWithOtp({ token, email, otp, newPassword, challengeId }) {
  return apiRequest(token ? "/auth/change-password-with-otp" : "/auth/reset-password", {
    method: "POST",
    token,
    body: { ...(token ? {} : { email }), otp, challenge_id: challengeId, new_password: newPassword },
  })
}

export function logout() {
  return apiRequest("/auth/logout", { method: "POST" })
}

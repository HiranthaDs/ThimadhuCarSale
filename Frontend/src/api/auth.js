import { advanceAuthEpoch, apiRequest } from "./client"

export async function login(email, password) {
  const result = await apiRequest("/auth/login", { method: "POST", body: { email, password }, notifyOnUnauthorized: false })
  advanceAuthEpoch()
  return result
}

export function me() {
  return apiRequest("/auth/me", { notifyOnUnauthorized: false })
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

export function changeName(token, fullName) {
  return apiRequest("/auth/me/name", {
    method: "PATCH",
    token,
    body: { full_name: fullName },
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

export async function logout() {
  const result = await apiRequest("/auth/logout", { method: "POST" })
  advanceAuthEpoch()
  return result
}

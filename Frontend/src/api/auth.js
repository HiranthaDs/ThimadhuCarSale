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

export function changePassword(token, { currentPassword, newPassword }) {
  return apiRequest("/auth/change-password", {
    method: "PATCH",
    token,
    body: { current_password: currentPassword, new_password: newPassword },
  })
}

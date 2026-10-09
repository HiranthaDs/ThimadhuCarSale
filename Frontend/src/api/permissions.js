import { apiRequest } from "./client"

// Customize needs the owner's password again; the server answers with a
// short-lived pass that every other Customize request must carry.
export function unlockCustomize(password) {
  return apiRequest("/permissions/unlock", { method: "POST", body: { password } })
}

const withPass = (unlockToken) => ({ "X-Customize-Unlock": unlockToken })

export function getAccessOverview(unlockToken) {
  return apiRequest("/permissions/", { headers: withPass(unlockToken) })
}

export function updateEmployeeAccess(unlockToken, userId, permissions) {
  return apiRequest(`/permissions/users/${userId}`, {
    method: "PUT",
    headers: withPass(unlockToken),
    body: { permissions },
  })
}

export function resetEmployeeAccess(unlockToken, userId) {
  return apiRequest(`/permissions/users/${userId}`, { method: "DELETE", headers: withPass(unlockToken) })
}

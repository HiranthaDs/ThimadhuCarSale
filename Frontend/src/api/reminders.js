import { apiRequest } from "./client"

export function listReminders(token, start, end) {
  const params = new URLSearchParams()
  if (start) params.set("start", start)
  if (end) params.set("end", end)
  const query = params.toString() ? `?${params.toString()}` : ""
  return apiRequest(`/reminders/${query}`, { token })
}

export function createReminder(token, payload) {
  return apiRequest("/reminders/", { method: "POST", token, body: payload })
}

export function updateReminder(token, id, payload) {
  return apiRequest(`/reminders/${id}`, { method: "PUT", token, body: payload })
}

export function deleteReminder(token, id) {
  return apiRequest(`/reminders/${id}`, { method: "DELETE", token })
}

// The green "OK" button: stop the siren glow for this one reminder.
export function acknowledgeReminder(token, id) {
  return apiRequest(`/reminders/${id}/acknowledge`, { method: "POST", token })
}

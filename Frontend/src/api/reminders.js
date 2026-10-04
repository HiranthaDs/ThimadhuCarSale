import { apiRequest } from "./client"

export async function listReminders(token, start, end) {
  const params = new URLSearchParams()
  if (start) params.set("start", start)
  if (end) params.set("end", end)
  const results = []
  params.set("limit", "500")
  for (let offset = 0; offset <= 100000; offset += 500) {
    params.set("offset", String(offset))
    const batch = await apiRequest(`/reminders/?${params}`, { token })
    results.push(...batch)
    if (batch.length < 500) return results
  }
  throw new Error("Too many reminders. Choose a narrower date range.")
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

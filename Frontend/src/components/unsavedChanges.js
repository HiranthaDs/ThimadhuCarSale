import { useEffect, useId } from "react"
import { confirmDialog } from "./ConfirmDialog"

// Forms that currently hold unsaved entries: id -> what would be lost.
const dirtyForms = new Map()

// Closing or refreshing the browser tab: the browser shows its own "Leave site?" prompt.
window.addEventListener("beforeunload", (e) => {
  if (dirtyForms.size === 0) return
  e.preventDefault()
  e.returnValue = ""
})

// A form calls this with whether it has unsaved entries; leaving the page or
// closing the form then asks first (see confirmDiscard).
export function useUnsavedChanges(isDirty, label) {
  const id = useId()
  useEffect(() => {
    if (!isDirty) return undefined
    dirtyForms.set(id, label)
    return () => { dirtyForms.delete(id) }
  }, [id, isDirty, label])
}

// Resolves true when it's fine to close: nothing is unsaved, or the user chose
// to discard it. Use before anything that would close an open form.
export async function confirmDiscard() {
  if (dirtyForms.size === 0) return true
  const label = [...dirtyForms.values()][0]
  const discard = await confirmDialog({
    title: `Discard this ${label}?`,
    message: "Everything you've entered will be lost.",
    confirmLabel: "Discard",
    cancelLabel: "Keep editing",
    danger: true,
  })
  if (discard) dirtyForms.clear()
  return discard
}

// The form's ✕ button: always asks, even before anything has been entered.
export async function confirmCloseForm(label) {
  const unsaved = dirtyForms.size > 0
  const close = await confirmDialog({
    title: `Close this ${label}?`,
    message: unsaved ? "Everything you've entered will be lost." : "You can open it again at any time.",
    confirmLabel: "Close",
    cancelLabel: "Keep editing",
    danger: unsaved,
  })
  if (close) dirtyForms.clear()
  return close
}

// Logging out: always asks, and warns about unsaved entries in the same popup.
export async function confirmLogout() {
  const unsaved = dirtyForms.size > 0
  const logout = await confirmDialog({
    title: "Are you sure you want to log out?",
    message: unsaved
      ? "You have unsaved entries in an open form. They will be lost."
      : "You'll need to sign in again to continue.",
    confirmLabel: "Log out",
    cancelLabel: "Cancel",
    danger: unsaved,
  })
  if (logout) dirtyForms.clear()
  return logout
}

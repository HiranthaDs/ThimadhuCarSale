let installPrompt = null
const subscribers = new Set()

function notify() {
  subscribers.forEach((subscriber) => subscriber())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPrompt = event
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installPrompt = null
    notify()
  })
}

export function subscribeInstallPrompt(subscriber) {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export function getInstallPrompt() {
  return installPrompt
}

export function clearInstallPrompt() {
  installPrompt = null
  notify()
}

import { useEffect, useState, useSyncExternalStore } from 'react'
import { clearInstallPrompt, getInstallPrompt, subscribeInstallPrompt } from './pwaInstallPrompt'
import './PwaInstallButton.css'

function isMobileDevice() {
  if (navigator.userAgentData?.mobile === true) return true
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

export default function PwaInstallButton() {
  const prompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null)
  const [desktop] = useState(() => !isMobileDevice())
  const [installed, setInstalled] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    const updateInstalled = () => setInstalled(window.matchMedia('(display-mode: standalone)').matches)
    updateInstalled()
    const onInstalled = () => setInstalled(true)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!desktop || installed) return null

  async function install() {
    if (installing) return
    if (!prompt) {
      setHelp(true)
      return
    }
    setHelp(false)
    setInstalling(true)
    try {
      await prompt.prompt()
      await prompt.userChoice
    } catch {
      setHelp(true)
    } finally {
      clearInstallPrompt()
      setInstalling(false)
    }
  }

  return <div className="pwa-install-control">
    <button type="button" className="pwa-install-button" onClick={install} disabled={installing}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" /></svg>
      {installing ? 'Opening installer…' : 'Install desktop app'}
    </button>
    {help && <p role="status">To install, open your browser menu and choose <strong>Install Thimadu</strong> or <strong>Install app</strong>.</p>}
  </div>
}

import { useEffect, useState, useSyncExternalStore } from 'react'
import { clearInstallPrompt, getInstallPrompt, subscribeInstallPrompt } from './pwaInstallPrompt'
import './PwaInstallButton.css'

function isMobileDevice() {
  if (navigator.userAgentData?.mobile === true) return true
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

function isAppleMobileDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function installHelp() {
  if (isAppleMobileDevice()) return <>On iPhone or iPad, open this site in Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</>
  if (/Macintosh/i.test(navigator.userAgent) && /Safari/i.test(navigator.userAgent) &&
      !/Chrome|Chromium|Edg|OPR/i.test(navigator.userAgent)) {
    return <>In Safari, choose <strong>File</strong> then <strong>Add to Dock</strong>.</>
  }
  return <>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</>
}

export default function PwaInstallButton() {
  const prompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null)
  const mobile = isMobileDevice()
  const [installed, setInstalled] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    const updateInstalled = () => setInstalled(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)
    updateInstalled()
    const onInstalled = () => setInstalled(true)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (installing || installed) return
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
    <button type="button" className={`pwa-install-button${installed ? ' pwa-install-button-installed' : ''}`} onClick={install} disabled={installing || installed}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" /></svg>
      {installed ? 'App installed' : installing ? 'Opening installer…' : mobile ? 'Install app' : 'Install desktop app'}
    </button>
    {help && <p role="status">{installHelp()}</p>}
  </div>
}

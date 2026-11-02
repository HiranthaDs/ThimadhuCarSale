import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { confirmDiscard } from './unsavedChanges'
import './PwaUpdate.css'

export default function PwaUpdate() {
  const registration = useRef(null)
  const [updating, setUpdating] = useState(false)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, activeRegistration) {
      registration.current = activeRegistration
    },
  })

  useEffect(() => {
    const checkForUpdate = () => {
      if (document.visibilityState !== 'visible') return
      if (registration.current?.waiting) {
        setNeedRefresh(true)
        return
      }
      if (navigator.onLine) registration.current?.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', checkForUpdate)
    window.addEventListener('online', checkForUpdate)
    const interval = window.setInterval(checkForUpdate, 60 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', checkForUpdate)
      window.removeEventListener('online', checkForUpdate)
      window.clearInterval(interval)
    }
  }, [])

  async function installUpdate() {
    if (updating || !(await confirmDiscard())) return
    setUpdating(true)
    try {
      await updateServiceWorker(true)
    } finally {
      setUpdating(false)
    }
  }

  if (!needRefresh) return null

  return <div className="pwa-update" role="status">
    <span>A new version is ready.</span>
    <button type="button" onClick={installUpdate} disabled={updating}>
      {updating ? 'Updating…' : 'Update now'}
    </button>
    <button type="button" className="pwa-update-later" onClick={() => setNeedRefresh(false)} disabled={updating}>
      Later
    </button>
  </div>
}

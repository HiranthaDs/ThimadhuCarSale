import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { confirmDiscard, hasUnsavedChanges } from './unsavedChanges'
import './PwaUpdate.css'

export default function PwaUpdate() {
  const registration = useRef(null)
  const swUrl = useRef(null)
  const updateInProgress = useRef(false)
  const [hasUnsaved, setHasUnsaved] = useState(hasUnsavedChanges)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState(false)
  const [retry, setRetry] = useState(0)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url, activeRegistration) {
      swUrl.current = url
      registration.current = activeRegistration
      if (navigator.onLine) activeRegistration?.update().catch(() => {})
    },
  })

  useEffect(() => {
    const syncUnsaved = () => setHasUnsaved(hasUnsavedChanges())
    window.addEventListener('thimadu:unsaved-changes', syncUnsaved)
    return () => window.removeEventListener('thimadu:unsaved-changes', syncUnsaved)
  }, [])

  useEffect(() => {
    const checkForUpdate = async () => {
      if (document.visibilityState !== 'visible') return
      const activeRegistration = registration.current
      if (activeRegistration?.waiting) {
        setNeedRefresh(true)
        return
      }
      if (!navigator.onLine || !activeRegistration || activeRegistration.installing) return
      try {
        const response = await fetch(swUrl.current || '/sw.js', { cache: 'no-store' })
        if (response.ok) await activeRegistration.update()
      } catch { /* Keep the installed app usable while offline. */ }
    }
    document.addEventListener('visibilitychange', checkForUpdate)
    window.addEventListener('online', checkForUpdate)
    window.addEventListener('pageshow', checkForUpdate)
    const interval = window.setInterval(checkForUpdate, 6 * 60 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', checkForUpdate)
      window.removeEventListener('online', checkForUpdate)
      window.removeEventListener('pageshow', checkForUpdate)
      window.clearInterval(interval)
    }
  }, [setNeedRefresh])

  useEffect(() => {
    if (!needRefresh || hasUnsaved || updateInProgress.current) return
    updateInProgress.current = true
    setUpdating(true)
    setUpdateError(false)
    updateServiceWorker(true).then(() => {
      setNeedRefresh(false)
    }).catch(() => {
      setUpdateError(true)
    }).finally(() => {
      updateInProgress.current = false
      setUpdating(false)
    })
  }, [needRefresh, hasUnsaved, retry, setNeedRefresh, updateServiceWorker])

  async function installUpdate() {
    if (updating) return
    if (hasUnsavedChanges()) {
      await confirmDiscard()
      return
    }
    setRetry((previous) => previous + 1)
  }

  if (!needRefresh && !updateError) return null

  return <div className="pwa-update" role="status">
    <span>{updateError ? 'The update could not be installed. Try again.'
      : hasUnsaved ? 'A new version is ready. Save your form to update automatically.'
        : 'Installing the latest version…'}</span>
    {(hasUnsaved || updateError) && <button type="button" onClick={installUpdate} disabled={updating}>
      {updating ? 'Updating…' : 'Update now'}
    </button>}
  </div>
}

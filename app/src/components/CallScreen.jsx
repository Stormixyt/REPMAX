import { useEffect, useMemo, useRef, useState } from 'react'
import { RiLoader4Line, RiPhoneFill } from '@remixicon/react'

const JITSI_SCRIPT_ID = 'repmax-jitsi-external-api'
const JITSI_SCRIPT_SRC = 'https://meet.jit.si/external_api.js'

let jitsiScriptPromise = null

function ensureJitsiApi() {
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve(window.JitsiMeetExternalAPI)
  }

  if (jitsiScriptPromise) {
    return jitsiScriptPromise
  }

  jitsiScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(JITSI_SCRIPT_ID)
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.JitsiMeetExternalAPI), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Could not load the call service.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = JITSI_SCRIPT_ID
    script.src = JITSI_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve(window.JitsiMeetExternalAPI)
    script.onerror = () => reject(new Error('Could not load the call service.'))
    document.body.appendChild(script)
  })

  return jitsiScriptPromise
}

export default function CallScreen({ callerName, isVideo, roomName, displayName, onEnd }) {
  const containerRef = useRef(null)
  const apiRef = useRef(null)
  const unmountingRef = useRef(false)
  const closingRef = useRef(false)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const toolbarButtons = useMemo(() => (
    isVideo
      ? ['microphone', 'camera', 'fullscreen', 'hangup', 'settings', 'tileview']
      : ['microphone', 'hangup', 'settings']
  ), [isVideo])

  useEffect(() => {
    let cancelled = false

    function closeLocally() {
      if (closingRef.current || unmountingRef.current) return
      closingRef.current = true
      onEnd?.({ notifyRemote: true })
    }

    async function mountConference() {
      try {
        const JitsiMeetExternalAPI = await ensureJitsiApi()
        if (cancelled || !containerRef.current) return

        const api = new JitsiMeetExternalAPI('meet.jit.si', {
          roomName,
          lang: 'en',
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: {
            displayName: displayName || 'REPMAX User'
          },
          configOverwrite: {
            disableDeepLinking: true,
            enableWelcomePage: false,
            prejoinPageEnabled: false,
            prejoinConfig: {
              enabled: false
            },
            requireDisplayName: false,
            disableInviteFunctions: true,
            startAudioOnly: !isVideo,
            startWithVideoMuted: !isVideo
          },
          interfaceConfigOverwrite: {
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            MOBILE_APP_PROMO: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_JITSI_WATERMARK: false,
            TOOLBAR_BUTTONS: toolbarButtons
          }
        })

        apiRef.current = api
        api.addListener('videoConferenceJoined', () => {
          if (cancelled) return
          setConnected(true)
          setLoading(false)
        })
        api.addListener('participantJoined', () => {
          if (!cancelled) setConnected(true)
        })
        api.addListener('readyToClose', closeLocally)
        api.addListener('videoConferenceLeft', closeLocally)

        setLoading(false)
      } catch (error) {
        console.error('[REPMAX] Failed to mount Jitsi call:', error)
        if (!cancelled) {
          setLoadError(error?.message || 'Could not load the call.')
          setLoading(false)
        }
      }
    }

    mountConference()

    return () => {
      cancelled = true
      unmountingRef.current = true
      try {
        apiRef.current?.dispose()
      } catch {}
      apiRef.current = null
    }
  }, [displayName, isVideo, onEnd, roomName, toolbarButtons])

  function handleHangup() {
    if (closingRef.current) return
    closingRef.current = true

    try {
      apiRef.current?.executeCommand('hangup')
    } catch {}

    onEnd?.({ notifyRemote: true })
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      background: '#070707'
    }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      <div style={{
        position: 'absolute',
        top: 18,
        left: 18,
        right: 18,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        pointerEvents: 'none'
      }}>
        <div style={{
          pointerEvents: 'auto',
          padding: '12px 16px',
          borderRadius: 18,
          background: 'rgba(12,14,18,0.82)',
          border: '1px solid rgba(212,255,0,0.16)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', fontWeight: 700 }}>
            {isVideo ? 'Video Call' : 'Voice Call'}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: 4 }}>
            {callerName || 'Gym Buddy'}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {loadError ? loadError : connected ? 'Connected' : loading ? 'Joining call...' : 'Waiting for the other person'}
          </div>
        </div>

        <button
          onClick={handleHangup}
          style={{
            pointerEvents: 'auto',
            width: 54,
            height: 54,
            borderRadius: '50%',
            border: 'none',
            background: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 10px 28px rgba(0,0,0,0.35)'
          }}
        >
          <RiPhoneFill size={26} color="#fff" style={{ transform: 'rotate(135deg)' }} />
        </button>
      </div>

      {loading && !loadError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, rgba(7,7,7,0.72), rgba(7,7,7,0.46))',
          pointerEvents: 'none'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 18px',
            borderRadius: 18,
            background: 'rgba(12,14,18,0.82)',
            border: '1px solid rgba(212,255,0,0.14)',
            color: '#fff',
            fontWeight: 700
          }}>
            <RiLoader4Line size={20} style={{ animation: 'spin 1s linear infinite' }} />
            Joining call...
          </div>
        </div>
      )}
    </div>
  )
}

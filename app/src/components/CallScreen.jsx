import { useState, useEffect, useRef } from 'react'
import { RiPhoneFill, RiMicFill, RiMicOffFill, RiCameraFill, RiCameraOffFill, RiVolumeMuteFill, RiVolumeUpFill } from '@remixicon/react'
import { endCall, toggleMute, toggleCamera } from '../lib/webrtc'

export default function CallScreen({ callerName, isVideo, localStream, remoteStream, onEnd }) {
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [connected, setConnected] = useState(false)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Detect connection
  useEffect(() => {
    if (remoteStream) setConnected(true)
  }, [remoteStream])

  // Attach streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  function formatTime(sec) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function handleMute() {
    const isMuted = toggleMute()
    setMuted(isMuted)
  }

  function handleCamera() {
    const isOff = toggleCamera()
    setCameraOff(isOff)
  }

  function handleEnd() {
    endCall()
    onEnd?.()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: isVideo ? '#000' : 'linear-gradient(135deg, #0a0a1a, #1a0a2e, #0a1a2e)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.3s ease'
    }}>
      {/* Remote video (fullscreen) */}
      {isVideo && remoteStream && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover'
          }}
        />
      )}

      {/* Local video (PIP) */}
      {isVideo && localStream && !cameraOff && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute', top: 60, right: 16,
            width: 120, height: 160, borderRadius: 16,
            objectFit: 'cover', zIndex: 2,
            border: '2px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}
        />
      )}

      {/* Audio-only UI */}
      {!isVideo && (
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Animated rings */}
          <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 24px' }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '2px solid rgba(212,255,0,0.1)',
              animation: connected ? 'pulse 2s ease-in-out infinite' : 'none'
            }} />
            <div style={{
              position: 'absolute', inset: 10, borderRadius: '50%',
              border: '2px solid rgba(212,255,0,0.2)',
              animation: connected ? 'pulse 2s ease-in-out infinite 0.5s' : 'none'
            }} />
            <div style={{
              position: 'absolute', inset: 20, borderRadius: '50%',
              background: 'var(--accent-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem'
            }}>
              🏋️
            </div>
          </div>

          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: '1.5rem', color: '#fff', margin: '0 0 4px'
          }}>
            {callerName || 'Gym Buddy'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', margin: 0 }}>
            {connected ? formatTime(elapsed) : 'Connecting...'}
          </p>

          {/* Voice wave animation */}
          {connected && !muted && (
            <div style={{
              display: 'flex', gap: 3, justifyContent: 'center',
              marginTop: 20, height: 30
            }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{
                  width: 4, borderRadius: 2,
                  background: 'var(--accent)', opacity: 0.7,
                  animation: `voiceWave 0.${3 + i}s ease-in-out infinite alternate`
                }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Video overlay info */}
      {isVideo && (
        <div style={{
          position: 'absolute', top: 60, left: 20,
          zIndex: 2, color: '#fff'
        }}>
          <h3 style={{ fontWeight: 700, fontSize: '1.1rem', margin: '0 0 2px', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            {callerName || 'Gym Buddy'}
          </h3>
          <p style={{ fontSize: '0.82rem', opacity: 0.7, margin: 0 }}>
            {connected ? formatTime(elapsed) : 'Connecting...'}
          </p>
        </div>
      )}

      {/* Controls */}
      <div style={{
        position: 'absolute', bottom: 50,
        display: 'flex', gap: 20, zIndex: 3,
        padding: '16px 24px', borderRadius: 24,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)'
      }}>
        <button
          onClick={handleMute}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: muted ? '#f87171' : 'rgba(255,255,255,0.15)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s'
          }}
        >
          {muted ? <RiMicOffFill size={24} color="#fff" /> : <RiMicFill size={24} color="#fff" />}
        </button>

        {isVideo && (
          <button
            onClick={handleCamera}
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: cameraOff ? '#f87171' : 'rgba(255,255,255,0.15)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            {cameraOff ? <RiCameraOffFill size={24} color="#fff" /> : <RiCameraFill size={24} color="#fff" />}
          </button>
        )}

        <button
          onClick={handleEnd}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#ef4444', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', transform: 'rotate(135deg)'
          }}
        >
          <RiPhoneFill size={28} color="#fff" />
        </button>
      </div>
    </div>
  )
}

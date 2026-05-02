import { useEffect, useRef, useState } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets
} from 'livekit-client'
import {
  RiArrowDownSLine,
  RiArrowUpLine,
  RiCameraFill,
  RiCameraOffFill,
  RiLoader4Line,
  RiMicFill,
  RiMicOffFill,
  RiPhoneFill,
  RiVolumeUpFill
} from '@remixicon/react'
import { fetchLiveKitCredentials } from '../lib/livekit'

function getInitial(name) {
  return String(name || 'R').trim().charAt(0).toUpperCase() || 'R'
}

function isProbablyMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function applyMediaElementStyles(element) {
  element.autoplay = true
  element.playsInline = true
  element.style.width = '100%'
  element.style.height = '100%'
  element.style.objectFit = 'cover'
}

export default function CallScreen({
  callerName,
  isVideo,
  roomName,
  displayName,
  direction,
  minimized = false,
  onMinimize,
  onExpand,
  onEnd
}) {
  const roomRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const remoteSpeakerRef = useRef(null)
  const cleanupRef = useRef(false)
  const endedRef = useRef(false)
  const hadRemoteParticipantRef = useRef(false)
  const attachedTracksRef = useRef(new Set())
  const mobileSpeakerDefaultRef = useRef(isProbablyMobileDevice())

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [joinedRoom, setJoinedRoom] = useState(false)
  const [remoteJoined, setRemoteJoined] = useState(false)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(!isVideo)
  const [needsAudioStart, setNeedsAudioStart] = useState(false)
  const [remoteName, setRemoteName] = useState(callerName || 'Gym Buddy')
  const [speakerOn, setSpeakerOn] = useState(() => isProbablyMobileDevice())

  function registerTrack(track) {
    attachedTracksRef.current.add(track)
  }

  function detachAllTracks() {
    attachedTracksRef.current.forEach((track) => {
      try {
        track.detach()
      } catch {}
    })
    attachedTracksRef.current.clear()

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.replaceChildren()
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }

    if (remoteSpeakerRef.current) {
      remoteSpeakerRef.current.srcObject = null
    }
  }

  function clearRemoteMedia(room = roomRef.current) {
    room?.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        try {
          publication.track?.detach()
        } catch {}
      })
    })

    if (remoteVideoRef.current) {
      remoteVideoRef.current.replaceChildren()
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }

    if (remoteSpeakerRef.current) {
      remoteSpeakerRef.current.srcObject = null
    }
  }

  function finishCall(notifyRemote = false) {
    if (cleanupRef.current || endedRef.current) return
    endedRef.current = true
    onEnd?.({ notifyRemote })
  }

  function getRemoteAudioElement() {
    if (speakerOn && remoteSpeakerRef.current) {
      return remoteSpeakerRef.current
    }
    return remoteAudioRef.current
  }

  function attachTrack(track, participant) {
    if (participant?.name) {
      setRemoteName(participant.name)
    }

    if (track.kind === Track.Kind.Video) {
      if (minimized || !remoteVideoRef.current) return

      remoteVideoRef.current.replaceChildren()
      const element = track.attach()
      applyMediaElementStyles(element)
      remoteVideoRef.current.appendChild(element)
      registerTrack(track)
      return
    }

    if (track.kind === Track.Kind.Audio) {
      const mediaElement = getRemoteAudioElement()
      if (!mediaElement) return

      track.attach(mediaElement)
      mediaElement.play().catch(() => {})
      registerTrack(track)
    }
  }

  function hydrateRemoteParticipant(room) {
    const remoteParticipants = Array.from(room.remoteParticipants.values())
    const firstRemote = remoteParticipants[0]

    if (!firstRemote) {
      setRemoteJoined(false)
      return
    }

    hadRemoteParticipantRef.current = true
    setRemoteJoined(true)
    setRemoteName(firstRemote.name || callerName || 'Gym Buddy')

    firstRemote.trackPublications.forEach((publication) => {
      if (publication.track) {
        attachTrack(publication.track, firstRemote)
      }
    })
  }

  function reattachLocalPreview(room = roomRef.current) {
    if (!isVideo || cameraOff || minimized || !room || !localVideoRef.current) return

    const cameraPublication = Array.from(room.localParticipant.videoTrackPublications.values())
      .find((publication) => publication.track)

    if (!cameraPublication?.track) return

    cameraPublication.track.attach(localVideoRef.current)
    registerTrack(cameraPublication.track)
  }

  useEffect(() => {
    let cancelled = false

    async function connectRoom() {
      const room = new Room({
        adaptiveStream: isVideo,
        dynacast: isVideo,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution
        }
      })

      roomRef.current = room

      room
        .on(RoomEvent.Connected, async () => {
          if (cancelled) return

          setJoinedRoom(true)
          setLoading(false)
          hydrateRemoteParticipant(room)

          try {
            await room.localParticipant.setMicrophoneEnabled(true)
            setMuted(false)

            if (isVideo) {
              const cameraPublication = await room.localParticipant.setCameraEnabled(true)
              setCameraOff(false)

              if (cameraPublication?.track && localVideoRef.current && !minimized) {
                cameraPublication.track.attach(localVideoRef.current)
                registerTrack(cameraPublication.track)
              }
            } else {
              setCameraOff(true)
            }
          } catch (error) {
            console.error('[REPMAX] Failed to enable local media:', error)
            setLoadError(error?.message || 'Could not access your microphone or camera.')
          }

          if (!room.canPlaybackAudio) {
            setNeedsAudioStart(true)
          } else {
            room.startAudio().catch(() => {})
          }
        })
        .on(RoomEvent.ParticipantConnected, (participant) => {
          if (cancelled) return
          hadRemoteParticipantRef.current = true
          setRemoteJoined(true)
          setRemoteName(participant.name || callerName || 'Gym Buddy')
          hydrateRemoteParticipant(room)
        })
        .on(RoomEvent.ParticipantDisconnected, () => {
          if (cancelled) return

          const stillHasRemoteParticipant = room.remoteParticipants.size > 0
          setRemoteJoined(stillHasRemoteParticipant)

          if (!stillHasRemoteParticipant && hadRemoteParticipantRef.current) {
            finishCall(false)
          }
        })
        .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (cancelled) return
          hadRemoteParticipantRef.current = true
          setRemoteJoined(true)
          attachTrack(track, participant)
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          try {
            track.detach()
          } catch {}
        })
        .on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (!cancelled) {
            setNeedsAudioStart(!room.canPlaybackAudio)
          }
        })
        .on(RoomEvent.MediaDevicesError, (error) => {
          if (cancelled) return
          console.error('[REPMAX] LiveKit media device error:', error)
          setLoadError(error?.message || 'Could not access your microphone or camera.')
          setLoading(false)
        })
        .on(RoomEvent.Disconnected, () => {
          if (cancelled || cleanupRef.current) return
          finishCall(false)
        })

      try {
        const { serverUrl, participantToken } = await fetchLiveKitCredentials({
          roomName,
          participantName: displayName,
          participantMetadata: JSON.stringify({ source: 'repmax-call' })
        })

        if (cancelled) return

        room.prepareConnection(serverUrl, participantToken)
        await room.connect(serverUrl, participantToken)
      } catch (error) {
        console.error('[REPMAX] Failed to connect to LiveKit:', error)
        if (!cancelled) {
          setLoadError(error?.message || 'Could not start the call.')
          setLoading(false)
        }
      }
    }

    connectRoom()

    return () => {
      cancelled = true
      cleanupRef.current = true

      try {
        roomRef.current?.disconnect()
      } catch {}

      detachAllTracks()
      roomRef.current = null
    }
  }, [callerName, displayName, isVideo, roomName])

  useEffect(() => {
    if (!joinedRoom) return
    clearRemoteMedia()
    hydrateRemoteParticipant(roomRef.current)
    reattachLocalPreview()
  }, [joinedRoom, minimized, speakerOn])

  useEffect(() => {
    if (!joinedRoom || !isVideo || cameraOff) return
    reattachLocalPreview()
  }, [cameraOff, isVideo, joinedRoom, minimized])

  async function handleMute() {
    const room = roomRef.current
    if (!room) return

    const nextMuted = !muted

    try {
      await room.localParticipant.setMicrophoneEnabled(!nextMuted)
      setMuted(nextMuted)
    } catch (error) {
      console.error('[REPMAX] Failed to toggle microphone:', error)
    }
  }

  async function handleCamera() {
    const room = roomRef.current
    if (!room || !isVideo) return

    const nextCameraOff = !cameraOff

    try {
      const cameraPublication = await room.localParticipant.setCameraEnabled(!nextCameraOff)
      setCameraOff(nextCameraOff)

      if (nextCameraOff) {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null
        }
        return
      }

      if (cameraPublication?.track && localVideoRef.current && !minimized) {
        cameraPublication.track.attach(localVideoRef.current)
        registerTrack(cameraPublication.track)
      }
    } catch (error) {
      console.error('[REPMAX] Failed to toggle camera:', error)
    }
  }

  async function handleEnableAudio() {
    const room = roomRef.current
    if (!room) return

    try {
      await room.startAudio()
      setNeedsAudioStart(false)
    } catch (error) {
      console.error('[REPMAX] Failed to start audio playback:', error)
    }
  }

  function handleSpeakerToggle() {
    setSpeakerOn((prev) => !prev)
    roomRef.current?.startAudio().catch(() => {})
  }

  function handleHangup() {
    try {
      roomRef.current?.disconnect()
    } catch {}

    finishCall(true)
  }

  const statusText = loadError
    ? loadError
    : loading
      ? 'Starting call...'
      : !joinedRoom
        ? 'Connecting...'
        : remoteJoined
          ? 'Connected'
          : direction === 'incoming'
            ? 'Joining...'
            : 'Calling...'

  const mediaNodes = (
    <>
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
          display: speakerOn ? 'none' : 'block'
        }}
      />
      <video
        ref={remoteSpeakerRef}
        autoPlay
        playsInline
        muted={false}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
          display: speakerOn ? 'block' : 'none'
        }}
      />
    </>
  )

  if (minimized) {
    return (
      <div
        onClick={() => onExpand?.()}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 92,
          zIndex: 10000,
          width: isVideo ? 188 : 222,
          borderRadius: 24,
          border: '1px solid rgba(212,255,0,0.16)',
          background: 'rgba(12,14,18,0.94)',
          color: '#fff',
          padding: 14,
          boxShadow: '0 20px 50px rgba(0,0,0,0.38)',
          backdropFilter: 'blur(14px)',
          cursor: 'pointer'
        }}
      >
        {mediaNodes}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
              {isVideo ? 'Video Call' : 'Voice Call'}
            </div>
            <div style={{ marginTop: 4, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {remoteName || callerName || 'Gym Buddy'}
            </div>
            <div style={{ marginTop: 3, fontSize: '0.82rem', color: 'rgba(255,255,255,0.68)' }}>
              {statusText}
            </div>
          </div>

          <button
            onClick={(event) => {
              event.stopPropagation()
              onExpand?.()
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <RiArrowUpLine size={20} color="#fff" />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={(event) => {
              event.stopPropagation()
              handleMute()
            }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 14,
              border: 'none',
              background: muted ? '#f87171' : 'rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {muted ? <RiMicOffFill size={20} color="#fff" /> : <RiMicFill size={20} color="#fff" />}
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation()
              handleSpeakerToggle()
            }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 14,
              border: 'none',
              background: speakerOn ? 'rgba(212,255,0,0.2)' : 'rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <RiVolumeUpFill size={20} color="#fff" />
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation()
              handleHangup()
            }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 14,
              border: 'none',
              background: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <RiPhoneFill size={22} color="#fff" style={{ transform: 'rotate(135deg)' }} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      background: isVideo ? '#050505' : 'radial-gradient(circle at top, rgba(212,255,0,0.18), rgba(7,7,7,0.98) 45%)',
      color: '#fff',
      overflow: 'hidden'
    }}>
      {mediaNodes}

      {isVideo && (
        <div ref={remoteVideoRef} style={{
          position: 'absolute',
          inset: 0,
          background: '#0b0b0b'
        }} />
      )}

      {isVideo && !remoteJoined && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, rgba(12,14,18,0.85), rgba(7,7,7,0.96))'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 140,
              height: 140,
              borderRadius: '50%',
              margin: '0 auto 18px',
              background: 'rgba(212,255,0,0.18)',
              border: '1px solid rgba(212,255,0,0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              fontWeight: 800
            }}>
              {getInitial(callerName)}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{callerName || 'Gym Buddy'}</div>
            <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)' }}>{statusText}</div>
          </div>
        </div>
      )}

      {!isVideo && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 168,
              height: 168,
              borderRadius: '50%',
              margin: '0 auto 24px',
              background: 'rgba(212,255,0,0.18)',
              border: '1px solid rgba(212,255,0,0.26)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3.5rem',
              fontWeight: 800,
              boxShadow: remoteJoined ? '0 0 40px rgba(212,255,0,0.22)' : 'none',
              animation: remoteJoined ? 'pulse 2s ease-in-out infinite' : 'none'
            }}>
              {getInitial(remoteName)}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{remoteName}</div>
            <div style={{ marginTop: 8, fontSize: '0.95rem', color: 'rgba(255,255,255,0.72)' }}>{statusText}</div>
            <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'rgba(255,255,255,0.56)' }}>
              Audio route: {speakerOn ? 'Speaker' : mobileSpeakerDefaultRef.current ? 'Phone' : 'Default'}
            </div>
          </div>
        </div>
      )}

      {isVideo && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            top: 84,
            right: 16,
            width: 118,
            height: 168,
            objectFit: 'cover',
            borderRadius: 20,
            background: '#111',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 10px 28px rgba(0,0,0,0.4)',
            opacity: cameraOff ? 0 : 1,
            pointerEvents: 'none'
          }}
        />
      )}

      <div style={{
        position: 'absolute',
        top: 18,
        left: 18,
        right: 18,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12
      }}>
        <div style={{
          padding: '12px 16px',
          borderRadius: 18,
          background: 'rgba(12,14,18,0.82)',
          border: '1px solid rgba(212,255,0,0.14)',
          backdropFilter: 'blur(12px)',
          maxWidth: 260
        }}>
          <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>
            {isVideo ? 'Video Call' : 'Voice Call'}
          </div>
          <div style={{ marginTop: 4, fontSize: '1rem', fontWeight: 800 }}>{callerName || 'Gym Buddy'}</div>
          <div style={{ marginTop: 2, fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>{statusText}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {typeof onMinimize === 'function' && (
            <button
              onClick={onMinimize}
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                border: '1px solid rgba(212,255,0,0.14)',
                background: 'rgba(12,14,18,0.82)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(12px)'
              }}
            >
              <RiArrowDownSLine size={22} color="#fff" />
            </button>
          )}

          {loading && (
            <div style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: 'rgba(12,14,18,0.82)',
              border: '1px solid rgba(212,255,0,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(12px)'
            }}>
              <RiLoader4Line size={20} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}
        </div>
      </div>

      {needsAudioStart && !loadError && (
        <button
          onClick={handleEnableAudio}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 136,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderRadius: 999,
            border: '1px solid rgba(212,255,0,0.22)',
            background: 'rgba(12,14,18,0.94)',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <RiVolumeUpFill size={18} />
          Enable Audio
        </button>
      )}

      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 34,
        display: 'flex',
        justifyContent: 'center',
        gap: 16,
        padding: '0 20px'
      }}>
        <button
          onClick={handleMute}
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            border: 'none',
            background: muted ? '#f87171' : 'rgba(255,255,255,0.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(12px)'
          }}
        >
          {muted ? <RiMicOffFill size={24} color="#fff" /> : <RiMicFill size={24} color="#fff" />}
        </button>

        <button
          onClick={handleSpeakerToggle}
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            border: 'none',
            background: speakerOn ? 'rgba(212,255,0,0.2)' : 'rgba(255,255,255,0.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(12px)'
          }}
        >
          <RiVolumeUpFill size={24} color="#fff" />
        </button>

        {isVideo && (
          <button
            onClick={handleCamera}
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              border: 'none',
              background: cameraOff ? '#f87171' : 'rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(12px)'
            }}
          >
            {cameraOff ? <RiCameraOffFill size={24} color="#fff" /> : <RiCameraFill size={24} color="#fff" />}
          </button>
        )}

        <button
          onClick={handleHangup}
          style={{
            width: 62,
            height: 62,
            borderRadius: '50%',
            border: 'none',
            background: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)'
          }}
        >
          <RiPhoneFill size={28} color="#fff" style={{ transform: 'rotate(135deg)' }} />
        </button>
      </div>
    </div>
  )
}

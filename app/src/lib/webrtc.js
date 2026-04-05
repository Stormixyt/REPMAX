/**
 * WebRTC Voice/Video Calling via Supabase Realtime Signaling
 * Zero infrastructure cost — uses free Google STUN servers + Supabase channels
 */
import { supabase } from './supabase'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

let peerConnection = null
let localStream = null
let remoteStream = null
let signalingChannel = null
let currentCallId = null
let pendingCandidates = []
let cleanupPromise = null
let onRemoteStream = null
let onCallEnded = null
let onCallConnected = null

export function setCallbacks({ onRemote, onEnded, onConnected }) {
  onRemoteStream = onRemote
  onCallEnded = onEnded
  onCallConnected = onConnected
}

function normalizeCandidate(candidate) {
  if (!candidate) return null
  return typeof candidate.toJSON === 'function' ? candidate.toJSON() : candidate
}

async function cleanupCall({ notifyRemote = false } = {}) {
  if (cleanupPromise) return cleanupPromise

  const channel = signalingChannel
  const stream = localStream
  const pc = peerConnection
  const callId = currentCallId
  const hadActiveCall = Boolean(channel || stream || pc || remoteStream || callId)

  signalingChannel = null
  localStream = null
  remoteStream = null
  peerConnection = null
  currentCallId = null
  pendingCandidates = []

  cleanupPromise = (async () => {
    if (pc) {
      pc.ontrack = null
      pc.onicecandidate = null
      pc.oniceconnectionstatechange = null
      pc.onconnectionstatechange = null
      try { pc.close() } catch {}
    }

    if (stream) {
      stream.getTracks().forEach((track) => {
        try { track.stop() } catch {}
      })
    }

    if (notifyRemote && channel && callId) {
      try {
        await channel.send({
          type: 'broadcast',
          event: 'end-call',
          payload: { callId }
        })
      } catch {}
    }

    if (channel) {
      try { await supabase.removeChannel(channel) } catch {}
    }
  })()
    .finally(() => {
      cleanupPromise = null
      if (hadActiveCall) onCallEnded?.()
    })

  return cleanupPromise
}

function createPeerConnection(callId) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

  pc.ontrack = (event) => {
    remoteStream = event.streams[0]
    onRemoteStream?.(remoteStream)
  }

  pc.onicecandidate = (event) => {
    if (!event.candidate || !signalingChannel || currentCallId !== callId) return

    signalingChannel.send({
      type: 'broadcast',
      event: 'ice-candidate',
      payload: {
        callId,
        candidate: normalizeCandidate(event.candidate)
      }
    }).catch(() => {})
  }

  pc.onconnectionstatechange = () => {
    if (currentCallId !== callId) return

    if (pc.connectionState === 'connected') {
      onCallConnected?.()
    }

    if (pc.connectionState === 'failed') {
      cleanupCall({ notifyRemote: true })
    }
  }

  pc.oniceconnectionstatechange = () => {
    if (currentCallId !== callId) return

    if (pc.iceConnectionState === 'connected') {
      onCallConnected?.()
    }

    if (pc.iceConnectionState === 'failed') {
      cleanupCall({ notifyRemote: true })
    }
  }

  return pc
}

async function subscribeToCallChannel(channel, callId, { listenForAnswer }) {
  await new Promise((resolve, reject) => {
    channel
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (!listenForAnswer || currentCallId !== callId || payload.callId !== callId || !peerConnection || !payload.answer) return

        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer))
          for (const candidate of pendingCandidates) {
            try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
          }
          pendingCandidates = []
        } catch (error) {
          console.error('[REPMAX] Failed to apply answer:', error)
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (currentCallId !== callId || payload.callId !== callId || !peerConnection || !payload.candidate) return

        try {
          if (peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate))
          } else {
            pendingCandidates.push(payload.candidate)
          }
        } catch (error) {
          console.error('[REPMAX] Failed to apply ICE candidate:', error)
        }
      })
      .on('broadcast', { event: 'end-call' }, ({ payload }) => {
        if (currentCallId === callId && payload.callId === callId) {
          cleanupCall({ notifyRemote: false })
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`Call channel subscription failed: ${status}`))
        }
      })
  })
}

export async function startCall(chatId, userId, withVideo = false, sendOfferCallback) {
  const callId = crypto.randomUUID()

  try {
    await cleanupCall({ notifyRemote: false })

    currentCallId = callId
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo ? { facingMode: 'user', width: 640, height: 480 } : false
    })

    peerConnection = createPeerConnection(callId)
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))

    signalingChannel = supabase.channel(`call-${chatId}-${callId}`)
    pendingCandidates = []

    await subscribeToCallChannel(signalingChannel, callId, { listenForAnswer: true })

    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    const payload = { offer, callerId: userId, withVideo, callId }
    if (sendOfferCallback) {
      await sendOfferCallback(payload)
    } else {
      await signalingChannel.send({
        type: 'broadcast',
        event: 'offer',
        payload
      })
    }

    return { localStream, callId, channelName: `call-${chatId}-${callId}` }
  } catch (err) {
    console.error('[REPMAX] Failed to start call:', err)
    await cleanupCall({ notifyRemote: false })
    throw err
  }
}

export async function answerCall(chatId, offer, withVideo = false, callId) {
  try {
    await cleanupCall({ notifyRemote: false })

    currentCallId = callId
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo ? { facingMode: 'user', width: 640, height: 480 } : false
    })

    peerConnection = createPeerConnection(callId)
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))

    signalingChannel = supabase.channel(`call-${chatId}-${callId}`)
    pendingCandidates = []

    await subscribeToCallChannel(signalingChannel, callId, { listenForAnswer: false })

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    for (const candidate of pendingCandidates) {
      try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
    }
    pendingCandidates = []

    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    await signalingChannel.send({
      type: 'broadcast',
      event: 'answer',
      payload: { answer, callId }
    })

    return { localStream, callId }
  } catch (err) {
    console.error('[REPMAX] Failed to answer call:', err)
    await cleanupCall({ notifyRemote: false })
    throw err
  }
}

export async function endCall(options = {}) {
  await cleanupCall({ notifyRemote: options.notifyRemote !== false })
}

export function toggleMute() {
  if (!localStream) return false
  const audioTrack = localStream.getAudioTracks()[0]
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled
    return !audioTrack.enabled
  }
  return false
}

export function toggleCamera() {
  if (!localStream) return false
  const videoTrack = localStream.getVideoTracks()[0]
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled
    return !videoTrack.enabled
  }
  return false
}

export function getLocalStream() { return localStream }
export function getRemoteStream() { return remoteStream }

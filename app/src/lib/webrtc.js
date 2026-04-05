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
let onRemoteStream = null
let onCallEnded = null
let onCallConnected = null

export function setCallbacks({ onRemote, onEnded, onConnected }) {
  onRemoteStream = onRemote
  onCallEnded = onEnded
  onCallConnected = onConnected
}

function createPeerConnection() {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

  pc.ontrack = (event) => {
    remoteStream = event.streams[0]
    onRemoteStream?.(remoteStream)
  }

  pc.onicecandidate = (event) => {
    if (event.candidate && signalingChannel) {
      signalingChannel.send({
        type: 'broadcast',
        event: 'ice-candidate',
        payload: { candidate: event.candidate }
      })
    }
  }

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'connected') {
      onCallConnected?.()
    }
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      endCall()
    }
  }

  return pc
}

export async function startCall(chatId, userId, withVideo = false) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo ? { facingMode: 'user', width: 640, height: 480 } : false
    })

    peerConnection = createPeerConnection()
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream))

    // Set up signaling channel
    const channelName = `call-${chatId}`
    signalingChannel = supabase.channel(channelName)

    signalingChannel
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (peerConnection && payload.answer) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer))
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (peerConnection && payload.candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate))
        }
      })
      .on('broadcast', { event: 'end-call' }, () => {
        endCall()
      })
      .subscribe()

    // Create and send offer
    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    signalingChannel.send({
      type: 'broadcast',
      event: 'offer',
      payload: { offer, callerId: userId, withVideo }
    })

    return { localStream, channelName }
  } catch (err) {
    console.error('[REPMAX] Failed to start call:', err)
    endCall()
    throw err
  }
}

export async function answerCall(chatId, offer, withVideo = false) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo ? { facingMode: 'user', width: 640, height: 480 } : false
    })

    peerConnection = createPeerConnection()
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream))

    const channelName = `call-${chatId}`
    signalingChannel = supabase.channel(channelName)

    signalingChannel
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (peerConnection && payload.candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate))
        }
      })
      .on('broadcast', { event: 'end-call' }, () => {
        endCall()
      })
      .subscribe()

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    signalingChannel.send({
      type: 'broadcast',
      event: 'answer',
      payload: { answer }
    })

    return { localStream }
  } catch (err) {
    console.error('[REPMAX] Failed to answer call:', err)
    endCall()
    throw err
  }
}

export function endCall() {
  if (signalingChannel) {
    signalingChannel.send({ type: 'broadcast', event: 'end-call', payload: {} })
    supabase.removeChannel(signalingChannel)
    signalingChannel = null
  }

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop())
    localStream = null
  }

  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }

  remoteStream = null
  onCallEnded?.()
}

export function toggleMute() {
  if (!localStream) return false
  const audioTrack = localStream.getAudioTracks()[0]
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled
    return !audioTrack.enabled // returns true if muted
  }
  return false
}

export function toggleCamera() {
  if (!localStream) return false
  const videoTrack = localStream.getVideoTracks()[0]
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled
    return !videoTrack.enabled // returns true if camera off
  }
  return false
}

export function getLocalStream() { return localStream }
export function getRemoteStream() { return remoteStream }

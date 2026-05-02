let currentCall = null

function sanitizeRoomPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 48)
}

function buildRoomName(chatId, callId) {
  const safeChatId = sanitizeRoomPart(chatId)
  const safeCallId = sanitizeRoomPart(callId)
  return `repmax-${safeChatId || 'chat'}-${safeCallId || 'call'}`
}

export function setCallbacks() {}

export async function startCall(chatId, userId, withVideo = false, sendOfferCallback) {
  const callId = crypto.randomUUID()
  const roomName = buildRoomName(chatId, callId)

  currentCall = {
    chatId,
    callId,
    roomName,
    withVideo,
    userId,
    direction: 'outgoing'
  }

  const payload = {
    offer: { roomName },
    callerId: userId,
    withVideo,
    callId,
    roomName
  }

  if (sendOfferCallback) {
    await sendOfferCallback(payload)
  }

  return { callId, roomName }
}

export async function answerCall(chatId, offer, withVideo = false, callId) {
  const roomName = offer?.roomName || buildRoomName(chatId, callId)

  currentCall = {
    chatId,
    callId,
    roomName,
    withVideo,
    direction: 'incoming'
  }

  return { callId, roomName }
}

export async function endCall() {
  currentCall = null
}

export function toggleMute() {
  return false
}

export function toggleCamera() {
  return false
}

export function getLocalStream() {
  return null
}

export function getRemoteStream() {
  return null
}

export function getCurrentCall() {
  return currentCall
}

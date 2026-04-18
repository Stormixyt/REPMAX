import { createContext, useContext, useState, useRef, useCallback } from 'react'

const CallContext = createContext(null)

export function CallProvider({ children }) {
  const [activeCall, setActiveCall] = useState(null)
  const [callMinimized, setCallMinimized] = useState(false)
  const [callToast, setCallToast] = useState(null)
  const toastTimer = useRef(null)

  const showCallToast = useCallback((message) => {
    setCallToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setCallToast(null), 3000)
  }, [])

  const clearActiveCall = useCallback(() => {
    setActiveCall(null)
    setCallMinimized(false)
  }, [])

  return (
    <CallContext.Provider value={{
      activeCall, setActiveCall, clearActiveCall,
      callMinimized, setCallMinimized,
      callToast, showCallToast,
    }}>
      {children}
    </CallContext.Provider>
  )
}

export function useCall() {
  const context = useContext(CallContext)
  if (!context) throw new Error('useCall must be used within CallProvider')
  return context
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const CallContext = createContext(null)

export function CallProvider({ children }) {
  const [activeCallState, setActiveCallState] = useState(null)
  const [callMinimized, setCallMinimized] = useState(false)
  const [callToast, setCallToast] = useState('')
  const toastTimerRef = useRef(null)

  const setActiveCall = useCallback((call) => {
    setCallMinimized(false)
    setActiveCallState(call)
  }, [])

  const clearActiveCall = useCallback(() => {
    setCallMinimized(false)
    setActiveCallState(null)
  }, [])

  const showCallToast = useCallback((message) => {
    if (!message) return
    setCallToast(message)

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }

    toastTimerRef.current = setTimeout(() => {
      setCallToast('')
      toastTimerRef.current = null
    }, 3000)
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
  }, [])

  const value = useMemo(() => ({
    activeCall: activeCallState,
    setActiveCall,
    clearActiveCall,
    callMinimized,
    setCallMinimized,
    callToast,
    showCallToast
  }), [activeCallState, callMinimized, callToast, clearActiveCall, setActiveCall, showCallToast])

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  )
}

export function useCall() {
  const context = useContext(CallContext)
  if (!context) {
    throw new Error('useCall must be used inside a CallProvider')
  }
  return context
}

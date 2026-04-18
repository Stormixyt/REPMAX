import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, Vibration } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../theme/ThemeContext'
import { spacing, fontSize, fontWeight, radius } from '../theme/spacing'
import Svg, { Circle } from 'react-native-svg'

export default function RestTimer({ duration, onClose, onDurationChange }) {
  const [timeLeft, setTimeLeft] = useState(duration)
  const [running, setRunning] = useState(true)
  const intervalRef = useRef(null)
  const { theme } = useTheme()

  useEffect(() => {
    if (running && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
            Vibration.vibrate([200, 100, 200])
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, timeLeft])

  function toggleTimer() {
    if (timeLeft === 0) {
      setTimeLeft(duration)
      setRunning(true)
    } else {
      setRunning(!running)
    }
  }

  function adjustTime(delta) {
    const newDuration = Math.max(30, duration + delta)
    onDurationChange(newDuration)
    setTimeLeft(prev => Math.max(0, prev + delta))
  }

  const r = 90
  const circumference = 2 * Math.PI * r
  const progress = duration > 0 ? (duration - timeLeft) / duration : 0
  const dashOffset = circumference * (1 - progress)
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.inner}>
          <View style={styles.ringWrap}>
            <Svg width={200} height={200} viewBox="0 0 200 200">
              <Circle cx="100" cy="100" r={r} stroke={theme.bg.elevated} strokeWidth={6} fill="none" />
              <Circle
                cx="100" cy="100" r={r}
                stroke={timeLeft === 0 ? theme.success : theme.accent}
                strokeWidth={6} fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(-90, 100, 100)"
              />
            </Svg>
            <View style={styles.timeWrap}>
              <Text style={[styles.time, { color: theme.text.primary }]}>
                {minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : seconds}
              </Text>
              <Text style={[styles.timeLabel, { color: theme.text.tertiary }]}>
                {timeLeft === 0 ? "Time's up!" : running ? 'Resting...' : 'Paused'}
              </Text>
            </View>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: theme.bg.elevated }]} onPress={() => adjustTime(-15)}>
              <Text style={[styles.controlText, { color: theme.text.primary }]}>-15s</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: theme.accent }]} onPress={toggleTimer}>
              <Text style={[styles.controlText, { color: theme.text.onAccent }]}>
                {timeLeft === 0 ? 'Reset' : running ? 'Pause' : 'Resume'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: theme.bg.elevated }]} onPress={() => adjustTime(15)}>
              <Text style={[styles.controlText, { color: theme.text.primary }]}>+15s</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.skipBtn, { backgroundColor: theme.bg.elevated }]} onPress={onClose}>
            <Text style={[styles.skipText, { color: theme.text.secondary }]}>Skip Rest</Text>
          </TouchableOpacity>

          <View style={styles.presets}>
            {[60, 90, 120, 180, 300].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.presetBtn, { backgroundColor: duration === t ? theme.accent : theme.bg.elevated }]}
                onPress={() => { onDurationChange(t); setTimeLeft(t); setRunning(true) }}
              >
                <Text style={[styles.presetText, { color: duration === t ? theme.text.onAccent : theme.text.primary }]}>
                  {t >= 60 ? `${t / 60}m` : `${t}s`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { alignItems: 'center', padding: spacing.xl },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  timeWrap: { position: 'absolute', alignItems: 'center' },
  time: { fontSize: 48, fontWeight: fontWeight.black },
  timeLabel: { fontSize: fontSize.sm, marginTop: 4 },
  controls: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  controlBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, minWidth: 70, alignItems: 'center' },
  controlText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  skipBtn: { paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  skipText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  presets: { flexDirection: 'row', gap: spacing.sm },
  presetBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  presetText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
})

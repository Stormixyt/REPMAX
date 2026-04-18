import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../theme/ThemeContext'
import { Input, Button } from '../../components/ui'
import { spacing, fontSize, fontWeight, radius } from '../../theme/spacing'
import { Ionicons } from '@expo/vector-icons'

export default function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const { theme } = useTheme()

  async function checkWaitlistApproval(emailToCheck) {
    try {
      const { data, error } = await supabase
        .from('waitlist')
        .select('approved')
        .eq('email', emailToCheck.toLowerCase().trim())
        .maybeSingle()
      if (error) return false
      if (!data) return false
      return data.approved === true
    } catch {
      return false
    }
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)
    const cleanEmail = email.toLowerCase().trim()
    try {
      const isApproved = await checkWaitlistApproval(cleanEmail)
      if (!isApproved) {
        setError('Your access has not been approved yet. Join the waitlist on the main page and wait for approval.')
        setLoading(false)
        return
      }
      if (mode === 'signup') {
        if (!name.trim()) { setError('Enter your name'); setLoading(false); return }
        if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return }
        const { error } = await signUp(cleanEmail, password, name.trim())
        if (error) throw error
      } else {
        const { error } = await signIn(cleanEmail, password)
        if (error) throw error
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.bg.primary }]}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Text style={[styles.logo, { color: theme.text.primary }]}>
            REPMAX<Text style={{ color: theme.accent }}>.</Text>
          </Text>
          <Text style={[styles.tagline, { color: theme.text.secondary }]}>
            Train smarter. Get stronger.
          </Text>
        </View>

        <View style={styles.form}>
          {mode === 'signup' && (
            <Input
              label="Your name"
              placeholder="What should we call you?"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              autoCapitalize="words"
            />
          )}

          <Input
            label="Email"
            placeholder="you@email.com"
            value={email}
            onChangeText={setEmail}
            autoComplete="email"
            autoCapitalize="none"
            keyboardType="email-address"
            error={error ? ' ' : null}
          />

          <Input
            label="Password"
            placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />

          {error ? (
            <View style={[styles.errorBox, { borderColor: 'rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.06)' }]}>
              <Ionicons name="alert-circle" size={16} color={theme.danger} />
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          <Button
            title={loading ? '' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            size="lg"
            style={{ marginTop: spacing.md }}
          />

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.text.secondary }]}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <TouchableOpacity onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
              <Text style={[styles.switchLink, { color: theme.accent }]}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.waitlistNote, { color: theme.text.tertiary }]}>
            Access is invite-only. Join the waitlist to request access.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 42, fontWeight: fontWeight.black, letterSpacing: -1 },
  tagline: { fontSize: fontSize.md, marginTop: spacing.sm },
  form: { width: '100%' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  errorText: { fontSize: fontSize.sm, flex: 1 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  switchText: { fontSize: fontSize.sm },
  switchLink: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  waitlistNote: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
})

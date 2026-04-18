import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useTheme } from '../theme/ThemeContext'
import { radius, spacing, fontSize, fontWeight } from '../theme/spacing'

export function Card({ children, style }) {
  const { theme } = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: theme.bg.card, borderColor: theme.border }, style]}>
      {children}
    </View>
  )
}

export function CardTitle({ children, style }) {
  const { theme } = useTheme()
  return <Text style={[styles.cardTitle, { color: theme.text.primary }, style]}>{children}</Text>
}

export function CardLabel({ children, style }) {
  const { theme } = useTheme()
  return <Text style={[styles.cardLabel, { color: theme.text.tertiary }, style]}>{children}</Text>
}

export function Button({ title, onPress, variant = 'primary', size = 'md', loading = false, disabled = false, icon, style }) {
  const { theme } = useTheme()
  const isPrimary = variant === 'primary'
  const isDanger = variant === 'danger'
  const bgColor = isPrimary ? theme.accent : isDanger ? theme.danger : theme.bg.elevated
  const textColor = isPrimary ? theme.text.onAccent : isDanger ? '#fff' : theme.text.primary
  const height = size === 'lg' ? 52 : size === 'sm' ? 36 : 44

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        { backgroundColor: bgColor, height, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {icon}
          <Text style={[styles.buttonText, { color: textColor, fontSize: size === 'sm' ? 13 : 15 }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

export function Input({ label, error, style, inputStyle, ...props }) {
  const { theme } = useTheme()
  return (
    <View style={[styles.inputGroup, style]}>
      {label && <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>{label}</Text>}
      <TextInput
        placeholderTextColor={theme.text.tertiary}
        style={[
          styles.input,
          {
            backgroundColor: theme.bg.input,
            color: theme.text.primary,
            borderColor: error ? theme.danger : theme.border,
          },
          inputStyle,
        ]}
        {...props}
      />
      {error && <Text style={[styles.inputError, { color: theme.danger }]}>{error}</Text>}
    </View>
  )
}

export function Badge({ label, color, style }) {
  const { theme } = useTheme()
  const bg = color || theme.accent
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.badgeText, { color: theme.text.onAccent }]}>{label}</Text>
    </View>
  )
}

export function Divider({ style }) {
  const { theme } = useTheme()
  return <View style={[styles.divider, { backgroundColor: theme.border }, style]} />
}

export function PageHeader({ title, subtitle }) {
  const { theme } = useTheme()
  return (
    <View style={styles.pageHeader}>
      <Text style={[styles.pageTitle, { color: theme.text.primary }]}>{title}</Text>
      {subtitle && <Text style={[styles.pageSubtitle, { color: theme.text.secondary }]}>{subtitle}</Text>}
    </View>
  )
}

export function StatBox({ value, label, style }) {
  const { theme } = useTheme()
  return (
    <View style={[styles.statBox, { backgroundColor: theme.bg.card, borderColor: theme.border }, style]}>
      <Text style={[styles.statValue, { color: theme.accent }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.text.tertiary }]}>{label}</Text>
    </View>
  )
}

export function EmptyState({ icon, title, description }) {
  const { theme } = useTheme()
  return (
    <View style={styles.emptyState}>
      {icon && <Text style={styles.emptyIcon}>{icon}</Text>}
      <Text style={[styles.emptyTitle, { color: theme.text.secondary }]}>{title}</Text>
      {description && <Text style={[styles.emptyDesc, { color: theme.text.tertiary }]}>{description}</Text>}
    </View>
  )
}

export function Toast({ message, visible }) {
  const { theme } = useTheme()
  if (!visible || !message) return null
  return (
    <View style={[styles.toast, { backgroundColor: theme.bg.elevated, borderColor: theme.borderAccent }]}>
      <Text style={[styles.toastText, { color: theme.text.primary }]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  cardLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  button: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontWeight: fontWeight.bold,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
  },
  inputError: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  divider: {
    height: 1,
    marginVertical: spacing.lg,
  },
  pageHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  pageTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.black,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  statBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    zIndex: 9999,
  },
  toastText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
})

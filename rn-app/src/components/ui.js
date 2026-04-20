import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../theme/ThemeContext'
import { radius, spacing, fontSize, fontWeight } from '../theme/spacing'

/* ── Card ── */
export function Card({ children, style, glow, accent, onPress }) {
  const { theme } = useTheme()
  const Wrapper = onPress ? TouchableOpacity : View
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.8 } : {}
  return (
    <Wrapper
      {...wrapperProps}
      style={[
        styles.card,
        {
          backgroundColor: theme.bg.card,
          borderColor: accent ? theme.borderAccent : theme.border,
        },
        glow && {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 6,
        },
        style,
      ]}
    >
      {children}
    </Wrapper>
  )
}

export function GlassCard({ children, style }) {
  const { theme } = useTheme()
  return (
    <View style={[styles.glassCard, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: theme.border }, style]}>
      {children}
    </View>
  )
}

export function CardTitle({ children, style }) {
  const { theme } = useTheme()
  return <Text style={[styles.cardTitle, { color: theme.text.primary }, style]}>{children}</Text>
}

export function CardLabel({ children, style, accent }) {
  const { theme } = useTheme()
  return (
    <Text style={[styles.cardLabel, { color: accent ? theme.accent : theme.text.tertiary }, style]}>
      {children}
    </Text>
  )
}

/* ── Button ── */
export function Button({ title, onPress, variant = 'primary', size = 'md', loading, disabled, icon, style, textStyle }) {
  const { theme } = useTheme()
  const isPrimary = variant === 'primary'
  const isDanger = variant === 'danger'
  const isOutline = variant === 'outline'
  const isGhost = variant === 'ghost'

  const bgColor = isPrimary
    ? theme.accent
    : isDanger
    ? theme.danger
    : isOutline
    ? 'transparent'
    : isGhost
    ? 'transparent'
    : theme.bg.elevated
  const textColor = isPrimary
    ? theme.text.onAccent
    : isDanger
    ? '#fff'
    : isOutline
    ? theme.accent
    : isGhost
    ? theme.text.secondary
    : theme.text.primary
  const height = size === 'lg' ? 56 : size === 'sm' ? 36 : size === 'xs' ? 30 : 46
  const borderW = isOutline ? 1.5 : 0
  const borderC = isOutline ? theme.accent : 'transparent'

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor: bgColor,
          height,
          opacity: disabled ? 0.4 : 1,
          borderWidth: borderW,
          borderColor: borderC,
          paddingHorizontal: size === 'sm' || size === 'xs' ? spacing.md : spacing.xl,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {icon}
          <Text
            style={[
              styles.buttonText,
              {
                color: textColor,
                fontSize: size === 'xs' ? 12 : size === 'sm' ? 13 : 15,
                fontWeight: fontWeight.bold,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

/* ── Input ── */
export function Input({ label, error, style, inputStyle, leftIcon, rightIcon, ...props }) {
  const { theme } = useTheme()
  return (
    <View style={[styles.inputGroup, style]}>
      {label && <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>{label}</Text>}
      <View style={{ position: 'relative' }}>
        {leftIcon && <View style={styles.inputLeftIcon}>{leftIcon}</View>}
        <TextInput
          placeholderTextColor={theme.text.tertiary}
          style={[
            styles.input,
            {
              backgroundColor: theme.bg.input,
              color: theme.text.primary,
              borderColor: error ? theme.danger : theme.border,
              paddingLeft: leftIcon ? 44 : spacing.lg,
            },
            inputStyle,
          ]}
          {...props}
        />
        {rightIcon && <View style={styles.inputRightIcon}>{rightIcon}</View>}
      </View>
      {error && <Text style={[styles.inputError, { color: theme.danger }]}>{error}</Text>}
    </View>
  )
}

/* ── Badge ── */
export function Badge({ label, color, variant = 'filled', icon, style }) {
  const { theme } = useTheme()
  const bg = variant === 'filled' ? (color || theme.accent) : 'transparent'
  const textC = variant === 'filled' ? theme.text.onAccent : (color || theme.accent)
  const borderW = variant === 'outline' ? 1 : 0
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderWidth: borderW, borderColor: textC }, style]}>
      {icon && <Text style={{ fontSize: 10, marginRight: 3 }}>{icon}</Text>}
      <Text style={[styles.badgeText, { color: textC }]}>{label}</Text>
    </View>
  )
}

export function TierBadge({ tier }) {
  if (!tier || tier === 'free') return null
  const config = {
    pro: { label: 'PRO', colors: ['#ccff00', '#88cc00'] },
    ultra: { label: 'ULTRA', colors: ['#b026ff', '#7c3aed'] },
  }
  const c = config[tier] || config.pro
  return (
    <LinearGradient colors={c.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tierBadge}>
      <Text style={styles.tierBadgeText}>{c.label}</Text>
    </LinearGradient>
  )
}

/* ── Divider ── */
export function Divider({ style }) {
  const { theme } = useTheme()
  return <View style={[styles.divider, { backgroundColor: theme.border }, style]} />
}

/* ── Page Header ── */
export function PageHeader({ title, subtitle, right, style }) {
  const { theme } = useTheme()
  return (
    <View style={[styles.pageHeader, style]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.pageTitle, { color: theme.text.primary }]}>{title}</Text>
        {subtitle && <Text style={[styles.pageSubtitle, { color: theme.text.secondary }]}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  )
}

/* ── Stat Box ── */
export function StatBox({ value, label, icon, trend, style }) {
  const { theme } = useTheme()
  return (
    <View style={[styles.statBox, { backgroundColor: theme.bg.card, borderColor: theme.border }, style]}>
      {icon && <Text style={styles.statIcon}>{icon}</Text>}
      <Text style={[styles.statValue, { color: theme.accent }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.text.tertiary }]}>{label}</Text>
      {trend !== undefined && (
        <Text style={[styles.statTrend, { color: trend > 0 ? theme.success : theme.danger }]}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </Text>
      )}
    </View>
  )
}

/* ── Empty State ── */
export function EmptyState({ icon, title, description, action, actionLabel }) {
  const { theme } = useTheme()
  return (
    <View style={styles.emptyState}>
      {icon && <Text style={styles.emptyIcon}>{icon}</Text>}
      <Text style={[styles.emptyTitle, { color: theme.text.secondary }]}>{title}</Text>
      {description && <Text style={[styles.emptyDesc, { color: theme.text.tertiary }]}>{description}</Text>}
      {action && actionLabel && (
        <Button title={actionLabel} onPress={action} variant="outline" size="sm" style={{ marginTop: spacing.lg }} />
      )}
    </View>
  )
}

/* ── Toast ── */
export function Toast({ message, visible, type = 'info' }) {
  const { theme } = useTheme()
  if (!visible || !message) return null
  const colorMap = { info: theme.accent, success: theme.success, error: theme.danger, warning: theme.warning }
  const c = colorMap[type] || theme.accent
  return (
    <View style={[styles.toast, { backgroundColor: theme.bg.elevated, borderColor: c }]}>
      <Text style={[styles.toastText, { color: theme.text.primary }]}>{message}</Text>
    </View>
  )
}

/* ── Segmented Control ── */
export function SegmentedControl({ tabs, activeTab, onTabChange, style }) {
  const { theme } = useTheme()
  return (
    <View style={[styles.segmented, { backgroundColor: theme.bg.secondary }, style]}>
      {tabs.map((tab) => {
        const active = tab.id === activeTab
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onTabChange(tab.id)}
            activeOpacity={0.7}
            style={[styles.segmentedTab, active && { backgroundColor: theme.bg.elevated }]}
          >
            {tab.icon && <Text style={{ fontSize: 13, marginRight: 4 }}>{tab.icon}</Text>}
            <Text
              style={[
                styles.segmentedText,
                { color: active ? theme.text.primary : theme.text.tertiary },
                active && { fontWeight: fontWeight.bold },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

/* ── Section Header ── */
export function SectionHeader({ title, right, style }) {
  const { theme } = useTheme()
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>{title}</Text>
      {right}
    </View>
  )
}

/* ── Chip / Tag ── */
export function Chip({ label, selected, onPress, style }) {
  const { theme } = useTheme()
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.bg.elevated,
          borderColor: selected ? theme.accent : theme.border,
        },
        style,
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? theme.text.onAccent : theme.text.secondary }]}>{label}</Text>
    </TouchableOpacity>
  )
}

/* ── Progress Bar ── */
export function ProgressBar({ progress, color, height = 6, style }) {
  const { theme } = useTheme()
  const pct = Math.min(Math.max(progress || 0, 0), 1)
  return (
    <View style={[styles.progressTrack, { height, backgroundColor: theme.bg.elevated }, style]}>
      <View
        style={[styles.progressFill, { width: `${pct * 100}%`, height, backgroundColor: color || theme.accent }]}
      />
    </View>
  )
}

/* ── Avatar ── */
export function Avatar({ uri, size = 40, fallback, style }) {
  const { theme } = useTheme()
  if (uri) {
    return <Image source={{ uri }} style={[{ width: size, height: size, borderRadius: size / 2 }, style]} />
  }
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.bg.elevated, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.4, color: theme.text.tertiary }}>{fallback || '👤'}</Text>
    </View>
  )
}

/* ── List Item ── */
export function ListItem({ title, subtitle, left, right, onPress, style }) {
  const { theme } = useTheme()
  const Wrapper = onPress ? TouchableOpacity : View
  const props = onPress ? { onPress, activeOpacity: 0.7 } : {}
  return (
    <Wrapper
      {...props}
      style={[styles.listItem, { borderBottomColor: theme.border }, style]}
    >
      {left && <View style={styles.listItemLeft}>{left}</View>}
      <View style={styles.listItemBody}>
        <Text style={[styles.listItemTitle, { color: theme.text.primary }]}>{title}</Text>
        {subtitle && <Text style={[styles.listItemSubtitle, { color: theme.text.tertiary }]}>{subtitle}</Text>}
      </View>
      {right && <View style={styles.listItemRight}>{right}</View>}
    </Wrapper>
  )
}

/* ── Icon Button ── */
export function IconButton({ icon, onPress, size = 40, style }) {
  const { theme } = useTheme()
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.bg.elevated,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.45 }}>{icon}</Text>
    </TouchableOpacity>
  )
}

/* ── Paywall Gate ── */
export function PaywallGate({ tier = 'pro', currentTier, children, navigation }) {
  const { theme } = useTheme()
  const tiers = { free: 0, pro: 1, ultra: 2 }
  if ((tiers[currentTier] || 0) >= (tiers[tier] || 1)) return children
  return (
    <View style={styles.paywallContainer}>
      <View style={[styles.paywallCard, { backgroundColor: theme.bg.card, borderColor: theme.borderAccent }]}>
        <Text style={styles.paywallIcon}>🔒</Text>
        <Text style={[styles.paywallTitle, { color: theme.text.primary }]}>
          {tier === 'ultra' ? 'ULTRA' : 'PRO'} Feature
        </Text>
        <Text style={[styles.paywallDesc, { color: theme.text.tertiary }]}>
          Upgrade to {tier === 'ultra' ? 'ULTRA' : 'PRO'} to unlock this feature.
        </Text>
        <Button
          title={`Upgrade to ${tier.toUpperCase()}`}
          onPress={() => navigation?.navigate?.('Subscription')}
          size="sm"
          style={{ marginTop: spacing.md }}
        />
      </View>
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
  glassCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  cardLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  button: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {},
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
    paddingVertical: 14,
    fontSize: fontSize.md,
  },
  inputLeftIcon: {
    position: 'absolute',
    left: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  inputRightIcon: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  inputError: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.black,
    color: '#000',
    letterSpacing: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.lg,
  },
  pageHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: fontWeight.black,
    letterSpacing: -0.8,
  },
  pageSubtitle: {
    fontSize: fontSize.sm,
    marginTop: 4,
    lineHeight: 20,
  },
  statBox: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    flex: 1,
    minHeight: 80,
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  statTrend: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl * 1.5,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
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
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  toastText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  segmentedText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  progressTrack: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: radius.full,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItemLeft: {
    marginRight: spacing.md,
  },
  listItemBody: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  listItemSubtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  listItemRight: {
    marginLeft: spacing.md,
  },
  paywallContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  paywallCard: {
    borderRadius: radius.xl || 20,
    borderWidth: 1,
    padding: spacing.xxl || 32,
    alignItems: 'center',
    width: '100%',
  },
  paywallIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  paywallTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  paywallDesc: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
})

import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Image, Animated, Pressable, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../theme/ThemeContext'
import { radius, spacing, fontSize, fontWeight } from '../theme/spacing'

/* ── Card ── */
export function Card({ children, style, glow, accent, onPress, variant = 'default' }) {
  const { theme } = useTheme()
  const Wrapper = onPress ? PressableScale : View
  const wrapperProps = onPress ? { onPress, haptic: 'light' } : {}
  const isHero = variant === 'hero'

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
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 20,
          elevation: 8,
        },
        style,
      ]}
    >
      {isHero && (
        <LinearGradient
          colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {children}
    </Wrapper>
  )
}

export function GlassCard({ children, style, accent, gradientColors }) {
  const { theme } = useTheme()
  const colors = gradientColors || [
    accent ? `${theme.accent}14` : 'rgba(255,255,255,0.05)',
    'rgba(255,255,255,0.01)',
  ]
  return (
    <View style={[styles.glassCard, { borderColor: accent ? theme.borderAccent : theme.border }, style]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={{ position: 'relative' }}>{children}</View>
    </View>
  )
}

/* ── Hero Card — gradient wash + inner glow ── */
export function HeroCard({ children, style, tint, onPress }) {
  const { theme } = useTheme()
  const Wrapper = onPress ? PressableScale : View
  const wrapperProps = onPress ? { onPress, haptic: 'medium' } : {}
  const tintColor = tint || theme.accent
  return (
    <Wrapper
      {...wrapperProps}
      style={[
        styles.heroCard,
        { backgroundColor: theme.bg.card, borderColor: theme.borderAccent },
        style,
      ]}
    >
      <LinearGradient
        colors={[`${tintColor}22`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.05)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
        pointerEvents="none"
      />
      <View style={{ position: 'relative' }}>{children}</View>
    </Wrapper>
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

/* ── PressableScale — haptic + scale animation wrapper ── */
export function PressableScale({ children, onPress, haptic = 'light', style, disabled, pressScale = 0.97 }) {
  const scale = useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: pressScale, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
  }
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start()
  }
  const handlePress = () => {
    if (haptic === 'light') Haptics.selectionAsync().catch(() => {})
    else if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    else if (haptic === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
    onPress?.()
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled}
        style={{ flex: undefined }}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}

/* ── Button — now with scale + haptic ── */
export function Button({ title, onPress, variant = 'primary', size = 'md', loading, disabled, icon, style, textStyle, haptic = 'light', gradient }) {
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
  const height = size === 'lg' ? 54 : size === 'sm' ? 36 : size === 'xs' ? 30 : 46
  const borderW = isOutline ? 1.5 : 0
  const borderC = isOutline ? theme.accent : 'transparent'
  const paddingH = size === 'sm' || size === 'xs' ? spacing.md : spacing.xl

  const content = (
    <View style={styles.buttonContent}>
      {icon}
      <Text
        style={[
          styles.buttonText,
          {
            color: textColor,
            fontSize: size === 'xs' ? 12 : size === 'sm' ? 13 : size === 'lg' ? 16 : 15,
            fontWeight: fontWeight.bold,
            letterSpacing: 0.2,
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </View>
  )

  const btnStyle = [
    styles.button,
    {
      backgroundColor: gradient ? 'transparent' : bgColor,
      height,
      opacity: disabled ? 0.4 : 1,
      borderWidth: borderW,
      borderColor: borderC,
      paddingHorizontal: paddingH,
      overflow: 'hidden',
    },
    isPrimary && !gradient && {
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    style,
  ]

  const inner = loading ? <ActivityIndicator color={textColor} size="small" /> : content

  return (
    <PressableScale
      onPress={onPress}
      haptic={disabled || loading ? null : haptic}
      disabled={disabled || loading}
      pressScale={0.96}
    >
      <View style={btnStyle}>
        {gradient && (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {isPrimary && !gradient && (
          <LinearGradient
            colors={['rgba(255,255,255,0.18)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
        {inner}
      </View>
    </PressableScale>
  )
}

/* ── Input ── focus-aware border + accent ring ── */
export function Input({ label, error, style, inputStyle, leftIcon, rightIcon, onFocus, onBlur, ...props }) {
  const { theme } = useTheme()
  const [focused, setFocused] = useState(false)
  return (
    <View style={[styles.inputGroup, style]}>
      {label && <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>{label}</Text>}
      <View style={{ position: 'relative' }}>
        {leftIcon && <View style={styles.inputLeftIcon}>{leftIcon}</View>}
        <TextInput
          placeholderTextColor={theme.text.tertiary}
          onFocus={(e) => { onFocus?.(e); setFocused(true) }}
          onBlur={(e) => { onBlur?.(e); setFocused(false) }}
          style={[
            styles.input,
            {
              backgroundColor: theme.bg.input,
              color: theme.text.primary,
              borderColor: error ? theme.danger : focused ? theme.accent : theme.border,
              paddingLeft: leftIcon ? 44 : spacing.lg,
            },
            focused && {
              shadowColor: theme.accent,
              shadowOpacity: 0.18,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 0 },
              elevation: 2,
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

/* ── Stat Box ── polished ── */
export function StatBox({ value, label, icon, trend, style, accent = true, onPress }) {
  const { theme } = useTheme()
  const Wrapper = onPress ? PressableScale : View
  const wrapperProps = onPress ? { onPress, haptic: 'light' } : {}
  return (
    <Wrapper
      {...wrapperProps}
      style={[
        styles.statBox,
        { backgroundColor: theme.bg.card, borderColor: theme.border },
        style,
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.03)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {icon && <Text style={styles.statIcon}>{icon}</Text>}
      <Text style={[styles.statValue, { color: accent ? theme.accent : theme.text.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.text.tertiary }]}>{label}</Text>
      {trend !== undefined && (
        <View style={styles.statTrendRow}>
          <Ionicons name={trend > 0 ? 'trending-up' : 'trending-down'} size={11} color={trend > 0 ? theme.success : theme.danger} />
          <Text style={[styles.statTrend, { color: trend > 0 ? theme.success : theme.danger }]}>
            {Math.abs(trend)}%
          </Text>
        </View>
      )}
    </Wrapper>
  )
}

/* ── Pill — small status tag ── */
export function Pill({ label, icon, color, variant = 'soft', style }) {
  const { theme } = useTheme()
  const c = color || theme.accent
  const isSolid = variant === 'solid'
  return (
    <View style={[
      styles.pill,
      {
        backgroundColor: isSolid ? c : `${c}14`,
        borderColor: isSolid ? c : `${c}33`,
      },
      style,
    ]}>
      {icon && <Ionicons name={icon} size={11} color={isSolid ? theme.text.onAccent : c} style={{ marginRight: 4 }} />}
      <Text style={[styles.pillText, { color: isSolid ? theme.text.onAccent : c }]}>{label}</Text>
    </View>
  )
}

/* ── Kicker — uppercase label with dot ── */
export function Kicker({ label, color, style, withDot = true }) {
  const { theme } = useTheme()
  const c = color || theme.accent
  return (
    <View style={[styles.kicker, style]}>
      {withDot && <View style={[styles.kickerDot, { backgroundColor: c, shadowColor: c }]} />}
      <Text style={[styles.kickerText, { color: c }]}>{label}</Text>
    </View>
  )
}

/* ── Quick Action tile ── */
export function QuickAction({ icon, label, onPress, color, style }) {
  const { theme } = useTheme()
  const c = color || theme.accent
  return (
    <PressableScale onPress={onPress} haptic="light" style={[{ flex: 1 }, style]}>
      <View style={[styles.quickAction, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
        <View style={[styles.quickActionIcon, { backgroundColor: `${c}14`, borderColor: `${c}33` }]}>
          <Ionicons name={icon} size={18} color={c} />
        </View>
        <Text style={[styles.quickActionLabel, { color: theme.text.primary }]}>{label}</Text>
      </View>
    </PressableScale>
  )
}

/* ── Ring Progress ── svg circular ring ── */
export function RingProgress({
  progress = 0,
  size = 100,
  strokeWidth = 8,
  color,
  backgroundColor,
  gradient,
  children,
  style,
}) {
  const { theme } = useTheme()
  const radiusSize = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radiusSize
  const clamped = Math.max(0, Math.min(1, progress))
  const offset = circumference * (1 - clamped)
  const mainColor = color || theme.accent
  const trackColor = backgroundColor || theme.bg.elevated
  const gradId = 'ringGrad' + Math.round(Math.random() * 9999)

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {gradient && (
          <Defs>
            <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={gradient[0]} stopOpacity="1" />
              <Stop offset="1" stopColor={gradient[1]} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
        )}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusSize}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusSize}
          stroke={gradient ? `url(#${gradId})` : mainColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </View>
      </View>
    </View>
  )
}

/* ── Skeleton shimmer ── */
export function Skeleton({ width = '100%', height = 16, style, radiusValue = 8 }) {
  const { theme } = useTheme()
  const shimmer = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [shimmer])

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] })

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radiusValue, backgroundColor: theme.bg.elevated, opacity },
        style,
      ]}
    />
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
export function SegmentedControl({ tabs, activeTab, onTabChange, options, selectedIndex, onChange, style }) {
  const { theme } = useTheme()

  // Support both APIs: {tabs, activeTab, onTabChange} and {options, selectedIndex, onChange}
  const resolvedTabs = tabs || (options || []).map((opt, i) => ({
    id: typeof opt === 'string' ? i : (opt.id ?? i),
    label: typeof opt === 'string' ? opt : opt.label,
    icon: typeof opt === 'string' ? undefined : opt.icon,
  }))
  const resolvedActive = activeTab !== undefined ? activeTab : selectedIndex
  const resolvedOnChange = onTabChange || ((idOrIndex) => onChange?.(typeof idOrIndex === 'number' ? idOrIndex : resolvedTabs.findIndex(t => t.id === idOrIndex)))

  return (
    <View style={[styles.segmented, { backgroundColor: theme.bg.secondary }, style]}>
      {resolvedTabs.map((tab, index) => {
        const tabId = tab.id ?? index
        const active = resolvedActive === tabId || resolvedActive === index
        return (
          <TouchableOpacity
            key={tabId}
            onPress={() => resolvedOnChange(tabId)}
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
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  glassCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: spacing.sm,
  },
  button: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
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
    fontSize: 11,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
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
    fontSize: 32,
    fontWeight: fontWeight.black,
    letterSpacing: -1.2,
    lineHeight: 34,
  },
  pageSubtitle: {
    fontSize: fontSize.sm,
    marginTop: 6,
    lineHeight: 20,
  },
  statBox: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    flex: 1,
    minHeight: 92,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: fontWeight.black,
    letterSpacing: -0.6,
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  statTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  statTrend: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.4,
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  kickerDot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  kickerText: {
    fontSize: 11,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  quickAction: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.1,
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
    borderRadius: radius.full,
    padding: 4,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  segmentedText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
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
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
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

import { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeContext'
import { fontWeight, radius } from '../theme/spacing'

/**
 * Beautiful custom tab bar:
 * - Glass surface with inner top highlight
 * - Active tab shows a pill background with accent glow
 * - Icons scale + haptic on press
 * - Honors safe area (bottom indicator)
 */
export default function GlassTabBar({ state, descriptors, navigation, iconMap }) {
  const { theme } = useTheme()
  const insets = useSafeAreaInsets()
  const bottomPad = Math.max(insets.bottom, 8)

  return (
    <View
      style={[
        styles.shell,
        {
          paddingBottom: bottomPad,
          backgroundColor: 'rgba(7,7,7,0.92)',
          borderTopColor: theme.border,
          shadowColor: theme.accent,
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const label = options.tabBarLabel ?? options.title ?? route.name
          const isFocused = state.index === index
          const icons = (iconMap && iconMap[route.name]) || { active: 'ellipse', inactive: 'ellipse-outline' }

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!isFocused && !event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => {})
              navigation.navigate(route.name, route.params)
            }
          }

          return (
            <TabItem
              key={route.key}
              icon={isFocused ? icons.active : icons.inactive}
              label={label}
              focused={isFocused}
              theme={theme}
              onPress={onPress}
            />
          )
        })}
      </View>
    </View>
  )
}

function TabItem({ icon, label, focused, theme, onPress }) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0.96)).current
  const pillOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1 : 0.96,
        useNativeDriver: true,
        speed: 30,
        bounciness: 8,
      }),
      Animated.timing(pillOpacity, {
        toValue: focused ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start()
  }, [focused])

  const color = focused ? theme.accent : theme.text.tertiary

  return (
    <Pressable onPress={onPress} style={styles.tab} android_ripple={{ color: 'rgba(255,255,255,0.06)', borderless: true }}>
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              backgroundColor: `${theme.accent}12`,
              borderColor: `${theme.accent}30`,
              opacity: pillOpacity,
              shadowColor: theme.accent,
            },
          ]}
        />
        <Ionicons name={icon} size={22} color={color} />
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color,
              fontWeight: focused ? fontWeight.bold : fontWeight.medium,
            },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  shell: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
    ...Platform.select({
      ios: {},
      android: { backgroundColor: 'rgba(7,7,7,0.99)' },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
  },
  tabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: 2,
    left: 10,
    right: 10,
    bottom: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
})

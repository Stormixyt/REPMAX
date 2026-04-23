import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { Button, Card, CardLabel, CardTitle, PageHeader, SectionHeader, Divider, Kicker, Pill, PressableScale } from '../../components/ui'
import { fontSize, fontWeight, radius, spacing } from '../../theme/spacing'

const TIERS = [
  {
    key: 'free',
    title: 'FREE',
    price: '€0',
    suffix: 'forever',
    tagline: 'Start training with the essentials.',
    features: ['Workout tracking', 'Program dashboard', 'Run tracker beta'],
    gradient: null,
  },
  {
    key: 'pro',
    title: 'PRO',
    price: '€3',
    suffix: '/ week',
    tagline: 'Smarter coach, premium UI, deeper tools.',
    features: ['AI coach upgrades', 'Premium interface skins', 'Advanced recovery + nutrition'],
    gradient: ['#ccff00', '#88cc00'],
  },
  {
    key: 'ultra',
    title: 'ULTRA',
    price: '€5',
    suffix: '/ week',
    tagline: 'The top of the stack. Intelligence + exclusives.',
    features: ['Ultra Lab intelligence', 'Import studio', 'Top-tier analytics & exclusives'],
    gradient: ['#b026ff', '#ff2a85'],
  },
]

const COMPARISON = [
  { feature: 'Workout tracking', free: true, pro: true, ultra: true },
  { feature: 'Run tracker', free: true, pro: true, ultra: true },
  { feature: 'Basic nutrition', free: true, pro: true, ultra: true },
  { feature: 'AI Coach (basic)', free: true, pro: true, ultra: true },
  { feature: 'AI Coach (premium models)', free: false, pro: true, ultra: true },
  { feature: 'Interface skins', free: false, pro: true, ultra: true },
  { feature: 'Recovery hub', free: false, pro: true, ultra: true },
  { feature: 'AI food scan', free: false, pro: true, ultra: true },
  { feature: 'Ultra Lab intelligence', free: false, pro: false, ultra: true },
  { feature: 'Import studio', free: false, pro: false, ultra: true },
  { feature: 'Social Edge', free: false, pro: false, ultra: true },
]

export default function SubscriptionScreen() {
  const { isPro, isUltra, profile } = useAuth()
  const { theme } = useTheme()
  const insets = useSafeAreaInsets()

  const currentTier = isUltra ? 'ultra' : isPro ? 'pro' : 'free'

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.bg.primary }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <Text style={[styles.kicker, { color: theme.text.tertiary }]}>UPGRADE</Text>
        <Text style={[styles.title, { color: theme.text.primary }]}>Pick your tier</Text>
        <Text style={[styles.sub, { color: theme.text.secondary }]}>How deep do you want REPMAX to go?</Text>
      </View>

      {TIERS.map((tier) => {
        const active = currentTier === tier.key
        const isUltraTier = tier.key === 'ultra'
        const isProTier = tier.key === 'pro'
        return (
          <View
            key={tier.key}
            style={[
              styles.tierCard,
              {
                backgroundColor: theme.bg.card,
                borderColor: active ? theme.accent : isUltraTier ? 'rgba(255, 42, 133, 0.22)' : theme.border,
                shadowColor: active ? theme.accent : 'transparent',
                shadowOpacity: active ? 0.25 : 0,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: active ? 8 : 0,
              },
            ]}
          >
            {tier.gradient && (
              <LinearGradient
                colors={[`${tier.gradient[0]}18`, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            )}

            <View style={styles.tierHead}>
              <View style={{ flex: 1 }}>
                <View style={styles.tierBadgeRow}>
                  {tier.gradient ? (
                    <LinearGradient
                      colors={tier.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.tierPill}
                    >
                      <Text style={styles.tierPillText}>{tier.title}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.tierPill, { backgroundColor: theme.bg.elevated, borderWidth: 1, borderColor: theme.border }]}>
                      <Text style={[styles.tierPillText, { color: theme.text.tertiary }]}>{tier.title}</Text>
                    </View>
                  )}
                  {active && <Pill label="CURRENT" color={theme.accent} variant="soft" />}
                </View>
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: theme.text.primary }]}>{tier.price}</Text>
                  <Text style={[styles.priceSuffix, { color: theme.text.tertiary }]}>{tier.suffix}</Text>
                </View>
                <Text style={[styles.tagline, { color: theme.text.secondary }]}>{tier.tagline}</Text>
              </View>
            </View>

            <View style={styles.featureList}>
              {tier.features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <View style={[styles.featureDot, { backgroundColor: isUltraTier ? '#ff2a85' : theme.accent }]} />
                  <Text style={[styles.featureText, { color: theme.text.primary }]}>{feature}</Text>
                </View>
              ))}
            </View>

            {!active && (
              <Button
                title={isProTier ? 'Go Pro' : isUltraTier ? 'Unlock ULTRA' : 'Start Free'}
                onPress={() => Linking.openURL('https://www.rep-max.app/app?upgrade=1').catch(() => {})}
                icon={<Ionicons name={isUltraTier ? 'diamond' : 'flash'} size={15} color={isUltraTier ? '#fff' : theme.text.onAccent} />}
                style={{ marginTop: spacing.md }}
                gradient={tier.gradient}
                haptic="medium"
              />
            )}
          </View>
        )
      })}

      <View style={[styles.statusCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
        <Kicker label="Current Status" />
        <Text style={[styles.statusText, { color: theme.text.primary }]}>
          You're on <Text style={{ color: theme.accent }}>{String(profile?.subscription_tier || currentTier).toUpperCase()}</Text>.
        </Text>
        <Text style={[styles.statusSubtext, { color: theme.text.secondary }]}>
          Billing is handled on the web while native checkout is being ported.
        </Text>
        <Button
          title="Open Web Billing"
          variant="outline"
          onPress={() => Linking.openURL('https://www.rep-max.app/app?upgrade=1').catch(() => {})}
          icon={<Ionicons name="open-outline" size={15} color={theme.accent} />}
          style={{ marginTop: spacing.md }}
        />
      </View>

      <SectionHeader title="FEATURE COMPARISON" />
      <View style={[styles.compCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
        <View style={styles.compRow}>
          <Text style={[styles.compFeatureHead, { color: theme.text.tertiary }]}>Feature</Text>
          <Text style={[styles.compTierHead, { color: theme.text.tertiary }]}>Free</Text>
          <Text style={[styles.compTierHead, { color: theme.text.tertiary }]}>Pro</Text>
          <Text style={[styles.compTierHead, { color: theme.text.tertiary }]}>Ultra</Text>
        </View>
        <Divider style={{ marginVertical: 8 }} />
        {COMPARISON.map((row, i) => (
          <View key={i} style={[styles.compRow, i % 2 === 0 && { backgroundColor: theme.bg.elevated + '33', borderRadius: 10 }]}>
            <Text style={[styles.compFeature, { color: theme.text.primary }]} numberOfLines={1}>{row.feature}</Text>
            {[row.free, row.pro, row.ultra].map((v, j) => (
              <View key={j} style={styles.compTierCell}>
                <Ionicons name={v ? 'checkmark-circle' : 'remove-circle-outline'} size={16} color={v ? theme.accent : theme.text.tertiary + '88'} />
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: spacing.xxxl },
  topRow: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  kicker: { fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1.6 },
  title: { fontSize: 32, fontWeight: fontWeight.black, letterSpacing: -1, marginTop: 6, lineHeight: 36 },
  sub: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  tierCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tierHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  tierBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  tierPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full },
  tierPillText: { fontSize: 11, fontWeight: fontWeight.black, letterSpacing: 1.4, color: '#070707' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price: { fontSize: 38, fontWeight: fontWeight.black, letterSpacing: -1.2, lineHeight: 42 },
  priceSuffix: { fontSize: 13, fontWeight: fontWeight.semibold, letterSpacing: 0.2 },
  tagline: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  featureList: { marginTop: spacing.md, gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureDot: { width: 6, height: 6, borderRadius: 3 },
  featureText: { fontSize: 14, flex: 1, fontWeight: fontWeight.medium, letterSpacing: -0.1 },
  statusCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  statusText: { fontSize: 20, fontWeight: fontWeight.black, letterSpacing: -0.5, marginTop: 6, lineHeight: 24 },
  statusSubtext: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  compCard: { marginHorizontal: spacing.xl, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  compRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 },
  compFeatureHead: { flex: 2, fontSize: 11, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 1.2 },
  compTierHead: { flex: 1, fontSize: 11, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 1.2, textAlign: 'center' },
  compFeature: { flex: 2, fontSize: 13, fontWeight: fontWeight.medium },
  compTierCell: { flex: 1, alignItems: 'center' },
})

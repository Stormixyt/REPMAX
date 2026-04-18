import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { Button, Card, CardLabel, CardTitle, PageHeader } from '../../components/ui'
import { fontSize, fontWeight, radius, spacing } from '../../theme/spacing'

const TIERS = [
  {
    key: 'free',
    title: 'FREE',
    price: '€0',
    features: ['Workout tracking', 'Program dashboard', 'Run tracker beta'],
  },
  {
    key: 'pro',
    title: 'PRO',
    price: '€3 / week',
    features: ['AI coach upgrades', 'Premium interface skins', 'Advanced recovery + nutrition tools'],
  },
  {
    key: 'ultra',
    title: 'ULTRA',
    price: '€5 / week',
    features: ['Ultra Lab intelligence', 'Import studio', 'Highest-tier analytics and exclusives'],
  },
]

export default function SubscriptionScreen() {
  const { isPro, isUltra, profile } = useAuth()
  const { theme } = useTheme()

  const currentTier = isUltra ? 'ultra' : isPro ? 'pro' : 'free'

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.bg.primary }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader title="Subscription" subtitle="Choose the REPMAX tier that matches how deep you want the system to go." />

      {TIERS.map((tier) => {
        const active = currentTier === tier.key
        return (
          <Card
            key={tier.key}
            style={[
              styles.tierCard,
              {
                borderColor: active ? theme.accent : theme.border,
                backgroundColor: active ? theme.bg.secondary : theme.bg.card,
              },
            ]}
          >
            <View style={styles.rowBetween}>
              <View>
                <CardLabel>{tier.title}</CardLabel>
                <CardTitle>{tier.price}</CardTitle>
              </View>
              {active && (
                <View style={[styles.activePill, { backgroundColor: theme.accent }]}>
                  <Text style={[styles.activePillText, { color: theme.text.onAccent }]}>ACTIVE</Text>
                </View>
              )}
            </View>

            <View style={styles.featureList}>
              {tier.features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.accent} />
                  <Text style={[styles.featureText, { color: theme.text.secondary }]}>{feature}</Text>
                </View>
              ))}
            </View>
          </Card>
        )
      })}

      <Card>
        <CardLabel>Current Status</CardLabel>
        <Text style={[styles.statusText, { color: theme.text.primary }]}>
          You are currently on {String(profile?.subscription_tier || currentTier).toUpperCase()}.
        </Text>
        <Text style={[styles.statusSubtext, { color: theme.text.secondary }]}>
          Billing and checkout are still handled by the existing REPMAX web flow while the native purchase flow is being ported.
        </Text>
        <Button
          title="Open Web Billing"
          onPress={() => Linking.openURL('https://www.rep-max.app/app?upgrade=1').catch(() => {})}
          icon={<Ionicons name="open-outline" size={16} color={theme.text.onAccent} />}
          style={styles.billingButton}
        />
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxxl,
  },
  tierCard: {
    marginHorizontal: spacing.xl,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  activePill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  activePillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black,
  },
  featureList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  statusText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  statusSubtext: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  billingButton: {
    marginTop: spacing.lg,
  },
})

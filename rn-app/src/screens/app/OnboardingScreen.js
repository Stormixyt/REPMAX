import { useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { Button, Card, CardLabel, CardTitle, PageHeader } from '../../components/ui'
import { fontSize, fontWeight, radius, spacing } from '../../theme/spacing'

const STEPS = ['Goal', 'Level', 'Days', 'Split', 'Equipment', 'Finish']
const TRAINING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const GOALS = [
  { key: 'strength', title: 'Strength', copy: 'Heavy compounds, progression focus, lower fluff.' },
  { key: 'hypertrophy', title: 'Hypertrophy', copy: 'More volume, more muscle, tighter exercise rotation.' },
  { key: 'athletic', title: 'Athletic', copy: 'Speed, conditioning, movement quality, and power.' },
  { key: 'general', title: 'General', copy: 'Balanced training with sustainability built in.' },
]

const LEVELS = [
  { key: 'beginner', title: 'Beginner', copy: 'You are learning technique and building consistency.' },
  { key: 'intermediate', title: 'Intermediate', copy: 'You have solid habits and want smarter progression.' },
  { key: 'advanced', title: 'Advanced', copy: 'You need structure, load management, and precision.' },
]

const EQUIPMENT = [
  { key: 'full_gym', title: 'Full Gym', copy: 'Commercial gym access with machines and free weights.' },
  { key: 'home_gym', title: 'Home Gym', copy: 'Rack, bench, dumbbells, or a good garage setup.' },
  { key: 'bodyweight', title: 'Bodyweight', copy: 'Minimal equipment, mobility, and bodyweight work.' },
]

function getSplitOptions(dayCount) {
  if (dayCount <= 2) return ['full_body', 'upper_lower']
  if (dayCount === 3) return ['full_body', 'push_pull_legs']
  if (dayCount === 4) return ['upper_lower', 'push_pull']
  if (dayCount === 5) return ['push_pull_legs_upper_lower', 'bro_split']
  return ['push_pull_legs_x2', 'bro_split']
}

function prettifySplit(split) {
  return String(split || '')
    .split('_')
    .map((part) => part.toUpperCase())
    .join(' / ')
}

function buildProgramDays(trainingDays, preferredSplit) {
  const templates = {
    full_body: ['Full Body A', 'Full Body B', 'Full Body C', 'Full Body D'],
    upper_lower: ['Upper', 'Lower', 'Upper', 'Lower'],
    push_pull_legs: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
    push_pull: ['Push', 'Pull', 'Push', 'Pull'],
    push_pull_legs_upper_lower: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
    push_pull_legs_x2: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
    bro_split: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Upper'],
  }

  const exerciseMap = {
    Push: [{ name: 'Bench Press', sets: 4, reps: '6-8' }, { name: 'Incline Dumbbell Press', sets: 3, reps: '8-10' }, { name: 'Lateral Raise', sets: 3, reps: '12-15' }],
    Pull: [{ name: 'Barbell Row', sets: 4, reps: '6-8' }, { name: 'Lat Pulldown', sets: 3, reps: '8-12' }, { name: 'Cable Curl', sets: 3, reps: '10-12' }],
    Legs: [{ name: 'Back Squat', sets: 4, reps: '5-8' }, { name: 'Romanian Deadlift', sets: 3, reps: '8-10' }, { name: 'Leg Press', sets: 3, reps: '10-12' }],
    Upper: [{ name: 'Bench Press', sets: 4, reps: '6-8' }, { name: 'Row', sets: 4, reps: '6-8' }, { name: 'Shoulder Press', sets: 3, reps: '8-10' }],
    Lower: [{ name: 'Back Squat', sets: 4, reps: '5-8' }, { name: 'Deadlift', sets: 3, reps: '3-5' }, { name: 'Hamstring Curl', sets: 3, reps: '10-12' }],
    Chest: [{ name: 'Bench Press', sets: 4, reps: '6-8' }, { name: 'Incline Press', sets: 3, reps: '8-10' }, { name: 'Fly', sets: 3, reps: '12-15' }],
    Back: [{ name: 'Barbell Row', sets: 4, reps: '6-8' }, { name: 'Pull-Up', sets: 3, reps: '6-10' }, { name: 'Seated Row', sets: 3, reps: '10-12' }],
    Shoulders: [{ name: 'Overhead Press', sets: 4, reps: '6-8' }, { name: 'Lateral Raise', sets: 4, reps: '12-15' }, { name: 'Rear Delt Fly', sets: 3, reps: '12-15' }],
    Arms: [{ name: 'Close Grip Bench', sets: 3, reps: '8-10' }, { name: 'EZ Curl', sets: 3, reps: '10-12' }, { name: 'Hammer Curl', sets: 3, reps: '10-12' }],
    'Full Body A': [{ name: 'Back Squat', sets: 4, reps: '5-8' }, { name: 'Bench Press', sets: 4, reps: '6-8' }, { name: 'Row', sets: 3, reps: '8-10' }],
    'Full Body B': [{ name: 'Deadlift', sets: 3, reps: '3-5' }, { name: 'Overhead Press', sets: 4, reps: '6-8' }, { name: 'Pull-Up', sets: 3, reps: '6-10' }],
    'Full Body C': [{ name: 'Front Squat', sets: 4, reps: '6-8' }, { name: 'Incline Press', sets: 3, reps: '8-10' }, { name: 'Lat Pulldown', sets: 3, reps: '10-12' }],
    'Full Body D': [{ name: 'Romanian Deadlift', sets: 4, reps: '8-10' }, { name: 'Dips', sets: 3, reps: '8-12' }, { name: 'Cable Row', sets: 3, reps: '10-12' }],
  }

  const rotation = templates[preferredSplit] || templates.full_body

  return trainingDays.map((day, index) => {
    const dayName = rotation[index % rotation.length]
    return {
      day,
      day_name: dayName,
      exercises: exerciseMap[dayName] || [{ name: 'Compound Lift', sets: 4, reps: '6-8' }, { name: 'Accessory Lift', sets: 3, reps: '8-12' }],
    }
  })
}

export default function OnboardingScreen() {
  const { user, profile, updateProfile } = useAuth()
  const { theme } = useTheme()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [goal, setGoal] = useState(profile?.goal || 'hypertrophy')
  const [experienceLevel, setExperienceLevel] = useState(profile?.experience_level || 'beginner')
  const [trainingDays, setTrainingDays] = useState(profile?.training_days?.length ? profile.training_days : ['Mon', 'Tue', 'Thu'])
  const [preferredSplit, setPreferredSplit] = useState(profile?.preferred_split || 'push_pull_legs')
  const [equipment, setEquipment] = useState(profile?.equipment || 'full_gym')

  const splitOptions = useMemo(() => getSplitOptions(trainingDays.length), [trainingDays.length])

  function goNext() {
    Haptics.selectionAsync().catch(() => {})
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  function goBack() {
    Haptics.selectionAsync().catch(() => {})
    setStep((current) => Math.max(current - 1, 0))
  }

  function toggleTrainingDay(day) {
    Haptics.selectionAsync().catch(() => {})
    setTrainingDays((current) => {
      if (current.includes(day)) {
        if (current.length <= 2) return current
        return current.filter((entry) => entry !== day)
      }
      return [...current, day].sort((a, b) => TRAINING_DAYS.indexOf(a) - TRAINING_DAYS.indexOf(b))
    })
  }

  async function finishOnboarding() {
    if (!user?.id) return

    setSaving(true)

    try {
      const programDays = buildProgramDays(trainingDays, preferredSplit)
      const starterProgram = {
        name: `REPMAX ${prettifySplit(preferredSplit)}`,
        split_type: preferredSplit,
        total_weeks: 4,
        program_data: {
          weeks: [
            {
              week: 1,
              days: programDays,
            },
          ],
        },
        active: true,
      }

      await supabase.from('programs').update({ active: false }).eq('user_id', user.id)
      await supabase.from('programs').insert({
        user_id: user.id,
        ...starterProgram,
      })

      await updateProfile({
        goal,
        experience_level: experienceLevel,
        training_days: trainingDays,
        preferred_split: preferredSplit,
        equipment,
        onboarded: true,
      })
    } catch (error) {
      console.error('Onboarding save error:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={[styles.screen, { backgroundColor: theme.bg.primary }]} contentContainerStyle={styles.content}>
      <PageHeader title="Set Up REPMAX" subtitle="We’ll build your starting lane, then let the app adapt from real training." />

      <View style={styles.stepDots}>
        {STEPS.map((label, index) => {
          const active = index === step
          const complete = index < step
          return (
            <View key={label} style={styles.stepDotWrap}>
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: active || complete ? theme.accent : theme.bg.elevated,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}
              />
              <Text style={[styles.stepLabel, { color: active ? theme.text.primary : theme.text.tertiary }]}>{label}</Text>
            </View>
          )
        })}
      </View>

      {step === 0 && (
        <Card>
          <CardLabel>Step 1</CardLabel>
          <CardTitle>What are you training for?</CardTitle>
          <View style={styles.optionStack}>
            {GOALS.map((option) => {
              const active = goal === option.key
              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.85}
                  onPress={() => setGoal(option.key)}
                  style={[
                    styles.bigOption,
                    {
                      backgroundColor: active ? theme.accentGlowStrong : theme.bg.elevated,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.bigOptionTitle, { color: theme.text.primary }]}>{option.title}</Text>
                  <Text style={[styles.bigOptionCopy, { color: theme.text.secondary }]}>{option.copy}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardLabel>Step 2</CardLabel>
          <CardTitle>How experienced are you?</CardTitle>
          <View style={styles.optionStack}>
            {LEVELS.map((option) => {
              const active = experienceLevel === option.key
              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.85}
                  onPress={() => setExperienceLevel(option.key)}
                  style={[
                    styles.bigOption,
                    {
                      backgroundColor: active ? theme.accentGlowStrong : theme.bg.elevated,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.bigOptionTitle, { color: theme.text.primary }]}>{option.title}</Text>
                  <Text style={[styles.bigOptionCopy, { color: theme.text.secondary }]}>{option.copy}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardLabel>Step 3</CardLabel>
          <CardTitle>Which days can you train?</CardTitle>
          <Text style={[styles.helperText, { color: theme.text.secondary }]}>Pick at least 2. REPMAX will build the split around this.</Text>
          <View style={styles.dayGrid}>
            {TRAINING_DAYS.map((day) => {
              const active = trainingDays.includes(day)
              return (
                <TouchableOpacity
                  key={day}
                  activeOpacity={0.85}
                  onPress={() => toggleTrainingDay(day)}
                  style={[
                    styles.dayChip,
                    {
                      backgroundColor: active ? theme.accent : theme.bg.elevated,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.dayChipText, { color: active ? theme.text.onAccent : theme.text.primary }]}>{day}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardLabel>Step 4</CardLabel>
          <CardTitle>Pick your split</CardTitle>
          <View style={styles.optionStack}>
            {splitOptions.map((split) => {
              const active = preferredSplit === split
              return (
                <TouchableOpacity
                  key={split}
                  activeOpacity={0.85}
                  onPress={() => setPreferredSplit(split)}
                  style={[
                    styles.bigOption,
                    {
                      backgroundColor: active ? theme.accentGlowStrong : theme.bg.elevated,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.bigOptionTitle, { color: theme.text.primary }]}>{prettifySplit(split)}</Text>
                  <Text style={[styles.bigOptionCopy, { color: theme.text.secondary }]}>
                    Built for {trainingDays.length} training day{trainingDays.length === 1 ? '' : 's'} per week.
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardLabel>Step 5</CardLabel>
          <CardTitle>What equipment do you have?</CardTitle>
          <View style={styles.optionStack}>
            {EQUIPMENT.map((option) => {
              const active = equipment === option.key
              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.85}
                  onPress={() => setEquipment(option.key)}
                  style={[
                    styles.bigOption,
                    {
                      backgroundColor: active ? theme.accentGlowStrong : theme.bg.elevated,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.bigOptionTitle, { color: theme.text.primary }]}>{option.title}</Text>
                  <Text style={[styles.bigOptionCopy, { color: theme.text.secondary }]}>{option.copy}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardLabel>Step 6</CardLabel>
          <CardTitle>Review your setup</CardTitle>
          <View style={styles.summaryList}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryKey, { color: theme.text.secondary }]}>Goal</Text>
              <Text style={[styles.summaryValue, { color: theme.text.primary }]}>{goal}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryKey, { color: theme.text.secondary }]}>Experience</Text>
              <Text style={[styles.summaryValue, { color: theme.text.primary }]}>{experienceLevel}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryKey, { color: theme.text.secondary }]}>Days</Text>
              <Text style={[styles.summaryValue, { color: theme.text.primary }]}>{trainingDays.join(', ')}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryKey, { color: theme.text.secondary }]}>Split</Text>
              <Text style={[styles.summaryValue, { color: theme.text.primary }]}>{prettifySplit(preferredSplit)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryKey, { color: theme.text.secondary }]}>Equipment</Text>
              <Text style={[styles.summaryValue, { color: theme.text.primary }]}>{equipment.replace('_', ' ')}</Text>
            </View>
          </View>
          <View style={[styles.generatorCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border }]}>
            {saving ? (
              <>
                <ActivityIndicator size="small" color={theme.accent} />
                <Text style={[styles.generatorTitle, { color: theme.text.primary }]}>Creating your starter program…</Text>
                <Text style={[styles.generatorCopy, { color: theme.text.secondary }]}>
                  Saving your profile and building your first training week.
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.generatorTitle, { color: theme.text.primary }]}>Ready to lock in</Text>
                <Text style={[styles.generatorCopy, { color: theme.text.secondary }]}>
                  This seeds a working REPMAX program immediately so Dashboard and Workout are live after setup.
                </Text>
              </>
            )}
          </View>
        </Card>
      )}

      <View style={styles.footer}>
        {step > 0 && (
          <Button title="Back" variant="secondary" onPress={goBack} style={styles.footerButton} />
        )}
        {step < STEPS.length - 1 ? (
          <Button title="Next" onPress={goNext} style={styles.footerButton} />
        ) : (
          <Button title="Finish Setup" onPress={finishOnboarding} loading={saving} style={styles.footerButton} />
        )}
      </View>
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
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  stepDotWrap: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  optionStack: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  bigOption: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  bigOptionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
  },
  bigOptionCopy: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  helperText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  dayChip: {
    width: '22%',
    minWidth: 68,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dayChipText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  summaryList: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryKey: {
    fontSize: fontSize.sm,
  },
  summaryValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    flexShrink: 1,
    textAlign: 'right',
  },
  generatorCard: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  generatorTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    textAlign: 'center',
  },
  generatorCopy: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  footerButton: {
    flex: 1,
  },
})

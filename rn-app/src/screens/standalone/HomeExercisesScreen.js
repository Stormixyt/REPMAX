import { useState, useMemo } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme/ThemeContext'
import { EXERCISES, EXERCISE_CATEGORIES } from '../../data/homeExercises'
import { Card, Badge } from '../../components/ui'
import { spacing, fontSize, fontWeight, radius } from '../../theme/spacing'

const DIFFICULTY_COLORS = { beginner: '#22c55e', intermediate: '#f59e0b', advanced: '#ef4444' }

export default function HomeExercisesScreen() {
  const navigation = useNavigation()
  const { theme } = useTheme()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const filtered = useMemo(() => {
    let list = EXERCISES
    if (category) list = list.filter(e => e.category === category)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.muscles.some(m => m.toLowerCase().includes(q)))
    }
    return list
  }, [search, category])

  function renderExercise({ item }) {
    const isOpen = expanded === item.id
    return (
      <TouchableOpacity onPress={() => setExpanded(isOpen ? null : item.id)}
        style={[styles.exerciseCard, { backgroundColor: theme.bg.card, borderColor: isOpen ? theme.borderAccent : theme.border }]}>
        <View style={styles.exerciseHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.exerciseName, { color: theme.text.primary }]}>{item.name}</Text>
            <Text style={[styles.exerciseMeta, { color: theme.text.tertiary }]}>{item.muscles.join(', ')} · {item.reps}</Text>
          </View>
          <Badge label={item.difficulty} color={DIFFICULTY_COLORS[item.difficulty]} />
        </View>
        {isOpen && (
          <View style={styles.exerciseBody}>
            {item.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <Text style={[styles.stepNum, { color: theme.accent }]}>{i + 1}</Text>
                <Text style={[styles.stepText, { color: theme.text.secondary }]}>{step}</Text>
              </View>
            ))}
            {item.equipment !== 'none' && (
              <Text style={[styles.equipmentTag, { color: theme.text.tertiary }]}>Equipment: {item.equipment}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg.primary }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text.primary }]}>Home Exercises</Text>
      </View>

      <TextInput
        style={[styles.search, { backgroundColor: theme.bg.input, color: theme.text.primary, borderColor: theme.border }]}
        placeholder="Search exercises..."
        placeholderTextColor={theme.text.tertiary}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        horizontal
        data={[null, ...EXERCISE_CATEGORIES]}
        keyExtractor={(item, i) => item || `all-${i}`}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryList}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.catBtn, { backgroundColor: category === item ? theme.accent : theme.bg.elevated }]}
            onPress={() => setCategory(item)}>
            <Text style={[styles.catLabel, { color: category === item ? theme.text.onAccent : theme.text.secondary }]}>{item || 'All'}</Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filtered}
        renderItem={renderExercise}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  search: { marginHorizontal: spacing.xl, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: fontSize.sm, marginBottom: spacing.sm },
  categoryList: { maxHeight: 40, marginBottom: spacing.sm },
  catBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full },
  catLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  exerciseCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center' },
  exerciseName: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  exerciseMeta: { fontSize: fontSize.xs, marginTop: 2 },
  exerciseBody: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stepNum: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, width: 20 },
  stepText: { fontSize: fontSize.sm, flex: 1, lineHeight: 20 },
  equipmentTag: { fontSize: fontSize.xs, fontStyle: 'italic', marginTop: spacing.sm },
})

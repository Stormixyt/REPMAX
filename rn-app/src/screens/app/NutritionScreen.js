import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { invokeServerApi, supabase } from '../../lib/supabase'
import { Button, Card, CardLabel, CardTitle, EmptyState, Input, PageHeader } from '../../components/ui'
import { fontSize, fontWeight, radius, spacing } from '../../theme/spacing'

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', factor: 1.2 },
  { id: 'light', label: 'Light', factor: 1.375 },
  { id: 'moderate', label: 'Moderate', factor: 1.55 },
  { id: 'active', label: 'Active', factor: 1.725 },
  { id: 'very_active', label: 'Extreme', factor: 1.9 },
]

const DIET_GOALS = [
  { id: 'aggressive_cut', label: 'Aggressive Cut', delta: -500 },
  { id: 'cut', label: 'Cut', delta: -300 },
  { id: 'maintain', label: 'Maintain', delta: 0 },
  { id: 'lean_bulk', label: 'Lean Bulk', delta: 250 },
  { id: 'bulk', label: 'Bulk', delta: 500 },
]

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { id: 'lunch', label: 'Lunch', icon: 'time-outline' },
  { id: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { id: 'snack', label: 'Snack', icon: 'flash-outline' },
]

function toDateKey(date) {
  return date.toISOString().split('T')[0]
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function inferActivityLevel(trainingDays = []) {
  const count = Array.isArray(trainingDays) ? trainingDays.length : 0
  if (count >= 6) return 'very_active'
  if (count >= 4) return 'active'
  if (count >= 3) return 'moderate'
  if (count >= 1) return 'light'
  return 'sedentary'
}

function buildSetupDraft(profile = {}) {
  return {
    age: profile?.age ? String(profile.age) : '',
    weight: profile?.weight_kg ? String(profile.weight_kg) : profile?.weight ? String(profile.weight) : '',
    height: profile?.height_cm ? String(profile.height_cm) : profile?.height ? String(profile.height) : '',
    gender: 'male',
    activity_level: inferActivityLevel(profile?.training_days),
    diet_goal: 'maintain',
  }
}

function calculateNutritionProfile(form) {
  if (!form.age || !form.weight || !form.height) return null

  const age = Number(form.age)
  const weight = Number(form.weight)
  const height = Number(form.height)
  const activityFactor = ACTIVITY_LEVELS.find((level) => level.id === form.activity_level)?.factor || 1.55
  const goalDelta = DIET_GOALS.find((goal) => goal.id === form.diet_goal)?.delta || 0

  if (!age || !weight || !height) return null

  const bmr = form.gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161

  const tdee = bmr * activityFactor
  const targetCalories = Math.round(tdee + goalDelta)
  const proteinMultiplier = form.diet_goal === 'aggressive_cut' ? 2.3 : form.diet_goal === 'cut' ? 2.2 : 2.0
  const targetProtein = Math.round(weight * proteinMultiplier)
  const targetFat = Math.round((targetCalories * 0.25) / 9)
  const targetCarbs = Math.max(0, Math.round((targetCalories - targetProtein * 4 - targetFat * 9) / 4))

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target_calories: targetCalories,
    target_protein: targetProtein,
    target_carbs: targetCarbs,
    target_fat: targetFat,
  }
}

async function searchOpenFoodFacts(query) {
  const encoded = encodeURIComponent(query.trim())
  const response = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encoded}&search_simple=1&action=process&json=1&page_size=8`
  )
  const data = await response.json()
  return (data?.products || [])
    .filter((product) => product?.product_name && product?.nutriments)
    .map((product) => ({
      food_name: product.product_name,
      brand: product.brands || '',
      serving_size: product.serving_size || '100g',
      calories: Math.round(product.nutriments['energy-kcal_100g'] || product.nutriments['energy-kcal'] || 0),
      protein: Math.round(product.nutriments.proteins_100g || 0),
      carbs: Math.round(product.nutriments.carbohydrates_100g || 0),
      fat: Math.round(product.nutriments.fat_100g || 0),
      fiber: Math.round(product.nutriments.fiber_100g || 0),
      sugar: Math.round(product.nutriments.sugars_100g || 0),
    }))
}

async function lookupBarcode(barcode) {
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
  )
  const data = await response.json()

  if (data?.status !== 1 || !data?.product) return null

  const product = data.product
  const nutrients = product.nutriments || {}

  return {
    food_name: product.product_name || barcode,
    brand: product.brands || '',
    serving_size: product.serving_size || '100g',
    calories: Math.round(nutrients['energy-kcal_100g'] || nutrients['energy-kcal'] || 0),
    protein: Math.round(nutrients.proteins_100g || 0),
    carbs: Math.round(nutrients.carbohydrates_100g || 0),
    fat: Math.round(nutrients.fat_100g || 0),
    fiber: Math.round(nutrients.fiber_100g || 0),
    sugar: Math.round(nutrients.sugars_100g || 0),
  }
}

function normalizeFoodResult(payload) {
  return {
    food_name: String(payload?.food_name || 'Meal'),
    brand: String(payload?.brand || ''),
    serving_size: String(payload?.serving_size || '1 serving'),
    calories: Number(payload?.calories || 0),
    protein: Number(payload?.protein || 0),
    carbs: Number(payload?.carbs || 0),
    fat: Number(payload?.fat || 0),
    fiber: Number(payload?.fiber || 0),
    sugar: Number(payload?.sugar || 0),
  }
}

function MacroBar({ label, value, target, color, theme }) {
  const progress = target > 0 ? Math.min(1, value / target) : 0

  return (
    <View style={styles.macroBarWrap}>
      <View style={styles.rowBetween}>
        <Text style={[styles.macroLabel, { color: theme.text.secondary }]}>{label}</Text>
        <Text style={[styles.macroValue, { color: theme.text.primary }]}>
          {Math.round(value)} / {Math.round(target || 0)}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.bg.elevated }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  )
}

export default function NutritionScreen() {
  const { user, profile, isPro } = useAuth()
  const { theme } = useTheme()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [nutritionProfile, setNutritionProfile] = useState(null)
  const [logs, setLogs] = useState([])
  const [savedMeals, setSavedMeals] = useState([])
  const [waterGlasses, setWaterGlasses] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [showAddFood, setShowAddFood] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState('snack')
  const [entryMode, setEntryMode] = useState('search')
  const [setupForm, setSetupForm] = useState(buildSetupDraft(profile))
  const [manualFood, setManualFood] = useState({
    food_name: '',
    serving_size: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [photoScanning, setPhotoScanning] = useState(false)
  const mounted = useRef(true)

  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate])

  useEffect(() => {
    mounted.current = true
    loadNutrition()
    return () => {
      mounted.current = false
    }
  }, [selectedDateKey, user?.id])

  async function loadNutrition() {
    if (!user?.id) return

    try {
      const [profileRes, logsRes, waterRes, savedRes] = await Promise.all([
        supabase.from('nutrition_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('food_logs').select('*').eq('user_id', user.id).eq('logged_at', selectedDateKey).order('created_at', { ascending: true }),
        supabase.from('water_logs').select('glasses').eq('user_id', user.id).eq('logged_at', selectedDateKey).maybeSingle(),
        supabase.from('saved_meals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
      ])

      if (!mounted.current) return

      setNutritionProfile(profileRes.data || null)
      setLogs(logsRes.data || [])
      setWaterGlasses(Number(waterRes.data?.glasses || 0))
      setSavedMeals(savedRes.data || [])

      if (!profileRes.data) {
        setSetupForm(buildSetupDraft(profile))
        setShowSetup(true)
      } else {
        setShowSetup(false)
      }
    } catch (error) {
      console.error('Nutrition load error:', error)
    } finally {
      if (mounted.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  function onRefresh() {
    setRefreshing(true)
    loadNutrition()
  }

  async function saveNutritionProfile() {
    const computed = calculateNutritionProfile(setupForm)
    if (!computed) {
      Alert.alert('Missing details', 'Age, weight, and height are required before REPMAX can calculate your targets.')
      return
    }

    const payload = {
      user_id: user.id,
      age: Number(setupForm.age),
      weight: Number(setupForm.weight),
      height: Number(setupForm.height),
      gender: setupForm.gender,
      activity_level: setupForm.activity_level,
      diet_goal: setupForm.diet_goal,
      ...computed,
      updated_at: new Date().toISOString(),
    }

    try {
      if (nutritionProfile) {
        const { data } = await supabase.from('nutrition_profiles').update(payload).eq('user_id', user.id).select().single()
        setNutritionProfile(data || payload)
      } else {
        const { data } = await supabase.from('nutrition_profiles').insert(payload).select().single()
        setNutritionProfile(data || payload)
      }
      setShowSetup(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    } catch (error) {
      console.error('Nutrition profile save error:', error)
      Alert.alert('Save failed', 'Could not save your nutrition profile yet.')
    }
  }

  async function runSearch() {
    const query = searchQuery.trim()
    if (!query) return

    setSearching(true)
    try {
      if (/^\d{8,}$/.test(query)) {
        const barcodeMatch = await lookupBarcode(query)
        setSearchResults(barcodeMatch ? [barcodeMatch] : [])
      } else {
        const results = await searchOpenFoodFacts(query)
        setSearchResults(results)
      }
    } catch (error) {
      console.error('Nutrition search error:', error)
      setSearchResults([])
    } finally {
      if (mounted.current) setSearching(false)
    }
  }

  function resetAddFoodState() {
    setSearchQuery('')
    setSearchResults([])
    setEntryMode('search')
    setManualFood({
      food_name: '',
      serving_size: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
    })
  }

  function openAddFood(mealType) {
    setSelectedMeal(mealType)
    resetAddFoodState()
    setShowAddFood(true)
  }

  async function addFoodLog(food, source = 'manual') {
    try {
      const payload = normalizeFoodResult(food)
      await supabase.from('food_logs').insert({
        user_id: user.id,
        food_name: payload.food_name,
        brand: payload.brand,
        serving_size: payload.serving_size,
        calories: payload.calories,
        protein: payload.protein,
        carbs: payload.carbs,
        fat: payload.fat,
        fiber: payload.fiber,
        sugar: payload.sugar,
        meal_type: selectedMeal,
        source,
        logged_at: selectedDateKey,
      })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setShowAddFood(false)
      resetAddFoodState()
      loadNutrition()
    } catch (error) {
      console.error('Add food log error:', error)
      Alert.alert('Log failed', 'Could not save that food item.')
    }
  }

  async function addManualFood() {
    if (!manualFood.food_name.trim()) {
      Alert.alert('Missing name', 'Give the food a name before saving it.')
      return
    }

    await addFoodLog(
      {
        ...manualFood,
        calories: Number(manualFood.calories || 0),
        protein: Number(manualFood.protein || 0),
        carbs: Number(manualFood.carbs || 0),
        fat: Number(manualFood.fat || 0),
      },
      'manual'
    )
  }

  async function deleteFoodLog(id) {
    await supabase.from('food_logs').delete().eq('id', id)
    loadNutrition()
  }

  async function saveMeal(food) {
    try {
      const normalized = normalizeFoodResult(food)
      await supabase.from('saved_meals').insert({
        user_id: user.id,
        food_name: normalized.food_name,
        brand: normalized.brand,
        serving_size: normalized.serving_size,
        calories: normalized.calories,
        protein: normalized.protein,
        carbs: normalized.carbs,
        fat: normalized.fat,
      })
      loadNutrition()
    } catch (error) {
      console.error('Save meal error:', error)
    }
  }

  async function updateWater(nextValue) {
    const safeValue = Math.max(0, nextValue)
    setWaterGlasses(safeValue)
    try {
      await supabase
        .from('water_logs')
        .upsert({ user_id: user.id, logged_at: selectedDateKey, glasses: safeValue }, { onConflict: 'user_id,logged_at' })
    } catch (error) {
      console.error('Water update error:', error)
    }
  }

  async function launchPhotoFlow(mode) {
    if (!isPro) {
      Alert.alert('PRO feature', 'AI photo scan is locked to PRO and ULTRA for now.')
      return
    }

    try {
      const requestPermission = mode === 'camera'
        ? ImagePicker.requestCameraPermissionsAsync
        : ImagePicker.requestMediaLibraryPermissionsAsync
      const permission = await requestPermission()

      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', `REPMAX needs ${mode === 'camera' ? 'camera' : 'photo library'} access for food scan.`)
        return
      }

      const launcher = mode === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync
      const result = await launcher({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.65,
        base64: true,
      })

      if (result.canceled || !result.assets?.[0]?.base64) return

      setPhotoScanning(true)

      const asset = result.assets[0]
      const mimeType = asset.mimeType || 'image/jpeg'
      const dataUrl = `data:${mimeType};base64,${asset.base64}`
      const prompt = `You are a professional nutritionist analyzing a meal photo.

Rules:
- Identify the visible meal
- Estimate a realistic total portion size
- Calculate total meal nutrition
- Return ONLY valid JSON with this exact schema:
{"food_name":"meal description","serving_size":"estimated total portion","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0}

No markdown, no commentary.`

      const response = await invokeServerApi(
        '/api/bedrock-proxy',
        {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
          model: 'anthropic/claude-sonnet-4',
          feature: 'photo_scan',
          temperature: 0.1,
          max_tokens: 700,
        },
        { timeoutMs: 45000, requireAuth: true }
      )

      const content = response?.choices?.[0]?.message?.content?.trim()
      if (!content) throw new Error('The meal scan came back empty.')

      const parsed = normalizeFoodResult(JSON.parse(content))
      await addFoodLog(parsed, 'photo')
    } catch (error) {
      console.error('Photo scan error:', error)
      Alert.alert('Photo scan failed', error?.message || 'Could not analyze that photo right now.')
    } finally {
      if (mounted.current) setPhotoScanning(false)
    }
  }

  const targets = nutritionProfile || calculateNutritionProfile(setupForm)
  const totals = useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        acc.calories += Number(log.calories || 0)
        acc.protein += Number(log.protein || 0)
        acc.carbs += Number(log.carbs || 0)
        acc.fat += Number(log.fat || 0)
        return acc
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
  }, [logs])

  const logsByMeal = useMemo(() => {
    return MEAL_TYPES.reduce((acc, meal) => {
      acc[meal.id] = logs.filter((log) => log.meal_type === meal.id)
      return acc
    }, {})
  }, [logs])

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg.primary }]}>
        <ActivityIndicator size="small" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.text.secondary }]}>Loading nutrition…</Text>
      </View>
    )
  }

  return (
    <>
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.bg.primary }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Nutrition" subtitle="Track intake, hit your macros, and keep the day organized by meal." />

        <Card>
          <View style={styles.rowBetween}>
            <TouchableOpacity onPress={() => setSelectedDate((current) => addDays(current, -1))} style={[styles.dateNavButton, { backgroundColor: theme.bg.elevated }]}>
              <Ionicons name="chevron-back" size={18} color={theme.text.primary} />
            </TouchableOpacity>
            <View style={styles.dateCopy}>
              <CardLabel>Daily Log</CardLabel>
              <Text style={[styles.dateValue, { color: theme.text.primary }]}>
                {selectedDate.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedDate((current) => addDays(current, 1))} style={[styles.dateNavButton, { backgroundColor: theme.bg.elevated }]}>
              <Ionicons name="chevron-forward" size={18} color={theme.text.primary} />
            </TouchableOpacity>
          </View>
          <Button title="Jump To Today" variant="secondary" size="sm" onPress={() => setSelectedDate(new Date())} style={styles.jumpButton} />
        </Card>

        {showSetup && (
          <Card>
            <CardLabel>Setup</CardLabel>
            <CardTitle>Build your nutrition targets</CardTitle>
            <Input label="Age" keyboardType="number-pad" value={setupForm.age} onChangeText={(value) => setSetupForm((prev) => ({ ...prev, age: value }))} />
            <Input label="Weight (kg)" keyboardType="decimal-pad" value={setupForm.weight} onChangeText={(value) => setSetupForm((prev) => ({ ...prev, weight: value }))} />
            <Input label="Height (cm)" keyboardType="number-pad" value={setupForm.height} onChangeText={(value) => setSetupForm((prev) => ({ ...prev, height: value }))} />

            <CardLabel>Activity Level</CardLabel>
            <View style={styles.choiceGrid}>
              {ACTIVITY_LEVELS.map((level) => {
                const active = setupForm.activity_level === level.id
                return (
                  <TouchableOpacity
                    key={level.id}
                    activeOpacity={0.85}
                    onPress={() => setSetupForm((prev) => ({ ...prev, activity_level: level.id }))}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: active ? theme.accentGlowStrong : theme.bg.elevated,
                        borderColor: active ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text style={[styles.choiceText, { color: active ? theme.text.primary : theme.text.secondary }]}>{level.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <CardLabel>Diet Goal</CardLabel>
            <View style={styles.choiceGrid}>
              {DIET_GOALS.map((goal) => {
                const active = setupForm.diet_goal === goal.id
                return (
                  <TouchableOpacity
                    key={goal.id}
                    activeOpacity={0.85}
                    onPress={() => setSetupForm((prev) => ({ ...prev, diet_goal: goal.id }))}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: active ? theme.accentGlowStrong : theme.bg.elevated,
                        borderColor: active ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text style={[styles.choiceText, { color: active ? theme.text.primary : theme.text.secondary }]}>{goal.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Button
              title="Save Targets"
              onPress={saveNutritionProfile}
              icon={<Ionicons name="checkmark" size={16} color={theme.text.onAccent} />}
            />
          </Card>
        )}

        {!!targets && (
          <Card>
            <CardLabel>Targets</CardLabel>
            <CardTitle>{Math.round(targets.target_calories || 0)} kcal target</CardTitle>
            <MacroBar label="Calories" value={totals.calories} target={targets.target_calories} color={theme.accent} theme={theme} />
            <MacroBar label="Protein" value={totals.protein} target={targets.target_protein} color="#ef4444" theme={theme} />
            <MacroBar label="Carbs" value={totals.carbs} target={targets.target_carbs} color="#22c55e" theme={theme} />
            <MacroBar label="Fat" value={totals.fat} target={targets.target_fat} color="#f59e0b" theme={theme} />
          </Card>
        )}

        <Card>
          <CardLabel>Hydration</CardLabel>
          <CardTitle>{waterGlasses} / 8 glasses</CardTitle>
          <View style={styles.waterRow}>
            <Button title="-1" variant="secondary" size="sm" onPress={() => updateWater(waterGlasses - 1)} style={styles.waterButton} />
            <View style={styles.waterDots}>
              {Array.from({ length: 8 }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.waterDot,
                    { backgroundColor: index < waterGlasses ? theme.info : theme.bg.elevated, borderColor: theme.border },
                  ]}
                />
              ))}
            </View>
            <Button title="+1" size="sm" onPress={() => updateWater(waterGlasses + 1)} style={styles.waterButton} />
          </View>
        </Card>

        {MEAL_TYPES.map((meal) => {
          const Icon = meal.icon
          const mealLogs = logsByMeal[meal.id] || []
          const mealCalories = mealLogs.reduce((sum, item) => sum + Number(item.calories || 0), 0)

          return (
            <Card key={meal.id}>
              <View style={styles.rowBetween}>
                <View style={styles.mealHeading}>
                  <Ionicons name={Icon} size={18} color={theme.accent} />
                  <View>
                    <Text style={[styles.mealTitle, { color: theme.text.primary }]}>{meal.label}</Text>
                    <Text style={[styles.mealMeta, { color: theme.text.tertiary }]}>
                      {mealLogs.length} item{mealLogs.length === 1 ? '' : 's'} · {Math.round(mealCalories)} kcal
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => openAddFood(meal.id)} style={[styles.iconAction, { backgroundColor: theme.bg.elevated, borderColor: theme.border }]}>
                  <Ionicons name="add" size={20} color={theme.accent} />
                </TouchableOpacity>
              </View>

              {mealLogs.length === 0 ? (
                <Text style={[styles.emptyMeal, { color: theme.text.tertiary }]}>Nothing logged yet.</Text>
              ) : (
                mealLogs.map((item) => (
                  <View key={item.id} style={[styles.foodRow, { borderTopColor: theme.border }]}>
                    <View style={styles.foodCopy}>
                      <Text style={[styles.foodName, { color: theme.text.primary }]}>{item.food_name}</Text>
                      <Text style={[styles.foodMeta, { color: theme.text.secondary }]}>
                        {item.serving_size || '1 serving'} · P {Math.round(item.protein || 0)} / C {Math.round(item.carbs || 0)} / F {Math.round(item.fat || 0)}
                      </Text>
                    </View>
                    <View style={styles.foodRight}>
                      <Text style={[styles.foodCalories, { color: theme.accent }]}>{Math.round(item.calories || 0)} kcal</Text>
                      <TouchableOpacity onPress={() => deleteFoodLog(item.id)} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={16} color={theme.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </Card>
          )
        })}

        {savedMeals.length > 0 && (
          <Card>
            <CardLabel>Saved Meals</CardLabel>
            <CardTitle>Quick add templates</CardTitle>
            <View style={styles.savedMealsList}>
              {savedMeals.map((meal) => (
                <TouchableOpacity
                  key={meal.id}
                  activeOpacity={0.85}
                  onPress={() => addFoodLog(meal, 'search')}
                  style={[styles.savedMealChip, { backgroundColor: theme.bg.elevated, borderColor: theme.border }]}
                >
                  <Text style={[styles.savedMealTitle, { color: theme.text.primary }]} numberOfLines={1}>{meal.food_name}</Text>
                  <Text style={[styles.savedMealMeta, { color: theme.text.tertiary }]}>{Math.round(meal.calories || 0)} kcal</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {!logs.length && !!nutritionProfile && (
          <EmptyState title="No food logged yet" description="Use the meal sections above to start building the day." icon="🍽️" />
        )}
      </ScrollView>

      <Modal visible={showAddFood} animationType="slide" transparent onRequestClose={() => setShowAddFood(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.bg.secondary, borderColor: theme.border }]}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Add to {selectedMeal}</Text>
                <Text style={[styles.modalSubtitle, { color: theme.text.tertiary }]}>Search, type manually, or scan a photo.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddFood(false)} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={theme.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.modeRow, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
              {['search', 'manual'].map((mode) => {
                const active = entryMode === mode
                return (
                  <TouchableOpacity
                    key={mode}
                    activeOpacity={0.85}
                    onPress={() => setEntryMode(mode)}
                    style={[styles.modeButton, { backgroundColor: active ? theme.accent : 'transparent' }]}
                  >
                    <Text style={[styles.modeText, { color: active ? theme.text.onAccent : theme.text.secondary }]}>
                      {mode === 'search' ? 'Search' : 'Manual'}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {entryMode === 'search' ? (
              <>
                <View style={styles.searchRow}>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Food name or barcode"
                    placeholderTextColor={theme.text.tertiary}
                    style={[styles.searchInput, { backgroundColor: theme.bg.input, color: theme.text.primary, borderColor: theme.border }]}
                    onSubmitEditing={runSearch}
                  />
                  <Button title="Go" size="sm" onPress={runSearch} loading={searching} style={styles.searchButton} />
                </View>

                <View style={styles.photoButtons}>
                  <Button
                    title="Camera Scan"
                    size="sm"
                    variant="secondary"
                    onPress={() => launchPhotoFlow('camera')}
                    loading={photoScanning}
                    icon={<Ionicons name="camera-outline" size={15} color={theme.text.primary} />}
                    style={styles.photoButton}
                  />
                  <Button
                    title="Photo Library"
                    size="sm"
                    variant="secondary"
                    onPress={() => launchPhotoFlow('library')}
                    loading={photoScanning}
                    icon={<Ionicons name="images-outline" size={15} color={theme.text.primary} />}
                    style={styles.photoButton}
                  />
                </View>

                <ScrollView style={styles.resultsList} contentContainerStyle={styles.resultsContent}>
                  {searchResults.length === 0 && !searching ? (
                    <Text style={[styles.resultEmpty, { color: theme.text.tertiary }]}>No search results yet.</Text>
                  ) : (
                    searchResults.map((result, index) => (
                      <TouchableOpacity
                        key={`${result.food_name}-${index}`}
                        activeOpacity={0.85}
                        onPress={() => addFoodLog(result, 'search')}
                        style={[styles.resultCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}
                      >
                        <View style={styles.resultCopy}>
                          <Text style={[styles.resultTitle, { color: theme.text.primary }]}>{result.food_name}</Text>
                          <Text style={[styles.resultMeta, { color: theme.text.secondary }]}>
                            {result.serving_size || '1 serving'} · P {result.protein} / C {result.carbs} / F {result.fat}
                          </Text>
                        </View>
                        <View style={styles.resultRight}>
                          <Text style={[styles.resultCalories, { color: theme.accent }]}>{Math.round(result.calories || 0)} kcal</Text>
                          <TouchableOpacity onPress={() => saveMeal(result)} style={styles.bookmarkButton}>
                            <Ionicons name="bookmark-outline" size={16} color={theme.text.secondary} />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </>
            ) : (
              <ScrollView style={styles.manualForm}>
                <Input label="Food Name" value={manualFood.food_name} onChangeText={(value) => setManualFood((prev) => ({ ...prev, food_name: value }))} />
                <Input label="Serving Size" value={manualFood.serving_size} onChangeText={(value) => setManualFood((prev) => ({ ...prev, serving_size: value }))} />
                <Input label="Calories" keyboardType="decimal-pad" value={manualFood.calories} onChangeText={(value) => setManualFood((prev) => ({ ...prev, calories: value }))} />
                <Input label="Protein" keyboardType="decimal-pad" value={manualFood.protein} onChangeText={(value) => setManualFood((prev) => ({ ...prev, protein: value }))} />
                <Input label="Carbs" keyboardType="decimal-pad" value={manualFood.carbs} onChangeText={(value) => setManualFood((prev) => ({ ...prev, carbs: value }))} />
                <Input label="Fat" keyboardType="decimal-pad" value={manualFood.fat} onChangeText={(value) => setManualFood((prev) => ({ ...prev, fat: value }))} />
                <Button title="Add Food" onPress={addManualFood} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxxl,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  dateNavButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCopy: {
    flex: 1,
    alignItems: 'center',
  },
  dateValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  jumpButton: {
    marginTop: spacing.md,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  choiceChip: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  choiceText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  macroBarWrap: {
    marginTop: spacing.md,
  },
  macroLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  macroValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  waterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  waterButton: {
    minWidth: 56,
  },
  waterDots: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  waterDot: {
    width: 18,
    height: 18,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  mealHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  mealTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  mealMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  iconAction: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMeal: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
  },
  foodCopy: {
    flex: 1,
  },
  foodName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  foodMeta: {
    fontSize: fontSize.xs,
    marginTop: 4,
    lineHeight: 16,
  },
  foodRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  foodCalories: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  deleteButton: {
    padding: 2,
  },
  savedMealsList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  savedMealChip: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  savedMealTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  savedMealMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.xl,
    minHeight: '78%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.black,
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  closeButton: {
    padding: spacing.xs,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 4,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  modeButton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
  },
  searchButton: {
    minWidth: 64,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  photoButton: {
    flex: 1,
  },
  resultsList: {
    marginTop: spacing.md,
  },
  resultsContent: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  resultEmpty: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  resultCopy: {
    flex: 1,
  },
  resultTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  resultMeta: {
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginTop: 2,
  },
  resultRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  resultCalories: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  bookmarkButton: {
    padding: 2,
  },
  manualForm: {
    marginTop: spacing.sm,
  },
})

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import PaywallGate from "../components/PaywallGate";
import { callGroq, MODEL, scanFoodPhoto } from "../lib/groq";
import { optimizeImageForVision } from "../lib/visionImages";
import {
  RiArrowLeftLine,
  RiFireFill,
  RiScales2Fill,
  RiHeartPulseFill,
  RiAddCircleFill,
  RiSearchLine,
  RiCameraFill,
  RiDeleteBinLine,
  RiSparkling2Fill,
  RiLeafFill,
  RiRestaurantFill,
  RiDropFill,
  RiArrowUpLine,
  RiArrowDownLine,
  RiEqualizerLine,
  RiCalendarLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiMoonFill,
  RiSunFill,
  RiTimeFill,
  RiFlashlightFill,
  RiTranslate2,
  RiRefreshLine,
  RiAddFill,
  RiBookmarkFill,
  RiBrainFill,
  RiBarcodeLine,
  RiCloseLine,
} from "@remixicon/react";

// ─── Nutrition constants ──────────────────────────────────────────────────────
const ACTIVITY_LEVELS = [
  {
    id: "sedentary",
    label: "Sedentary",
    desc: "Little to no exercise",
    factor: 1.2,
  },
  {
    id: "light",
    label: "Lightly Active",
    desc: "1–3 days/week",
    factor: 1.375,
  },
  {
    id: "moderate",
    label: "Moderately Active",
    desc: "3–5 days/week",
    factor: 1.55,
  },
  { id: "active", label: "Very Active", desc: "6–7 days/week", factor: 1.725 },
  {
    id: "very_active",
    label: "Extreme",
    desc: "Twice daily / athlete",
    factor: 1.9,
  },
];

const DIET_GOALS = [
  {
    id: "aggressive_cut",
    label: "Aggressive Cut",
    delta: -500,
    color: "#ef4444",
    icon: RiArrowDownLine,
  },
  {
    id: "cut",
    label: "Cut",
    delta: -300,
    color: "#f97316",
    icon: RiArrowDownLine,
  },
  {
    id: "maintain",
    label: "Maintain",
    delta: 0,
    color: "#3b82f6",
    icon: RiEqualizerLine,
  },
  {
    id: "lean_bulk",
    label: "Lean Bulk",
    delta: 250,
    color: "#22c55e",
    icon: RiArrowUpLine,
  },
  {
    id: "bulk",
    label: "Bulk",
    delta: 500,
    color: "#D4FF00",
    icon: RiArrowUpLine,
  },
];

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast", icon: RiSunFill },
  { id: "lunch", label: "Lunch", icon: RiTimeFill },
  { id: "dinner", label: "Dinner", icon: RiMoonFill },
  { id: "snack", label: "Snack", icon: RiFlashlightFill },
];

// ─── FatSecret search — calls the secure edge function ───────────────────────
async function searchFatSecret(englishQuery) {
  try {
    const { data, error } = await supabase.functions.invoke(
      "fatsecret-search",
      {
        body: { query: englishQuery },
      },
    );
    if (error) throw error;
    return data?.results ?? [];
  } catch (err) {
    console.error("FatSecret search error:", err);
    return [];
  }
}

// Barcode lookup via OpenFoodFacts
async function lookupBarcode(barcode) {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
  );
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const n = p.nutriments || {};
  return {
    food_name: p.product_name || barcode,
    brand: p.brands || "",
    serving_size: p.serving_size || "100g",
    calories: Math.round(n["energy-kcal_100g"] || n["energy-kcal"] || 0),
    protein: Math.round(n.proteins_100g || 0),
    carbs: Math.round(n.carbohydrates_100g || 0),
    fat: Math.round(n.fat_100g || 0),
    fiber: Math.round(n.fiber_100g || 0),
    sugar: Math.round(n.sugars_100g || 0),
  };
}

// Fallback: OpenFoodFacts (no API key required)
async function searchOpenFoodFacts(query) {
  try {
    const q = encodeURIComponent(query);
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=6`,
    );
    const data = await res.json();
    if (!data?.products) return [];
    return data.products
      .filter((p) => p.product_name && p.nutriments)
      .slice(0, 6)
      .map((p) => ({
        food_name: p.product_name,
        brand: p.brands || "",
        serving_size: p.serving_size || "100g",
        calories: Math.round(
          p.nutriments["energy-kcal_100g"] || p.nutriments["energy-kcal"] || 0,
        ),
        protein: Math.round(p.nutriments.proteins_100g || 0),
        carbs: Math.round(p.nutriments.carbohydrates_100g || 0),
        fat: Math.round(p.nutriments.fat_100g || 0),
        fiber: Math.round(p.nutriments.fiber_100g || 0),
        sugar: Math.round(p.nutriments.sugars_100g || 0),
      }));
  } catch {
    return [];
  }
}

// Translate any query to English for database search
const _translationCache = new Map();
async function translateQuery(query) {
  if (_translationCache.has(query)) return _translationCache.get(query);
  try {
    const data = await callGroq({
      messages: [
        {
          role: "system",
          content:
            'You are a translator. Detect the language of the food query and translate it to English. If the query is already in English, still return it. Return ONLY valid JSON with no extra text: {"english":"translated text","is_english":true/false,"original_lang":"detected language name"}',
        },
        { role: "user", content: `Food query: ${query}` },
      ],
      model: MODEL,
      temperature: 0.1,
      max_tokens: 120,
      response_format: { type: "json_object" },
    });
    const result = JSON.parse(data.choices[0].message.content);
    _translationCache.set(query, result);
    return result;
  } catch {
    const fallback = { english: query, is_english: true, original_lang: "Unknown" };
    return fallback;
  }
}

// AI nutrition lookup — returns accurate portion sizes based on what the user types
async function aiSearchFood(query) {
  try {
    const data = await callGroq({
      messages: [
        {
          role: "system",
          content: `You are a precise nutrition database. Given a user's food query (e.g. "1 egg" or "200g chicken" or "1 scoop whey"), calculate the nutritional data FOR THE EXACT PORTION REQUESTED.
Rules:
- Give accurate calories and macros for the ENTIRE amount they requested.
- If no specific portion is given (e.g. "apple"), assume a standard serving (e.g. "1 medium apple").
- Set serving_size to the exact portion calculated (e.g. "1 large egg (50g)", "2 slices (60g)", "150g").
- Output ONLY valid JSON:
  {"food_name":"...","brand":"","serving_size":"...","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0}`,
        },
        { role: "user", content: `Nutritional info for: ${query}` },
      ],
      model: MODEL,
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return null;
  }
}

function inferActivityLevelFromTrainingDays(trainingDays = []) {
  const count = Array.isArray(trainingDays) ? trainingDays.length : 0;
  if (count >= 6) return "very_active";
  if (count >= 4) return "active";
  if (count >= 3) return "moderate";
  if (count >= 1) return "light";
  return "sedentary";
}

function buildDraftNutritionSetup(profile = {}) {
  const age = profile?.age ? String(profile.age) : "";
  const weight = profile?.weight_kg ? String(profile.weight_kg) : "";
  const height = profile?.height_cm ? String(profile.height_cm) : "";
  const activityLevel = inferActivityLevelFromTrainingDays(profile?.training_days || []);
  const hasPrefill = Boolean(age || weight || height);

  return {
    values: {
      age,
      weight,
      height,
      gender: "male",
      activity_level: activityLevel,
      diet_goal: "maintain",
    },
    hasPrefill,
  };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toDateStr(d) { return d.toISOString().split("T")[0]; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isSameDay(a, b) { return toDateStr(a) === toDateStr(b); }
function isToday(d) { return isSameDay(d, new Date()); }
const DAY_NAMES_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Main component ───────────────────────────────────────────────────────────
export default function Nutrition() {
  const { user, profile, isPro } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("tracker");
  const [nutProfile, setNutProfile] = useState(null);
  const [todayLogs, setTodayLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [aiResult, setAiResult] = useState(null);
  const [aiMultiplier, setAiMultiplier] = useState(1);
  const [searching, setSearching] = useState(false);
  const [detectedLang, setDetectedLang] = useState(null);
  const [selectedMeal, setSelectedMeal] = useState("snack");
  const [toast, setToast] = useState("");
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [savedMeals, setSavedMeals] = useState([]);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [setupSource, setSetupSource] = useState("manual");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loggedDates, setLoggedDates] = useState(new Set());
  const mounted = useRef(true);

  const selectedDateStr = toDateStr(selectedDate);
  const isViewingToday = isToday(selectedDate);
  const canAddFood = (() => {
    const diff = (new Date().setHours(0,0,0,0) - new Date(selectedDateStr).getTime()) / 86400000;
    return diff <= 3;
  })();

  const [setupForm, setSetupForm] = useState({
    age: "",
    weight: "",
    height: "",
    gender: "male",
    activity_level: "moderate",
    diet_goal: "maintain",
  });

  useEffect(() => {
    mounted.current = true;
    loadNutrition();
    return () => { mounted.current = false; };
  }, [selectedDateStr]);

  useEffect(() => {
    if (nutProfile || !showSetup || setupSource !== "manual") return;
    const draft = buildDraftNutritionSetup(profile);
    if (!draft.hasPrefill) return;
    setSetupForm(draft.values);
    setSetupSource("profile");
  }, [nutProfile, profile, setupSource, showSetup]);

  function showToastMsg(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function loadNutrition() {
    try {
      const dateStr = selectedDateStr;
      const [npRes, logsRes] = await Promise.all([
        supabase
          .from("nutrition_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("food_logs")
          .select("*")
          .eq("user_id", user.id)
          .eq("logged_at", dateStr)
          .order("created_at", { ascending: true }),
      ]);
      if (!mounted.current) return;
      if (npRes.data) {
        setNutProfile(npRes.data);
        setSetupSource("saved");
        setSetupForm({
          age: npRes.data.age || "",
          weight: npRes.data.weight || "",
          height: npRes.data.height || "",
          gender: npRes.data.gender || "male",
          activity_level: npRes.data.activity_level || "moderate",
          diet_goal: npRes.data.diet_goal || "maintain",
        });
      } else {
        const draft = buildDraftNutritionSetup(profile);
        setSetupForm(draft.values);
        setSetupSource(draft.hasPrefill ? "profile" : "manual");
        setShowSetup(true);
      }
      setTodayLogs(logsRes.data || []);

      // Load water for selected date
      try {
        const { data: waterData } = await supabase
          .from('water_logs').select('glasses')
          .eq('user_id', user.id).eq('logged_at', dateStr).maybeSingle();
        if (waterData) setWaterGlasses(waterData.glasses || 0);
        else setWaterGlasses(0);
      } catch { setWaterGlasses(0); }

      // Load saved meals
      try {
        const { data: meals } = await supabase
          .from('saved_meals').select('*')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
        if (meals) setSavedMeals(meals);
      } catch { /* saved_meals table may not exist yet */ }

      // Load which of last 7 days have food logged (for calendar dots)
      try {
        const weekAgo = toDateStr(addDays(new Date(), -6));
        const todayStr = toDateStr(new Date());
        const { data: recentLogs } = await supabase
          .from('food_logs')
          .select('logged_at')
          .eq('user_id', user.id)
          .gte('logged_at', weekAgo)
          .lte('logged_at', todayStr);
        if (recentLogs) {
          setLoggedDates(new Set(recentLogs.map(l => l.logged_at)));
        }
      } catch {}
    } catch (err) {
      console.error("Nutrition load error:", err);
    }
    if (mounted.current) setLoading(false);
  }

  function calculateTDEE(form) {
    const { age, weight, height, gender, activity_level, diet_goal } = form;
    if (!age || !weight || !height) return null;
    const w = parseFloat(weight),
      h = parseFloat(height),
      a = parseInt(age);
    // Mifflin-St Jeor formula
    let bmr =
      gender === "male"
        ? 10 * w + 6.25 * h - 5 * a + 5
        : 10 * w + 6.25 * h - 5 * a - 161;
    const actLevel = ACTIVITY_LEVELS.find((l) => l.id === activity_level);
    const tdee = bmr * (actLevel?.factor || 1.55);
    const goalData = DIET_GOALS.find((g) => g.id === diet_goal);
    const target = Math.round(tdee + (goalData?.delta || 0));
    // Calculate Macros based on body weight for better accuracy
    let proteinMul = 2.0; // 2.0g per kg is the sweet spot
    if (diet_goal === "aggressive_cut") proteinMul = 2.3; // slightly higher to preserve muscle in deep deficit
    else if (diet_goal === "cut") proteinMul = 2.2;

    const target_protein = Math.round(w * proteinMul);
    const target_fat = Math.round((target * 0.25) / 9); // 25% of calories to fat for hormones
    const target_carbs = Math.max(0, Math.round((target - (target_protein * 4) - (target_fat * 9)) / 4));

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      target_calories: target,
      target_protein,
      target_fat,
      target_carbs,
    };
  }

  async function saveNutritionProfile() {
    const calc = calculateTDEE(setupForm);
    if (!calc) return;
    const payload = {
      user_id: user.id,
      ...setupForm,
      age: parseInt(setupForm.age),
      weight: parseFloat(setupForm.weight),
      height: parseFloat(setupForm.height),
      ...calc,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = nutProfile
      ? await supabase
          .from("nutrition_profiles")
          .update(payload)
          .eq("user_id", user.id)
          .select()
          .single()
      : await supabase
          .from("nutrition_profiles")
          .insert(payload)
          .select()
          .single();
    if (!error && data) {
      setNutProfile(data);
      setShowSetup(false);
      showToastMsg("Profile saved!");
    } else {
      console.error("Save error:", error);
    }
  }

  async function runFoodSearch(rawQuery) {
    const query = String(rawQuery || "").trim();
    if (!query) return;
    setSearching(true);
    setSearchResults([]);
    setAiResult(null);
    setAiMultiplier(1);
    setDetectedLang(null);
    setSearchQuery(query);

    try {
      // Run translation + AI lookup in parallel — AI always returns in user's language
      const [translationRes, aiRes] = await Promise.all([
        translateQuery(query),
        aiSearchFood(query),
      ]);

      if (aiRes) setAiResult(aiRes);

      if (!translationRes.is_english) {
        setDetectedLang(translationRes.original_lang);
      }

      const englishQuery = translationRes.english || query;

      // Try FatSecret (OAuth 1.0a); fall back to OpenFoodFacts on error
      let dbResults = await searchFatSecret(englishQuery);
      if (!dbResults.length)
        dbResults = await searchOpenFoodFacts(englishQuery);

      setSearchResults(dbResults);
    } catch (err) {
      console.error("Search error:", err);
    }

    setSearching(false);
  }

  async function searchFoods() {
    await runFoodSearch(searchQuery);
  }

  async function handleBarcodeScan(barcode) {
    setShowBarcodeScanner(false);
    setBarcodeLoading(true);
    try {
      const food = await lookupBarcode(barcode);
      if (food) {
        setAiResult(null);
        setSearchResults([food]);
        setSearchQuery(barcode);
        showToastMsg(`Found: ${food.food_name}`);
      } else {
        showToastMsg("Product not found — try searching by name");
      }
    } catch {
      showToastMsg("Barcode lookup failed");
    }
    setBarcodeLoading(false);
  }

  async function addFoodLog(food, source = "search") {
    const { error } = await supabase.from("food_logs").insert({
      user_id: user.id,
      food_name: food.food_name,
      brand: food.brand || "",
      serving_size: food.serving_size || "",
      calories: food.calories || 0,
      protein: food.protein || 0,
      carbs: food.carbs || 0,
      fat: food.fat || 0,
      fiber: food.fiber || 0,
      sugar: food.sugar || 0,
      meal_type: selectedMeal,
      source,
      logged_at: selectedDateStr,
    });
    if (!error) {
      showToastMsg(`Added ${food.food_name}`);
      setShowAddFood(false);
      setSearchQuery("");
      setSearchResults([]);
      setAiResult(null);
      setAiMultiplier(1);
      setDetectedLang(null);
      loadNutrition();
    } else {
      showToastMsg(`Failed: ${error.message} (Did you run the SQL?)`);
      console.error("Add food error:", error);
    }
  }

  async function deleteFoodLog(id) {
    await supabase.from("food_logs").delete().eq("id", id);
    loadNutrition();
  }

  async function addWaterGlass() {
    const newCount = waterGlasses + 1;
    setWaterGlasses(newCount);
    try {
      await supabase.from('water_logs').upsert({ user_id: user.id, logged_at: selectedDateStr, glasses: newCount }, { onConflict: 'user_id,logged_at' });
    } catch { /* table may not exist yet */ }
  }

  async function removeWaterGlass() {
    if (waterGlasses <= 0) return;
    const newCount = waterGlasses - 1;
    setWaterGlasses(newCount);
    try {
      await supabase.from('water_logs').upsert({ user_id: user.id, logged_at: selectedDateStr, glasses: newCount }, { onConflict: 'user_id,logged_at' });
    } catch {}
  }

  async function saveMeal(food) {
    try {
      await supabase.from('saved_meals').insert({ user_id: user.id, food_name: food.food_name, brand: food.brand || '', serving_size: food.serving_size || '', calories: food.calories || 0, protein: food.protein || 0, carbs: food.carbs || 0, fat: food.fat || 0 });
      showToastMsg('Meal saved!');
    } catch { showToastMsg('Could not save meal'); }
  }

  async function quickAddSavedMeal(meal) {
    await addFoodLog({ food_name: meal.food_name, brand: meal.brand, serving_size: meal.serving_size, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat }, 'saved');
  }

  // ─── Derived values ─────────────────────────────────────────────────────────
  const totals = todayLogs.reduce(
    (acc, log) => ({
      calories: acc.calories + (log.calories || 0),
      protein: acc.protein + (log.protein || 0),
      carbs: acc.carbs + (log.carbs || 0),
      fat: acc.fat + (log.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const calorieProgress = nutProfile
    ? Math.min((totals.calories / nutProfile.target_calories) * 100, 100)
    : 0;
  const remaining = nutProfile
    ? nutProfile.target_calories - totals.calories
    : 0;
  const dietAdvice = nutProfile
    ? DIET_GOALS.find((g) => g.id === nutProfile.diet_goal)
    : null;

  // ─── Loading skeleton ────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="page">
        <div className="page-header">
          <div className="skeleton" style={{ width: 160, height: 28 }} />
        </div>
        <div
          className="skeleton"
          style={{ height: 200, borderRadius: 16, marginBottom: 12 }}
        />
        <div className="skeleton" style={{ height: 120, borderRadius: 16 }} />
      </div>
    );

  // ─── Render ──────────────────────────────────────────────────────────────────
  const waterTarget = 8;
  const waterProgress = Math.min((waterGlasses / waterTarget) * 100, 100);
  const waterCircumference = 2 * Math.PI * 32;

  return (
    <div className="page nutrition-page">
      {/* ── Header ── */}
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <RiArrowLeftLine size={20} />
        </button>
        <h1 className="page-title">
          <RiLeafFill size={20} style={{ color: "var(--accent)" }} /> Smart
          Eating
        </h1>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setShowSetup(true)}
        >
          <RiEqualizerLine size={18} />
        </button>
      </div>

      {/* ── Date Navigation ── */}
      <div className="nutrition-date-nav">
        <button className="date-nav-arrow" onClick={() => setSelectedDate(d => addDays(d, -1))}>
          <RiArrowLeftSLine size={20} />
        </button>
        <div className="date-nav-days">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = addDays(new Date(), i - 6);
            const ds = toDateStr(d);
            const active = ds === selectedDateStr;
            const hasLog = loggedDates.has(ds);
            return (
              <button
                key={ds}
                className={`date-nav-pill ${active ? "active" : ""}`}
                onClick={() => setSelectedDate(d)}
              >
                <span className="date-nav-day-name">{DAY_NAMES_SHORT[d.getDay()]}</span>
                <span className="date-nav-day-num">{d.getDate()}</span>
                {hasLog && <span className="date-nav-dot" />}
              </button>
            );
          })}
        </div>
        <button
          className="date-nav-arrow"
          onClick={() => { if (!isViewingToday) setSelectedDate(d => addDays(d, 1)); }}
          disabled={isViewingToday}
        >
          <RiArrowRightSLine size={20} />
        </button>
      </div>
      {!isViewingToday && (
        <button className="btn btn-sm btn-ghost date-today-btn" onClick={() => setSelectedDate(new Date())}>
          ← Back to Today
        </button>
      )}

      {/* ── Setup Modal ── */}
      {showSetup && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSetup(false);
          }}
        >
          <div className="modal glass-modal">
            <h2 className="modal-title">
              <RiScales2Fill size={22} style={{ color: "var(--accent)" }} />{" "}
              Nutrition Setup
            </h2>
            <p className="modal-subtitle">
              {setupSource === "profile"
                ? "We prefilled this from your REPMAX profile so you can review it instead of starting over."
                : "We'll calculate your daily targets and keep them easy to adjust."}
            </p>

            {setupSource === "profile" && (
              <div className="nutrition-setup-note">
                Your age, height, weight, and activity level were pulled from the profile you already filled out.
              </div>
            )}

            {/* Basic stats */}
            <div className="setup-grid">
              <div className="input-group">
                <label className="input-label">Age</label>
                <input
                  className="input glass-input"
                  type="number"
                  placeholder="18"
                  value={setupForm.age}
                  onChange={(e) =>
                    setSetupForm((f) => ({ ...f, age: e.target.value }))
                  }
                />
              </div>
              <div className="input-group">
                <label className="input-label">Weight (kg)</label>
                <input
                  className="input glass-input"
                  type="number"
                  placeholder="80"
                  value={setupForm.weight}
                  onChange={(e) =>
                    setSetupForm((f) => ({ ...f, weight: e.target.value }))
                  }
                />
              </div>
              <div className="input-group">
                <label className="input-label">Height (cm)</label>
                <input
                  className="input glass-input"
                  type="number"
                  placeholder="180"
                  value={setupForm.height}
                  onChange={(e) =>
                    setSetupForm((f) => ({ ...f, height: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Gender */}
            <div className="input-group">
              <label className="input-label">Gender</label>
              <div className="toggle-row">
                {["male", "female"].map((g) => (
                  <button
                    key={g}
                    className={`glass-chip ${setupForm.gender === g ? "active" : ""}`}
                    onClick={() => setSetupForm((f) => ({ ...f, gender: g }))}
                  >
                    {g === "male" ? "♂ Male" : "♀ Female"}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity level */}
            <div className="input-group">
              <label className="input-label">Activity Level</label>
              <div className="activity-list">
                {ACTIVITY_LEVELS.map((a) => (
                  <button
                    key={a.id}
                    className={`glass-option ${setupForm.activity_level === a.id ? "active" : ""}`}
                    onClick={() =>
                      setSetupForm((f) => ({ ...f, activity_level: a.id }))
                    }
                  >
                    <span className="glass-option-label">{a.label}</span>
                    <span className="glass-option-desc">{a.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Diet goal */}
            <div className="input-group">
              <label className="input-label">Goal</label>
              <div className="goal-row">
                {DIET_GOALS.map((g) => {
                  const Icon = g.icon;
                  return (
                    <button
                      key={g.id}
                      className={`goal-chip ${setupForm.diet_goal === g.id ? "active" : ""}`}
                      style={{ "--goal-color": g.color }}
                      onClick={() =>
                        setSetupForm((f) => ({ ...f, diet_goal: g.id }))
                      }
                    >
                      <Icon size={13} /> {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live preview */}
            {setupForm.age &&
              setupForm.weight &&
              setupForm.height &&
              (() => {
                const preview = calculateTDEE(setupForm);
                if (!preview) return null;
                const goalData = DIET_GOALS.find(
                  (g) => g.id === setupForm.diet_goal,
                );
                return (
                  <div className="glass-preview">
                    <div className="preview-stat">
                      <span
                        className="preview-value"
                        style={{ color: goalData?.color }}
                      >
                        {preview.target_calories}
                      </span>
                      <span className="preview-label">kcal / day</span>
                    </div>
                    <div className="preview-macros">
                      <div>
                        <RiRestaurantFill
                          size={13}
                          style={{ color: "#ef4444" }}
                        />{" "}
                        {preview.target_protein}g protein
                      </div>
                      <div>
                        <RiLeafFill size={13} style={{ color: "#22c55e" }} />{" "}
                        {preview.target_carbs}g carbs
                      </div>
                      <div>
                        <RiDropFill size={13} style={{ color: "#f59e0b" }} />{" "}
                        {preview.target_fat}g fat
                      </div>
                    </div>
                    <div
                      className="preview-advice"
                      style={{
                        color: goalData?.color,
                        background: goalData?.color + "18",
                      }}
                    >
                      {(() => {
                        const I = goalData?.icon;
                        return I ? <I size={13} /> : null;
                      })()}
                      {setupForm.diet_goal === "bulk" &&
                        "Eat in a +500 kcal surplus to maximise muscle growth."}
                      {setupForm.diet_goal === "lean_bulk" &&
                        "Controlled +250 kcal surplus — muscle without the fluff."}
                      {setupForm.diet_goal === "maintain" &&
                        "Stay at maintenance — perfect for body recomposition."}
                      {setupForm.diet_goal === "cut" &&
                        "Mild –300 kcal deficit for steady fat loss."}
                      {setupForm.diet_goal === "aggressive_cut" &&
                        "Aggressive –500 kcal deficit — keep protein high!"}
                    </div>
                  </div>
                );
              })()}

            <button
              className="btn btn-primary btn-full btn-lg glass-btn"
              onClick={saveNutritionProfile}
              disabled={
                !setupForm.age || !setupForm.weight || !setupForm.height
              }
            >
              <RiHeartPulseFill size={18} /> Save Profile
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      {nutProfile && (
        <>
          {/* Calorie ring card */}
          <div className="glass-card calorie-ring-card">
            <div className="ring-container">
              <svg className="calorie-ring" viewBox="0 0 120 120">
                <circle className="ring-bg" cx="60" cy="60" r="52" />
                <circle
                  className="ring-fill"
                  cx="60"
                  cy="60"
                  r="52"
                  style={{
                    strokeDashoffset: 326.7 - (326.7 * calorieProgress) / 100,
                  }}
                />
              </svg>
              <div className="ring-center">
                <span className="ring-value">{Math.round(remaining)}</span>
                <span className="ring-label">remaining</span>
              </div>
            </div>
            <div className="calorie-stats">
              <div className="cal-stat">
                <RiFireFill size={16} style={{ color: "var(--accent)" }} />
                <div>
                  <span className="cal-stat-value">
                    {nutProfile.target_calories}
                  </span>
                  <span className="cal-stat-label">Target</span>
                </div>
              </div>
              <div className="cal-stat">
                <RiFlashlightFill size={16} style={{ color: "#22c55e" }} />
                <div>
                  <span className="cal-stat-value">
                    {Math.round(totals.calories)}
                  </span>
                  <span className="cal-stat-label">Consumed</span>
                </div>
              </div>
            </div>
            {dietAdvice && (
              <div
                className="diet-badge"
                style={{
                  background: dietAdvice.color + "20",
                  color: dietAdvice.color,
                }}
              >
                {(() => {
                  const I = dietAdvice.icon;
                  return <I size={13} />;
                })()}
                {dietAdvice.label} — {dietAdvice.delta > 0 ? "+" : ""}
                {dietAdvice.delta} kcal
              </div>
            )}
          </div>

          {/* Macro bars */}
          <div className="glass-card macro-bars">
            {[
              {
                label: "Protein",
                current: totals.protein,
                target: nutProfile.target_protein,
                color: "#ef4444",
                icon: RiRestaurantFill,
                unit: "g",
              },
              {
                label: "Carbs",
                current: totals.carbs,
                target: nutProfile.target_carbs,
                color: "#22c55e",
                icon: RiLeafFill,
                unit: "g",
              },
              {
                label: "Fat",
                current: totals.fat,
                target: nutProfile.target_fat,
                color: "#f59e0b",
                icon: RiDropFill,
                unit: "g",
              },
            ].map((m) => {
              const pct =
                m.target > 0 ? Math.min((m.current / m.target) * 100, 100) : 0;
              const Icon = m.icon;
              return (
                <div key={m.label} className="macro-row">
                  <div className="macro-info">
                    <Icon size={13} style={{ color: m.color }} />
                    <span className="macro-name">{m.label}</span>
                    <span className="macro-count">
                      {Math.round(m.current)}/{m.target}
                      {m.unit}
                    </span>
                  </div>
                  <div className="macro-bar-track">
                    <div
                      className="macro-bar-fill"
                      style={{ width: `${pct}%`, background: m.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Food log for selected date */}
          <div className="section-header-row">
            <h3 className="section-label-text">
              <RiCalendarLine size={15} /> {isViewingToday ? "Today's Log" : new Date(selectedDateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </h3>
            {canAddFood && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddFood(true)}
            >
              <RiAddCircleFill size={15} /> Add Food
            </button>
            )}
          </div>

          {MEAL_TYPES.map((meal) => {
            const mealLogs = todayLogs.filter((l) => l.meal_type === meal.id);
            if (mealLogs.length === 0) return null;
            const mealCals = mealLogs.reduce(
              (s, l) => s + (l.calories || 0),
              0,
            );
            const Icon = meal.icon;
            return (
              <div key={meal.id} className="meal-section">
                <div className="meal-header">
                  <span className="meal-name">
                    <Icon size={13} /> {meal.label}
                  </span>
                  <span className="meal-cals">{Math.round(mealCals)} kcal</span>
                </div>
                {mealLogs.map((log) => (
                  <div key={log.id} className="food-log-item">
                    <div className="food-log-info">
                      <span className="food-log-name">{log.food_name}</span>
                      <span className="food-log-detail">
                        {log.serving_size}
                        {log.brand ? ` • ${log.brand}` : ""}
                        {log.source === "ai" && " • AI"}
                        {log.source === "photo" && " • 📸 AI Scan"}
                      </span>
                    </div>
                    <div className="food-log-right">
                      <span className="food-log-cals">
                        {Math.round(log.calories)}
                      </span>
                      <button
                        className="food-log-delete"
                        onClick={() => deleteFoodLog(log.id)}
                      >
                        <RiDeleteBinLine size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {todayLogs.length === 0 && (
            <div className="empty-state" style={{ marginTop: 20 }}>
              <RiLeafFill size={40} className="empty-icon" />
              <h3 className="empty-title">No food logged today</h3>
              <p className="empty-text">
                Tap "Add Food" to start tracking your meals.
              </p>
            </div>
          )}

          {/* ── Water Tracker ── */}
          <div className="water-tracker" style={{ marginTop: 20 }}>
            <div className="water-tracker-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RiDropFill size={18} style={{ color: '#3b82f6' }} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Water</span>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{waterGlasses}/{waterTarget} glasses</span>
            </div>

            <div className="water-tracker-ring">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle className="ring-bg" cx="40" cy="40" r="32" />
                <circle className="ring-fill" cx="40" cy="40" r="32"
                  style={{
                    strokeDasharray: waterCircumference,
                    strokeDashoffset: waterCircumference - (waterCircumference * waterProgress / 100),
                  }}
                />
              </svg>
              <div className="water-tracker-center">
                <div className="water-tracker-value">{waterGlasses}</div>
                <div className="water-tracker-label">glasses</div>
              </div>
            </div>

            <div className="water-glasses">
              {Array.from({ length: waterTarget }).map((_, i) => (
                <div key={i} className={`water-glass ${i < waterGlasses ? 'filled' : ''}`}
                  onClick={() => {
                    if (i < waterGlasses) { removeWaterGlass(); } else { addWaterGlass(); }
                  }}>
                  <RiDropFill size={14} />
                </div>
              ))}
            </div>

            <button className="water-add-btn" onClick={addWaterGlass}>
              <RiAddFill size={18} /> Add Glass
            </button>
          </div>

          {/* ── Smart Nutrition Insights ── */}
          <div className="glass-card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <RiBrainFill size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 800, fontSize: '0.9rem', fontFamily: 'var(--font-display)' }}>Smart Insights</span>
            </div>

            {/* Protein pacing */}
            {(() => {
              const proteinPct = nutProfile.target_protein > 0
                ? Math.round((totals.protein / nutProfile.target_protein) * 100)
                : 0
              const hour = new Date().getHours()
              const dayProgressPct = Math.round(((hour - 6) / 16) * 100)
              const isAhead = proteinPct > dayProgressPct + 10
              const isBehind = proteinPct < dayProgressPct - 15

              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 14,
                  background: isBehind ? 'rgba(239,68,68,0.06)' : isAhead ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isBehind ? 'rgba(239,68,68,0.2)' : isAhead ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  marginBottom: 10,
                }}>
                  <div style={{ fontSize: '1.5rem' }}>{isBehind ? '⚠️' : isAhead ? '💪' : '📊'}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>
                      {isBehind ? 'Protein behind schedule' : isAhead ? 'Protein pacing looks great' : 'Protein on track'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {proteinPct}% of target hit with {100 - dayProgressPct}% of your eating window remaining.
                      {isBehind && ` Add ${Math.round(nutProfile.target_protein - totals.protein)}g to catch up.`}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Meal balance indicator */}
            {(() => {
              const mealCounts = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }
              todayLogs.forEach(l => { if (mealCounts[l.meal_type] !== undefined) mealCounts[l.meal_type] += 1 })
              const logged = Object.values(mealCounts).filter(c => c > 0).length
              return (
                <div style={{
                  display: 'flex', gap: 8, marginBottom: 10,
                }}>
                  {['breakfast', 'lunch', 'dinner', 'snack'].map(m => (
                    <div key={m} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 10, textAlign: 'center',
                      background: mealCounts[m] > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${mealCounts[m] > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                      <div style={{ fontSize: '0.92rem', marginBottom: 2 }}>
                        {mealCounts[m] > 0 ? '✅' : '⬜'}
                      </div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{m}</div>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Calorie deficit/surplus context */}
            {remaining !== 0 && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, padding: '4px 0' }}>
                {remaining > 0
                  ? `${Math.round(remaining)} kcal remaining. ${remaining > 500 ? 'Consider a protein-rich meal to close the gap.' : 'One snack could fill this.'}`
                  : `${Math.abs(Math.round(remaining))} kcal over target. ${Math.abs(remaining) < 200 ? 'Marginal — no adjustment needed.' : 'Reduce portion size tomorrow to compensate.'}`
                }
              </div>
            )}
          </div>

          {/* ── Saved Meals Quick Add ── */}
          {savedMeals.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <RiBookmarkFill size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Quick Add Saved Meals</span>
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                {savedMeals.map((m, i) => (
                  <button key={m.id || i} className="saved-meal-chip" onClick={() => quickAddSavedMeal(m)}>
                    <RiAddFill size={12} /> {m.food_name} — {m.calories} kcal
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Add Food Modal ── */}
      {showAddFood && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddFood(false);
              setSearchResults([]);
              setAiResult(null);
              setSearchQuery("");
            }
          }}
        >
          <div className="modal glass-modal food-modal">
            <h2 className="modal-title">
              <RiSearchLine size={20} /> Add Food
            </h2>

            {/* Meal type selector */}
            <div className="meal-selector">
              {MEAL_TYPES.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    className={`meal-chip ${selectedMeal === m.id ? "active" : ""}`}
                    onClick={() => setSelectedMeal(m.id)}
                  >
                    <Icon size={13} /> {m.label}
                  </button>
                );
              })}
            </div>

            {/* Search bar */}
            <div className="search-bar" style={{ marginBottom: 8 }}>
              <div className="search-input-wrap">
                <RiSearchLine size={17} className="search-icon" />
                <input
                  className="input search-input"
                  placeholder="Search food in any language…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchFoods()}
                />
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowBarcodeScanner(true)}
                disabled={barcodeLoading}
                title="Scan barcode"
                style={{ padding: '8px 10px' }}
              >
                {barcodeLoading ? <span className="spinner" /> : <RiBarcodeLine size={18} />}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={searchFoods}
                disabled={searching}
              >
                {searching ? <span className="spinner" /> : "Search"}
              </button>
            </div>

            {showBarcodeScanner && (
              <BarcodeScanner
                onScan={handleBarcodeScan}
                onClose={() => setShowBarcodeScanner(false)}
              />
            )}

            {/* Language detection hint */}
            {detectedLang && (
              <div className="lang-hint">
                <RiTranslate2 size={13} />
                Detected {detectedLang} — searching in English
              </div>
            )}

            {searching && (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px 0",
                  color: "var(--text-tertiary)",
                }}
              >
                <span className="spinner" /> &nbsp;Searching…
              </div>
            )}

            {/* ── AI Featured Result (always on top) ── */}
            {aiResult && !searching && (() => {
              const calcCals = Math.round(aiResult.calories * aiMultiplier);
              const calcPro = Math.round(aiResult.protein * aiMultiplier);
              const calcCarb = Math.round(aiResult.carbs * aiMultiplier);
              const calcFat = Math.round(aiResult.fat * aiMultiplier);
              
              let finalServing = aiResult.serving_size;
              if (aiMultiplier !== 1) {
                finalServing = `${aiMultiplier}x (${aiResult.serving_size})`;
              }

              return (
              <div className="ai-food-result">
                <div className="ai-food-badge">
                  <RiSparkling2Fill size={13} /> AI Precision Match
                </div>
                <div className="ai-food-card glass-card">
                  <div className="ai-food-header">
                    <div>
                      <span className="ai-food-name" style={{ display: 'block' }}>{aiResult.food_name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{finalServing}</span>
                    </div>
                    <span className="ai-food-cals">
                      {calcCals} kcal
                    </span>
                  </div>
                  <div className="ai-food-macros">
                    <span>
                      <RiRestaurantFill
                        size={11}
                        style={{ color: "#ef4444" }}
                      />{" "}
                      {calcPro}g P
                    </span>
                    <span>
                      <RiLeafFill size={11} style={{ color: "#22c55e" }} />{" "}
                      {calcCarb}g C
                    </span>
                    <span>
                      <RiDropFill size={11} style={{ color: "#f59e0b" }} />{" "}
                      {calcFat}g F
                    </span>
                  </div>
                  
                  {/* Servings Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 16 }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Servings:</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="input glass-input" 
                      style={{ padding: '8px 12px', fontSize: '0.9rem', width: '100px' }}
                      value={aiMultiplier}
                      onChange={(e) => setAiMultiplier(Number(e.target.value) || 0)}
                    />
                  </div>

                  <button
                    className="btn btn-primary btn-sm btn-full"
                    onClick={() => addFoodLog({
                      ...aiResult,
                      serving_size: finalServing,
                      calories: calcCals,
                      protein: calcPro,
                      carbs: calcCarb,
                      fat: calcFat
                    }, "ai")}
                  >
                    <RiAddCircleFill size={15} /> Add This
                  </button>
                </div>
              </div>
            )})()}

            {/* ── Database Results ── */}
            {searchResults.length > 0 && !searching && (
              <div className="search-results-section">
                <div className="search-results-label">
                  {"FatSecret Database"}
                </div>
                {searchResults.map((food, i) => (
                  <div
                    key={i}
                    className="search-result-item"
                    onClick={() => {
                      // Normalize the selected food serving to 100g if it isn't already, for the gram selector
                      // (OpenFoodFacts results are mostly already per 100g in our mapping)
                      setAiResult(food);
                      document.querySelector(".food-modal")?.scrollTo({
                        top: 0,
                        behavior: "smooth",
                      });
                    }}
                  >
                    <div className="search-result-left">
                      <div className="search-result-name">{food.food_name}</div>
                      {food.brand && (
                        <div className="search-result-brand">{food.brand}</div>
                      )}
                      <div className="search-result-serving">
                        {food.serving_size}
                      </div>
                    </div>
                    <div className="search-result-right">
                      <span className="search-result-cals">
                        {food.calories}
                      </span>
                      <span className="search-result-unit">kcal</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── AI Photo Scan (PRO only) ── */}
            <div style={{ marginTop: 20 }}>
              <PaywallGate feature="AI Photo Scan">
                <AIPhotoScan
                  onResult={(food) => addFoodLog(food, "photo")}
                  onManualPrefill={runFoodSearch}
                  isPaid={isPro}
                />
              </PaywallGate>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ─── AI Photo Scan component (PRO) ───────────────────────────────────────────
function AIPhotoScan({ onResult, onManualPrefill, isPaid = false }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [scanState, setScanState] = useState("idle");
  const [scanMessage, setScanMessage] = useState("");
  const [scanPrefill, setScanPrefill] = useState("");
  const fileRef = useRef(null);

  function resetDiagnostics() {
    setScanState("idle");
    setScanMessage("");
    setScanPrefill("");
  }

  async function handleCapture() {
    const { isNative, takePhoto } = await import("../lib/native");
    if (isNative) {
      try {
        const photo = await takePhoto({ quality: 80, width: 1200, height: 1200 });
        if (!photo?.dataUrl) return;
        resetDiagnostics();
        setAnalyzing(true);
        setScanState("analyzing");
        setScanMessage("Checking the meal...");
        setPreview(photo.dataUrl);
        await analyzePhoto(photo.dataUrl);
      } catch (e) {
        if (!e?.message?.includes("cancel")) {
          setScanState("error");
          setScanMessage(e?.message || "Camera error.");
          setAnalyzing(false);
        }
      }
      return;
    }
    fileRef.current?.click();
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    resetDiagnostics();
    setAnalyzing(true);
    setScanState("analyzing");
    setScanMessage("Compressing the photo and checking the meal...");

    try {
      const optimizedDataUrl = await optimizeImageForVision(file);
      setPreview(optimizedDataUrl);
      await analyzePhoto(optimizedDataUrl);
    } catch (error) {
      setScanState("error");
      setScanMessage(error?.message || "Could not prepare the selected image.");
      setAnalyzing(false);
    }

    e.target.value = "";
  }

  async function analyzePhoto(dataUrl) {
    try {
      const result = await scanFoodPhoto(dataUrl, { isPaid });

      if (result.success && result.food) {
        onResult(result.food);
        setPreview(null);
        resetDiagnostics();
        return;
      }

      const nextPrefill = String(result?.suggestedQuery || "").trim();
      setScanPrefill(nextPrefill);

      if (result?.error?.status === "needs_review") {
        setScanState("review");
        setScanMessage(result.error.message || "The scan needs a quick manual review.");
      } else {
        setScanState("error");
        setScanMessage(result?.error?.message || "Could not analyze the photo right now.");
      }
    } catch (error) {
      setScanState("error");
      setScanMessage(error?.message || "Could not analyze the photo right now.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function continueManually() {
    if (!scanPrefill || typeof onManualPrefill !== "function") return;
    await onManualPrefill(scanPrefill);
    setPreview(null);
    resetDiagnostics();
  }

  const showDiagnostics = scanState === "review" || scanState === "error";

  return (
    <div className="photo-scan-section">
      <div className="photo-scan-header">
        <RiCameraFill size={20} style={{ color: "var(--accent)" }} />
        <div>
          <h4 style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem" }}>
            AI Food Scanner
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: "0.78rem",
              color: "var(--text-tertiary)",
              marginTop: 2,
            }}
          >
            Snap a meal and REPMAX estimates the full nutrition breakdown without leaving the food logger.
          </p>
        </div>
      </div>

      {preview ? (
        <div className="photo-preview-wrap">
          <img src={preview} alt="Food preview" className="photo-preview-img" />
          {analyzing && (
            <div className="photo-analyzing-overlay">
              <span className="spinner" />
              <span style={{ fontSize: "0.85rem", marginLeft: 8 }}>
                Analyzing meal…
              </span>
            </div>
          )}
        </div>
      ) : (
        <button
          className="photo-capture-btn"
          onClick={handleCapture}
        >
          <RiCameraFill size={22} />
          <span>Take Photo or Choose from Gallery</span>
        </button>
      )}

      {scanState === "analyzing" && (
        <div className="scan-diagnostic-card analyzing">
          <div className="scan-diagnostic-label">Analyzing</div>
          <div className="scan-diagnostic-copy">{scanMessage}</div>
        </div>
      )}

      {showDiagnostics && (
        <div className={`scan-diagnostic-card ${scanState}`}>
          <div className="scan-diagnostic-label">
            {scanState === "review" ? "Needs review" : "Scan failed"}
          </div>
          <div className="scan-diagnostic-copy">{scanMessage}</div>
          {scanPrefill && (
            <div className="scan-diagnostic-prefill">
              Best guess: <strong>{scanPrefill}</strong>
            </div>
          )}
          <div className="scan-diagnostic-actions">
            {scanPrefill && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={continueManually}
              >
                Use description manually
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setPreview(null);
                resetDiagnostics();
                handleCapture();
              }}
            >
              <RiRefreshLine size={15} /> Try another photo
            </button>
          </div>
        </div>
      )}

      {preview && !analyzing && !showDiagnostics && (
        <button
          className="btn btn-secondary btn-sm btn-full"
          style={{ marginTop: 8 }}
          onClick={() => {
            setPreview(null);
            resetDiagnostics();
            fileRef.current?.click();
          }}
        >
          <RiRefreshLine size={15} /> Retake Photo
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
    </div>
  );
}

// ─── Barcode Scanner component ──────────────────────────────────────────────
function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const containerRef = useRef(null);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted || !containerRef.current) return;

        const scanner = new Html5Qrcode("barcode-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 150 } },
          (decodedText) => {
            scanner.stop().catch(() => {});
            onScan(decodedText);
          },
          () => {}
        );
      } catch {
        if (mounted) setError("Camera access denied. Enter barcode manually below.");
      }
    }

    startScanner();

    return () => {
      mounted = false;
      scannerRef.current?.stop?.().catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="barcode-scanner-overlay">
      <div className="barcode-scanner-modal glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
            <RiBarcodeLine size={18} style={{ verticalAlign: -3 }} /> Scan Barcode
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '6px 8px' }}>
            <RiCloseLine size={18} />
          </button>
        </div>

        {!error && (
          <div
            id="barcode-reader"
            ref={containerRef}
            style={{ width: '100%', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}
          />
        )}

        {error && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            className="input"
            placeholder="Or type barcode number…"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualCode.trim()) {
                scannerRef.current?.stop?.().catch(() => {});
                onScan(manualCode.trim());
              }
            }}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={!manualCode.trim()}
            onClick={() => {
              scannerRef.current?.stop?.().catch(() => {});
              onScan(manualCode.trim());
            }}
          >
            Look up
          </button>
        </div>
      </div>
    </div>
  );
}

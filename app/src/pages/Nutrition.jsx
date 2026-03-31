import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import PaywallGate from "../components/PaywallGate";
import { callGroq } from "../lib/groq";
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
  RiMeatFill,
  RiDropFill,
  RiArrowUpLine,
  RiArrowDownLine,
  RiEqualizerLine,
  RiCalendarLine,
  RiMoonFill,
  RiSunFill,
  RiTimeFill,
  RiFlashlightFill,
  RiImageFill,
  RiTranslate2,
  RiRefreshLine,
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
async function translateQuery(query) {
  // Quick ASCII check — if all ASCII printable, likely already English
  if (/^[\x20-\x7E]+$/.test(query)) {
    return { english: query, is_english: true, original_lang: "English" };
  }
  try {
    const data = await callGroq({
      messages: [
        {
          role: "system",
          content:
            'You are a translator. Detect the language of the food query and translate it to English. Return ONLY valid JSON with no extra text: {"english":"translated text","is_english":false,"original_lang":"detected language name"}',
        },
        { role: "user", content: `Food query: ${query}` },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 120,
      response_format: { type: "json_object" },
    });
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return { english: query, is_english: true, original_lang: "Unknown" };
  }
}

// AI nutrition lookup — always returns a result in the user's original language
async function aiSearchFood(query) {
  try {
    const data = await callGroq({
      messages: [
        {
          role: "system",
          content: `You are a precise nutrition database. Given a food item (in any language), return accurate per-serving nutritional data.
Rules:
- Use real USDA / common nutritional values
- If the input is not in English, return food_name in the SAME language as the input
- Output ONLY valid JSON, nothing else:
  {"food_name":"...","brand":"","serving_size":"...","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0}`,
        },
        { role: "user", content: `Nutritional info for: ${query}` },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return null;
  }
}

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
  const [searching, setSearching] = useState(false);
  const [detectedLang, setDetectedLang] = useState(null);
  const [selectedMeal, setSelectedMeal] = useState("snack");
  const [toast, setToast] = useState("");

  const [setupForm, setSetupForm] = useState({
    age: "",
    weight: "",
    height: "",
    gender: "male",
    activity_level: "moderate",
    diet_goal: "maintain",
  });

  useEffect(() => {
    loadNutrition();
  }, []);

  function showToastMsg(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function loadNutrition() {
    try {
      const today = new Date().toISOString().split("T")[0];
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
          .eq("logged_at", today)
          .order("created_at", { ascending: true }),
      ]);
      if (npRes.data) {
        setNutProfile(npRes.data);
        setSetupForm({
          age: npRes.data.age || "",
          weight: npRes.data.weight || "",
          height: npRes.data.height || "",
          gender: npRes.data.gender || "male",
          activity_level: npRes.data.activity_level || "moderate",
          diet_goal: npRes.data.diet_goal || "maintain",
        });
      } else {
        setShowSetup(true);
      }
      setTodayLogs(logsRes.data || []);
    } catch (err) {
      console.error("Nutrition load error:", err);
    }
    setLoading(false);
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
    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      target_calories: target,
      target_protein: Math.round((target * 0.3) / 4),
      target_fat: Math.round((target * 0.25) / 9),
      target_carbs: Math.round((target * 0.45) / 4),
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

  async function searchFoods() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setAiResult(null);
    setDetectedLang(null);

    const query = searchQuery.trim();

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
      logged_at: new Date().toISOString().split("T")[0],
    });
    if (!error) {
      showToastMsg(`Added ${food.food_name}`);
      setShowAddFood(false);
      setSearchQuery("");
      setSearchResults([]);
      setAiResult(null);
      setDetectedLang(null);
      loadNutrition();
    }
  }

  async function deleteFoodLog(id) {
    await supabase.from("food_logs").delete().eq("id", id);
    loadNutrition();
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
              We'll calculate your perfect daily targets
            </p>

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
                        <RiMeatFill size={13} style={{ color: "#ef4444" }} />{" "}
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
                icon: RiMeatFill,
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

          {/* Today's food log */}
          <div className="section-header-row">
            <h3 className="section-label-text">
              <RiCalendarLine size={15} /> Today's Log
            </h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddFood(true)}
            >
              <RiAddCircleFill size={15} /> Add Food
            </button>
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
                className="btn btn-primary btn-sm"
                onClick={searchFoods}
                disabled={searching}
              >
                {searching ? <span className="spinner" /> : "Search"}
              </button>
            </div>

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
            {aiResult && !searching && (
              <div className="ai-food-result">
                <div className="ai-food-badge">
                  <RiSparkling2Fill size={13} /> AI Result
                </div>
                <div className="ai-food-card glass-card">
                  <div className="ai-food-header">
                    <span className="ai-food-name">{aiResult.food_name}</span>
                    <span className="ai-food-cals">
                      {aiResult.calories} kcal
                    </span>
                  </div>
                  <div className="ai-food-macros">
                    <span>
                      <RiMeatFill size={11} style={{ color: "#ef4444" }} />{" "}
                      {aiResult.protein}g P
                    </span>
                    <span>
                      <RiLeafFill size={11} style={{ color: "#22c55e" }} />{" "}
                      {aiResult.carbs}g C
                    </span>
                    <span>
                      <RiDropFill size={11} style={{ color: "#f59e0b" }} />{" "}
                      {aiResult.fat}g F
                    </span>
                    {aiResult.fiber > 0 && (
                      <span
                        style={{
                          color: "var(--text-tertiary)",
                          fontSize: "0.75rem",
                        }}
                      >
                        • {aiResult.fiber}g fiber
                      </span>
                    )}
                  </div>
                  <div className="ai-food-serving">{aiResult.serving_size}</div>
                  <button
                    className="btn btn-primary btn-sm btn-full"
                    onClick={() => addFoodLog(aiResult, "ai")}
                  >
                    <RiAddCircleFill size={15} /> Add This
                  </button>
                </div>
              </div>
            )}

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
                    onClick={() => addFoodLog(food, "search")}
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
                <AIPhotoScan onResult={(food) => addFoodLog(food, "photo")} />
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
function AIPhotoScan({ onResult }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [scanError, setScanError] = useState("");
  const fileRef = useRef(null);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError("");

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      await analyzePhoto(dataUrl);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  async function analyzePhoto(dataUrl) {
    setAnalyzing(true);
    setScanError("");
    try {
      const data = await callGroq({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: `You are a professional nutritionist. Carefully analyze this food photo.
- Identify every food item visible
- Estimate realistic portion sizes based on the plate/container
- Calculate total combined nutritional values
Return ONLY valid JSON, no extra text:
{"food_name":"full description of the meal","serving_size":"estimated total portion","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"items":["item 1","item 2"]}`,
              },
            ],
          },
        ],
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0.2,
        max_tokens: 700,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(data.choices[0].message.content);
      onResult(result);
      setPreview(null);
    } catch (err) {
      console.error("Vision error:", err);
      setScanError(
        "Could not analyze the photo. Try again or describe the food manually.",
      );
    }
    setAnalyzing(false);
  }

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
            Take a photo of your meal — AI calculates the full nutrition
            breakdown
          </p>
        </div>
      </div>

      {/* Photo preview */}
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
          onClick={() => fileRef.current?.click()}
        >
          <RiCameraFill size={22} />
          <span>Take Photo or Choose from Gallery</span>
        </button>
      )}

      {/* Retake button */}
      {preview && !analyzing && (
        <button
          className="btn btn-secondary btn-sm btn-full"
          style={{ marginTop: 8 }}
          onClick={() => {
            setPreview(null);
            setScanError("");
            fileRef.current?.click();
          }}
        >
          <RiRefreshLine size={15} /> Retake Photo
        </button>
      )}

      {scanError && (
        <p
          style={{
            fontSize: "0.8rem",
            color: "#ef4444",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {scanError}
        </p>
      )}

      {/* Hidden file input — capture="environment" opens rear camera on mobile */}
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

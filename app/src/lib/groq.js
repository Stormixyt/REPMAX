/**
 * groq.js — All AI calls go through the Supabase Edge Function "ai-proxy".
 * The actual Groq API key lives only in Supabase secrets, never in this bundle.
 */
import { supabase } from "./supabase";

const MODEL = "llama-3.3-70b-versatile";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const SYSTEM_PROMPT = `You are REPMAX, an expert strength and conditioning coach AI. You create scientifically-backed, periodized workout programs.

CORE PRINCIPLES YOU FOLLOW:
- Progressive overload: systematically increase weight, reps, or sets over time
- Proper volume: 10-20 hard sets per muscle group per week depending on experience
- Exercise selection: compound movements first, then isolation work
- Periodization: mesocycle structure with accumulation and deload phases
- RPE-based autoregulation: adjust intensity based on daily readiness
- Specific to user's equipment, schedule, and goals

WHEN CREATING A PROGRAM, YOU MUST:
1. Create a full week-by-week plan for 4 weeks (3 training weeks + 1 deload)
2. Each training day must have 5-7 exercises
3. Include specific sets, reps, and RPE targets
4. Use appropriate rep ranges for the goal:
   - Strength: 3-6 reps @ RPE 7-9
   - Hypertrophy: 8-12 reps @ RPE 7-8.5
   - Athletic: mix of 3-6 and 8-15 @ RPE 7-8
   - General: 8-15 reps @ RPE 6-8
5. Include warm-up sets for main compounds
6. Week 4 deload: reduce volume by 40%, reduce RPE by 2 points

OUTPUT FORMAT: You MUST respond with ONLY valid JSON matching this structure exactly:
{
  "name": "Program Name",
  "split_type": "ppl|upper_lower|full_body|bro_split",
  "weeks": [
    {
      "week_number": 1,
      "is_deload": false,
      "days": [
        {
          "day_name": "Push Day",
          "target_muscles": ["chest", "shoulders", "triceps"],
          "exercises": [
            {
              "name": "Barbell Bench Press",
              "sets": 4,
              "reps": 8,
              "rpe": 7.5,
              "rest_seconds": 180,
              "notes": "Control the eccentric, pause at chest"
            }
          ]
        }
      ]
    }
  ]
}

NEVER include any text outside the JSON. ONLY output the JSON object.`;

/**
 * Core helper — calls the ai-proxy edge function with a hard timeout.
 * If the edge function takes longer than 10 seconds (mobile/rate-limited),
 * we abort and fall back to the local program generator.
 */
async function callGroq(body) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const { data, error } = await supabase.functions.invoke("ai-proxy", {
      body,
      signal: controller.signal
    })
    clearTimeout(timeout)
    if (error) throw new Error(error.message)
    return data
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

export async function generateProgram(profile) {
  const userPrompt = buildUserPrompt(profile);

  try {
    const data = await callGroq({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      model: MODEL,
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    });

    const programJson = JSON.parse(data.choices[0].message.content);
    return { success: true, program: programJson };
  } catch (err) {
    console.warn("AI generation failed/timed out, using local fallback:", err.message);
    return generateFallbackProgram(profile);
  }
}

function generateFallbackProgram(profile) {
  const days = profile.training_days || ['Mon', 'Wed', 'Fri'];
  const goal = profile.goal || 'general';
  const level = profile.experience_level || 'intermediate';
  const split = profile.preferred_split || 'full_body';

  const repRange = { strength: 5, hypertrophy: 10, athletic: 8, general: 10 };
  const baseReps = repRange[goal] || 10;
  const baseSets = level === 'beginner' ? 3 : 4;

  const exerciseBank = {
    push: [
      { name: 'Bench Press', sets: baseSets, reps: baseReps, rpe: 7.5, rest_seconds: 120, notes: 'Controlled descent' },
      { name: 'Overhead Press', sets: 3, reps: baseReps, rpe: 7.5, rest_seconds: 90, notes: 'Brace core' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: 12, rpe: 7, rest_seconds: 90, notes: '30-degree angle' },
      { name: 'Lateral Raises', sets: 3, reps: 15, rpe: 7, rest_seconds: 60, notes: 'Slow eccentric' },
      { name: 'Tricep Pushdowns', sets: 3, reps: 12, rpe: 7, rest_seconds: 60, notes: 'Squeeze at bottom' },
      { name: 'Dips', sets: 3, reps: baseReps, rpe: 7.5, rest_seconds: 90, notes: 'Bodyweight or weighted' }
    ],
    pull: [
      { name: 'Barbell Row', sets: baseSets, reps: baseReps, rpe: 7.5, rest_seconds: 120, notes: 'Squeeze shoulder blades' },
      { name: 'Pull-ups or Lat Pulldown', sets: baseSets, reps: baseReps, rpe: 7.5, rest_seconds: 90, notes: 'Full stretch at bottom' },
      { name: 'Cable Row', sets: 3, reps: 12, rpe: 7, rest_seconds: 90, notes: 'Pause at contraction' },
      { name: 'Face Pulls', sets: 3, reps: 15, rpe: 7, rest_seconds: 60, notes: 'External rotate at top' },
      { name: 'Barbell Curls', sets: 3, reps: 12, rpe: 7, rest_seconds: 60, notes: 'No swinging' },
      { name: 'Hammer Curls', sets: 3, reps: 12, rpe: 7, rest_seconds: 60, notes: 'Neutral grip' }
    ],
    legs: [
      { name: 'Squat', sets: baseSets, reps: baseReps, rpe: 8, rest_seconds: 180, notes: 'Below parallel' },
      { name: 'Romanian Deadlift', sets: baseSets, reps: baseReps, rpe: 7.5, rest_seconds: 120, notes: 'Hinge at hips' },
      { name: 'Leg Press', sets: 3, reps: 12, rpe: 7, rest_seconds: 120, notes: 'Full range of motion' },
      { name: 'Leg Curls', sets: 3, reps: 12, rpe: 7, rest_seconds: 60, notes: 'Control the negative' },
      { name: 'Calf Raises', sets: 4, reps: 15, rpe: 7, rest_seconds: 60, notes: 'Full stretch and pause' },
      { name: 'Walking Lunges', sets: 3, reps: 12, rpe: 7, rest_seconds: 90, notes: 'Per leg' }
    ],
    upper: [
      { name: 'Bench Press', sets: baseSets, reps: baseReps, rpe: 7.5, rest_seconds: 120, notes: 'Controlled descent' },
      { name: 'Barbell Row', sets: baseSets, reps: baseReps, rpe: 7.5, rest_seconds: 120, notes: 'Squeeze shoulder blades' },
      { name: 'Overhead Press', sets: 3, reps: baseReps, rpe: 7.5, rest_seconds: 90, notes: 'Brace core' },
      { name: 'Pull-ups or Lat Pulldown', sets: 3, reps: baseReps, rpe: 7.5, rest_seconds: 90, notes: 'Full ROM' },
      { name: 'Lateral Raises', sets: 3, reps: 15, rpe: 7, rest_seconds: 60, notes: 'Slow eccentric' },
      { name: 'Barbell Curls', sets: 3, reps: 12, rpe: 7, rest_seconds: 60, notes: 'No swinging' }
    ],
    lower: [
      { name: 'Squat', sets: baseSets, reps: baseReps, rpe: 8, rest_seconds: 180, notes: 'Below parallel' },
      { name: 'Romanian Deadlift', sets: baseSets, reps: baseReps, rpe: 7.5, rest_seconds: 120, notes: 'Hinge at hips' },
      { name: 'Leg Press', sets: 3, reps: 12, rpe: 7, rest_seconds: 120, notes: 'Full range of motion' },
      { name: 'Leg Curls', sets: 3, reps: 12, rpe: 7, rest_seconds: 60, notes: 'Control negative' },
      { name: 'Bulgarian Split Squats', sets: 3, reps: 10, rpe: 7, rest_seconds: 90, notes: 'Per leg' },
      { name: 'Calf Raises', sets: 4, reps: 15, rpe: 7, rest_seconds: 60, notes: 'Full stretch' }
    ],
    full: [
      { name: 'Squat', sets: baseSets, reps: baseReps, rpe: 8, rest_seconds: 180, notes: 'Below parallel' },
      { name: 'Bench Press', sets: baseSets, reps: baseReps, rpe: 7.5, rest_seconds: 120, notes: 'Controlled descent' },
      { name: 'Barbell Row', sets: baseSets, reps: baseReps, rpe: 7.5, rest_seconds: 120, notes: 'Squeeze lats' },
      { name: 'Overhead Press', sets: 3, reps: baseReps, rpe: 7.5, rest_seconds: 90, notes: 'Brace core' },
      { name: 'Romanian Deadlift', sets: 3, reps: baseReps, rpe: 7.5, rest_seconds: 120, notes: 'Hinge at hips' },
      { name: 'Pull-ups or Lat Pulldown', sets: 3, reps: baseReps, rpe: 7, rest_seconds: 90, notes: 'Full ROM' }
    ]
  };

  function getDayExercises(dayIndex, numDays) {
    if (split === 'ppl') {
      const cycle = ['push', 'pull', 'legs'];
      return exerciseBank[cycle[dayIndex % 3]];
    }
    if (split === 'upper_lower') {
      return dayIndex % 2 === 0 ? exerciseBank.upper : exerciseBank.lower;
    }
    if (split === 'bro_split') {
      const cycle = ['push', 'pull', 'legs', 'upper', 'lower'];
      return exerciseBank[cycle[dayIndex % 5]];
    }
    return exerciseBank.full;
  }

  function getDayName(dayIndex) {
    if (split === 'ppl') {
      const names = ['Push Day', 'Pull Day', 'Leg Day'];
      return names[dayIndex % 3];
    }
    if (split === 'upper_lower') {
      return dayIndex % 2 === 0 ? 'Upper Body' : 'Lower Body';
    }
    if (split === 'bro_split') {
      const names = ['Chest & Triceps', 'Back & Biceps', 'Legs', 'Shoulders & Arms', 'Full Body'];
      return names[dayIndex % 5];
    }
    return `Full Body ${String.fromCharCode(65 + dayIndex)}`;
  }

  function getTargetMuscles(dayIndex) {
    if (split === 'ppl') {
      const targets = [['chest', 'shoulders', 'triceps'], ['back', 'biceps', 'rear delts'], ['quads', 'hamstrings', 'glutes', 'calves']];
      return targets[dayIndex % 3];
    }
    if (split === 'upper_lower') {
      return dayIndex % 2 === 0 ? ['chest', 'back', 'shoulders', 'arms'] : ['quads', 'hamstrings', 'glutes', 'calves'];
    }
    return ['full body'];
  }

  const weeks = Array.from({ length: 4 }, (_, weekIdx) => {
    const isDeload = weekIdx === 3;
    return {
      week_number: weekIdx + 1,
      is_deload: isDeload,
      days: days.map((_, dayIdx) => {
        const exercises = getDayExercises(dayIdx, days.length).map(ex => ({
          ...ex,
          sets: isDeload ? Math.max(2, ex.sets - 1) : ex.sets,
          rpe: isDeload ? Math.max(5, ex.rpe - 2) : ex.rpe + (weekIdx * 0.5)
        }));
        return {
          day_name: getDayName(dayIdx),
          target_muscles: getTargetMuscles(dayIdx),
          exercises
        };
      })
    };
  });

  const splitNames = { ppl: 'Push/Pull/Legs', upper_lower: 'Upper/Lower', full_body: 'Full Body', bro_split: 'Bro Split' };

  return {
    success: true,
    program: {
      name: `${splitNames[split] || split} Program`,
      split_type: split,
      weeks
    }
  };
}

export async function adaptProgram(profile, currentProgram, recentPerformance) {
  const prompt = `Based on recent performance data, adapt this program for next week.

CURRENT PROFILE:
${JSON.stringify(profile, null, 2)}

CURRENT PROGRAM STRUCTURE:
${JSON.stringify(currentProgram, null, 2)}

RECENT PERFORMANCE (last week's logged sets):
${JSON.stringify(recentPerformance, null, 2)}

ADAPTATION RULES:
- If user hit all target reps at the target RPE: increase weight by 2.5-5 lbs for compounds, 2.5 lbs for isolation
- If user missed reps: keep same weight, they'll get it next time
- If RPE was consistently 9-10: reduce weight by 5% or add a rest day
- If RPE was consistently below 6: increase weight by 5-10%

Output the updated program for next week ONLY as JSON in the same format.`;

  try {
    const data = await callGroq({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      model: MODEL,
      temperature: 0.5,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    });

    const adapted = JSON.parse(data.choices[0].message.content);
    return { success: true, program: adapted };
  } catch (err) {
    console.warn("Adaptation API failed, returning unmodified program:", err);
    return { success: true, program: currentProgram };
  }
}

function buildUserPrompt(profile) {
  const splitMap = {
    ppl: "Push/Pull/Legs (PPL)",
    upper_lower: "Upper/Lower",
    full_body: "Full Body",
    bro_split: "Bro Split (one muscle group per day)",
    arnold: "Arnold Split",
  };

  const goalDesc = {
    strength: "maximize strength and 1RM on compound lifts",
    hypertrophy: "maximize muscle growth and size",
    athletic: "build functional strength, power, and conditioning",
    general: "improve overall fitness, build muscle, and get stronger",
  };

  const days = profile.training_days || [];
  const equipment = profile.equipment || [];
  const split = splitMap[profile.preferred_split] || profile.preferred_split;
  const goal = goalDesc[profile.goal] || profile.goal;
  const level = profile.experience_level || 'intermediate';
  const prompt = `As an elite strength and conditioning coach, generate a highly optimized ${profile.total_weeks || 4}-week training program in strict JSON format.

Client Profile:
- Goal: ${profile.goal}
- Experience Level: ${profile.experience_level}
- Training Days per Week: ${profile.training_days?.length || 3} (${profile.training_days?.join(', ')})
- Equipment Available: ${profile.equipment?.join(', ') || 'Standard Gym'}
- Split: ${profile.preferred_split}
${profile.focus_muscles?.length > 0 ? `- Primary Muscle Focuses: ${profile.focus_muscles.join(', ')} (PRIORITIZE THESE IN VOLUME/INTENSITY)` : ''}
- Name: ${profile.display_name || "Athlete"}

REQUIREMENTS:
- Build the program for ${days.length} training days per week
- Use the ${split} split style
- Only use exercises possible with my available equipment
- Week 4 should be a deload week
- Include warmup sets for main compound lifts
- Suggest starting weights appropriate for a ${level} lifter (in lbs)

Create the program now.`;

  return prompt;
}

// Exported for use in Nutrition.jsx and other pages
export { callGroq, VISION_MODEL, MODEL };

export async function generateProgramFromImages(base64Images) {
  const VISION_PROMPT = `You are REPMAX Vision, an expert fitness AI. Your task is to extract the training routine shown in the provided images and output it EXACTLY matching the strict JSON format below.

IF any vital data (like RPE or Rest time) is missing from the images, you MUST invent sensible defaults (e.g. RPE 8, 120s rest).
Assume 4 weeks of training (just duplicate week 1 into week 2, 3, and 4 if only 1 week is shown).

OUTPUT FORMAT: You MUST respond with ONLY valid JSON matching this structure exactly (do not wrap in markdown blocks, just raw JSON):
{
  "name": "Custom Routine",
  "split_type": "custom",
  "weeks": [
    {
      "week_number": 1,
      "is_deload": false,
      "days": [
        {
          "day_name": "Day 1",
          "target_muscles": ["chest", "shoulders"],
          "exercises": [
            {
              "name": "Barbell Bench Press",
              "sets": 4,
              "reps": 8,
              "rpe": 7.5,
              "rest_seconds": 180,
              "notes": "Any notes from the image"
            }
          ]
        }
      ]
    }
  ]
}

DO NOT OUTPUT ANY OTHER TEXT. ONLY RAW JSON.`;

  try {
    const userMessageContent = [
      { type: "text", text: "Parse the training routines in these images and give me the perfect JSON structure." }
    ];

    for (const img of base64Images) {
      userMessageContent.push({
        type: "image_url",
        image_url: { url: img }
      });
    }

    const data = await callGroq({
      messages: [
        { role: "system", content: VISION_PROMPT },
        { role: "user", content: userMessageContent },
      ],
      model: "llama-3.2-90b-vision-preview",
      temperature: 0.2, // Low temp for extraction tasks
      max_tokens: 6000,
    });

    let rawOutput = data.choices[0].message.content;
    
    // Strip markdown JSON wrapping if present
    if (rawOutput.includes('\`\`\`json')) {
      rawOutput = rawOutput.split('\`\`\`json')[1].split('\`\`\`')[0];
    } else if (rawOutput.includes('\`\`\`')) {
      rawOutput = rawOutput.split('\`\`\`')[1].split('\`\`\`')[0];
    }

    const programJson = JSON.parse(rawOutput.trim());
    return { success: true, program: programJson };
  } catch(err) {
    console.error("Vision AI failed:", err);
    return { success: false, error: err };
  }
}

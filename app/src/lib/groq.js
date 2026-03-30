const GROQ_API_KEY = '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'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

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

NEVER include any text outside the JSON. ONLY output the JSON object.`

export async function generateProgram(profile) {
  const userPrompt = buildUserPrompt(profile)
  
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        model: MODEL,
        temperature: 0.7,
        max_tokens: 8000,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`)
    }

    const data = await response.json()
    const programJson = JSON.parse(data.choices[0].message.content)
    return { success: true, program: programJson }
  } catch (err) {
    console.error('Program generation failed:', err)
    return { success: false, error: err.message }
  }
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

Output the updated program for next week ONLY as JSON in the same format.`

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        model: MODEL,
        temperature: 0.5,
        max_tokens: 8000,
        response_format: { type: 'json_object' }
      })
    })

    const data = await response.json()
    const adapted = JSON.parse(data.choices[0].message.content)
    return { success: true, program: adapted }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

function buildUserPrompt(profile) {
  const splitMap = {
    'ppl': 'Push/Pull/Legs (PPL)',
    'upper_lower': 'Upper/Lower',
    'full_body': 'Full Body',
    'bro_split': 'Bro Split (one muscle group per day)',
    'arnold': 'Arnold Split'
  }

  const goalDesc = {
    'strength': 'maximize strength and 1RM on compound lifts',
    'hypertrophy': 'maximize muscle growth and size',
    'athletic': 'build functional strength, power, and conditioning',
    'general': 'improve overall fitness, build muscle, and get stronger'
  }

  const days = profile.training_days || []
  const equipment = profile.equipment || []
  const split = splitMap[profile.preferred_split] || profile.preferred_split
  const goal = goalDesc[profile.goal] || profile.goal
  const level = profile.experience_level || 'intermediate'

  return `Create a complete 4-week training program for me.

MY PROFILE:
- Experience: ${level}
- Goal: ${goal}  
- Training days per week: ${days.length} (${days.join(', ')})
- Preferred split: ${split}
- Available equipment: ${equipment.join(', ')}
- Name: ${profile.display_name || 'Athlete'}

REQUIREMENTS:
- Build the program for ${days.length} training days per week
- Use the ${split} split style
- Only use exercises possible with my available equipment
- Week 4 should be a deload week
- Include warmup sets for main compound lifts
- Suggest starting weights appropriate for a ${level} lifter (in lbs)

Create the program now.`
}

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { generateProgram } from '../lib/groq'
import { supabase } from '../lib/supabase'
import { RiBoxingFill, RiFlashlightFill, RiSpeedFill, RiBodyScanFill, RiFireFill, RiSeedlingFill, RiLineChartFill, RiTrophyFill, RiCalendarCheckFill, RiImageFill, RiUploadCloud2Fill, RiStore2Fill, RiHandHeartFill, RiCrosshair2Fill, RiBrainFill, RiCheckFill, RiArrowRightLine, RiRocketFill } from '@remixicon/react'

const GOALS = [
  { id: 'strength', icon: <RiBoxingFill size={28} />, label: 'Strength', desc: 'Maximize lifts & power' },
  { id: 'hypertrophy', icon: <RiFlashlightFill size={28} />, label: 'Muscle Growth', desc: 'Build size & definition' },
  { id: 'athletic', icon: <RiSpeedFill size={28} />, label: 'Athletic', desc: 'Speed, power & agility' },
  { id: 'general', icon: <RiFireFill size={28} />, label: 'General Fitness', desc: 'Get stronger overall' },
]

const LEVELS = [
  { id: 'beginner', icon: <RiSeedlingFill size={24} />, label: 'Beginner', desc: 'Less than 6 months lifting' },
  { id: 'intermediate', icon: <RiLineChartFill size={24} />, label: 'Intermediate', desc: '6 months to 2 years' },
  { id: 'advanced', icon: <RiTrophyFill size={24} />, label: 'Advanced', desc: '2+ years of consistent training' },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const EQUIPMENT = [
  'Barbell', 'Dumbbells', 'Cables', 'Machines',
  'Pull-up Bar', 'Bench', 'Squat Rack', 'Bodyweight Only'
]

const FOCUS_MUSCLES = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 
  'Quads', 'Hamstrings', 'Calves', 'Abs', 'Glutes', 'Forearms'
]

const SPLITS = {
  3: [
    { id: 'full_body', label: 'Full Body', desc: 'Hit everything 3x/week' },
    { id: 'ppl', label: 'Push/Pull/Legs', desc: 'Classic PPL once per week' },
  ],
  4: [
    { id: 'upper_lower', label: 'Upper/Lower', desc: '2 upper + 2 lower days' },
    { id: 'ppl', label: 'PPL + Full', desc: 'PPL + one full body day' },
  ],
  5: [
    { id: 'ppl', label: 'Push/Pull/Legs', desc: 'PPL with 2 repeat days' },
    { id: 'upper_lower', label: 'Upper/Lower', desc: 'UL with extra day' },
    { id: 'bro_split', label: 'Bro Split', desc: 'One muscle group per day' },
  ],
  6: [
    { id: 'ppl', label: 'Push/Pull/Legs ×2', desc: 'Classic PPL twice per week' },
    { id: 'arnold', label: 'Arnold Split', desc: 'Chest/Back, Shoulders/Arms, Legs ×2' },
  ],
}

export default function Onboarding() {
  const { user, updateProfile, fetchProfile, isPro } = useAuth()
  const [step, setStep] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [genStep, setGenStep] = useState(0)

  const [goal, setGoal] = useState('')
  const [level, setLevel] = useState('')
  const [selectedDays, setSelectedDays] = useState([])
  const [equipment, setEquipment] = useState([])
  const [focus, setFocus] = useState([])
  const [split, setSplit] = useState('')
  const [visionImages, setVisionImages] = useState([])

  function toggleDay(day) {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  function toggleEquipment(item) {
    setEquipment(prev => prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item])
  }

  function toggleFocus(item) {
    setFocus(prev => prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item])
  }

  function handleVisionUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return

    let loaded = 0
    const newImages = []

    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          let width = img.width
          let height = img.height
          const MAX_SIZE = 1000
          
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width
            width = MAX_SIZE
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height
            height = MAX_SIZE
          }
          
          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)
          
          newImages.push(canvas.toDataURL('image/jpeg', 0.6)) // Aggressive compression for API
          loaded++
          
          if (loaded === files.length) {
            setVisionImages(prev => {
              const combined = [...prev, ...newImages]
              return combined.slice(0, 3) // max 3
            })
          }
        }
        img.src = event.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  async function finishOnboarding() {
    setGenerating(true)
    setGenStep(0)

    const profileData = {
      goal,
      experience_level: level,
      training_days: selectedDays,
      equipment,
      focus_muscles: focus,
      preferred_split: split,
      display_name: user?.user_metadata?.display_name || user?.email?.split('@')[0]
    }

    await updateProfile(profileData)
    setGenStep(1)

    await new Promise(r => setTimeout(r, 800))
    setGenStep(2)
    const result = await generateProgram({ ...profileData })
    setGenStep(3)

    if (result.success) {
      const { error } = await supabase.from('programs').insert({
        user_id: user.id,
        name: result.program.name || `${split.toUpperCase()} Program`,
        split_type: split,
        total_weeks: result.program.weeks?.length || 4,
        program_data: result.program,
        active: true
      })
      
      if (!error) {
        setGenStep(4)
        await updateProfile({ onboarded: true })
        await fetchProfile()
        setGenStep(5)
        return
      }
    }
    
    // If we reach here, something completely failed (rare with local fallback)
    alert("Generation failed. Please try again.")
    setGenerating(false)
    setStep(1)
  }

  async function finishVisionOnboarding() {
    if (!visionImages.length) return
    setGenerating(true)
    setGenStep(0)

    const profileData = {
      display_name: user?.user_metadata?.display_name || user?.email?.split('@')[0]
    }

    await updateProfile(profileData)
    setGenStep(1)

    await new Promise(r => setTimeout(r, 800))
    setGenStep(2)
    // Needs to be imported from groq
    const { generateProgramFromImages } = await import('../lib/groq.js') 
    const result = await generateProgramFromImages(visionImages)
    setGenStep(3)

    if (result.success) {
      const { error } = await supabase.from('programs').insert({
        user_id: user.id,
        name: result.program.name || 'Custom routine',
        split_type: 'custom',
        total_weeks: result.program.weeks?.length || 4,
        program_data: result.program,
        active: true
      })
      
      if (!error) {
        setGenStep(4)
        await updateProfile({ onboarded: true })
        await fetchProfile()
        setGenStep(5)
        return
      }
    }
    
    alert("Image Parsing failed. Please try again.")
    setGenerating(false)
    setStep(10)
  }

  const totalSteps = 5
  const availableSplits = SPLITS[selectedDays.length] || SPLITS[3]

  if (generating) {
    const steps = [
      'Saving your profile...',
      'Analyzing your goals...',
      'Building your program with AI...',
      'Saving your custom program...',
      'Finalizing setup...',
      'Done!'
    ]

    return (
      <div className="generating-screen">
        <div className="generating-icon"><RiBrainFill size={48} /></div>
        <h2 className="generating-title">Building Your Program</h2>
        <p className="generating-subtitle">Our AI is creating a personalized training plan just for you</p>
        <div className="generating-steps">
          {steps.map((s, i) => (
            <div key={i} className={`generating-step ${i === genStep ? 'active' : ''} ${i < genStep ? 'done' : ''}`}>
              <div className="step-icon">{i < genStep ? <RiCheckFill size={14} /> : i + 1}</div>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="onboarding">
      <div className="onboarding-progress">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`onboarding-progress-bar ${i < step ? 'filled' : ''} ${i === step ? 'current' : ''}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="onboarding-content" key="welcome">
          <div className="onboarding-emoji"><RiHandHeartFill size={48} /></div>
          <h1 className="onboarding-title">Let's build your perfect program.</h1>
          <p className="onboarding-subtitle">
            Answer a few quick questions and our AI will create a fully periodized training program designed specifically for you. Takes about 60 seconds.
          </p>
          <div className="onboarding-actions" style={{ flexDirection: 'column', gap: 12 }}>
            <button className="btn btn-primary btn-full btn-lg" onClick={() => setStep(1)}>
              Let's Go (AI Guided) <RiArrowRightLine size={18} />
            </button>
            <button 
              className="btn btn-secondary btn-full" 
              onClick={() => {
                if (isPro) {
                  setStep(10)
                } else {
                  alert("Upgrade to PRO in your settings to unlock Custom Image Routine parsing!")
                }
              }}
              style={{ padding: '12px', fontSize: '0.9rem' }}
            >
              Upload Routine Image (PRO)
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="onboarding-content" key="goal">
          <div className="onboarding-emoji"><RiCrosshair2Fill size={40} /></div>
          <h1 className="onboarding-title">What's your main goal?</h1>
          <p className="onboarding-subtitle">This determines your rep ranges, volume, and exercise selection.</p>
          <div className="selection-grid">
            {GOALS.map(g => (
              <div key={g.id} className={`selection-card ${goal === g.id ? 'selected' : ''}`} onClick={() => setGoal(g.id)}>
                <span className="icon">{g.icon}</span>
                <div className="label">{g.label}</div>
                <div className="desc">{g.desc}</div>
              </div>
            ))}
          </div>
          <div className="onboarding-actions">
            <button className="btn btn-secondary" onClick={() => setStep(0)}>Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(2)} disabled={!goal}>Next</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="onboarding-content" key="level">
          <div className="onboarding-emoji"><RiLineChartFill size={40} /></div>
          <h1 className="onboarding-title">Experience level?</h1>
          <p className="onboarding-subtitle">Be honest — this affects starting weights and volume. No judgment.</p>
          <div className="selection-grid" style={{ gridTemplateColumns: '1fr' }}>
            {LEVELS.map(l => (
              <div key={l.id} className={`selection-card ${level === l.id ? 'selected' : ''}`} onClick={() => setLevel(l.id)} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16 }}>
                <span className="icon" style={{ margin: 0 }}>{l.icon}</span>
                <div>
                  <div className="label">{l.label}</div>
                  <div className="desc">{l.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="onboarding-actions">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(3)} disabled={!level}>Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="onboarding-content" key="schedule">
          <div className="onboarding-emoji"><RiCalendarCheckFill size={40} /></div>
          <h1 className="onboarding-title">When can you train?</h1>
          <p className="onboarding-subtitle">Tap the days you're available. We'll suggest the best split.</p>
          <div className="day-picker" style={{ marginBottom: 28 }}>
            {DAYS.map(d => (
              <button key={d} type="button" className={`day-btn ${selectedDays.includes(d) ? 'selected' : ''}`} onClick={() => toggleDay(d)}>{d.slice(0, 2)}</button>
            ))}
          </div>
          {selectedDays.length >= 3 && availableSplits && (
            <>
              <p className="input-label" style={{ marginBottom: 12 }}>Choose your split ({selectedDays.length} days/week)</p>
              <div className="selection-grid" style={{ gridTemplateColumns: '1fr' }}>
                {availableSplits.map(s => (
                  <div key={s.id} className={`selection-card ${split === s.id ? 'selected' : ''}`} onClick={() => setSplit(s.id)} style={{ textAlign: 'left', padding: 16 }}>
                    <div className="label" style={{ fontSize: '0.9rem' }}>{s.label}</div>
                    <div className="desc">{s.desc}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {selectedDays.length > 0 && selectedDays.length < 3 && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Select at least 3 training days</p>
          )}
          <div className="onboarding-actions">
            <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(4)} disabled={selectedDays.length < 3 || !split}>Next</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="onboarding-content" key="focus">
          <div className="onboarding-emoji"><RiCrosshair2Fill size={40} /></div>
          <h1 className="onboarding-title">Muscle Focus</h1>
          <p className="onboarding-subtitle">Choose up to 3 muscle groups you want to prioritize for extra volume.</p>
          <div className="tag-grid">
            {FOCUS_MUSCLES.map(m => (
              <div 
                key={m} 
                className={`tag ${focus.includes(m) ? 'selected' : ''}`} 
                onClick={() => {
                  if (focus.includes(m)) toggleFocus(m)
                  else if (focus.length < 3) toggleFocus(m)
                }}
              >
                {m}
              </div>
            ))}
          </div>
          <div className="onboarding-actions" style={{ marginTop: 28 }}>
            <button className="btn btn-secondary" onClick={() => setStep(3)}>Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(5)}>Next</button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="onboarding-content" key="equipment">
          <div className="onboarding-emoji"><RiStore2Fill size={40} /></div>
          <h1 className="onboarding-title">What equipment do you have?</h1>
          <p className="onboarding-subtitle">Select everything available at your gym. This ensures your program only uses exercises you can actually do.</p>
          <div className="tag-grid">
            {EQUIPMENT.map(e => (
              <div key={e} className={`tag ${equipment.includes(e) ? 'selected' : ''}`} onClick={() => toggleEquipment(e)}>{e}</div>
            ))}
          </div>
          <div className="onboarding-actions" style={{ marginTop: 28 }}>
            <button className="btn btn-secondary" onClick={() => setStep(4)}>Back</button>
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={finishOnboarding} disabled={equipment.length === 0}>
              <RiRocketFill size={18} /> Build My Program
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

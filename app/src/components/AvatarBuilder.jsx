import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { RiCheckFill, RiCloseLine, RiShuffleFill, RiVipCrownFill, RiUploadCloud2Fill } from '@remixicon/react'

const HAIR_STYLES = ['fonze', 'mrT', 'dougFunny', 'mrClean', 'dannyPhantom', 'full', 'turpiSpaceMan', 'pixie']
const HAIR_COLORS = ['#2c1b18', '#4a3728', '#71523e', '#b7a69e', '#d4c4b0', '#c9b037', '#e8d44d', '#a52019', '#e74c3c', '#1abc9c', '#8e44ad', '#3498db']
const MOUTH_STYLES = ['laughing', 'nervous', 'pucker', 'sad', 'smile', 'smirk', 'surprised', 'frown']
const EYE_STYLES = ['eyes', 'eyesShadow', 'round', 'smiling']
const EYEBROW_STYLES = ['up', 'eyelashesUp', 'eyelashesDown']
const GLASSES = ['none', 'round', 'tiny']
const POSES = ['idle', 'flex', 'victory', 'wave']
const BG_COLORS = ['transparent', '#1a1a2e', '#0a2647', '#2c1810', '#1a2e1a', '#2e1a2e', '#0d0d0d', '#1e3a5f', '#3d1c02']

export default function AvatarBuilder({ onClose }) {
  const { user, profile, updateProfile, isPro } = useAuth()
  const [activeTab, setActiveTab] = useState('hair')
  const [currentPose, setCurrentPose] = useState('idle')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const [config, setConfig] = useState({
    hair: profile?.avatar_config?.hair || 'fonze',
    hairColor: profile?.avatar_config?.hairColor || '#2c1b18',
    mouth: profile?.avatar_config?.mouth || 'smile',
    eyes: profile?.avatar_config?.eyes || 'eyes',
    eyebrows: profile?.avatar_config?.eyebrows || 'up',
    glasses: profile?.avatar_config?.glasses || 'none',
    bgColor: profile?.avatar_config?.bgColor || 'transparent',
    pose: profile?.avatar_config?.pose || 'idle',
    seed: profile?.avatar_seed || Math.random().toString(36).substring(7),
    imageUrl: profile?.image_url || null
  })

  // Cycle through poses for animation preview
  useEffect(() => {
    if (currentPose === 'idle') return
    const timeout = setTimeout(() => setCurrentPose('idle'), 1500)
    return () => clearTimeout(timeout)
  }, [currentPose])

  function getAvatarUrl(overrides = {}) {
    const c = { ...config, ...overrides }
    if (c.imageUrl && activeTab === 'upload') return c.imageUrl // show uploaded image if in upload tab
    
    const params = new URLSearchParams({
      seed: c.seed,
      hair: c.hair,
      hairColor: c.hairColor.replace('#', ''),
      mouth: c.mouth,
      eyes: c.eyes,
      eyebrows: c.eyebrows,
      backgroundColor: c.bgColor === 'transparent' ? 'transparent' : c.bgColor.replace('#', ''),
    })
    if (c.glasses !== 'none') {
      params.set('glasses', c.glasses)
      params.set('glassesProbability', '100')
    } else {
      params.set('glassesProbability', '0')
    }
    return `https://api.dicebear.com/7.x/micah/svg?${params.toString()}`
  }

  function randomize() {
    setConfig(prev => ({
      ...prev,
      seed: Math.random().toString(36).substring(7),
      imageUrl: null, // clear custom image on randomize
      hair: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)],
      hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
      mouth: MOUTH_STYLES[Math.floor(Math.random() * MOUTH_STYLES.length)],
      eyes: EYE_STYLES[Math.floor(Math.random() * EYE_STYLES.length)],
      eyebrows: EYEBROW_STYLES[Math.floor(Math.random() * EYEBROW_STYLES.length)],
    }))
    setCurrentPose('victory')
    if (activeTab === 'upload') setActiveTab('hair')
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploading(true)

    // Compress image client-side to max 400x400
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const MAX = 400

        if (width > height && width > MAX) {
          height *= MAX / width
          width = MAX
        } else if (height > MAX) {
          width *= MAX / height
          height = MAX
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(async (blob) => {
          if (!blob) {
            alert('Failed to process image')
            setUploading(false)
            return
          }

          const fileExt = 'jpeg'
          const fileName = `${user.id}-${Math.random()}.${fileExt}`
          
          try {
            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' })
              
            if (uploadError) throw uploadError
            
            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
            
            setConfig(prev => ({ ...prev, imageUrl: data.publicUrl }))
            setCurrentPose('flex')
          } catch (err) {
            console.error('Upload failed:', err)
            alert('Failed to upload image. Did you run setup-avatars.sql in Supabase?')
          } finally {
            setUploading(false)
          }
        }, 'image/jpeg', 0.85) // 85% quality JPEG
      }
    }
  }

  async function save() {
    setSaving(true)
    setCurrentPose('flex')
    
    const updates = { 
      avatar_seed: config.seed, 
      avatar_config: { ...config, pose: config.pose },
    }
    
    // If they switched back to drawn avatar, clear the image property
    if (activeTab !== 'upload' && config.imageUrl) {
      updates.image_url = null
      setConfig(prev => ({ ...prev, imageUrl: null }))
    } else if (activeTab === 'upload' && config.imageUrl) {
      updates.image_url = config.imageUrl
    }
    
    await updateProfile(updates)
    setTimeout(() => { setSaving(false); onClose() }, 800)
  }

  const tabs = [
    { id: 'hair', label: '💇' },
    { id: 'color', label: '🎨' },
    { id: 'face', label: '😊' },
    { id: 'extras', label: '👓' },
    { id: 'pose', label: '💪' },
    { id: 'bg', label: '🖼️' },
    { id: 'upload', label: '📸' }
  ]

  // Animation class based on current pose
  const poseClass = `avatar-pose-${currentPose}`
  const displayUrl = activeTab === 'upload' && config.imageUrl ? config.imageUrl : getAvatarUrl()

  return (
    <div className="avatar-builder-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="avatar-builder">
        <div className="modal-slide-handle" />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Avatar Studio</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 8 }}>
            <RiCloseLine size={22} />
          </button>
        </div>

        {/* Preview with animated pose */}
        <div className="avatar-builder-preview">
          <div className={activeTab === 'upload' && config.imageUrl ? '' : `avatar-character ${poseClass}`} style={activeTab === 'upload' && config.imageUrl ? { width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' } : {}}>
            <img src={displayUrl} alt="Avatar" style={activeTab === 'upload' && config.imageUrl ? { objectFit: 'cover' } : {}} />
          </div>
          {/* Pose indicator */}
          {activeTab !== 'upload' && <div className="avatar-pose-label">{currentPose.toUpperCase()}</div>}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          <button className="btn btn-sm btn-secondary" onClick={randomize} style={{ gap: 6 }}>
            <RiShuffleFill size={14} /> Randomize
          </button>
          {activeTab !== 'upload' && POSES.map(p => (
            <button
              key={p}
              className={`avatar-pose-btn ${currentPose === p ? 'active' : ''}`}
              onClick={() => setCurrentPose(p)}
            >
              {p === 'idle' ? '🧍' : p === 'flex' ? '💪' : p === 'victory' ? '🏆' : '👋'}
            </button>
          ))}
        </div>

        {/* Tab navigation */}
        <div className="avatar-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`avatar-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="avatar-tab-content">
          {activeTab === 'hair' && (
            <div className="avatar-option-grid">
              {HAIR_STYLES.map((h, i) => (
                <button
                  key={`${h}-${i}`}
                  className={`avatar-option ${config.hair === h ? 'selected' : ''}`}
                  onClick={() => setConfig(prev => ({ ...prev, hair: h, seed: Math.random().toString(36).substring(7) }))}
                >
                  <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${h}${i}&hair=${h}&backgroundColor=transparent`} alt={h} />
                </button>
              ))}
            </div>
          )}

          {activeTab === 'color' && (
            <>
              <div className="input-label" style={{ marginBottom: 10 }}>Hair Color</div>
              <div className="avatar-color-grid">
                {HAIR_COLORS.map(c => (
                  <button key={c} className={`avatar-color-dot ${config.hairColor === c ? 'selected' : ''}`} style={{ backgroundColor: c }} onClick={() => setConfig(prev => ({ ...prev, hairColor: c }))} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'face' && (
            <>
              <div className="input-label" style={{ marginBottom: 10 }}>Expression</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MOUTH_STYLES.map(m => (
                  <button key={m} className={`tag ${config.mouth === m ? 'selected' : ''}`} onClick={() => { setConfig(prev => ({ ...prev, mouth: m })); setCurrentPose('idle') }}>
                    {m}
                  </button>
                ))}
              </div>
              <div className="input-label" style={{ marginBottom: 10, marginTop: 16 }}>Eyes</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EYE_STYLES.map(e => (
                  <button key={e} className={`tag ${config.eyes === e ? 'selected' : ''}`} onClick={() => setConfig(prev => ({ ...prev, eyes: e }))}>
                    {e}
                  </button>
                ))}
              </div>
              <div className="input-label" style={{ marginBottom: 10, marginTop: 16 }}>Eyebrows</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EYEBROW_STYLES.map(b => (
                  <button key={b} className={`tag ${config.eyebrows === b ? 'selected' : ''}`} onClick={() => setConfig(prev => ({ ...prev, eyebrows: b }))}>
                    {b}
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === 'extras' && (
            <>
              <div className="input-label" style={{ marginBottom: 10 }}>Glasses</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {GLASSES.map(g => (
                  <button key={g} className={`tag ${config.glasses === g ? 'selected' : ''}`} onClick={() => setConfig(prev => ({ ...prev, glasses: g }))}>
                    {g === 'none' ? '✕ None' : g}
                  </button>
                ))}
              </div>
              {!isPro && (
                <div className="pro-lock-overlay" style={{ marginTop: 16 }}>
                  <RiVipCrownFill size={20} color="#ffd700" />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>More accessories with PRO</span>
                </div>
              )}
            </>
          )}

          {activeTab === 'pose' && (
            <>
              <div className="input-label" style={{ marginBottom: 10 }}>Default Pose</div>
              <div className="avatar-pose-grid">
                {POSES.map(p => (
                  <button
                    key={p}
                    className={`avatar-pose-card ${config.pose === p ? 'selected' : ''}`}
                    onClick={() => { setConfig(prev => ({ ...prev, pose: p })); setCurrentPose(p) }}
                  >
                    <div className="avatar-pose-emoji">
                      {p === 'idle' ? '🧍' : p === 'flex' ? '💪' : p === 'victory' ? '🏆' : '👋'}
                    </div>
                    <div className="avatar-pose-name">{p.charAt(0).toUpperCase() + p.slice(1)}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === 'bg' && (
            <>
              <div className="input-label" style={{ marginBottom: 10 }}>Background</div>
              <div className="avatar-color-grid">
                {BG_COLORS.map(c => (
                  <button key={c} className={`avatar-color-dot ${config.bgColor === c ? 'selected' : ''}`} style={{ backgroundColor: c === 'transparent' ? '#070707' : c, border: c === 'transparent' ? '2px dashed var(--border)' : undefined }} onClick={() => setConfig(prev => ({ ...prev, bgColor: c }))} />
                ))}
              </div>
            </>
          )}
          
          {activeTab === 'upload' && (
            <>
              <div className="input-label" style={{ marginBottom: 10, textAlign: 'center' }}>Custom Picture</div>
              <input 
                type="file" 
                accept="image/jpeg,image/png,image/webp" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileUpload} 
              />
              <div 
                style={{ 
                  border: '2px dashed var(--border)', 
                  borderRadius: 16, 
                  padding: 32, 
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                ) : (
                  <>
                    <RiUploadCloud2Fill size={40} color="var(--accent)" />
                    <div style={{ fontWeight: 600 }}>Tap to upload custom image</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>JPG, PNG or WebP under 2MB</div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Save */}
        <button className="btn btn-primary btn-full btn-lg" onClick={save} disabled={saving || uploading} style={{ marginTop: 16 }}>
          {saving ? <span className="spinner-sm" /> : <><RiCheckFill size={18} /> {activeTab === 'upload' ? 'Use Picture' : 'Save Avatar'}</>}
        </button>
      </div>
    </div>
  )
}


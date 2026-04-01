import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { RiCheckFill, RiCloseLine, RiShuffleFill } from '@remixicon/react'

const HAIR_STYLES = ['fonze', 'mrT', 'dougFunny', 'mrClean', 'dannyPhantom', 'full', 'turpiSpaceMan', 'pixie', 'fonze']
const HAIR_COLORS = ['#2c1b18', '#4a3728', '#71523e', '#b7a69e', '#d4c4b0', '#c9b037', '#e8d44d', '#a52019', '#e74c3c', '#1abc9c', '#8e44ad', '#3498db']
const MOUTH_STYLES = ['laughing', 'nervous', 'pucker', 'sad', 'smile', 'smirk', 'surprised', 'frown']
const EYE_STYLES = ['eyes', 'eyesShadow', 'round', 'smiling']
const EYEBROW_STYLES = ['up', 'eyelashesUp', 'eyelashesDown']
const ACCESSORIES = ['none', 'round', 'tiny'] // glasses
const BG_COLORS = ['transparent', '#1a1a2e', '#0a2647', '#2c1810', '#1a2e1a', '#2e1a2e', '#0d0d0d', '#1e3a5f', '#3d1c02']

export default function AvatarBuilder({ onClose }) {
  const { profile, updateProfile } = useAuth()
  
  const [config, setConfig] = useState({
    hair: profile?.avatar_config?.hair || 'fonze',
    hairColor: profile?.avatar_config?.hairColor || '#2c1b18',
    mouth: profile?.avatar_config?.mouth || 'smile',
    eyes: profile?.avatar_config?.eyes || 'eyes',
    eyebrows: profile?.avatar_config?.eyebrows || 'up',
    glasses: profile?.avatar_config?.glasses || 'none',
    bgColor: profile?.avatar_config?.bgColor || 'transparent',
    seed: profile?.avatar_seed || Math.random().toString(36).substring(7)
  })

  function getAvatarUrl() {
    const params = new URLSearchParams({
      seed: config.seed,
      hair: config.hair,
      hairColor: config.hairColor.replace('#', ''),
      mouth: config.mouth,
      eyes: config.eyes,
      eyebrows: config.eyebrows,
      backgroundColor: config.bgColor === 'transparent' ? 'transparent' : config.bgColor.replace('#', ''),
    })
    if (config.glasses !== 'none') {
      params.set('glasses', config.glasses)
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
      hair: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)],
      hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
      mouth: MOUTH_STYLES[Math.floor(Math.random() * MOUTH_STYLES.length)],
      eyes: EYE_STYLES[Math.floor(Math.random() * EYE_STYLES.length)],
    }))
  }

  async function save() {
    await updateProfile({
      avatar_seed: config.seed,
      avatar_config: config
    })
    onClose()
  }

  const avatarUrl = getAvatarUrl()

  return (
    <div className="avatar-builder-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="avatar-builder">
        <div className="modal-slide-handle" />
        
        {/* Preview */}
        <div className="avatar-builder-preview">
          <img src={avatarUrl} alt="Avatar preview" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn btn-secondary btn-sm" onClick={randomize}>
            <RiShuffleFill size={16} /> Randomize
          </button>
        </div>

        {/* Hair Style */}
        <div className="input-group">
          <label className="input-label">Hair Style</label>
          <div className="avatar-option-grid">
            {HAIR_STYLES.map((h, i) => (
              <button
                key={`${h}-${i}`}
                className={`avatar-option ${config.hair === h ? 'selected' : ''}`}
                onClick={() => setConfig(prev => ({ ...prev, hair: h, seed: Math.random().toString(36).substring(7) }))}
              >
                <img 
                  src={`https://api.dicebear.com/7.x/micah/svg?seed=${h}${i}&hair=${h}&backgroundColor=transparent`}
                  alt={h}
                  style={{ width: '100%', height: '100%' }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Hair Color */}
        <div className="input-group">
          <label className="input-label">Hair Color</label>
          <div className="avatar-option-grid">
            {HAIR_COLORS.map(c => (
              <button
                key={c}
                className={`avatar-color-option ${config.hairColor === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setConfig(prev => ({ ...prev, hairColor: c }))}
              />
            ))}
          </div>
        </div>

        {/* Mouth */}
        <div className="input-group">
          <label className="input-label">Expression</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MOUTH_STYLES.map(m => (
              <button
                key={m}
                className={`tag ${config.mouth === m ? 'selected' : ''}`}
                onClick={() => setConfig(prev => ({ ...prev, mouth: m }))}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Glasses */}
        <div className="input-group">
          <label className="input-label">Glasses</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {ACCESSORIES.map(a => (
              <button
                key={a}
                className={`tag ${config.glasses === a ? 'selected' : ''}`}
                onClick={() => setConfig(prev => ({ ...prev, glasses: a }))}
              >
                {a === 'none' ? 'None' : a}
              </button>
            ))}
          </div>
        </div>

        {/* Background */}
        <div className="input-group">
          <label className="input-label">Background</label>
          <div className="avatar-option-grid">
            {BG_COLORS.map(c => (
              <button
                key={c}
                className={`avatar-color-option ${config.bgColor === c ? 'selected' : ''}`}
                style={{ backgroundColor: c === 'transparent' ? '#070707' : c, border: c === 'transparent' ? '2px dashed var(--border)' : undefined }}
                onClick={() => setConfig(prev => ({ ...prev, bgColor: c }))}
              />
            ))}
          </div>
        </div>

        {/* Save */}
        <button className="btn btn-primary btn-full btn-lg" onClick={save} style={{ marginTop: 16 }}>
          <RiCheckFill size={18} /> Save Avatar
        </button>
      </div>
    </div>
  )
}

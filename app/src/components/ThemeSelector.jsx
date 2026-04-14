import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { RiCheckFill, RiLock2Line, RiPaletteFill, RiSparklingFill, RiVipCrownFill } from '@remixicon/react'

const THEMES = [
  { id: 'green', name: 'Neon Green', color: '#ccff00' },
  { id: 'pink', name: 'Hot Pink', color: '#ff2a85' },
  { id: 'blue', name: 'Deep Blue', color: '#00d4ff' },
  { id: 'gold', name: 'Royal Gold', color: '#ffb800' },
  { id: 'cherry-red', name: 'Cherry Red', color: '#ff003c' },
  { id: 'neon-purple', name: 'Neon Purple', color: '#b026ff' },
  { id: 'cyber-orange', name: 'Cyber Orange', color: '#ff5e00' },
]

const INTERFACE_STYLES = [
  {
    id: 'default',
    name: 'Default',
    description: 'Cleaner and more restrained, while still keeping the premium tier polish.',
    previewClass: 'default',
  },
  {
    id: 'ultra-signature',
    name: 'ULTRA Signature',
    description: 'Richer contrast, deeper glow, and the full REPMAX luxury performance skin.',
    previewClass: 'ultra-signature',
  },
  {
    id: 'v5',
    name: 'V5',
    description: 'Deeper blacks, glass-morphism cards, and a tighter visual system. The future of REPMAX.',
    previewClass: 'v5',
  },
]

export default function ThemeSelector() {
  const { profile, updateProfile, isPro, isUltra } = useAuth()
  const [savingTheme, setSavingTheme] = useState('')
  const [savingSkin, setSavingSkin] = useState('')

  const currentTheme = profile?.theme_color || 'green'
  const currentInterfaceSkin = (() => {
    const skin = profile?.interface_skin
    if (skin === 'v5' && isPro) return 'v5'
    if (skin === 'ultra-signature' && isUltra) return 'ultra-signature'
    return 'default'
  })()

  function syncAppearanceChange(work) {
    if (typeof document !== 'undefined') {
      document.body.classList.add('appearance-syncing')
    }

    const finish = () => {
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          document.body.classList.remove('appearance-syncing')
        }, 180)
      } else if (typeof document !== 'undefined') {
        document.body.classList.remove('appearance-syncing')
      }
    }

    return Promise.resolve(work()).finally(finish)
  }

  async function handleThemeChange(id) {
    if (!isPro || savingTheme === id) return

    setSavingTheme(id)
    try {
      await syncAppearanceChange(() => updateProfile({ theme_color: id }))
    } finally {
      setSavingTheme('')
    }
  }

  async function handleInterfaceSkinChange(id) {
    if (!isPro || savingSkin === id) return
    if (id === 'ultra-signature' && !isUltra) return

    setSavingSkin(id)
    try {
      await syncAppearanceChange(() => updateProfile({ interface_skin: id }))
    } finally {
      setSavingSkin('')
    }
  }

  return (
    <div className="card theme-selector" style={{ marginBottom: 16 }}>
      <div className="theme-selector-header">
        <div className="theme-selector-title-row">
          <RiPaletteFill size={18} style={{ color: 'var(--accent)' }} />
          <h3 className="theme-selector-title">Appearance</h3>
        </div>
        {!isPro && (
          <div className="theme-selector-lock">
            <RiVipCrownFill size={14} />
            PRO
          </div>
        )}
      </div>

      <p className="theme-selector-copy">
        Pick your accent color, then choose whether you want the cleaner premium shell or the full ULTRA Signature look.
      </p>

      <div className={`theme-selector-section ${!isPro ? 'locked' : ''}`}>
        <div className="theme-selector-section-head">
          <div>
            <div className="theme-selector-label">Theme Color</div>
            <div className="theme-selector-note">Premium accent colors applied across the entire app.</div>
          </div>
        </div>

        <div className="theme-swatch-grid">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleThemeChange(theme.id)}
              className={`theme-swatch ${currentTheme === theme.id ? 'is-active' : ''}`}
              disabled={!isPro}
              aria-label={`Switch to ${theme.name}`}
              title={theme.name}
              style={{ '--theme-swatch-color': theme.color }}
            >
              <span className="theme-swatch-core" />
              {currentTheme === theme.id && (
                <span className="theme-swatch-check">
                  <RiCheckFill size={18} color={theme.id === 'green' || theme.id === 'gold' ? '#000' : '#fff'} />
                </span>
              )}
              {savingTheme === theme.id && <span className="theme-swatch-saving" />}
            </button>
          ))}
        </div>
      </div>

      <div className={`theme-selector-section ${!isPro ? 'locked' : ''}`}>
        <div className="theme-selector-section-head">
          <div>
            <div className="theme-selector-label">Interface Style</div>
            <div className="theme-selector-note">
              {isPro
                ? 'Choose your interface look. V5 is available to PRO+, ULTRA Signature is ULTRA-only.'
                : 'Upgrade to PRO to unlock interface styles.'}
            </div>
          </div>
          {!isPro && (
            <div className="theme-selector-tag">
              <RiVipCrownFill size={14} />
              PRO
            </div>
          )}
        </div>

        <div className="theme-style-grid">
          {INTERFACE_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              className={`theme-style-card ${style.previewClass} ${currentInterfaceSkin === style.id ? 'is-active' : ''}`}
              onClick={() => handleInterfaceSkinChange(style.id)}
              disabled={!isPro || (style.id === 'ultra-signature' && !isUltra)}
            >
              <div className="theme-style-preview">
                <span className="theme-style-preview-top" />
                <span className="theme-style-preview-card" />
                <span className="theme-style-preview-pill" />
              </div>

              <div className="theme-style-copy-shell">
                <div className="theme-style-head">
                  <div className="theme-style-name">
                    {style.name}
                    {(style.id === 'ultra-signature' || style.id === 'v5') && <RiSparklingFill size={14} />}
                  </div>
                  <div className="theme-style-indicator">
                    {currentInterfaceSkin === style.id ? <RiCheckFill size={16} /> : !isUltra ? <RiLock2Line size={16} /> : null}
                  </div>
                </div>
                <div className="theme-style-copy">
                  <div className="theme-style-helper">
                    {style.id === 'default' ? 'Restrained premium shell' : style.id === 'v5' ? 'Next-gen glass interface' : 'High-contrast luxury shell'}
                  </div>
                  <div className="theme-style-description">{style.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {!isPro && <p className="theme-selector-footnote">Upgrade to PRO to unlock premium color themes.</p>}
    </div>
  )
}

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
]

export default function ThemeSelector() {
  const { profile, updateProfile, isPro, isUltra } = useAuth()
  const [savingTheme, setSavingTheme] = useState('')
  const [savingSkin, setSavingSkin] = useState('')

  const currentTheme = profile?.theme_color || 'green'
  const currentInterfaceSkin = isUltra && profile?.interface_skin === 'ultra-signature'
    ? 'ultra-signature'
    : 'default'

  async function handleThemeChange(id) {
    if (!isPro || savingTheme === id) return

    setSavingTheme(id)
    try {
      await updateProfile({ theme_color: id })
    } finally {
      setSavingTheme('')
    }
  }

  async function handleInterfaceSkinChange(id) {
    if (!isUltra || savingSkin === id) return

    setSavingSkin(id)
    try {
      await updateProfile({ interface_skin: id })
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

      <div className={`theme-selector-section ${!isUltra ? 'locked' : ''}`}>
        <div className="theme-selector-section-head">
          <div>
            <div className="theme-selector-label">Interface Style</div>
            <div className="theme-selector-note">
              {isUltra
                ? 'ULTRA members can switch between the default premium shell and the signature REPMAX look.'
                : 'Upgrade to ULTRA to unlock the signature REPMAX interface style.'}
            </div>
          </div>
          {!isUltra && (
            <div className="theme-selector-tag">
              <RiVipCrownFill size={14} />
              ULTRA
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
              disabled={!isUltra}
            >
              <div className="theme-style-preview">
                <span className="theme-style-preview-top" />
                <span className="theme-style-preview-card" />
                <span className="theme-style-preview-pill" />
              </div>

              <div className="theme-style-copy">
                <div className="theme-style-name">
                  {style.name}
                  {style.id === 'ultra-signature' && <RiSparklingFill size={14} />}
                </div>
                <div className="theme-style-description">{style.description}</div>
              </div>

              <div className="theme-style-indicator">
                {currentInterfaceSkin === style.id ? <RiCheckFill size={16} /> : !isUltra ? <RiLock2Line size={16} /> : null}
              </div>
            </button>
          ))}
        </div>
      </div>

      {!isPro && <p className="theme-selector-footnote">Upgrade to PRO to unlock premium color themes.</p>}
    </div>
  )
}

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { RiPaletteFill, RiVipCrownFill, RiCheckFill } from '@remixicon/react';

export default function ThemeSelector() {
  const { profile, updateProfile, isPro } = useAuth();

  const themes = [
    { id: 'green', name: 'Neon Green', color: '#ccff00' },
    { id: 'pink', name: 'Hot Pink', color: '#ff2a85' },
    { id: 'blue', name: 'Deep Blue', color: '#00d4ff' },
    { id: 'gold', name: 'Royal Gold', color: '#ffb800' }
  ];

  const currentTheme = profile?.theme_color || 'green';

  async function handleThemeChange(id) {
    if (!isPro) {
       // Only pros can change theme
       return;
    }
    await updateProfile({ theme_color: id });
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <RiPaletteFill size={18} style={{ color: 'var(--accent)' }} />
        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>App Theme</h3>
        {!isPro && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--warning)', fontSize: '0.75rem', fontWeight: 600 }}><RiVipCrownFill size={14}/> PRO</div>}
      </div>

      <div style={{ display: 'flex', gap: 12, opacity: isPro ? 1 : 0.5 }}>
        {themes.map(t => (
          <button
            key={t.id}
            onClick={() => handleThemeChange(t.id)}
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: t.color,
              border: 'none',
              cursor: isPro ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: currentTheme === t.id ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${t.color}` : 'none',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
          >
            {currentTheme === t.id && <RiCheckFill size={20} color={t.id === 'green' || t.id === 'gold' ? '#000' : '#fff'} />}
          </button>
        ))}
      </div>
      {!isPro && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 12 }}>
          Upgrade to PRO to unlock premium color themes.
        </p>
      )}
    </div>
  );
}

export const colors = {
  bg: {
    primary: '#070707',
    secondary: '#0d0d0d',
    card: '#111111',
    cardHover: '#161616',
    elevated: '#1a1a1a',
    input: '#141414',
  },
  accent: '#ccff00',
  accentDim: '#9ec400',
  accentGlow: 'rgba(204, 255, 0, 0.12)',
  accentGlowStrong: 'rgba(204, 255, 0, 0.25)',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  text: {
    primary: '#ffffff',
    secondary: '#a0a0a0',
    tertiary: '#606060',
    onAccent: '#070707',
  },
  border: 'rgba(255, 255, 255, 0.06)',
  borderHover: 'rgba(255, 255, 255, 0.12)',
  borderAccent: 'rgba(204, 255, 0, 0.2)',
}

export const themes = {
  green: {
    accent: '#ccff00',
    accentDim: '#9ec400',
    accentGlow: 'rgba(204, 255, 0, 0.12)',
    accentGlowStrong: 'rgba(204, 255, 0, 0.25)',
    borderAccent: 'rgba(204, 255, 0, 0.2)',
  },
  pink: {
    accent: '#ff2a85',
    accentDim: '#cc1b66',
    accentGlow: 'rgba(255, 42, 133, 0.12)',
    accentGlowStrong: 'rgba(255, 42, 133, 0.25)',
    borderAccent: 'rgba(255, 42, 133, 0.2)',
  },
  blue: {
    accent: '#00d4ff',
    accentDim: '#00a4cc',
    accentGlow: 'rgba(0, 212, 255, 0.12)',
    accentGlowStrong: 'rgba(0, 212, 255, 0.25)',
    borderAccent: 'rgba(0, 212, 255, 0.2)',
  },
  gold: {
    accent: '#ffb800',
    accentDim: '#cc9300',
    accentGlow: 'rgba(255, 184, 0, 0.12)',
    accentGlowStrong: 'rgba(255, 184, 0, 0.25)',
    borderAccent: 'rgba(255, 184, 0, 0.2)',
  },
  'cherry-red': {
    accent: '#ff003c',
    accentDim: '#cc0030',
    accentGlow: 'rgba(255, 0, 60, 0.12)',
    accentGlowStrong: 'rgba(255, 0, 60, 0.25)',
    borderAccent: 'rgba(255, 0, 60, 0.2)',
  },
  'neon-purple': {
    accent: '#b026ff',
    accentDim: '#8d1ecd',
    accentGlow: 'rgba(176, 38, 255, 0.12)',
    accentGlowStrong: 'rgba(176, 38, 255, 0.25)',
    borderAccent: 'rgba(176, 38, 255, 0.2)',
  },
  'cyber-orange': {
    accent: '#ff5e00',
    accentDim: '#cc4b00',
    accentGlow: 'rgba(255, 94, 0, 0.12)',
    accentGlowStrong: 'rgba(255, 94, 0, 0.25)',
    borderAccent: 'rgba(255, 94, 0, 0.2)',
  },
}

export function getThemeColors(themeName = 'green') {
  const theme = themes[themeName] || themes.green
  return { ...colors, ...theme }
}

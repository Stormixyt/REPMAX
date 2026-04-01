// Generates a shareable DNA card image using Canvas
// Returns a Blob that can be shared via Web Share API

export async function generateDNAImage(profile, stats, theme = 'green') {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')

  // Theme colors
  const themes = {
    green: { accent: '#ccff00', bg: '#070707', card: '#111111' },
    pink: { accent: '#ff2a85', bg: '#080010', card: '#140a1a' },
    blue: { accent: '#00b4ff', bg: '#000810', card: '#0a1520' },
    gold: { accent: '#ffd700', bg: '#0a0800', card: '#1a1408' }
  }
  const t = themes[theme] || themes.green

  // Background
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, 1080, 1350)

  // Gradient glow
  const glow = ctx.createRadialGradient(540, 400, 0, 540, 400, 500)
  glow.addColorStop(0, t.accent + '20')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 1080, 1350)

  // Card background
  roundRect(ctx, 60, 160, 960, 1000, 40)
  ctx.fillStyle = t.card
  ctx.fill()
  ctx.strokeStyle = t.accent + '30'
  ctx.lineWidth = 2
  ctx.stroke()

  // Avatar circle
  ctx.save()
  ctx.beginPath()
  ctx.arc(540, 380, 100, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = t.card
  ctx.fill()

  // Load avatar
  try {
    const seed = profile?.avatar_seed || 'default'
    const img = await loadImage(`https://api.dicebear.com/7.x/micah/svg?seed=${seed}&backgroundColor=transparent`)
    ctx.clip()
    ctx.drawImage(img, 440, 280, 200, 200)
  } catch {}
  ctx.restore()

  // Aura ring
  ctx.beginPath()
  ctx.arc(540, 380, 110, 0, Math.PI * 2)
  ctx.strokeStyle = t.accent
  ctx.lineWidth = 4
  ctx.shadowColor = t.accent
  ctx.shadowBlur = 30
  ctx.stroke()
  ctx.shadowBlur = 0

  // Name
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = '900 52px "Space Grotesk", sans-serif'
  ctx.fillText(profile?.display_name || 'Athlete', 540, 540)

  // PRO badge
  if (profile?.subscription_status === 'pro' || (profile?.pro_until && new Date(profile.pro_until) > new Date())) {
    const badgeWidth = 120
    const badgeX = 540 - badgeWidth / 2
    roundRect(ctx, badgeX, 560, badgeWidth, 36, 18)
    ctx.fillStyle = t.accent
    ctx.fill()
    ctx.fillStyle = t.bg
    ctx.font = '700 16px "Space Grotesk", sans-serif'
    ctx.fillText('⭐ PRO', 540, 584)
  }

  // Split type
  ctx.fillStyle = '#888888'
  ctx.font = '500 24px "Inter", sans-serif'
  const split = profile?.preferred_split?.replace('_', '/').toUpperCase() || 'TRAINING'
  ctx.fillText(split + ' SPLIT', 540, 640)

  // Stats boxes
  const statsData = [
    { value: String(stats?.total || 0), label: 'SESSIONS' },
    { value: String(stats?.streak || 0), label: 'STREAK' },
    { value: stats?.volume > 1000 ? `${(stats.volume / 1000).toFixed(1)}K` : String(stats?.volume || 0), label: 'VOLUME' }
  ]

  const boxWidth = 260
  const boxGap = 30
  const startX = (1080 - (boxWidth * 3 + boxGap * 2)) / 2

  statsData.forEach((s, i) => {
    const x = startX + i * (boxWidth + boxGap)
    roundRect(ctx, x, 690, boxWidth, 140, 20)
    ctx.fillStyle = '#ffffff08'
    ctx.fill()
    ctx.strokeStyle = t.accent + '25'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = t.accent
    ctx.font = '800 48px "Space Grotesk", sans-serif'
    ctx.fillText(s.value, x + boxWidth / 2, 755)

    ctx.fillStyle = '#666666'
    ctx.font = '600 14px "Inter", sans-serif'
    ctx.letterSpacing = '2px'
    ctx.fillText(s.label, x + boxWidth / 2, 800)
  })

  // Goal
  const goal = profile?.goal ? profile.goal.charAt(0).toUpperCase() + profile.goal.slice(1) : 'Training'
  ctx.fillStyle = '#444444'
  ctx.font = '500 22px "Inter", sans-serif'
  ctx.fillText(`Goal: ${goal}`, 540, 900)

  // Experience
  const exp = profile?.experience_level ? profile.experience_level.charAt(0).toUpperCase() + profile.experience_level.slice(1) : ''
  if (exp) {
    ctx.fillText(`Level: ${exp}`, 540, 940)
  }

  // Divider line
  ctx.strokeStyle = t.accent + '15'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(160, 990)
  ctx.lineTo(920, 990)
  ctx.stroke()

  // REPMAX BRANDING
  ctx.fillStyle = t.accent
  ctx.font = '800 42px "Space Grotesk", sans-serif'
  ctx.fillText('REPMAX', 540, 1060)

  ctx.fillStyle = '#555555'
  ctx.font = '500 18px "Inter", sans-serif'
  ctx.fillText('repmax.vercel.app', 540, 1095)

  ctx.fillStyle = '#333333'
  ctx.font = '400 16px "Inter", sans-serif'
  ctx.fillText('Train Smarter. Get Stronger.', 540, 1130)

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png')
  })
}

export async function shareDNACard(profile, stats, theme) {
  const blob = await generateDNAImage(profile, stats, theme)
  const file = new File([blob], 'my-repmax-dna.png', { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: `${profile?.display_name || 'Athlete'}'s REPMAX DNA`,
      text: 'Check out my training stats on REPMAX 💪',
      url: 'https://repmax.vercel.app',
      files: [file]
    })
    return true
  } else {
    // Fallback: download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-repmax-dna.png'
    a.click()
    URL.revokeObjectURL(url)
    return false
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

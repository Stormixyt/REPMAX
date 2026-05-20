import { useEffect, useState } from 'react'
import { RiArrowRightLine, RiCheckFill, RiDownloadFill, RiNotification3Fill } from '@remixicon/react'
import { getPushSupportState } from '../lib/pushNotifications'
import { isNative } from '../lib/native'

function getInstallGuide() {
  if (isNative) return null

  const support = getPushSupportState()
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isAndroid = /Android/i.test(userAgent)
  const installed = support.standalone === true

  if (installed) {
    return {
      installed: true,
      kicker: 'Installed',
      title: 'REPMAX is on your home screen',
      subtitle: 'Perfect. Open it from your home screen when you train so it feels closer to a real app.',
      steps: [
        'Launch REPMAX from the home screen icon instead of a browser tab.',
        'Turn notifications on in Settings for chats, invites, and reminders.'
      ],
      footer: 'You are set up for the best web app experience.'
    }
  }

  if (support.isiPhone) {
    return {
      installed: false,
      kicker: 'iPhone setup',
      title: 'Add REPMAX to your home screen',
      subtitle: 'That unlocks the cleanest full-screen experience and is the best path for phone notifications on iPhone.',
      steps: [
        'Open REPMAX in Safari.',
        'Tap Share in the browser bar.',
        'Tap Add to Home Screen, then launch REPMAX from the new icon.'
      ],
      footer: 'After that, open Settings inside REPMAX and turn notifications on.'
    }
  }

  if (isAndroid) {
    return {
      installed: false,
      kicker: 'Android setup',
      title: 'Install REPMAX from Chrome',
      subtitle: 'Installing it keeps REPMAX one tap away and makes the web app feel much closer to native.',
      steps: [
        'Open REPMAX in Chrome.',
        'Tap the browser menu.',
        'Choose Install app or Add to Home screen, then open it from there.'
      ],
      footer: 'Then enable notifications in Settings for reminders, chats, and invites.'
    }
  }

  return {
    installed: false,
    kicker: 'Best experience',
    title: 'Use REPMAX on your phone',
    subtitle: 'The web app works best on mobile when it lives on your home screen.',
    steps: [
      'Open REPMAX on your phone.',
      'Add it to your home screen from Safari or Chrome.',
      'Go through onboarding there so the app feels right from day one.'
    ],
    footer: 'Once installed, notifications and quick access are much smoother.'
  }
}

export default function InstallGuideCard({ compact = false, alwaysShow = false }) {
  const [guide, setGuide] = useState(() => getInstallGuide())

  useEffect(() => {
    const syncGuide = () => setGuide(getInstallGuide())
    syncGuide()
    window.addEventListener('resize', syncGuide)
    return () => window.removeEventListener('resize', syncGuide)
  }, [])

  if (!guide) return null
  if (!alwaysShow && guide.installed) return null

  return (
    <div
      className="card"
      style={{
        marginTop: compact ? 0 : 18,
        padding: compact ? 16 : 18,
        borderColor: 'rgba(204,255,0,0.14)',
        background: 'linear-gradient(180deg, rgba(204,255,0,0.06), rgba(255,255,255,0.02))'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div
          style={{
            width: compact ? 36 : 40,
            height: compact ? 36 : 40,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: guide.installed ? 'rgba(34,197,94,0.16)' : 'rgba(204,255,0,0.12)',
            color: guide.installed ? '#22c55e' : 'var(--accent)',
            flexShrink: 0
          }}
        >
          {guide.installed ? <RiCheckFill size={18} /> : <RiDownloadFill size={18} />}
        </div>
        <div>
          <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', fontWeight: 800 }}>
            {guide.kicker}
          </div>
          <div style={{ fontSize: compact ? '0.96rem' : '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {guide.title}
          </div>
        </div>
      </div>

      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: compact ? '0.8rem' : '0.84rem', lineHeight: 1.6 }}>
        {guide.subtitle}
      </p>

      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {guide.steps.map((step, index) => (
          <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--accent)',
                marginTop: 1
              }}
            >
              {guide.installed ? <RiCheckFill size={13} /> : index < 2 ? <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{index + 1}</span> : <RiArrowRightLine size={13} />}
            </div>
            <div style={{ color: 'var(--text-primary)', fontSize: compact ? '0.8rem' : '0.84rem', lineHeight: 1.55 }}>
              {step}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, color: 'var(--text-tertiary)', fontSize: compact ? '0.76rem' : '0.78rem', lineHeight: 1.5 }}>
        <RiNotification3Fill size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span>{guide.footer}</span>
      </div>
    </div>
  )
}

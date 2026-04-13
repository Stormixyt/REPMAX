const MOVE_META = {
  'neck-roll': {
    title: 'Neck Roll',
    caption: 'Ease the neck through a slow circular range.',
  },
  'shoulder-stretch': {
    title: 'Shoulder Stretch',
    caption: 'Cross the arm gently and let the shoulder open.',
  },
  'cat-cow': {
    title: 'Cat-Cow',
    caption: 'Flow between flexion and extension with your breath.',
  },
  'hip-flexor': {
    title: 'Hip Flexor Stretch',
    caption: 'Sink the hips forward after a small pelvic tuck.',
  },
  hamstring: {
    title: 'Hamstring Stretch',
    caption: 'Reach long first, then fold deeper through the exhale.',
  },
}

export default function RecoveryMoveDemo({ variant = 'neck-roll' }) {
  const move = MOVE_META[variant] || MOVE_META['neck-roll']

  return (
    <div className={`recovery-demo recovery-demo--${variant}`} aria-label={move.title}>
      <div className="recovery-demo-backdrop" />
      <svg viewBox="0 0 220 160" className="recovery-demo-svg" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="recoveryDemoGlow" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(204,255,0,0.95)" />
            <stop offset="100%" stopColor="rgba(176,38,255,0.92)" />
          </linearGradient>
        </defs>

        <ellipse className="recovery-demo-ground" cx="110" cy="140" rx="70" ry="10" />

        {variant === 'neck-roll' && (
          <g className="recovery-figure recovery-figure-neck">
            <path className="recovery-stroke" d="M110 54 L110 94" />
            <path className="recovery-stroke" d="M88 74 L132 74" />
            <path className="recovery-stroke" d="M110 94 L96 128" />
            <path className="recovery-stroke" d="M110 94 L124 128" />
            <circle className="recovery-head recovery-head-roll" cx="110" cy="38" r="15" />
          </g>
        )}

        {variant === 'shoulder-stretch' && (
          <g className="recovery-figure recovery-figure-shoulder">
            <circle className="recovery-head" cx="108" cy="36" r="14" />
            <path className="recovery-stroke" d="M108 50 L108 98" />
            <path className="recovery-stroke" d="M108 64 L144 58" />
            <path className="recovery-stroke recovery-arm-across" d="M108 66 L76 72" />
            <path className="recovery-stroke" d="M76 72 L66 58" />
            <path className="recovery-stroke" d="M108 98 L96 128" />
            <path className="recovery-stroke" d="M108 98 L122 128" />
          </g>
        )}

        {variant === 'cat-cow' && (
          <g className="recovery-figure recovery-figure-catcow">
            <circle className="recovery-head" cx="74" cy="72" r="11" />
            <path className="recovery-stroke recovery-back-curve" d="M86 74 C106 48 138 48 158 74" />
            <path className="recovery-stroke" d="M92 78 L88 118" />
            <path className="recovery-stroke" d="M152 78 L156 118" />
            <path className="recovery-stroke" d="M116 76 L114 118" />
            <path className="recovery-stroke" d="M136 76 L138 118" />
          </g>
        )}

        {variant === 'hip-flexor' && (
          <g className="recovery-figure recovery-figure-hip">
            <circle className="recovery-head" cx="122" cy="34" r="13" />
            <path className="recovery-stroke" d="M122 46 L118 84" />
            <path className="recovery-stroke" d="M118 84 L90 100" />
            <path className="recovery-stroke recovery-hip-drive" d="M118 84 L148 92" />
            <path className="recovery-stroke" d="M90 100 L78 128" />
            <path className="recovery-stroke" d="M148 92 L176 92" />
            <path className="recovery-stroke" d="M176 92 L192 124" />
            <path className="recovery-stroke" d="M120 60 L152 46" />
            <path className="recovery-stroke" d="M120 60 L96 54" />
          </g>
        )}

        {variant === 'hamstring' && (
          <g className="recovery-figure recovery-figure-hamstring">
            <circle className="recovery-head" cx="92" cy="58" r="11" />
            <path className="recovery-stroke recovery-hamstring-fold" d="M100 64 L128 84 L176 84" />
            <path className="recovery-stroke" d="M128 84 L126 126" />
            <path className="recovery-stroke" d="M126 126 L94 126" />
            <path className="recovery-stroke" d="M128 84 L78 112" />
            <path className="recovery-stroke" d="M128 84 L176 84" />
          </g>
        )}
      </svg>

      <div className="recovery-demo-caption">
        <div className="recovery-demo-title">{move.title}</div>
        <div className="recovery-demo-copy">{move.caption}</div>
      </div>
    </div>
  )
}

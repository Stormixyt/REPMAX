import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EXERCISE_CATEGORIES, EXERCISES } from '../data/homeExercises'
import { RiArrowLeftLine, RiSearchLine, RiFilterLine, RiArrowDownSLine } from '@remixicon/react'

const DIFFICULTY_COLORS = {
  beginner: { bg: 'rgba(74,222,128,0.15)', text: '#4ade80', label: 'Beginner' },
  intermediate: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', label: 'Intermediate' },
  advanced: { bg: 'rgba(248,113,113,0.15)', text: '#f87171', label: 'Advanced' }
}

export default function HomeExercises() {
  const navigate = useNavigate()
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  const filtered = EXERCISES.filter(ex => {
    if (category !== 'all' && ex.category !== category) return false
    if (difficulty !== 'all' && ex.difficulty !== difficulty) return false
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="page" style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="icon-btn" onClick={() => navigate(-1)}>
          <RiArrowLeftLine size={22} />
        </button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
            Home Exercises
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', margin: 0 }}>
            {filtered.length} exercises • No equipment needed
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '10px 14px', marginBottom: 16
      }}>
        <RiSearchLine size={18} color="var(--text-tertiary)" />
        <input
          type="text"
          placeholder="Search exercises..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: '0.9rem', flex: 1
          }}
        />
      </div>

      {/* Category pills */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto',
        paddingBottom: 4, marginBottom: 12,
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none'
      }}>
        <button
          onClick={() => setCategory('all')}
          style={{
            padding: '8px 16px', borderRadius: 20, border: 'none',
            background: category === 'all' ? 'var(--accent)' : 'var(--bg-card)',
            color: category === 'all' ? 'var(--text-on-accent)' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.2s'
          }}
        >
          All
        </button>
        {EXERCISE_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            style={{
              padding: '8px 16px', borderRadius: 20, border: 'none',
              background: category === cat.id ? 'var(--accent)' : 'var(--bg-card)',
              color: category === cat.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.2s'
            }}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Difficulty filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'beginner', 'intermediate', 'advanced'].map(d => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            style={{
              padding: '6px 12px', borderRadius: 12, border: 'none',
              background: difficulty === d
                ? (d === 'all' ? 'var(--bg-elevated)' : DIFFICULTY_COLORS[d]?.bg)
                : 'transparent',
              color: difficulty === d
                ? (d === 'all' ? 'var(--text-primary)' : DIFFICULTY_COLORS[d]?.text)
                : 'var(--text-tertiary)',
              fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {d === 'all' ? 'All Levels' : DIFFICULTY_COLORS[d]?.label}
          </button>
        ))}
      </div>

      {/* Exercise Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(ex => {
          const isExpanded = expandedId === ex.id
          const dc = DIFFICULTY_COLORS[ex.difficulty]
          return (
            <div
              key={ex.id}
              onClick={() => setExpandedId(isExpanded ? null : ex.id)}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 16, padding: 16, cursor: 'pointer',
                transition: 'all 0.25s ease',
                transform: isExpanded ? 'scale(1.01)' : 'scale(1)',
                boxShadow: isExpanded ? '0 8px 32px rgba(0,0,0,0.3)' : 'none'
              }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <h3 style={{
                      margin: 0, fontSize: '1rem', fontWeight: 700,
                      fontFamily: 'var(--font-display)', color: 'var(--text-primary)'
                    }}>
                      {ex.name}
                    </h3>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px',
                      borderRadius: 6, background: dc.bg, color: dc.text
                    }}>
                      {dc.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {ex.muscles.map(m => (
                      <span key={m} style={{
                        fontSize: '0.72rem', color: 'var(--text-tertiary)',
                        background: 'var(--bg-elevated)', padding: '2px 8px',
                        borderRadius: 6
                      }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)',
                    marginBottom: 4
                  }}>
                    {ex.reps}
                  </div>
                  <RiArrowDownSLine
                    size={18}
                    style={{
                      color: 'var(--text-tertiary)',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.25s ease'
                    }}
                  />
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{
                  marginTop: 14, paddingTop: 14,
                  borderTop: '1px solid var(--border)',
                  animation: 'fadeIn 0.2s ease'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    How to perform:
                  </div>
                  <ol style={{
                    margin: 0, paddingLeft: 20,
                    display: 'flex', flexDirection: 'column', gap: 6
                  }}>
                    {ex.steps.map((step, i) => (
                      <li key={i} style={{
                        fontSize: '0.83rem', color: 'var(--text-secondary)',
                        lineHeight: 1.5
                      }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                  {ex.equipment !== 'none' && (
                    <div style={{
                      marginTop: 10, fontSize: '0.78rem',
                      color: 'var(--text-tertiary)', fontStyle: 'italic'
                    }}>
                      Equipment: {ex.equipment === 'minimal' ? 'Chair, table, or step' : ex.equipment}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔍</p>
          <p>No exercises found. Try different filters.</p>
        </div>
      )}
    </div>
  )
}

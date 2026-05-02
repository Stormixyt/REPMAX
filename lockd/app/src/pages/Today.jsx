import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Camera, Check, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { Capacitor } from '@capacitor/core'

export default function Today() {
  const { user, profile, fetchProfile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [proofs, setProofs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [newEmoji, setNewEmoji] = useState('🔥')
  const fileRef = useRef(null)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => { loadData() }, [user])

  async function loadData() {
    if (!user) return
    setLoading(true)

    const [{ data: taskData }, { data: proofData }] = await Promise.all([
      supabase.from('lockd_tasks').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('lockd_proofs').select('*').eq('user_id', user.id).eq('proof_date', today),
    ])

    setTasks(taskData || [])
    setProofs(proofData || [])
    setLoading(false)
  }

  function isProved(taskId) {
    return proofs.some(p => p.task_id === taskId)
  }

  async function handleProof(taskId) {
    if (isProved(taskId)) return

    if (Capacitor.isNativePlatform()) {
      try {
        const { Camera: Cap } = await import('@capacitor/camera')
        const photo = await Cap.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: 'base64',
          source: 'CAMERA',
        })
        await uploadProof(taskId, photo.base64String, photo.format)
      } catch {
        /* user cancelled */
      }
    } else {
      setUploading(taskId)
      fileRef.current?.click()
    }
  }

  async function onFileSelected(e) {
    const file = e.target.files?.[0]
    if (!file || !uploading) return

    const taskId = uploading
    setUploading(null)
    e.target.value = ''

    const ext = file.name.split('.').pop()
    const path = `${user.id}/${taskId}_${today}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('lockd-proofs')
      .upload(path, file, { upsert: true })

    if (uploadErr) { console.error(uploadErr); return }

    const { data: urlData } = supabase.storage
      .from('lockd-proofs')
      .getPublicUrl(path)

    const { error: proofErr } = await supabase.from('lockd_proofs').insert({
      user_id: user.id,
      task_id: taskId,
      proof_date: today,
      photo_url: urlData.publicUrl,
    })

    if (proofErr) { console.error(proofErr); return }

    await supabase.rpc('lockd_update_streak', { p_user_id: user.id })
    await loadData()
    await fetchProfile(user.id)
  }

  async function uploadProof(taskId, base64, format) {
    const path = `${user.id}/${taskId}_${today}.${format || 'jpg'}`
    const blob = await fetch(`data:image/${format || 'jpeg'};base64,${base64}`).then(r => r.blob())

    await supabase.storage.from('lockd-proofs').upload(path, blob, { upsert: true })
    const { data: urlData } = supabase.storage.from('lockd-proofs').getPublicUrl(path)

    await supabase.from('lockd_proofs').insert({
      user_id: user.id,
      task_id: taskId,
      proof_date: today,
      photo_url: urlData.publicUrl,
    })

    await supabase.rpc('lockd_update_streak', { p_user_id: user.id })
    await loadData()
    await fetchProfile(user.id)
  }

  async function addTask() {
    if (!newTask.trim()) return
    await supabase.from('lockd_tasks').insert({
      user_id: user.id,
      title: newTask.trim(),
      emoji: newEmoji,
      sort_order: tasks.length,
    })
    setNewTask('')
    setNewEmoji('🔥')
    setShowAdd(false)
    await loadData()
  }

  async function removeTask(taskId) {
    await supabase.from('lockd_tasks').update({ is_active: false }).eq('id', taskId)
    await loadData()
  }

  const completed = tasks.filter(t => isProved(t.id)).length
  const total = tasks.length
  const allDone = total > 0 && completed === total
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0
  const remaining = Math.max(total - completed, 0)

  if (loading) return <div className="loading-spinner" />

  return (
    <div className="page">
      <input type="file" accept="image/*" capture="environment" ref={fileRef} onChange={onFileSelected} style={{ display: 'none' }} />

      <section className="hero-surface stagger-item">
        <div className="dashboard-hero__top">
          <div>
            <p className="page-kicker">{format(new Date(), 'EEEE, MMM d')}</p>
            <h1 className="page-title">
              {allDone ? 'Locked In.' : 'Today'}
            </h1>
            <p className="page-subtitle">
              {allDone
                ? 'Everything is proved. You did what you said you would do.'
                : total > 0
                  ? `${completed} of ${total} tasks proved so far. ${remaining} left to close out.`
                  : 'Set your first non-negotiable and start building proof today.'}
            </p>
          </div>

          <div className="score-orb" style={{ '--fill': `${progress}%` }}>
            <div className="score-orb__inner">
              <span className="score-orb__value">{progress}%</span>
              <span className="score-orb__label">Done</span>
            </div>
          </div>
        </div>

        <div className="glass-row" style={{ marginBottom: 16 }}>
          <div className="streak-badge">🔥 {profile?.current_streak || 0} day streak</div>
          <div className={`mini-pill${allDone ? ' status-pill status-pill--success' : ''}`}>
            {allDone ? 'All proof posted' : `${remaining} task${remaining === 1 ? '' : 's'} left`}
          </div>
          <div className="mini-pill">📸 {proofs.length} proof{proofs.length === 1 ? '' : 's'}</div>
        </div>

        <div className="progress-track" aria-hidden="true">
          <div
            className="progress-fill"
            style={{
              width: `${progress}%`,
              background: allDone
                ? 'linear-gradient(90deg, var(--success), #b7ffd4)'
                : undefined,
              boxShadow: allDone ? '0 0 20px rgba(74, 210, 149, 0.28)' : undefined,
            }}
          />
        </div>
      </section>

      {tasks.map(task => {
        const proved = isProved(task.id)
        const proof = proofs.find(p => p.task_id === task.id)
        return (
          <div
            key={task.id}
            className={`card task-card stagger-item${proved ? ' task-card--done' : ''}`}
            style={{ animationDelay: `${80 + tasks.indexOf(task) * 70}ms` }}
          >
            <div className="task-card__media">
              {proof?.photo_url ? (
                <img src={proof.photo_url} alt="" className="proof-thumb" />
              ) : (
                <span style={{ fontSize: '1.65rem', lineHeight: 1 }}>{task.emoji}</span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p className={`task-card__title${proved ? ' task-card__title--done' : ''}`}>
                {task.title}
              </p>

              <p className="task-card__meta">
                {proved
                  ? `Proof posted at ${proof?.created_at ? format(new Date(proof.created_at), 'h:mm a') : ''}`
                  : 'Waiting on photo proof'}
              </p>
            </div>

            {!proved ? (
              <button
                onClick={() => handleProof(task.id)}
                className="task-card__action task-card__action--pending"
                aria-label={`Upload proof for ${task.title}`}
              >
                <Camera size={20} />
              </button>
            ) : (
              <div className="task-card__action task-card__action--done" aria-hidden="true">
                <Check size={20} />
              </div>
            )}
          </div>
        )
      })}

      {tasks.length === 0 && (
        <div className="empty-state">
          <div className="emoji">🎯</div>
          <h3>No non-negotiables yet</h3>
          <p>add your first daily task below</p>
        </div>
      )}

      {showAdd ? (
        <div className="card stagger-item" style={{ marginTop: 10 }}>
          <div className="section-title-row">
            <div>
              <p className="divider-label">New non-negotiable</p>
              <p className="page-subtitle" style={{ fontSize: '0.84rem' }}>
                Add something you need to prove every day.
              </p>
            </div>
          </div>

          <div className="composer-row" style={{ marginBottom: 12 }}>
            <button
              className="emoji-pick"
              onClick={() => {
                const emojis = ['🔥','💪','🧠','📖','🏃','🥗','💧','🧘','📝','⚡','🎯','🚀']
                const idx = emojis.indexOf(newEmoji)
                setNewEmoji(emojis[(idx + 1) % emojis.length])
              }}
            >
              {newEmoji}
            </button>
            <input
              className="input"
              placeholder="task name..."
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              autoFocus
              maxLength={40}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-small" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary btn-small" onClick={addTask} disabled={!newTask.trim()}>Add Task</button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-outline"
          style={{ marginTop: 10, justifyContent: 'center' }}
          onClick={() => setShowAdd(true)}
        >
          <Plus size={18} /> Add Non-Negotiable
        </button>
      )}
    </div>
  )
}

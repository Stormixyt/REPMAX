import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { supabase } from '../lib/supabase'
import { triggerPushNotification } from '../lib/notifications'
import ProBadge from '../components/ProBadge'
import { RiArrowLeftLine, RiUser3Fill, RiLockPasswordFill, RiScales3Fill, RiNotification3Fill, RiEyeOffFill, RiVipCrownFill, RiDownloadFill, RiDeleteBin6Fill, RiInformationFill, RiLogoutBoxRFill, RiPaletteFill, RiRefreshLine, RiCheckFill, RiArrowRightSLine, RiImageFill, RiTranslate2 } from '@remixicon/react'
import { getPushDeviceStatus, getPushSupportState, requestNotificationPermission, showLocalNotification, subscribeToPush } from '../lib/pushNotifications'

export default function Settings() {
  const { user, profile, signOut, updateProfile, isPro, isUltra, isAdmin, subscriptionTier } = useAuth()
  const { language, setLanguage, t, languageOptions } = useLanguage()
  const navigate = useNavigate()
  const [editName, setEditName] = useState(false)
  const [nameValue, setNameValue] = useState(profile?.display_name || '')
  const [showDelete, setShowDelete] = useState(false)
  const [toast, setToast] = useState('')
  const [pushDeviceStatus, setPushDeviceStatus] = useState({ loading: true })
  const [pushSyncing, setPushSyncing] = useState(false)

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const pushSupport = getPushSupportState()
  const currentLanguage = languageOptions.find((option) => option.value === language) || languageOptions[0]

  useEffect(() => {
    refreshPushDeviceStatus()
  }, [user?.id])

  async function refreshPushDeviceStatus() {
    const status = await getPushDeviceStatus()
    setPushDeviceStatus({ loading: false, ...status })
  }

  function getPushStatusCopy(status) {
    if (status.loading) return 'Checking whether this phone is actually linked for remote push.'
    if (!status.supported) return 'This browser does not support REPMAX push notifications.'
    if (status.requiresInstalledApp) return 'Install REPMAX to your iPhone home screen first, then turn notifications on there.'
    if (status.permission === 'denied') return 'Notifications are blocked for this browser right now.'
    if (status.permission !== 'granted') return 'Notifications are available, but this browser has not granted permission yet.'
    if (!status.hasRegistration) return 'Permission is on, but the REPMAX service worker has not linked this browser yet.'
    if (!status.subscribed) return 'This phone has permission, but it is not subscribed for remote push yet.'
    if (!status.lastSyncedAt) return 'This phone is subscribed locally. Server sync has not finished yet.'
    if (status.error) return 'This phone is close, but the last push status check hit a sync error.'
    return 'This phone is subscribed and synced with REPMAX remote push.'
  }

  function formatPushPermission(permission) {
    if (permission === 'granted') return 'Allowed'
    if (permission === 'denied') return 'Blocked'
    if (permission === 'default') return 'Ask first'
    return 'Unavailable'
  }

  function formatSyncLabel(value) {
    if (!value) return 'No server sync yet'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'No server sync yet'
    return `Last synced ${date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
  }

  async function saveName() {
    await updateProfile({ display_name: nameValue })
    setEditName(false)
    showToast('Name updated!')
  }

  async function toggleUnit() {
    const currentUnit = profile?.unit_preference || profile?.units || 'kg'
    const newUnit = currentUnit === 'kg' ? 'lbs' : 'kg'
    await updateProfile({ units: newUnit, unit_preference: newUnit })
    showToast(`Units changed to ${newUnit}`)
  }

  async function toggleNotif(field) {
    const newValue = !profile?.[field]
    await updateProfile({ [field]: newValue })
    if (newValue) {
      const granted = await requestNotificationPermission()
      if (granted) {
        await subscribeToPush(user.id)
        await refreshPushDeviceStatus()
      }
    }
  }

  async function togglePrivacy() {
    const cycle = { public: 'friends', friends: 'private', private: 'public' }
    const next = cycle[profile?.privacy || 'friends']
    await updateProfile({ privacy: next })
    showToast(`Privacy: ${next}`)
  }

  async function cycleLanguage() {
    const currentIndex = languageOptions.findIndex((option) => option.value === language)
    const nextOption = languageOptions[(currentIndex + 1) % languageOptions.length]
    const normalized = setLanguage(nextOption.value)
    const { error } = await updateProfile({ language: normalized })
    showToast(error ? t('settings_language_local_only') : t('settings_language_saved', { language: nextOption.nativeLabel }))
  }

  async function sendTestNotification() {
    const granted = await requestNotificationPermission()
    if (!granted) {
      await refreshPushDeviceStatus()
      showToast('Notification permission is off')
      return
    }

    const subscription = await subscribeToPush(user.id)
    if (!subscription) {
      await refreshPushDeviceStatus()
      showToast('This device could not finish push setup')
      return
    }

    const pushResult = await triggerPushNotification({
      userId: user.id,
      type: 'session_reminder',
      title: 'REPMAX Test',
      body: 'This phone is locked in for chats, calls, and invites.',
      data: { url: '/app' },
      tag: `test-${Date.now()}`,
      ignorePreferences: true
    })

    if (pushResult.sent > 0) {
      await refreshPushDeviceStatus()
      showToast(t('settings_push_sent'))
      return
    }

    showLocalNotification('REPMAX Test', 'Notifications are enabled on this phone.', {
      tag: `local-test-${Date.now()}`,
      data: { url: '/app' }
    })

    if (pushResult.matched === 0) {
      await refreshPushDeviceStatus()
      showToast('Phone notifications are enabled. Remote push is still syncing to this device.')
      return
    }

    await refreshPushDeviceStatus()
    showToast(pushResult.error ? 'Local test worked. Remote push still needs attention.' : 'Local test worked. Remote push may take a moment.')
  }

  async function resyncPushDevice() {
    setPushSyncing(true)
    try {
      const granted = await requestNotificationPermission()
      if (!granted) {
        showToast('Notification permission is off')
        return
      }

      const subscription = await subscribeToPush(user.id)
      showToast(subscription ? 'This phone is linked for remote push' : 'Could not sync this device yet')
    } finally {
      await refreshPushDeviceStatus()
      setPushSyncing(false)
    }
  }

  async function exportData() {
    const { data: workouts } = await supabase.from('workouts').select('*').eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false })
    if (!workouts?.length) { showToast('No workout data to export'); return }
    const csv = 'Date,Workout,Duration (min),Volume (lbs)\n' + workouts.map(w => `${w.completed_at?.split('T')[0]},${w.day_name},${Math.round((w.duration_seconds || 0) / 60)},${w.total_volume || 0}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'repmax_workouts.csv'; a.click()
    showToast('Data exported!')
  }

  async function deleteAccount() {
    await supabase.from('profiles').delete().eq('id', user.id)
    await signOut()
  }

  const initials = (profile?.display_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <RiArrowLeftLine size={20} /> Back
      </button>

      <div className="page-header">
        <h1 className="page-title">{t('settings_title')}</h1>
      </div>

      {/* Profile Section */}
      <div className="profile-header" style={{ marginBottom: 24 }}>
        <div className="profile-avatar">{initials}</div>
        <div>
          <div className="profile-name">
            {profile?.display_name || 'Athlete'}
            {isPro && <ProBadge size="md" tier={subscriptionTier} />}
          </div>
          <div className="profile-email">{user?.email}</div>
        </div>
      </div>

      {/* Account */}
      <div className="settings-section-title">Account</div>

      <div className="settings-item" onClick={() => setEditName(true)}>
        <div className="settings-item-left">
          <div className="settings-icon"><RiUser3Fill size={18} /></div>
          <div>
            <div className="settings-label">Display Name</div>
            <div className="settings-value">{profile?.display_name || 'Not set'}</div>
          </div>
        </div>
        <RiArrowRightSLine size={20} className="settings-chevron" />
      </div>

      <div className="settings-item" onClick={() => showToast('Password reset email sent! (mock)')}>
        <div className="settings-item-left">
          <div className="settings-icon"><RiLockPasswordFill size={18} /></div>
          <div>
            <div className="settings-label">Change Password</div>
            <div className="settings-value">Via email reset</div>
          </div>
        </div>
        <RiArrowRightSLine size={20} className="settings-chevron" />
      </div>

      {/* App Settings */}
      <div className="settings-section-title">App Settings</div>

      <div className="settings-item" onClick={cycleLanguage}>
        <div className="settings-item-left">
          <div className="settings-icon"><RiTranslate2 size={18} /></div>
          <div>
            <div className="settings-label">{t('settings_language')}</div>
            <div className="settings-value">{currentLanguage.nativeLabel}</div>
          </div>
        </div>
        <div className="settings-toggle" style={{ border: 'none', background: 'transparent' }}>
          <RiArrowRightSLine size={20} className="settings-chevron" />
        </div>
      </div>

      {/* Training */}
      <div className="settings-section-title">Training</div>

      <div className="settings-item" onClick={toggleUnit}>
        <div className="settings-item-left">
          <div className="settings-icon"><RiScales3Fill size={18} /></div>
          <div>
            <div className="settings-label">Weight Units</div>
            <div className="settings-value">{(profile?.unit_preference || profile?.units) === 'kg' ? 'Kilograms (kg)' : 'Pounds (lbs)'}</div>
          </div>
        </div>
        <div className="settings-toggle">{profile?.unit_preference || profile?.units || 'lbs'}</div>
      </div>

      <div className="settings-item" onClick={() => navigate('/profile')}>
        <div className="settings-item-left">
          <div className="settings-icon"><RiRefreshLine size={18} /></div>
          <div>
            <div className="settings-label">Training Preferences</div>
            <div className="settings-value">Goal, split, equipment</div>
          </div>
        </div>
        <RiArrowRightSLine size={20} className="settings-chevron" />
      </div>

      <div className="settings-item" onClick={() => {
        if (!isPro) {
          navigate('/subscribe')
        } else {
          navigate('/setup?vision=true')
        }
      }}>
        <div className="settings-item-left">
          <div className="settings-icon"><RiImageFill size={18} /></div>
          <div>
            <div className="settings-label" style={{ color: isPro ? 'var(--text-primary)' : 'var(--accent)' }}>Upload Custom Routine</div>
            <div className="settings-value">{isPro ? 'Build program from pictures' : 'PRO Feature'}</div>
          </div>
        </div>
        <RiArrowRightSLine size={20} className="settings-chevron" />
      </div>

      {/* Notifications */}
      <div className="settings-section-title">Notifications</div>

      {[
        { key: 'notify_reminders', label: 'Training Reminders', desc: 'Daily workout reminders' },
        { key: 'notify_nudges', label: 'Friend Nudges', desc: 'When friends nudge you to train' },
        { key: 'notify_invites', label: 'Training Invites', desc: 'When friends invite you to train' },
      ].map(n => (
        <div key={n.key} className="settings-item" onClick={() => toggleNotif(n.key)}>
          <div className="settings-item-left">
            <div className="settings-icon"><RiNotification3Fill size={18} /></div>
            <div>
              <div className="settings-label">{n.label}</div>
              <div className="settings-value">{n.desc}</div>
            </div>
          </div>
          <div className={`settings-switch ${profile?.[n.key] !== false ? 'on' : ''}`}>
            <div className="settings-switch-thumb" />
          </div>
        </div>
      ))}

      <div className="settings-item" onClick={sendTestNotification}>
        <div className="settings-item-left">
          <div className="settings-icon"><RiInformationFill size={18} /></div>
          <div>
            <div className="settings-label">{t('settings_push_test')}</div>
            <div className="settings-value">{t('settings_push_test_desc')}</div>
          </div>
        </div>
        <RiArrowRightSLine size={20} className="settings-chevron" />
      </div>

      <div className="push-status-card">
        <div className="push-status-header">
          <div>
            <div className="push-status-kicker">This phone</div>
            <div className="push-status-title">Push sync status</div>
          </div>
          <button type="button" className="push-status-action" onClick={resyncPushDevice} disabled={pushSyncing}>
            {pushSyncing ? 'Syncing...' : 'Resync device'}
          </button>
        </div>

        <p className="push-status-copy">{getPushStatusCopy(pushDeviceStatus)}</p>

        <div className="push-status-pill-row">
          <span className={`push-status-pill ${pushDeviceStatus.permission === 'granted' ? 'live' : ''}`}>
            Permission: {formatPushPermission(pushDeviceStatus.permission)}
          </span>
          <span className={`push-status-pill ${pushDeviceStatus.hasRegistration ? 'live' : ''}`}>
            Service worker: {pushDeviceStatus.hasRegistration ? 'Ready' : 'Not linked'}
          </span>
          <span className={`push-status-pill ${pushDeviceStatus.subscribed ? 'live' : ''}`}>
            Device: {pushDeviceStatus.subscribed ? 'Subscribed' : 'Not subscribed'}
          </span>
        </div>

        <div className="push-status-meta">
          <span>{formatSyncLabel(pushDeviceStatus.lastSyncedAt)}</span>
          {pushDeviceStatus.endpointPreview && <span>Device tail ...{pushDeviceStatus.endpointPreview}</span>}
        </div>
      </div>

      {pushSupport.requiresInstalledApp && (
        <div className="card" style={{ marginTop: 12, marginBottom: 4, padding: 16, background: 'rgba(204,255,0,0.05)', borderColor: 'rgba(204,255,0,0.16)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>iPhone note</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.6 }}>
            Install REPMAX to your home screen first if you want phone notifications on iPhone.
          </div>
        </div>
      )}

      {/* Privacy */}
      <div className="settings-section-title">Privacy</div>

      <div className="settings-item" onClick={togglePrivacy}>
        <div className="settings-item-left">
          <div className="settings-icon"><RiEyeOffFill size={18} /></div>
          <div>
            <div className="settings-label">Profile Visibility</div>
            <div className="settings-value">{({ public: 'Everyone', friends: 'Friends Only', private: 'Private' })[profile?.privacy || 'friends']}</div>
          </div>
        </div>
        <RiArrowRightSLine size={20} className="settings-chevron" />
      </div>

      {/* Subscription */}
      <div className="settings-section-title">Subscription</div>

      <div className="settings-item" onClick={() => navigate('/subscribe')}>
        <div className="settings-item-left">
          <div className="settings-icon settings-icon-accent"><RiVipCrownFill size={18} /></div>
          <div>
            <div className="settings-label">
              {isUltra ? 'Manage ULTRA' : isPro ? 'Manage PRO' : 'Upgrade Your Plan'}
            </div>
            <div className="settings-value">
              {isUltra ? 'ULTRA active · €5/week' : isPro ? 'PRO active · €3/week' : 'Free, PRO, and ULTRA tiers'}
            </div>
          </div>
        </div>
        <RiArrowRightSLine size={20} className="settings-chevron" />
      </div>

      {/* Data */}
      <div className="settings-section-title">Data</div>

      <div className="settings-item" onClick={exportData}>
        <div className="settings-item-left">
          <div className="settings-icon"><RiDownloadFill size={18} /></div>
          <div>
            <div className="settings-label">Export Workout Data</div>
            <div className="settings-value">Download as CSV</div>
          </div>
        </div>
        <RiArrowRightSLine size={20} className="settings-chevron" />
      </div>

      {/* Danger Zone */}
      <div className="settings-section-title" style={{ color: 'var(--danger)' }}>Danger Zone</div>

      <div className="settings-item settings-item-danger" onClick={() => setShowDelete(true)}>
        <div className="settings-item-left">
          <div className="settings-icon settings-icon-danger"><RiDeleteBin6Fill size={18} /></div>
          <div>
            <div className="settings-label" style={{ color: 'var(--danger)' }}>Delete Account</div>
            <div className="settings-value">Permanently delete all your data</div>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div style={{ textAlign: 'center', padding: '24px 0 40px' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>REPMAX v2.0 · Made with grit</div>
      </div>

      {/* Admin Panel — only visible to admin */}
      {isAdmin && (
        <button className="btn btn-full" onClick={() => navigate('/admin')} style={{ marginBottom: 12, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#8b5cf6', fontWeight: 700 }}>
          <RiInformationFill size={18} /> Admin Panel
        </button>
      )}

      {/* Sign Out */}
      <button className="btn btn-secondary btn-full" onClick={signOut} style={{ marginBottom: 24 }}>
        <RiLogoutBoxRFill size={18} /> Sign Out
      </button>

      {/* Edit Name Modal */}
      {editName && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditName(false) }}>
          <div className="modal">
            <h2 className="modal-title">Edit Name</h2>
            <div className="input-group">
              <input className="input" value={nameValue} onChange={e => setNameValue(e.target.value)} autoFocus />
            </div>
            <button className="btn btn-primary btn-full" onClick={saveName}>
              <RiCheckFill size={18} /> Save
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDelete && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowDelete(false) }}>
          <div className="modal">
            <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Delete Account?</h2>
            <p className="modal-subtitle">This action is permanent. All your workouts, programs, and data will be deleted forever.</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowDelete(false)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={deleteAccount}>Delete Forever</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

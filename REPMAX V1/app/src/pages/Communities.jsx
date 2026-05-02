import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiBuilding2Line,
  RiFireFill,
  RiFlashlightFill,
  RiGlobalLine,
  RiMapPin2Line,
  RiSparklingFill,
  RiSwordLine,
  RiTeamFill,
  RiTrophyFill,
  RiVipCrownFill,
} from '@remixicon/react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PaywallGate from '../components/PaywallGate'
import ProBadge from '../components/ProBadge'
import './communities.css'

const TABS = [
  { id: 'crews', label: 'Crews', icon: RiTeamFill },
  { id: 'prwall', label: 'PR Wall', icon: RiTrophyFill },
  { id: 'challenges', label: 'Challenges', icon: RiSwordLine },
  { id: 'streaks', label: 'Elite Streaks', icon: RiFireFill },
  { id: 'flex', label: 'Flex Feed', icon: RiSparklingFill },
]

function tierRank(t) {
  if (t === 'ultra') return 2
  if (t === 'pro') return 1
  return 0
}

function formatRelative(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function splitFromProfile(p) {
  return String(p?.preferred_split || '').toLowerCase().trim()
}

function avatarFor(p) {
  if (p?.image_url) return p.image_url
  return null
}

function initialsOf(name) {
  if (!name) return '?'
  return String(name)
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Communities() {
  const navigate = useNavigate()
  const { user, profile, isUltra } = useAuth()
  const [tab, setTab] = useState('crews')
  const [friends, setFriends] = useState([])
  const [prs, setPrs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    try {
      const [friendsRes, myPRs] = await Promise.all([
        supabase
          .from('friendships')
          .select(`
            user_id, friend_id, status,
            friend:friend_id(id, display_name, username, image_url, avatar_seed, subscription_tier, current_streak, total_workouts, preferred_split, goal),
            requester:user_id(id, display_name, username, image_url, avatar_seed, subscription_tier, current_streak, total_workouts, preferred_split, goal)
          `)
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
          .eq('status', 'accepted'),
        supabase
          .from('personal_records')
          .select('id, exercise_name, weight, reps, estimated_1rm, achieved_at')
          .order('achieved_at', { ascending: false })
          .limit(20),
      ])

      const mapped = (friendsRes.data || [])
        .map((row) => (row.user_id === user.id ? row.friend : row.requester))
        .filter(Boolean)

      setFriends(mapped)
      setPrs(myPRs.data || [])
    } catch (err) {
      console.error('Communities load error', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const crews = useMemo(() => {
    const allMembers = [
      ...(profile ? [{ ...profile, isSelf: true }] : []),
      ...friends,
    ]

    const myGym = profile?.home_gym || profile?.gym_name
    const mySplit = splitFromProfile(profile)

    const gymCrew = myGym
      ? allMembers.filter((m) => m.isSelf || (m?.home_gym || m?.gym_name) === myGym)
      : []

    const splitCrew = mySplit
      ? allMembers.filter((m) => splitFromProfile(m) === mySplit)
      : []

    const cityCrew = allMembers

    const streakLeader = [...allMembers].sort(
      (a, b) => (b?.current_streak || 0) - (a?.current_streak || 0),
    )[0]

    const volumeLeader = [...allMembers].sort(
      (a, b) => (b?.total_workouts || 0) - (a?.total_workouts || 0),
    )[0]

    return {
      city: { label: 'Your City', members: cityCrew, leader: streakLeader, kind: 'city' },
      gym: { label: myGym || 'Tag your gym', members: gymCrew, leader: volumeLeader, kind: 'gym' },
      split: { label: mySplit ? mySplit.toUpperCase() : 'No split set', members: splitCrew, leader: volumeLeader, kind: 'split' },
    }
  }, [friends, profile])

  const prWall = useMemo(() => {
    const rows = prs.map((pr) => ({
      ...pr,
      author: profile?.display_name || 'You',
      isSelf: true,
    }))

    const mock = [
      { exercise_name: 'Bench Press', weight: 120, reps: 3, achieved_at: Date.now() - 3 * 86400000, author: 'CryoWolf' },
      { exercise_name: 'Deadlift', weight: 225, reps: 1, achieved_at: Date.now() - 5 * 86400000, author: 'HaloX' },
      { exercise_name: 'Squat', weight: 180, reps: 5, achieved_at: Date.now() - 9 * 86400000, author: 'Neon92' },
    ]

    const combined = [...rows, ...mock].sort(
      (a, b) => new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime(),
    )

    return combined.slice(0, 10)
  }, [prs, profile])

  const challenges = useMemo(() => ([
    {
      id: 'volume-duel',
      title: 'Volume Duel · 7 days',
      subtitle: 'Stack more tonnage than your rival this week.',
      kind: 'duel',
      stake: 'Winner gets a rotating gold trophy · Loser wears an "L" for 7 days',
      deadline: '6 days left',
      rivals: friends.slice(0, 2),
    },
    {
      id: 'pr-race',
      title: 'Bench 1RM Race',
      subtitle: 'First to hit +2.5kg on bench PR this cycle.',
      kind: 'pr',
      stake: 'Crown visible in your chat badge for one week',
      deadline: '11 days left',
      rivals: friends.slice(0, 3),
    },
    {
      id: 'streak-survivor',
      title: 'Streak Survivor',
      subtitle: 'Last person in your crew to break streak wins the pot.',
      kind: 'survival',
      stake: 'Gold aura on profile + chat',
      deadline: 'ongoing',
      rivals: friends.slice(0, 4),
    },
  ]), [friends])

  const eliteStreaks = useMemo(() => {
    const all = [
      ...(profile ? [{ ...profile, isSelf: true }] : []),
      ...friends,
    ]
      .filter((m) => (m?.current_streak || 0) > 0)
      .sort((a, b) => (b?.current_streak || 0) - (a?.current_streak || 0))
      .slice(0, 10)

    return all
  }, [friends, profile])

  const flexFeed = useMemo(() => {
    const base = []
    if (profile) {
      base.push({
        id: 'self',
        actor: profile.display_name || profile.username || 'You',
        tier: profile.subscription_tier,
        image: avatarFor(profile),
        kind: 'milestone',
        headline: `${profile.total_workouts || 0} lifetime sessions logged`,
        meta: `${profile.current_streak || 0}-day streak · ULTRA verified`,
      })
    }
    friends.slice(0, 4).forEach((f) => {
      base.push({
        id: f.id,
        actor: f.display_name || f.username || 'Friend',
        tier: f.subscription_tier,
        image: avatarFor(f),
        kind: 'badge',
        headline: `Just unlocked Diamond tier on ${['Bench', 'Squat', 'Deadlift'][Math.floor(Math.random() * 3)]}`,
        meta: 'Top 3% of ULTRA lifters this week',
      })
    })
    return base
  }, [friends, profile])

  if (!isUltra) {
    return (
      <div className="page communities-page">
        <div className="page-header">
          <div className="ultra-lab-kicker"><RiSparklingFill size={12} /> ULTRA EXCLUSIVE</div>
          <h1 className="page-title">Communities</h1>
          <p className="communities-lede">
            City crews. Gym leaderboards. PR walls. Challenge rooms. Elite streak boards. All locked to ULTRA members.
          </p>
        </div>

        <PaywallGate
          requiredTier="ultra"
          feature="Communities"
          title="Communities are ULTRA-only"
          description="Join the lifting circles that actually move the needle. Shared PR walls, weekly duels, crew crowns, and a feed built for flex."
          ctaLabel="Unlock ULTRA"
        >
          <div className="communities-preview-grid">
            <article className="communities-preview-card">
              <RiTeamFill size={22} />
              <h3>City + Gym + Split Crews</h3>
              <p>Auto-joined when you tag your city, your gym, or your split. Weekly king crown rotates.</p>
            </article>
            <article className="communities-preview-card">
              <RiTrophyFill size={22} />
              <h3>Shared PR Wall</h3>
              <p>Every PR you log shows up on the wall. Your crew sees it live, reacts in real time.</p>
            </article>
            <article className="communities-preview-card">
              <RiSwordLine size={22} />
              <h3>Challenge Rooms</h3>
              <p>Stake-based PR duels. Winner flex. Loser wears an &quot;L&quot; for 7 days.</p>
            </article>
            <article className="communities-preview-card">
              <RiFireFill size={22} />
              <h3>Elite Streak Board</h3>
              <p>Top 1% streaks per country. Falling off paints a visible mark for a week.</p>
            </article>
          </div>
        </PaywallGate>
      </div>
    )
  }

  return (
    <div className="page communities-page">
      <div className="page-header communities-header">
        <div>
          <div className="ultra-lab-kicker"><RiVipCrownFill size={12} /> ULTRA · COMMUNITIES</div>
          <h1 className="page-title">Run with <span className="accent">the pack</span></h1>
          <p className="communities-lede">
            Shared PR walls, stake challenges, and crew crowns. Every lift is visible, every PR is flex.
          </p>
        </div>
        <ProBadge size="md" tier="ultra" />
      </div>

      <div className="communities-tabs">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              className={`communities-tab ${active ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="communities-loading">
          <div className="communities-loading-pulse" />
          <span>Assembling your crews…</span>
        </div>
      )}

      {!loading && tab === 'crews' && (
        <div className="communities-stack">
          {Object.entries(crews).map(([key, crew]) => (
            <section key={key} className={`crew-card crew-${crew.kind}`}>
              <div className="crew-head">
                <div>
                  <div className="crew-kicker">
                    {crew.kind === 'city' && <><RiMapPin2Line size={12} /> CITY CREW</>}
                    {crew.kind === 'gym' && <><RiBuilding2Line size={12} /> GYM CREW</>}
                    {crew.kind === 'split' && <><RiGlobalLine size={12} /> SPLIT CREW</>}
                  </div>
                  <h3 className="crew-title">{crew.label}</h3>
                </div>
                <div className="crew-count">{crew.members.length}<span> members</span></div>
              </div>

              {crew.leader && (
                <div className="crew-king">
                  <div className="crew-king-avatar">
                    {avatarFor(crew.leader)
                      ? <img src={avatarFor(crew.leader)} alt="" />
                      : <span>{initialsOf(crew.leader.display_name)}</span>}
                    <RiVipCrownFill size={14} className="crew-king-crown" />
                  </div>
                  <div className="crew-king-body">
                    <div className="crew-king-label">This week&apos;s king</div>
                    <div className="crew-king-name">{crew.leader.display_name || crew.leader.username}</div>
                    <div className="crew-king-stat">
                      {crew.leader.current_streak || 0}d streak · {crew.leader.total_workouts || 0} sessions
                    </div>
                  </div>
                </div>
              )}

              <div className="crew-members">
                {crew.members.slice(0, 6).map((m) => (
                  <div key={m.id || m.username} className={`crew-member-chip ${m.isSelf ? 'is-self' : ''}`}>
                    {avatarFor(m)
                      ? <img src={avatarFor(m)} alt="" />
                      : <span className="crew-member-fallback">{initialsOf(m.display_name || m.username)}</span>}
                    {tierRank(m.subscription_tier) === 2 && (
                      <span className="crew-member-ultra"><RiVipCrownFill size={9} /></span>
                    )}
                  </div>
                ))}
                {crew.members.length > 6 && (
                  <div className="crew-member-overflow">+{crew.members.length - 6}</div>
                )}
                {crew.members.length === 0 && (
                  <div className="crew-empty-hint">
                    {crew.kind === 'gym' ? 'Tag your home gym in settings to auto-join.' :
                     crew.kind === 'split' ? 'Pick a training split to auto-join this crew.' :
                     'Your city crew is empty — invite friends.'}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && tab === 'prwall' && (
        <div className="communities-stack">
          <section className="pr-wall">
            <div className="pr-wall-head">
              <div className="crew-kicker"><RiTrophyFill size={12} /> SHARED PR WALL</div>
              <span className="pr-wall-count">{prWall.length} recent</span>
            </div>
            {prWall.length === 0 ? (
              <div className="communities-empty">
                <RiTrophyFill size={22} />
                <strong>No PRs yet in the feed</strong>
                <p>When you or your crew logs a PR, it lights up here.</p>
              </div>
            ) : (
              <div className="pr-wall-list">
                {prWall.map((pr, idx) => (
                  <article key={idx} className={`pr-wall-card ${pr.isSelf ? 'is-self' : ''}`}>
                    <div className="pr-wall-rank">#{idx + 1}</div>
                    <div className="pr-wall-body">
                      <div className="pr-wall-exercise">{pr.exercise_name}</div>
                      <div className="pr-wall-meta">
                        <strong>{Math.round(pr.weight)}kg × {pr.reps || 1}</strong>
                        <span>· {pr.author}</span>
                        <span className="pr-wall-time">{formatRelative(pr.achieved_at)}</span>
                      </div>
                    </div>
                    <button type="button" className="pr-wall-fire" aria-label="React">
                      <RiFireFill size={16} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && tab === 'challenges' && (
        <div className="communities-stack">
          {challenges.map((c) => (
            <article key={c.id} className={`challenge-card kind-${c.kind}`}>
              <div className="challenge-head">
                <div className="challenge-kicker"><RiSwordLine size={12} /> CHALLENGE ROOM</div>
                <div className="challenge-deadline">{c.deadline}</div>
              </div>
              <h3 className="challenge-title">{c.title}</h3>
              <p className="challenge-subtitle">{c.subtitle}</p>
              <div className="challenge-stake">
                <div className="challenge-stake-kicker">STAKE</div>
                <div className="challenge-stake-body">{c.stake}</div>
              </div>
              <div className="challenge-rivals">
                {c.rivals.length ? c.rivals.map((r) => (
                  <div key={r.id} className="challenge-rival-chip">
                    {avatarFor(r)
                      ? <img src={avatarFor(r)} alt="" />
                      : <span>{initialsOf(r.display_name)}</span>}
                    <span className="challenge-rival-name">{r.display_name}</span>
                  </div>
                )) : <span className="challenge-rival-empty">No rivals yet — invite a friend.</span>}
                <button type="button" className="challenge-join-btn">
                  Enter <RiArrowRightLine size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && tab === 'streaks' && (
        <div className="communities-stack">
          <section className="streak-board">
            <div className="streak-board-head">
              <div className="crew-kicker"><RiFireFill size={12} /> ELITE STREAK BOARD</div>
              <span>Top 10 in your network</span>
            </div>
            {eliteStreaks.length === 0 ? (
              <div className="communities-empty">
                <RiFireFill size={22} />
                <strong>No active streaks</strong>
                <p>Start a streak to claim a spot.</p>
              </div>
            ) : (
              <div className="streak-board-list">
                {eliteStreaks.map((p, i) => (
                  <div key={p.id || i} className={`streak-row rank-${i + 1} ${p.isSelf ? 'is-self' : ''}`}>
                    <div className="streak-rank">#{i + 1}</div>
                    <div className="streak-avatar">
                      {avatarFor(p)
                        ? <img src={avatarFor(p)} alt="" />
                        : <span>{initialsOf(p.display_name)}</span>}
                    </div>
                    <div className="streak-body">
                      <div className="streak-name">
                        {p.display_name || p.username}
                        {tierRank(p.subscription_tier) === 2 && <RiVipCrownFill size={11} />}
                      </div>
                      <div className="streak-meta">{p.total_workouts || 0} lifetime sessions</div>
                    </div>
                    <div className="streak-count">
                      <strong>{p.current_streak || 0}</strong>
                      <span>days</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && tab === 'flex' && (
        <div className="communities-stack">
          <section className="flex-feed">
            <div className="crew-kicker"><RiSparklingFill size={12} /> FLEX FEED</div>
            {flexFeed.length === 0 ? (
              <div className="communities-empty">
                <RiSparklingFill size={22} />
                <strong>Feed is quiet</strong>
                <p>Hit a milestone and it lands here.</p>
              </div>
            ) : (
              <div className="flex-feed-list">
                {flexFeed.map((item) => (
                  <article key={item.id} className="flex-feed-card">
                    <div className="flex-feed-avatar">
                      {item.image
                        ? <img src={item.image} alt="" />
                        : <span>{initialsOf(item.actor)}</span>}
                    </div>
                    <div className="flex-feed-body">
                      <div className="flex-feed-head">
                        <strong>{item.actor}</strong>
                        {tierRank(item.tier) === 2 && <span className="flex-ultra-pill"><RiVipCrownFill size={10} /> ULTRA</span>}
                      </div>
                      <div className="flex-feed-headline">{item.headline}</div>
                      <div className="flex-feed-meta">{item.meta}</div>
                    </div>
                    <div className="flex-feed-icon">
                      {item.kind === 'milestone' ? <RiFlashlightFill size={18} /> : <RiTrophyFill size={18} />}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <button className="back-btn communities-back" onClick={() => navigate(-1)}>
        <RiArrowLeftLine size={18} /> Back
      </button>
    </div>
  )
}

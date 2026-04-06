/**
 * REPMAX ONBOARDING — v4 FINAL
 * 1. Fixes channel permissions (allows @everyone to send in key channels)
 * 2. Configures onboarding questions
 * 3. Enables onboarding
 */
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, SnowflakeUtil } = require('discord.js')
const { getBotConfig } = require('./config')

const { BOT_TOKEN, GUILD_ID } = getBotConfig()

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] })
const log = msg => console.log(`  [${new Date().toLocaleTimeString()}] ${msg}`)
let idC = 0
const genId = () => SnowflakeUtil.generate({ timestamp: Date.now() + (++idC) }).toString()

client.once('ready', async () => {
  console.log('\n  REPMAX ONBOARDING v4 — FINAL\n')
  log(`Logged in as ${client.user.tag}`)

  const guild = client.guilds.cache.get(GUILD_ID)
  if (!guild) { log('Guild not found!'); process.exit(1) }

  const findCh = name => guild.channels.cache.find(c => c.name.includes(name) && c.type === ChannelType.GuildText)
  const findRole = name => guild.roles.cache.find(r => r.name.includes(name) && !r.name.startsWith('──'))

  // ─── STEP 1: FIX CHANNEL PERMISSIONS ───
  console.log('\n━━━ STEP 1: FIXING PERMISSIONS ━━━')
  
  // Channels that @everyone should be able to SEND in (for onboarding)
  const writableNames = [
    'general-chat', 'introductions', 'motivation', 'memes', 'gym-selfies',
    'pump-playlist', 'workout-logs', 'form-checks', 'exercise-tips',
    'home-workouts', 'personal-records', 'program-reviews',
    'meal-prep', 'recipes', 'supplements', 'diet-help', 'food-pics',
    'transformations', 'progress-pics', 'milestones', 'streak-board',
    'bug-reports', 'feature-requests', 'app-help',
  ]
  
  // Channels that stay READ-ONLY
  const readOnlyNames = ['rules', 'announcements', 'changelogs', 'faq', 'get-roles', 'welcome', 'create-ticket']

  for (const name of writableNames) {
    const ch = findCh(name)
    if (ch) {
      try {
        await ch.permissionOverwrites.edit(guild.id, {
          ViewChannel: true,
          SendMessages: true,
        })
        log(`  ✅ ${name} → View+Send`)
      } catch (e) { log(`  ⚠️ ${name}: ${e.message}`) }
    }
  }

  for (const name of readOnlyNames) {
    const ch = findCh(name)
    if (ch) {
      try {
        await ch.permissionOverwrites.edit(guild.id, {
          ViewChannel: true,
          SendMessages: false,
        })
        log(`  🔒 ${name} → View only`)
      } catch (e) { log(`  ⚠️ ${name}: ${e.message}`) }
    }
  }

  log('Permissions fixed!')

  // ─── STEP 2: BUILD ONBOARDING DATA ───
  console.log('\n━━━ STEP 2: BUILDING QUESTIONS ━━━')

  const channels = {}
  for (const name of [...writableNames, ...readOnlyNames]) {
    channels[name] = findCh(name)
  }

  const roles = {
    muscle: findRole('Muscle Building'), weightloss: findRole('Weight Loss'),
    powerlifting: findRole('Powerlifting'), calisthenics: findRole('Calisthenics'),
    cardio: findRole('Cardio'), homegym: findRole('Home Gym'),
    updates: findRole('App Updates'), events: findRole('Events'), giveaways: findRole('Giveaways'),
  }

  const cid = name => channels[name]?.id
  const rid = key => roles[key]?.id
  const vids = (...names) => names.map(n => cid(n)).filter(Boolean)

  // Default channels: 7 writable ones from different categories
  const default_channel_ids = vids(
    'general-chat',    // GENERAL
    'introductions',   // GENERAL  
    'motivation',      // GENERAL
    'memes',           // GENERAL
    'workout-logs',    // TRAINING
    'meal-prep',       // NUTRITION
    'bug-reports',     // SUPPORT
  )
  log(`${default_channel_ids.length} default channels (all writable)`)

  // Q1: Fitness Goals
  const q1 = []
  const addG = (t, d, e, rk, chs) => {
    const r = rid(rk) ? [rid(rk)] : []
    const c = vids(...chs)
    if (r.length || c.length) q1.push({ id: genId(), title: t, description: d, emoji: { id: null, name: e, animated: false }, role_ids: r, channel_ids: c })
  }
  addG('Muscle Building', 'Hypertrophy and size gains', '💪', 'muscle', ['workout-logs','form-checks','personal-records','program-reviews'])
  addG('Weight Loss', 'Fat loss and cutting', '🔥', 'weightloss', ['workout-logs','meal-prep','diet-help','transformations'])
  addG('Powerlifting', 'Squat, bench, deadlift', '🏋', 'powerlifting', ['workout-logs','form-checks','personal-records'])
  addG('Calisthenics', 'Bodyweight training', '🤸', 'calisthenics', ['workout-logs','form-checks','home-workouts'])
  addG('Cardio & Endurance', 'Running, cycling, HIIT', '🏃', 'cardio', ['workout-logs','transformations','streak-board'])
  addG('Home Gym', 'Training at home', '🏠', 'homegym', ['home-workouts','exercise-tips'])
  log(`Q1: ${q1.length} goals`)

  // Q2: Experience  
  const q2 = [
    { id: genId(), title: 'Beginner', description: '0-6 months', emoji: { id: null, name: '🌱', animated: false }, role_ids: [], channel_ids: vids('exercise-tips','form-checks','app-help') },
    { id: genId(), title: 'Intermediate', description: '6 months - 2 years', emoji: { id: null, name: '💪', animated: false }, role_ids: [], channel_ids: vids('workout-logs','program-reviews','personal-records') },
    { id: genId(), title: 'Advanced', description: '2+ years lifting', emoji: { id: null, name: '🏆', animated: false }, role_ids: [], channel_ids: vids('workout-logs','form-checks','personal-records','program-reviews') },
    { id: genId(), title: 'Coach / Trainer', description: 'Certified coach', emoji: { id: null, name: '🧠', animated: false }, role_ids: [], channel_ids: vids('exercise-tips','form-checks','program-reviews') },
  ].filter(o => o.channel_ids.length > 0)
  log(`Q2: ${q2.length} levels`)

  // Q3: Content
  const q3 = [
    { id: genId(), title: 'Workout Sharing', description: 'Logs and programs', emoji: { id: null, name: '📝', animated: false }, role_ids: [], channel_ids: vids('workout-logs','personal-records','program-reviews') },
    { id: genId(), title: 'Nutrition', description: 'Recipes and meal prep', emoji: { id: null, name: '🥗', animated: false }, role_ids: [], channel_ids: vids('meal-prep','recipes','supplements','diet-help','food-pics') },
    { id: genId(), title: 'Progress Tracking', description: 'Transformations and milestones', emoji: { id: null, name: '📈', animated: false }, role_ids: [], channel_ids: vids('transformations','progress-pics','milestones','streak-board') },
    { id: genId(), title: 'Form Checks', description: 'Video feedback', emoji: { id: null, name: '🎥', animated: false }, role_ids: [], channel_ids: vids('form-checks','exercise-tips') },
    { id: genId(), title: 'Memes and Vibes', description: 'Humor and selfies', emoji: { id: null, name: '😂', animated: false }, role_ids: [], channel_ids: vids('memes','gym-selfies','pump-playlist') },
    { id: genId(), title: 'App Support', description: 'Bugs and help', emoji: { id: null, name: '🛠', animated: false }, role_ids: [], channel_ids: vids('bug-reports','feature-requests','app-help') },
  ].filter(o => o.channel_ids.length > 0)
  log(`Q3: ${q3.length} interests`)

  // Q4: Notifications
  const q4 = []
  if (rid('updates')) q4.push({ id: genId(), title: 'App Updates', description: 'New features', emoji: { id: null, name: '📱', animated: false }, role_ids: [rid('updates')], channel_ids: vids('announcements','changelogs') })
  if (rid('events')) q4.push({ id: genId(), title: 'Events', description: 'Challenges and comps', emoji: { id: null, name: '🏆', animated: false }, role_ids: [rid('events')], channel_ids: vids('announcements') })
  if (rid('giveaways')) q4.push({ id: genId(), title: 'Giveaways', description: 'Free PRO prizes', emoji: { id: null, name: '🎁', animated: false }, role_ids: [rid('giveaways')], channel_ids: vids('announcements') })
  log(`Q4: ${q4.length} notifications`)

  const prompts = []
  if (q1.length >= 2) prompts.push({ id: genId(), type: 0, title: 'What are your fitness goals?', single_select: false, required: true, in_onboarding: true, options: q1 })
  if (q2.length >= 2) prompts.push({ id: genId(), type: 0, title: "What's your experience level?", single_select: true, required: true, in_onboarding: true, options: q2 })
  if (q3.length >= 2) prompts.push({ id: genId(), type: 0, title: 'What content interests you?', single_select: false, required: true, in_onboarding: true, options: q3 })
  if (q4.length >= 2) prompts.push({ id: genId(), type: 0, title: 'What notifications do you want?', single_select: false, required: false, in_onboarding: true, options: q4 })

  // ─── STEP 3: SEND TO DISCORD ───
  console.log('\n━━━ STEP 3: APPLYING ━━━')

  const body = { prompts, default_channel_ids, enabled: true, mode: 0 }

  const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/onboarding`, {
    method: 'PUT',
    headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()

  if (res.ok) {
    log(`SUCCESS! Onboarding ENABLED with ${data.prompts?.length} questions!`)
  } else {
    log(`Failed (${res.status}): ${data.message}`)
    if (data.errors) console.log(JSON.stringify(data.errors, null, 2))
    
    // Fallback: save without enabling
    log('Trying without enabling...')
    body.enabled = false
    const res2 = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/onboarding`, {
      method: 'PUT',
      headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data2 = await res2.json()
    if (res2.ok) {
      log(`Questions saved (${data2.prompts?.length}). Enable manually in Discord.`)
    } else {
      log(`Also failed: ${data2.message}`)
      if (data2.errors) console.log(JSON.stringify(data2.errors, null, 2))
    }
  }

  // Welcome screen
  try {
    const wc = []
    if (cid('rules')) wc.push({ channel_id: cid('rules'), description: 'Read the rules', emoji_name: '📜' })
    if (cid('get-roles')) wc.push({ channel_id: cid('get-roles'), description: 'Pick your roles', emoji_name: '🎭' })
    if (cid('introductions')) wc.push({ channel_id: cid('introductions'), description: 'Introduce yourself', emoji_name: '👋' })
    if (cid('general-chat')) wc.push({ channel_id: cid('general-chat'), description: 'Start chatting', emoji_name: '💬' })
    if (cid('announcements')) wc.push({ channel_id: cid('announcements'), description: 'Stay updated', emoji_name: '📢' })
    await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/welcome-screen`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, description: 'Welcome to REPMAX! AI-Powered Fitness Community', welcome_channels: wc }),
    })
    log('Welcome screen OK')
  } catch {}

  console.log('\nDone!')
  process.exit(0)
})

client.on('error', e => log(e.message))
process.on('unhandledRejection', e => log(e?.message || String(e)))
client.login(BOT_TOKEN)

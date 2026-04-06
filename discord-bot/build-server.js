/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           REPMAX DISCORD SERVER BUILDER v4.0                 ║
 * ║   Smart: skips what already exists • Adds onboarding        ║
 * ║   Run once to build, then run bot.js for live features      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const { Client, GatewayIntentBits, PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js')
const { getBotConfig } = require('./config')

// ═══════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════
const { BOT_TOKEN, GUILD_ID } = getBotConfig()

const IMAGES = {
  server: 'https://imgur.com/Ok1hYHa.png',
  rules: 'https://imgur.com/BQT87ZW.png',
  welcome: 'https://imgur.com/8T2oyBq.png',
  faq: 'https://imgur.com/57v5mGw.png',
  training: 'https://imgur.com/xe7fY26.png',
  nutrition: 'https://imgur.com/kdzugpS.png',
  pro: 'https://imgur.com/qyaLWHc.png',
  support: 'https://imgur.com/3KiW2fP.png',
  progress: 'https://imgur.com/wbDAh48.png',
  invite: 'https://imgur.com/JVNWTzk.png',
}

const C = {
  accent: 0xCCFF00, gold: 0xFFD700, purple: 0x7C3AED, green: 0x22C55E,
  red: 0xEF4444, blue: 0x3B82F6, orange: 0xFF6B35, amber: 0xF59E0B,
}

// ═══════════════════════════════════════════
//  ROLES
// ═══════════════════════════════════════════
const ROLES = [
  { name: '─────────────', color: 0x2F3136, hoist: false, mentionable: false },
  { name: '🤖 Bot', color: 0x5865F2, hoist: false, mentionable: false },
  { name: '🆕 Newbie', color: 0x95A5A6, hoist: true, mentionable: false },
  { name: '💪 Member', color: 0x3498DB, hoist: true, mentionable: true },
  { name: '✅ Verified', color: 0x2ECC71, hoist: true, mentionable: true },
  { name: '🏅 OG Member', color: 0xE67E22, hoist: true, mentionable: true },
  { name: '──── Special ────', color: 0x2F3136, hoist: false, mentionable: false },
  { name: '🔥 Streak Master', color: 0xFF6B35, hoist: true, mentionable: true },
  { name: '🏆 100 Club', color: 0xFFD700, hoist: true, mentionable: true },
  { name: '💎 PRO Member', color: 0xF59E0B, hoist: true, mentionable: true },
  { name: '──── Pings ────', color: 0x2F3136, hoist: false, mentionable: false },
  { name: '📱 App Updates', color: 0x3B82F6, hoist: false, mentionable: true },
  { name: '🏆 Events', color: 0x22C55E, hoist: false, mentionable: true },
  { name: '🎁 Giveaways', color: 0xF59E0B, hoist: false, mentionable: true },
  { name: '──── Goals ────', color: 0x2F3136, hoist: false, mentionable: false },
  { name: '💪 Muscle Building', color: 0x3498DB, hoist: false, mentionable: false },
  { name: '🔥 Weight Loss', color: 0xE74C3C, hoist: false, mentionable: false },
  { name: '🏋️ Powerlifting', color: 0x9B59B6, hoist: false, mentionable: false },
  { name: '🤸 Calisthenics', color: 0x2ECC71, hoist: false, mentionable: false },
  { name: '🏃 Cardio', color: 0x1ABC9C, hoist: false, mentionable: false },
  { name: '🏠 Home Gym', color: 0xE67E22, hoist: false, mentionable: false },
  { name: '──── Staff ────', color: 0x2F3136, hoist: false, mentionable: false },
  { name: '🎨 Content Creator', color: 0xE91E63, hoist: true, mentionable: true },
  { name: '🛡️ Moderator', color: 0x9B59B6, hoist: true, mentionable: true },
  { name: '⚡ Admin', color: 0xE74C3C, hoist: true, mentionable: true },
  { name: '👑 Owner', color: 0xFFD700, hoist: true, mentionable: false },
]

// ═══════════════════════════════════════════
//  CHANNELS
// ═══════════════════════════════════════════
const CATEGORIES = [
  { name: '📋 INFORMATION', channels: [
    { name: '📜│rules', type: 'text', readOnly: true, topic: 'Server rules' },
    { name: '📢│announcements', type: 'text', readOnly: true, topic: 'Official announcements' },
    { name: '📰│changelogs', type: 'text', readOnly: true, topic: 'App updates' },
    { name: '❓│faq', type: 'text', readOnly: true, topic: 'FAQ' },
    { name: '🎭│get-roles', type: 'text', readOnly: true, topic: 'Select your roles' },
    { name: '👋│welcome', type: 'text', readOnly: true, topic: 'Welcome new members' },
  ]},
  { name: '🏋️ GENERAL', channels: [
    { name: '💬│general-chat', type: 'text', topic: 'Talk about anything fitness related' },
    { name: '👋│introductions', type: 'text', topic: 'Introduce yourself!', slowmode: 10 },
    { name: '🔥│motivation', type: 'text', topic: 'Share what keeps you going' },
    { name: '😂│memes', type: 'text', topic: 'Gym memes', slowmode: 5 },
    { name: '📸│gym-selfies', type: 'text', topic: 'Show off that pump' },
    { name: '🎵│pump-playlist', type: 'text', topic: 'Workout music' },
  ]},
  { name: '💪 TRAINING', channels: [
    { name: '📝│workout-logs', type: 'text', topic: 'Daily workout logs' },
    { name: '🎥│form-checks', type: 'text', topic: 'Post videos for form feedback' },
    { name: '💡│exercise-tips', type: 'text', topic: 'Tips and techniques' },
    { name: '🏠│home-workouts', type: 'text', topic: 'Home gym routines' },
    { name: '🏆│personal-records', type: 'text', topic: 'Celebrate PRs!' },
    { name: '📊│program-reviews', type: 'text', topic: 'Training programs' },
  ]},
  { name: '🥗 NUTRITION', channels: [
    { name: '🍳│meal-prep', type: 'text', topic: 'Meal prep ideas' },
    { name: '📖│recipes', type: 'text', topic: 'Healthy recipes' },
    { name: '💊│supplements', type: 'text', topic: 'Supplement discussion' },
    { name: '🆘│diet-help', type: 'text', topic: 'Nutrition advice' },
    { name: '📷│food-pics', type: 'text', topic: 'Share your meals' },
  ]},
  { name: '🏆 PROGRESS', channels: [
    { name: '📈│transformations', type: 'text', topic: 'Before & after photos' },
    { name: '🪞│progress-pics', type: 'text', topic: 'Progress updates' },
    { name: '🎯│milestones', type: 'text', topic: 'Celebrate goals!' },
    { name: '📊│streak-board', type: 'text', topic: 'Streak leaderboard' },
  ]},
  { name: '💎 PRO LOUNGE', proOnly: true, channels: [
    { name: '💎│pro-chat', type: 'text', topic: 'Exclusive PRO chat', proOnly: true },
    { name: '🧠│pro-coaching', type: 'text', topic: 'Advanced coaching', proOnly: true },
    { name: '⚔️│pro-challenges', type: 'text', topic: 'Weekly challenges', proOnly: true },
  ]},
  { name: '🎙️ VOICE', channels: [
    { name: '🗣️ Gym Talk', type: 'voice' },
    { name: '🏋️ Workout Together', type: 'voice' },
    { name: '🎵 Music & Chill', type: 'voice' },
    { name: '💎 PRO Voice', type: 'voice', proOnly: true },
    { name: '📺 Stream Zone', type: 'voice' },
  ]},
  { name: '🛠️ SUPPORT', channels: [
    { name: '🐛│bug-reports', type: 'text', topic: 'Report bugs' },
    { name: '💡│feature-requests', type: 'text', topic: 'Suggest features' },
    { name: '🆘│app-help', type: 'text', topic: 'Get help' },
    { name: '🎫│create-ticket', type: 'text', readOnly: true, topic: 'Create a ticket' },
  ]},
  { name: '📊 STAFF ONLY', staffOnly: true, channels: [
    { name: '💬│staff-chat', type: 'text', topic: 'Internal discussion', staffOnly: true },
    { name: '📋│mod-logs', type: 'text', readOnly: true, topic: 'Mod logs', staffOnly: true },
    { name: '📊│analytics', type: 'text', topic: 'Server analytics', staffOnly: true },
    { name: '🤖│bot-commands', type: 'text', topic: 'Bot testing', staffOnly: true },
  ]},
]

// ═══════════════════════════════════════════
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = msg => console.log(`  [${new Date().toLocaleTimeString()}] ${msg}`)
const img = (embed, url) => { if (url) embed.setImage(url); return embed }

client.once('ready', async () => {
  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║     REPMAX SERVER BUILDER v4.0 (Smart)       ║')
  console.log('╚══════════════════════════════════════════════╝\n')
  log(`✅ Logged in as ${client.user.tag}`)

  const guild = client.guilds.cache.get(GUILD_ID)
  if (!guild) { log('❌ Guild not found!'); process.exit(1) }

  // ─── SMART DETECTION ───
  const existingRoles = guild.roles.cache.map(r => r.name)
  const existingChannels = guild.channels.cache.map(c => c.name)

  const rolesExist = ROLES.filter(r => !r.name.includes('────')).some(r => existingRoles.includes(r.name))
  const channelsExist = CATEGORIES.some(cat => cat.channels.some(ch => existingChannels.includes(ch.name)))

  if (rolesExist && channelsExist) {
    log('🔍 Detected existing REPMAX server structure — skipping nuke/build')
    log('   Jumping straight to onboarding & content check...')

    // Map existing channels
    const CH = {}
    for (const cat of CATEGORIES) {
      for (const ch of cat.channels) {
        const found = guild.channels.cache.find(c => c.name === ch.name)
        if (found) CH[ch.name] = found
      }
    }

    // Map existing roles
    const R = {}
    for (const def of ROLES) {
      const found = guild.roles.cache.find(r => r.name === def.name)
      if (found) R[def.name] = found
    }

    log(`   Found ${Object.keys(CH).length} channels, ${Object.keys(R).length} roles`)

    // Jump to populating missing content + onboarding
    await populateChannels(guild, CH, R)
    await setupOnboarding(guild, CH)

    console.log('\n╔══════════════════════════════════════════════╗')
    console.log('║    🎉  INCREMENTAL UPDATE COMPLETE!  🎉       ║')
    console.log('║    🤖 Now run: node bot.js                    ║')
    console.log('╚══════════════════════════════════════════════╝\n')
    process.exit(0)
  }

  // ─── PHASE 1: NUKE (only if fresh build) ───
  console.log('\n━━━ PHASE 1: NUKING EVERYTHING ━━━')
  for (const [, ch] of guild.channels.cache.filter(c => c.deletable)) { try { await ch.delete(); await sleep(350) } catch {} }
  const botHighest = guild.members.me.roles.highest
  for (const [, r] of guild.roles.cache.filter(r => r.id !== guild.id && r.position < botHighest.position && !r.managed && r.editable)) { try { await r.delete(); await sleep(350) } catch {} }
  try { for (const [, e] of guild.emojis.cache) { try { await e.delete(); await sleep(200) } catch {} } } catch {}
  log('✅ Server nuked')
  await sleep(1000)

  // ─── PHASE 2: SETTINGS ───
  console.log('\n━━━ PHASE 2: SERVER SETTINGS ━━━')
  try {
    await guild.edit({ name: 'REPMAX | Fitness Community', description: 'The #1 AI-Powered Fitness Community 🏋️', defaultMessageNotifications: 1, explicitContentFilter: 2, verificationLevel: 1 })
    log('✅ Settings updated')
  } catch (e) { log(`⚠️  ${e.message}`) }

  // ─── PHASE 3: ROLES ───
  console.log('\n━━━ PHASE 3: CREATING ROLES ━━━')
  const R = {}
  for (let i = 0; i < ROLES.length; i++) {
    const def = ROLES[i]
    try {
      const perms = []
      if (def.name.includes('Owner')) perms.push(PermissionsBitField.Flags.Administrator)
      else if (def.name.includes('Admin')) perms.push(PermissionsBitField.Flags.ManageGuild, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageRoles, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.BanMembers, PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.MentionEveryone, PermissionsBitField.Flags.ViewAuditLog)
      else if (def.name.includes('Moderator')) perms.push(PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.MuteMembers, PermissionsBitField.Flags.DeafenMembers, PermissionsBitField.Flags.MoveMembers, PermissionsBitField.Flags.ManageNicknames, PermissionsBitField.Flags.ViewAuditLog)
      const role = await guild.roles.create({ name: def.name, color: def.color, hoist: def.hoist, mentionable: def.mentionable, permissions: perms, position: i + 1 })
      R[def.name] = role
      log(`  🎨 ${def.name}`)
      await sleep(400)
    } catch (e) { log(`  ⚠️  ${def.name}: ${e.message}`) }
  }
  log(`✅ ${Object.keys(R).length} roles created`)
  await sleep(1000)

  // ─── PHASE 4: CHANNELS ───
  console.log('\n━━━ PHASE 4: CREATING CHANNELS ━━━')
  const CH = {}
  for (const cat of CATEGORIES) {
    const overrides = [{ id: guild.id, allow: cat.staffOnly ? [] : [PermissionsBitField.Flags.ViewChannel], deny: cat.staffOnly ? [PermissionsBitField.Flags.ViewChannel] : [] }]
    if (cat.staffOnly) { for (const rn of ['🛡️ Moderator', '⚡ Admin', '👑 Owner']) { if (R[rn]) overrides.push({ id: R[rn].id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }) } }
    if (cat.proOnly) { overrides[0].deny = [PermissionsBitField.Flags.ViewChannel]; for (const rn of ['💎 PRO Member', '🛡️ Moderator', '⚡ Admin', '👑 Owner']) { if (R[rn]) overrides.push({ id: R[rn].id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }) } }

    let category
    try { category = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, permissionOverwrites: overrides }); log(`📁 ${cat.name}`); await sleep(400) } catch (e) { log(`⚠️  ${cat.name}: ${e.message}`); continue }

    for (const ch of cat.channels) {
      try {
        const chOvr = [...overrides]
        if (ch.readOnly) chOvr.push({ id: guild.id, deny: [PermissionsBitField.Flags.SendMessages] })
        if (ch.proOnly && !cat.proOnly) { chOvr[0] = { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }; for (const rn of ['💎 PRO Member', '🛡️ Moderator', '⚡ Admin', '👑 Owner']) { if (R[rn]) chOvr.push({ id: R[rn].id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }) } }
        const isV = ch.type === 'voice'
        const channel = await guild.channels.create({ name: ch.name, type: isV ? ChannelType.GuildVoice : ChannelType.GuildText, parent: category.id, topic: ch.topic || null, rateLimitPerUser: ch.slowmode || 0, permissionOverwrites: chOvr })
        CH[ch.name] = channel
        log(`  ${isV ? '🔊' : '💬'} ${ch.name}`)
        await sleep(350)
      } catch (e) { log(`  ⚠️  ${ch.name}: ${e.message}`) }
    }
  }

  // Tickets category
  try { await guild.channels.create({ name: '🎫 TICKETS', type: ChannelType.GuildCategory, permissionOverwrites: [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }] }); log('📁 🎫 TICKETS') } catch {}
  log('✅ All channels created')
  await sleep(1000)

  // ─── PHASE 5: POPULATE ───
  await populateChannels(guild, CH, R)

  // ─── PHASE 6: FINAL ───
  console.log('\n━━━ PHASE 6: FINAL CONFIGURATION ━━━')
  const generalChat = CH['💬│general-chat']
  if (generalChat) { try { await guild.edit({ systemChannel: generalChat.id, systemChannelFlags: 0 }); log('✅ System → #general-chat') } catch {} }
  const rulesChannel = CH['📜│rules']
  if (rulesChannel) { try { await guild.edit({ rulesChannel: rulesChannel.id }); log('✅ Rules channel set') } catch {} }
  try { const owner = await guild.fetchOwner(); if (owner && R['👑 Owner']) { await owner.roles.add(R['👑 Owner']); log(`👑 Owner → ${owner.user.tag}`) } } catch {}

  // ─── PHASE 7: ONBOARDING ───
  await setupOnboarding(guild, CH)

  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║        🎉  SERVER BUILD COMPLETE!  🎉         ║')
  console.log('╠══════════════════════════════════════════════╣')
  console.log(`║  📁 Categories:  ${CATEGORIES.length + 1}                            ║`)
  console.log(`║  💬 Channels:    ${Object.keys(CH).length}                           ║`)
  console.log(`║  🎨 Roles:       ${Object.keys(R).length}                           ║`)
  console.log('║  🤖 Now run: node bot.js                      ║')
  console.log('╚══════════════════════════════════════════════╝\n')
  process.exit(0)
})

// ═══════════════════════════════════════════
//  POPULATE CHANNELS
// ═══════════════════════════════════════════
async function populateChannels(guild, CH, R) {
  console.log('\n━━━ POPULATING CHANNELS ━━━')

  // Only post if channel is empty (prevents duplicates on re-run)
  async function postIfEmpty(channel, content) {
    if (!channel) return false
    try {
      const msgs = await channel.messages.fetch({ limit: 1 })
      if (msgs.size > 0) { log(`  ⏭️  ${channel.name} (already has content)`); return false }
    } catch {}
    await channel.send(content)
    return true
  }

  // Rules
  if (await postIfEmpty(CH['📜│rules'], { embeds: [img(new EmbedBuilder().setColor(C.accent), IMAGES.rules)
    .setTitle('📜  REPMAX Community Rules').setDescription('Welcome to **REPMAX**! Follow these rules to keep our community amazing.')
    .addFields(
      { name: '1️⃣ Be Respectful', value: 'No harassment, hate speech, or personal attacks.', inline: false },
      { name: '2️⃣ No Spam', value: 'No spam or excessive self-promotion.', inline: false },
      { name: '3️⃣ Stay On Topic', value: 'Use the right channels for your content.', inline: false },
      { name: '4️⃣ No NSFW', value: 'Keep it clean and appropriate.', inline: false },
      { name: '5️⃣ No Dangerous Advice', value: 'Don\'t recommend dangerous exercises or substances.', inline: false },
      { name: '6️⃣ Respect Privacy', value: 'Don\'t share others\' personal info without permission.', inline: false },
      { name: '7️⃣ Listen to Staff', value: 'Moderators have the final say. Disagree? Open a ticket.', inline: false },
      { name: '8️⃣ Have Fun! 💪', value: 'Ask questions, share wins, support each other!', inline: false },
    ).setFooter({ text: 'Breaking rules → Warning → Mute → Ban' }).setTimestamp()] })) log('  📜 Rules')

  // Welcome
  if (await postIfEmpty(CH['👋│welcome'], { embeds: [img(new EmbedBuilder().setColor(C.accent), IMAGES.welcome)
    .setTitle('🏋️  Welcome to REPMAX!').setDescription('**REPMAX** is the **#1 AI-Powered Fitness Community**.\n\n> 🤖 AI-generated workouts\n> 📊 Track everything\n> 👥 Social features\n> 💎 PRO perks\n\n🔗 [repmax.vercel.app](https://repmax.vercel.app)')
    .setFooter({ text: 'Train. Track. Dominate. 💪' }).setTimestamp()],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('🔗 Open REPMAX').setStyle(ButtonStyle.Link).setURL('https://repmax.vercel.app'))] })) log('  👋 Welcome')

  // FAQ
  if (await postIfEmpty(CH['❓│faq'], { embeds: [img(new EmbedBuilder().setColor(C.blue), IMAGES.faq)
    .setTitle('❓  Frequently Asked Questions')
    .addFields(
      { name: '🤔 What is REPMAX?', value: 'AI-powered fitness tracker with personalized workouts, nutrition, and social features.', inline: false },
      { name: '📱 How do I install it?', value: 'Visit [repmax.vercel.app](https://repmax.vercel.app) → "Add to Home Screen"', inline: false },
      { name: '💰 Is it free?', value: 'Yes! PRO unlocks themes, calls, and exclusive features.', inline: false },
      { name: '💎 What does PRO include?', value: '• Custom themes\n• Voice/video calls\n• AI Vision\n• Super reactions\n• Exclusive Discord channels', inline: false },
    ).setFooter({ text: 'More questions? Ask in #app-help' }).setTimestamp()] })) log('  ❓ FAQ')

  // Announcements
  if (await postIfEmpty(CH['📢│announcements'], { embeds: [new EmbedBuilder().setColor(C.accent).setTitle('📢  Server Launch!').setDescription('🎉 Welcome to the official REPMAX Discord!\n\n> 1️⃣ Read the rules\n> 2️⃣ Pick your roles\n> 3️⃣ Introduce yourself\n> 4️⃣ Start chatting!\n\n**Let\'s build the strongest community. 💪**').setTimestamp()] })) log('  📢 Announcement')

  // Changelogs
  if (await postIfEmpty(CH['📰│changelogs'], { embeds: [new EmbedBuilder().setColor(C.green).setTitle('📰  REPMAX v4.1').setDescription('**🆕 New:**\n> • AI Nutrition engine\n> • User profile modals\n> • Recovery Hub\n> • Language switcher\n> • WebRTC stability\n\n**🐛 Fixes:**\n> • Online status\n> • Dark text on dark BG\n> • Call notifications').setTimestamp()] })) log('  📰 Changelog')

  // Get Roles
  const rolesChannel = CH['🎭│get-roles']
  if (rolesChannel) {
    try {
      const msgs = await rolesChannel.messages.fetch({ limit: 1 })
      if (msgs.size === 0) {
        await rolesChannel.send({ embeds: [new EmbedBuilder().setColor(C.accent).setTitle('🎯  Select Your Fitness Goals')],
          components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('goal_roles').setPlaceholder('🎯 Select goals...').setMinValues(1).setMaxValues(6).addOptions([
            { label: 'Muscle Building', value: 'muscle', emoji: '💪' }, { label: 'Weight Loss', value: 'weightloss', emoji: '🔥' },
            { label: 'Powerlifting', value: 'powerlifting', emoji: '🏋️' }, { label: 'Calisthenics', value: 'calisthenics', emoji: '🤸' },
            { label: 'Cardio', value: 'cardio', emoji: '🏃' }, { label: 'Home Gym', value: 'homegym', emoji: '🏠' },
          ]))] })
        await rolesChannel.send({ embeds: [new EmbedBuilder().setColor(C.green).setTitle('🔔  Notification Preferences')],
          components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('notif_roles').setPlaceholder('🔔 Select pings...').setMinValues(1).setMaxValues(3).addOptions([
            { label: 'App Updates', value: 'updates', emoji: '📱' }, { label: 'Events', value: 'events', emoji: '🏆' }, { label: 'Giveaways', value: 'giveaways', emoji: '🎁' },
          ]))] })
        log('  🎭 Role menus')
      } else log('  ⏭️  get-roles (exists)')
    } catch {}
  }

  // Introductions
  if (await postIfEmpty(CH['👋│introductions'], { embeds: [new EmbedBuilder().setColor(C.green).setTitle('👋  Introduce Yourself!').setDescription('```\n🏷️ Name:\n🎂 Age:\n🏋️ Training style:\n🎯 Goals:\n💪 Favorite exercise:\n📱 REPMAX username:\n```')] })) log('  👋 Intro template')

  // Training
  if (await postIfEmpty(CH['📝│workout-logs'], { embeds: [img(new EmbedBuilder().setColor(C.orange), IMAGES.training).setTitle('📝  Workout Log Channel').setDescription('Share your workouts!\n```\n📅 Date: April 6\n🏋️ Split: Push Day\n1. Bench Press — 4×8 @ 185lbs\n2. Incline DB — 3×10 @ 65lbs\n⏱️ Duration: 62 min\n🔥 Feeling: 9/10\n```')] })) log('  📝 Workout template')
  if (await postIfEmpty(CH['🎥│form-checks'], { embeds: [new EmbedBuilder().setColor(C.orange).setTitle('🎥  Form Check Guidelines').setDescription('Include: exercise, weight, reps, angle.\n\n✅ Be constructive\n❌ Not rude\n🎯 Focus on 1-2 fixes')] })) log('  🎥 Form checks')
  if (await postIfEmpty(CH['🏆│personal-records'], { embeds: [new EmbedBuilder().setColor(C.gold).setTitle('🏆  PR Zone!').setDescription('Hit a PR? POST IT! 🎉\n```\n🏆 Bench Press\n⚖️ 225 lbs (1RM)\n📈 Previous: 215 lbs\n💪 +10 lbs!\n```\nEvery PR matters! 🔥')] })) log('  🏆 PR template')

  // Nutrition
  if (await postIfEmpty(CH['🍳│meal-prep'], { embeds: [img(new EmbedBuilder().setColor(C.green), IMAGES.nutrition).setTitle('🍳  Meal Prep').setDescription('```\n📅 Week of: April 6\n🎯 Bulking (3200 cal)\nBreakfast: Oats + protein\nLunch: Chicken, rice, broccoli\nDinner: Salmon, sweet potato\n📊 200P / 350C / 90F\n```')] })) log('  🍳 Meal prep')

  // Progress
  if (await postIfEmpty(CH['📈│transformations'], { embeds: [img(new EmbedBuilder().setColor(C.gold), IMAGES.progress).setTitle('📈  Transformations').setDescription('Share your journey!\n> 📅 Timeline\n> ⚖️ Start → Current\n> 🏋️ Training style\n> 💡 Key lessons\n\n*Every journey is valid. 💪*')] })) log('  📈 Transformations')

  // PRO
  if (await postIfEmpty(CH['💎│pro-chat'], { embeds: [img(new EmbedBuilder().setColor(C.amber), IMAGES.pro).setTitle('💎  PRO Lounge').setDescription('**Welcome, PRO member!**\n\n> 🧠 Advanced coaching\n> ⚔️ Weekly challenges\n> 💬 Focused community\n> 🎙️ PRO voice\n\nThank you for supporting REPMAX! 👑')] })) log('  💎 PRO lounge')

  // Support
  if (await postIfEmpty(CH['🐛│bug-reports'], { embeds: [img(new EmbedBuilder().setColor(C.red), IMAGES.support).setTitle('🐛  Bug Reports').setDescription('```\n🐛 Bug: [description]\n📱 Device: [phone/browser]\n📋 Steps: 1. 2. 3.\n📸 Screenshot: [attach]\n```')] })) log('  🐛 Bugs')
  if (await postIfEmpty(CH['💡│feature-requests'], { embeds: [new EmbedBuilder().setColor(C.purple).setTitle('💡  Feature Requests').setDescription('```\n💡 Feature: [name]\n📝 Description: [what]\n🎯 Why: [benefit]\n```\n👍 React to support ideas!')] })) log('  💡 Features')

  // Tickets
  const ticketCh = CH['🎫│create-ticket']
  if (ticketCh) {
    try {
      const msgs = await ticketCh.messages.fetch({ limit: 1 })
      if (msgs.size === 0) {
        await ticketCh.send({ embeds: [new EmbedBuilder().setColor(C.purple).setTitle('🎫  Support Tickets').setDescription('Need private help? Click below.\n\n> 🔒 Account issues\n> 🛡️ Report a user\n> 💎 PRO help\n> 🐛 Complex bugs')],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Create Ticket').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('create_ticket_urgent').setLabel('🚨 Urgent').setStyle(ButtonStyle.Danger),
          )] })
        log('  🎫 Ticket system')
      } else log('  ⏭️  tickets (exists)')
    } catch {}
  }

  // Motivation
  const motivCh = CH['🔥│motivation']
  if (motivCh) {
    try {
      const msgs = await motivCh.messages.fetch({ limit: 1 })
      if (msgs.size === 0) {
        for (const q of ['"The only bad workout is the one that didn\'t happen." 💪', '"Discipline is choosing between what you want now and what you want most." 🎯', '"Your body can stand almost anything. It\'s your mind you have to convince." 🧠']) {
          await motivCh.send({ content: q }); await sleep(500)
        }
        log('  🔥 Motivation')
      } else log('  ⏭️  motivation (exists)')
    } catch {}
  }

  // Playlist
  if (await postIfEmpty(CH['🎵│pump-playlist'], { embeds: [new EmbedBuilder().setColor(C.accent).setTitle('🎵  Pump Playlist').setDescription('**Staff Picks:**\n> 🔥 Lose Yourself — Eminem\n> 🔥 Till I Collapse — Eminem\n> 🔥 Stronger — Kanye\n> 🔥 Eye of the Tiger — Survivor\n\nShare yours below! 🎶')] })) log('  🎵 Playlist')

  // General + Staff
  if (await postIfEmpty(CH['💬│general-chat'], { content: '🏋️ **Welcome to REPMAX!** What are you training today? 💪' })) log('  💬 General starter')
  if (await postIfEmpty(CH['💬│staff-chat'], { embeds: [new EmbedBuilder().setColor(C.red).setTitle('🔒  Staff HQ').setDescription('> 📋 #mod-logs — Action logs\n> 📊 #analytics — Stats\n> 🤖 #bot-commands — Testing\n\n• Warn before banning\n• Log all actions\n• Be fair and consistent')] })) log('  💬 Staff chat')
}

// ═══════════════════════════════════════════
//  ONBOARDING SETUP
// ═══════════════════════════════════════════
async function setupOnboarding(guild, CH) {
  console.log('\n━━━ ONBOARDING SETUP ━━━')
  try {
    const generalChat = CH['💬│general-chat']
    await guild.edit({ systemChannel: generalChat?.id || null, systemChannelFlags: 0 })

    try {
      const wc = []
      if (CH['📜│rules']) wc.push({ channel: CH['📜│rules'].id, description: '📜 Read the rules first', emoji: '📜' })
      if (CH['🎭│get-roles']) wc.push({ channel: CH['🎭│get-roles'].id, description: '🎭 Pick your fitness goals', emoji: '🎭' })
      if (CH['👋│introductions']) wc.push({ channel: CH['👋│introductions'].id, description: '👋 Introduce yourself!', emoji: '👋' })
      if (generalChat) wc.push({ channel: generalChat.id, description: '💬 Start chatting', emoji: '💬' })
      if (CH['📢│announcements']) wc.push({ channel: CH['📢│announcements'].id, description: '📢 Stay up to date', emoji: '📢' })

      await guild.editWelcomeScreen({
        enabled: true,
        description: 'Welcome to REPMAX! The #1 AI-Powered Fitness Community 🏋️\nFollow the steps below to get started:',
        welcomeChannels: wc,
      })
      log('✅ Welcome screen configured')
    } catch (e) {
      log(`⚠️  Welcome screen requires Community: ${e.message}`)
    }
    log('✅ Onboarding done')
  } catch (e) { log(`⚠️  ${e.message}`) }
}

client.on('error', e => log(`❌ ${e.message}`))
process.on('unhandledRejection', e => log(`❌ ${e?.message || e}`))
client.login(BOT_TOKEN)

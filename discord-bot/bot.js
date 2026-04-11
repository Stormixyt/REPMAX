/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              REPMAX DISCORD BOT — Persistent                 ║
 * ║   Tickets • Roles • Welcome • Moderation • Leveling         ║
 * ║   Status • Logging • Slash Commands • Daily Motivation      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 *   Run this AFTER build-server.js:  node bot.js
 *   Keep it running 24/7 (use pm2 or a VPS)
 */

const { Client, GatewayIntentBits, PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, ActivityType, REST, Routes, SlashCommandBuilder } = require('discord.js')
const fs = require('fs')
const path = require('path')
const { getBotConfig } = require('./config')
const { askRepmaxAI, DEFAULT_MODEL } = require('./repmax-ai')

// ═══════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════
const { BOT_TOKEN, GUILD_ID, GROQ_API_KEY, GROQ_MODEL } = getBotConfig()

const C = {
  accent: 0xCCFF00, gold: 0xFFD700, purple: 0x7C3AED, green: 0x22C55E,
  red: 0xEF4444, blue: 0x3B82F6, orange: 0xFF6B35, amber: 0xF59E0B,
}

// ═══════════════════════════════════════════
//  DATA PERSISTENCE (JSON file)
// ═══════════════════════════════════════════
const DATA_FILE = path.join(__dirname, 'bot-data.json')

function withDataDefaults(raw = {}) {
  return {
    xp: raw.xp || {},
    warnings: raw.warnings || {},
    afk: raw.afk || {},
    changelogPosts: raw.changelogPosts || {},
  }
}

function loadData() {
  try {
    return withDataDefaults(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')))
  } catch {
    return withDataDefaults()
  }
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(withDataDefaults(data), null, 2))
}

let botData = loadData()
const aiCooldowns = new Map()

// ═══════════════════════════════════════════
//  XP / LEVELING SYSTEM
// ═══════════════════════════════════════════
function getLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp)) }
function xpForLevel(level) { return (level / 0.1) ** 2 }

function addXP(userId, amount) {
  if (!botData.xp[userId]) botData.xp[userId] = 0
  const oldLevel = getLevel(botData.xp[userId])
  botData.xp[userId] += amount
  const newLevel = getLevel(botData.xp[userId])
  saveData(botData)
  return newLevel > oldLevel ? newLevel : null
}

// ═══════════════════════════════════════════
//  MOTIVATION QUOTES
// ═══════════════════════════════════════════
const QUOTES = [
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "Your body can stand almost anything. It's your mind you have to convince.", author: "Unknown" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Arnold Schwarzenegger" },
  { text: "Strength doesn't come from what you can do. It comes from overcoming what you thought you couldn't.", author: "Rikki Rogers" },
  { text: "Success isn't always about greatness. It's about consistency.", author: "Dwayne Johnson" },
  { text: "The last three or four reps is what makes the muscle grow.", author: "Arnold Schwarzenegger" },
  { text: "You don't have to be extreme, just consistent.", author: "Unknown" },
  { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
  { text: "Champions aren't made in gyms. Champions are made from something deep inside them.", author: "Muhammad Ali" },
  { text: "The clock is ticking. Are you becoming the person you want to be?", author: "Greg Plitt" },
  { text: "If it doesn't challenge you, it doesn't change you.", author: "Fred DeVito" },
  { text: "Excuses don't burn calories.", author: "Unknown" },
  { text: "Fall in love with taking care of yourself.", author: "Unknown" },
]

// ═══════════════════════════════════════════
//  CLIENT
// ═══════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
  ]
})

const log = msg => console.log(`  [${new Date().toLocaleTimeString()}] ${msg}`)

// ═══════════════════════════════════════════
//  SLASH COMMANDS REGISTRATION
// ═══════════════════════════════════════════
const commands = [
  new SlashCommandBuilder().setName('help').setDescription('List all REPMAX bot commands'),
  new SlashCommandBuilder().setName('profile').setDescription('View your REPMAX profile').addUserOption(o => o.setName('user').setDescription('User to view')),
  new SlashCommandBuilder().setName('leaderboard').setDescription('View the XP leaderboard'),
  new SlashCommandBuilder().setName('streak').setDescription('Check your activity streak'),
  new SlashCommandBuilder().setName('motivation').setDescription('Get a random motivation quote'),
  new SlashCommandBuilder().setName('workout').setDescription('Get a quick workout suggestion').addStringOption(o => o.setName('type').setDescription('Workout type').addChoices(
    { name: 'Push', value: 'push' }, { name: 'Pull', value: 'pull' }, { name: 'Legs', value: 'legs' }, { name: 'Full Body', value: 'full' }, { name: 'Core', value: 'core' },
  )),
  new SlashCommandBuilder().setName('afk').setDescription('Set yourself as AFK').addStringOption(o => o.setName('reason').setDescription('Why you\'re AFK')),
  new SlashCommandBuilder().setName('warn').setDescription('Warn a user (Staff only)').addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder().setName('serverinfo').setDescription('View server statistics'),
  new SlashCommandBuilder().setName('app').setDescription('Get the REPMAX app link'),
  new SlashCommandBuilder()
    .setName('changelog')
    .setDescription('Post a REPMAX update in the changelog channel (Admin only)')
    .addStringOption(o => o.setName('version').setDescription('Version label, for example 4.2').setRequired(true))
    .addStringOption(o => o.setName('headline').setDescription('Short summary line for the update').setRequired(true))
    .addStringOption(o => o.setName('new_1').setDescription('First new feature or improvement'))
    .addStringOption(o => o.setName('new_2').setDescription('Second new feature or improvement'))
    .addStringOption(o => o.setName('new_3').setDescription('Third new feature or improvement'))
    .addStringOption(o => o.setName('new_4').setDescription('Fourth new feature or improvement'))
    .addStringOption(o => o.setName('fix_1').setDescription('First bug fix'))
    .addStringOption(o => o.setName('fix_2').setDescription('Second bug fix'))
    .addStringOption(o => o.setName('fix_3').setDescription('Third bug fix'))
    .addStringOption(o => o.setName('fix_4').setDescription('Fourth bug fix'))
    .addBooleanOption(o => o.setName('ping_updates').setDescription('Ping the App Updates role')),
  new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Ask the REPMAX AI about the app, training, or getting started')
    .addStringOption(o => o.setName('question').setDescription('What do you want to ask?').setRequired(true))
    .addBooleanOption(o => o.setName('private').setDescription('Only show the reply to you')),
]

function normalizeChangelogVersion(version = '') {
  return version.trim().replace(/^v/i, '').trim()
}

function getChangelogChannel(guild) {
  return guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.includes('changelog'))
}

function getUpdatesRole(guild) {
  return guild.roles.cache.find(r => r.name === NOTIF_MAP.updates || r.name.toLowerCase().includes('app updates'))
}

function bulletList(items = []) {
  return items.filter(Boolean).map(item => `• ${item}`).join('\n')
}

function buildChangelogEmbed({ version, headline, newItems, fixItems, authorTag }) {
  const embed = new EmbedBuilder()
    .setColor(C.green)
    .setTitle(`📰 REPMAX v${version} — Latest Update`)
    .setDescription(headline)
    .setTimestamp()
    .setFooter({ text: `Posted by ${authorTag} • More updates coming soon! 🚀` })

  if (newItems.length) {
    embed.addFields({ name: '🆕 What\'s New', value: bulletList(newItems), inline: false })
  }

  if (fixItems.length) {
    embed.addFields({ name: '🐛 Bug Fixes', value: bulletList(fixItems), inline: false })
  }

  return embed
}

function buildInviteUrl(applicationId) {
  const params = new URLSearchParams({
    client_id: applicationId,
    scope: 'bot applications.commands',
    permissions: PermissionsBitField.Flags.Administrator.toString(),
  })
  return `https://discord.com/oauth2/authorize?${params.toString()}`
}

async function registerCommands(applicationId) {
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN)
  try {
    await rest.put(Routes.applicationGuildCommands(applicationId, GUILD_ID), { body: commands.map(c => c.toJSON()) })
    log(`✅ Slash commands registered (${commands.length})`)
  } catch (e) { log(`⚠️  Commands: ${e.message}`) }
}

// ═══════════════════════════════════════════
//  QUICK WORKOUTS
// ═══════════════════════════════════════════
const WORKOUTS = {
  push: { title: '💪 Push Day', exercises: ['Bench Press 4×8', 'Overhead Press 3×10', 'Incline DB Press 3×10', 'Lateral Raises 4×15', 'Tricep Pushdowns 3×12', 'Cable Flys 3×12'] },
  pull: { title: '🏋️ Pull Day', exercises: ['Barbell Rows 4×8', 'Pull-Ups 3×max', 'Face Pulls 4×15', 'Barbell Curls 3×10', 'Hammer Curls 3×12', 'Lat Pulldowns 3×10'] },
  legs: { title: '🦵 Leg Day', exercises: ['Squats 4×8', 'Romanian Deadlifts 3×10', 'Leg Press 3×12', 'Walking Lunges 3×10/leg', 'Leg Curls 3×12', 'Calf Raises 4×15'] },
  full: { title: '🔥 Full Body', exercises: ['Squats 3×8', 'Bench Press 3×8', 'Barbell Rows 3×8', 'Overhead Press 3×10', 'Pull-Ups 3×max', 'Planks 3×60s'] },
  core: { title: '🧱 Core Day', exercises: ['Hanging Leg Raises 3×12', 'Cable Woodchops 3×15', 'Ab Rollouts 3×10', 'Russian Twists 3×20', 'Planks 3×60s', 'Dead Bugs 3×12/side'] },
}

// ═══════════════════════════════════════════
//  ROLE MAPS
// ═══════════════════════════════════════════
const GOAL_MAP = { muscle: '💪 Muscle Building', weightloss: '🔥 Weight Loss', powerlifting: '🏋️ Powerlifting', calisthenics: '🤸 Calisthenics', cardio: '🏃 Cardio', homegym: '🏠 Home Gym' }
const NOTIF_MAP = { updates: '📱 App Updates', events: '🏆 Events', giveaways: '🎁 Giveaways' }

// ═══════════════════════════════════════════
//  BOT READY
// ═══════════════════════════════════════════
client.once('ready', async () => {
  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║       REPMAX BOT — Online & Operational       ║')
  console.log('╚══════════════════════════════════════════════╝\n')
  log(`✅ ${client.user.tag} is online!`)

  await client.application?.fetch()
  const applicationId = client.application?.id
  if (!applicationId) {
    throw new Error('Could not resolve Discord application ID for slash command registration.')
  }

  // Register slash commands
  await registerCommands(applicationId)
  log(`🔗 Install / refresh commands: ${buildInviteUrl(applicationId)}`)

  // Rotating status
  const statuses = [
    { name: 'your gains 💪', type: ActivityType.Watching },
    { name: 'rep-max.app', type: ActivityType.Playing },
    { name: 'workout logs 📝', type: ActivityType.Listening },
    { name: `${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)} athletes`, type: ActivityType.Watching },
    { name: 'PRs being crushed 🏆', type: ActivityType.Watching },
    { name: '/motivation for quotes', type: ActivityType.Playing },
  ]
  let statusIdx = 0
  setInterval(() => {
    client.user.setPresence({ activities: [statuses[statusIdx % statuses.length]], status: 'online' })
    statusIdx++
  }, 30000)

  // Daily motivation at 8 AM
  scheduleDailyMotivation()

  log('🤖 All systems operational!')
  log('   Listening for: tickets, roles, commands, XP, welcome, moderation')
})

// ═══════════════════════════════════════════
//  SLASH COMMAND HANDLER
// ═══════════════════════════════════════════
client.on(Events.InteractionCreate, async interaction => {
  // ── SLASH COMMANDS ──
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction

    if (commandName === 'help') {
      const e = new EmbedBuilder().setColor(C.accent)
        .setTitle('🤖 REPMAX Bot Commands')
        .setDescription([
          '`/help` - show every command',
          '`/profile` - view XP, level, warnings, roles',
          '`/leaderboard` - server XP leaderboard',
          '`/streak` - quick activity check',
          '`/motivation` - random motivation quote',
          '`/workout` - quick workout suggestion',
          '`/afk` - set your AFK status',
          '`/warn` - staff warning command',
          '`/serverinfo` - current server stats',
          '`/app` - open the REPMAX app',
          '`/changelog` - publish a changelog update (admin only)',
          '`/ai` - ask the REPMAX AI about the app or training',
        ].join('\n'))
        .setFooter({ text: 'If commands are missing, re-invite the bot with applications.commands scope.' })
      await interaction.reply({ embeds: [e], ephemeral: true })
    }

    else if (commandName === 'profile') {
      const user = interaction.options.getUser('user') || interaction.user
      const xp = botData.xp[user.id] || 0
      const level = getLevel(xp)
      const nextLevelXP = xpForLevel(level + 1)
      const progress = Math.floor((xp / nextLevelXP) * 100)
      const warnings = (botData.warnings[user.id] || []).length
      const member = await interaction.guild.members.fetch(user.id).catch(() => null)

      const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10))

      const e = new EmbedBuilder().setColor(C.accent)
        .setTitle(`${user.username}'s Profile`)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: '📊 Level', value: `**${level}**`, inline: true },
          { name: '✨ XP', value: `**${xp}** / ${Math.floor(nextLevelXP)}`, inline: true },
          { name: '⚠️ Warnings', value: `${warnings}/3`, inline: true },
          { name: '📈 Progress', value: `\`${bar}\` ${progress}%`, inline: false },
          { name: '📅 Joined', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
          { name: '🎭 Roles', value: member ? member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString()).slice(0, 10).join(' ') || 'None' : 'Unknown', inline: false },
        )
        .setFooter({ text: 'REPMAX • Train. Track. Dominate.' })
      await interaction.reply({ embeds: [e] })
    }

    else if (commandName === 'leaderboard') {
      const sorted = Object.entries(botData.xp).sort((a, b) => b[1] - a[1]).slice(0, 10)
      const medals = ['🥇', '🥈', '🥉']
      let desc = ''
      for (let i = 0; i < sorted.length; i++) {
        const [userId, xp] = sorted[i]
        const lvl = getLevel(xp)
        desc += `${medals[i] || `**${i + 1}.**`} <@${userId}> — Level **${lvl}** (${xp} XP)\n`
      }
      const e = new EmbedBuilder().setColor(C.gold).setTitle('🏆  XP Leaderboard').setDescription(desc || 'No data yet. Start chatting!').setFooter({ text: 'Earn XP by being active!' })
      await interaction.reply({ embeds: [e] })
    }

    else if (commandName === 'streak') {
      const xp = botData.xp[interaction.user.id] || 0
      const level = getLevel(xp)
      const e = new EmbedBuilder().setColor(C.orange)
        .setTitle(`🔥 ${interaction.user.username}'s Activity`)
        .setDescription(`You're at **Level ${level}** with **${xp} XP**.\n\nKeep chatting and sharing workouts to level up! Every message = XP. 💪`)
        .setFooter({ text: 'Use /profile for full stats' })
      await interaction.reply({ embeds: [e], ephemeral: true })
    }

    else if (commandName === 'motivation') {
      const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)]
      const e = new EmbedBuilder().setColor(C.accent)
        .setTitle('💪  Daily Motivation')
        .setDescription(`> *"${quote.text}"*\n> — ${quote.author}`)
        .setFooter({ text: 'REPMAX • Train. Track. Dominate.' })
      await interaction.reply({ embeds: [e] })
    }

    else if (commandName === 'workout') {
      const type = interaction.options.getString('type') || ['push', 'pull', 'legs', 'full', 'core'][Math.floor(Math.random() * 5)]
      const w = WORKOUTS[type]
      const e = new EmbedBuilder().setColor(C.orange)
        .setTitle(w.title)
        .setDescription(w.exercises.map((ex, i) => `**${i + 1}.** ${ex}`).join('\n'))
        .setFooter({ text: 'Open REPMAX for personalized AI workouts! 🤖' })
      await interaction.reply({ embeds: [e] })
    }

    else if (commandName === 'afk') {
      const reason = interaction.options.getString('reason') || 'AFK'
      botData.afk[interaction.user.id] = { reason, since: Date.now() }
      saveData(botData)
      await interaction.reply({ content: `💤 ${interaction.user} is now AFK: **${reason}**` })
    }

    else if (commandName === 'warn') {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
        return interaction.reply({ content: '❌ Staff only.', ephemeral: true })
      }

      await interaction.deferReply({ ephemeral: true })

      try {
        const target = interaction.options.getUser('user', true)
        const reason = interaction.options.getString('reason', true)

        if (!botData.warnings[target.id]) botData.warnings[target.id] = []
        botData.warnings[target.id].push({ reason, by: interaction.user.id, date: Date.now() })
        saveData(botData)

        const count = botData.warnings[target.id].length
        let dmDelivered = false

        const userDmEmbed = new EmbedBuilder()
          .setColor(C.red)
          .setTitle('⚠️ You received a warning in REPMAX')
          .addFields(
            { name: 'Server', value: interaction.guild?.name || 'REPMAX', inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Warning count', value: `${count}/3`, inline: true },
            { name: 'Reason', value: reason, inline: false },
          )
          .setFooter({ text: count >= 3 ? 'You have reached 3 warnings. Contact staff if you think this was a mistake.' : 'Please fix the issue and avoid more warnings.' })

        try {
          await target.send({ embeds: [userDmEmbed] })
          dmDelivered = true
        } catch {}

        const e = new EmbedBuilder().setColor(C.red)
          .setTitle('⚠️  Warning Issued')
          .addFields(
            { name: 'User', value: `${target}`, inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Total Warnings', value: `${count}/3`, inline: true },
            { name: 'User notified', value: dmDelivered ? 'DM sent' : 'DM failed / closed', inline: true },
          )

        if (count >= 3) {
          e.setFooter({ text: '⚠️ 3 warnings reached — consider a mute/ban' })
        }

        await interaction.editReply({ embeds: [e] })

        const modLogs = interaction.guild.channels.cache.find(c => c.name.includes('mod-logs'))
        if (modLogs) {
          await modLogs.send({ embeds: [e] }).catch(() => {})
        }
      } catch (error) {
        await interaction.editReply({
          content: `❌ Warn failed: ${error.message}`,
        })
      }
    }

    else if (commandName === 'serverinfo') {
      const guild = interaction.guild
      const e = new EmbedBuilder().setColor(C.accent)
        .setTitle(`📊  ${guild.name}`)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .addFields(
          { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
          { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
          { name: '🎨 Roles', value: `${guild.roles.cache.size}`, inline: true },
          { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
          { name: '🔒 Verification', value: ['None', 'Low', 'Medium', 'High', 'Highest'][guild.verificationLevel], inline: true },
        )
      await interaction.reply({ embeds: [e] })
    }

    else if (commandName === 'app') {
      const e = new EmbedBuilder().setColor(C.accent)
        .setTitle('📱  REPMAX — AI Fitness Tracker')
        .setDescription('🤖 AI workouts • 📊 Smart tracking • 💬 Social gym\n\n**100% free. Install on any device.**')
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('🔗 Open App').setStyle(ButtonStyle.Link).setURL('https://www.rep-max.app/app'),
        new ButtonBuilder().setLabel('💎 Get PRO').setStyle(ButtonStyle.Link).setURL('https://www.rep-max.app/subscribe'),
      )
      await interaction.reply({ embeds: [e], components: [row] })
    }

    else if (commandName === 'changelog') {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ content: '❌ Admin only.', ephemeral: true })
      }

      await interaction.deferReply({ ephemeral: true })

      try {
        const version = normalizeChangelogVersion(interaction.options.getString('version', true))
        const versionKey = version.toLowerCase()
        const headline = interaction.options.getString('headline', true).trim()
        const newItems = ['new_1', 'new_2', 'new_3', 'new_4']
          .map(key => interaction.options.getString(key))
          .filter(Boolean)
          .map(item => item.trim())
        const fixItems = ['fix_1', 'fix_2', 'fix_3', 'fix_4']
          .map(key => interaction.options.getString(key))
          .filter(Boolean)
          .map(item => item.trim())
        const pingUpdates = interaction.options.getBoolean('ping_updates') ?? false

        if (!version) {
          throw new Error('Version is required.')
        }

        if (!headline) {
          throw new Error('Headline is required.')
        }

        if (!newItems.length && !fixItems.length) {
          throw new Error('Add at least one new item or one bug fix.')
        }

        if (botData.changelogPosts[versionKey]) {
          throw new Error(`v${version} has already been posted in changelogs.`)
        }

        const changelogChannel = getChangelogChannel(interaction.guild)
        if (!changelogChannel) {
          throw new Error('Could not find the changelog channel.')
        }

        const updatesRole = pingUpdates ? getUpdatesRole(interaction.guild) : null
        const embed = buildChangelogEmbed({
          version,
          headline,
          newItems,
          fixItems,
          authorTag: interaction.user.tag,
        })

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('📱 Open REPMAX').setStyle(ButtonStyle.Link).setURL('https://www.rep-max.app'),
          new ButtonBuilder().setLabel('🚀 Open App').setStyle(ButtonStyle.Link).setURL('https://www.rep-max.app/app'),
        )

        const sent = await changelogChannel.send({
          content: updatesRole ? `${updatesRole}` : undefined,
          allowedMentions: updatesRole ? { roles: [updatesRole.id] } : { parse: [] },
          embeds: [embed],
          components: [row],
        })

        botData.changelogPosts[versionKey] = {
          version,
          headline,
          newItems,
          fixItems,
          postedBy: interaction.user.id,
          messageId: sent.id,
          channelId: sent.channelId,
          postedAt: new Date().toISOString(),
        }
        saveData(botData)

        await interaction.editReply({
          content: `✅ Posted REPMAX v${version} in ${changelogChannel}${updatesRole ? ` and pinged ${updatesRole}` : ''}.\n${sent.url}`,
        })
      } catch (error) {
        await interaction.editReply({
          content: `❌ Changelog failed: ${error.message}`,
        })
      }
    }

    else if (commandName === 'ai') {
      const question = interaction.options.getString('question', true)
      const privateReply = interaction.options.getBoolean('private') ?? false
      const now = Date.now()
      const cooldownUntil = aiCooldowns.get(interaction.user.id) || 0

      if (cooldownUntil > now) {
        const secondsLeft = Math.ceil((cooldownUntil - now) / 1000)
        return interaction.reply({
          content: `⏳ Slow down for ${secondsLeft}s and then ask again.`,
          ephemeral: true,
        })
      }

      aiCooldowns.set(interaction.user.id, now + 8000)
      await interaction.deferReply({ ephemeral: privateReply })

      try {
        const answer = await askRepmaxAI({
          apiKey: GROQ_API_KEY,
          model: GROQ_MODEL || DEFAULT_MODEL,
          question,
          username: interaction.user.username,
        })

        const e = new EmbedBuilder()
          .setColor(C.accent)
          .setTitle('🧠 REPMAX AI')
          .setDescription(answer)
          .setFooter({ text: 'Public product info only — no private/internal data.' })

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('📱 Open REPMAX').setStyle(ButtonStyle.Link).setURL('https://www.rep-max.app'),
          new ButtonBuilder().setLabel('💬 Join Discord').setStyle(ButtonStyle.Link).setURL('https://discord.gg/repmax'),
        )

        await interaction.editReply({ embeds: [e], components: [row] })
      } catch (error) {
        await interaction.editReply({
          content: `❌ AI command failed: ${error.message}`,
        })
      } finally {
        setTimeout(() => aiCooldowns.delete(interaction.user.id), 8000)
      }
    }
  }

  // ── BUTTON: TICKETS ──
  if (interaction.isButton()) {
    if (interaction.customId === 'create_ticket' || interaction.customId === 'create_ticket_urgent') {
      const guild = interaction.guild
      const member = interaction.member
      const isUrgent = interaction.customId === 'create_ticket_urgent'
      const safeName = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')

      const existing = guild.channels.cache.find(c => c.name.includes(`ticket-${safeName}`) && !c.name.startsWith('closed'))
      if (existing) return interaction.reply({ content: `❌ You already have an open ticket: ${existing}`, ephemeral: true })

      const ticketsCategory = guild.channels.cache.find(c => c.name === '🎫 TICKETS' && c.type === ChannelType.GuildCategory)
      try {
        const ovr = [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
        ]
        for (const rn of ['🛡️ Moderator', '⚡ Admin', '👑 Owner']) {
          const role = guild.roles.cache.find(r => r.name === rn)
          if (role) ovr.push({ id: role.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages] })
        }

        const ch = await guild.channels.create({
          name: `${isUrgent ? '🚨' : '🎫'}ticket-${safeName}`,
          type: ChannelType.GuildText,
          parent: ticketsCategory?.id || null,
          topic: `Ticket for ${member.user.tag} • ${new Date().toLocaleDateString()}`,
          permissionOverwrites: ovr,
        })

        await ch.send({ embeds: [new EmbedBuilder().setColor(isUrgent ? C.red : C.purple)
          .setTitle(`${isUrgent ? '🚨 URGENT' : '🎫'} Support Ticket`)
          .setDescription(`Hey ${member}! Staff will be with you shortly.\n\n**Describe your issue:**\n> • What happened?\n> • Steps to reproduce\n> • Screenshots\n\n*Opened ${new Date().toLocaleString()}*`)
          .setFooter({ text: 'Click Close when resolved' })],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('delete_ticket').setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger),
          )] })

        await interaction.reply({ content: `✅ Ticket created: ${ch}`, ephemeral: true })

        // Log
        const modLogs = guild.channels.cache.find(c => c.name.includes('mod-logs'))
        if (modLogs) await modLogs.send({ embeds: [new EmbedBuilder().setColor(C.blue).setTitle('🎫 Ticket Created').setDescription(`${member.user.tag} opened a ${isUrgent ? 'URGENT ' : ''}ticket`).setTimestamp()] })
      } catch (e) {
        await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true })
      }
    }

    if (interaction.customId === 'close_ticket') {
      const ch = interaction.channel
      if (!ch.name.includes('ticket-')) return
      await ch.send({ content: `🔒 Closed by ${interaction.user.tag}` })
      try { await ch.setName(`closed-${ch.name.replace(/^(🚨|🎫)/, '')}`) } catch {}
      await interaction.reply({ content: '✅ Ticket closed.', ephemeral: true })
    }

    if (interaction.customId === 'delete_ticket') {
      if (!interaction.channel.name.includes('ticket-')) return
      await interaction.reply({ content: '🗑️ Deleting in 3s...' })
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000)
    }
  }

  // ── SELECT MENU: ROLES ──
  if (interaction.isStringSelectMenu()) {
    const member = interaction.member
    const guild = interaction.guild
    const map = interaction.customId === 'goal_roles' ? GOAL_MAP : NOTIF_MAP
    const allNames = Object.values(map)
    const selected = interaction.values.map(v => map[v]).filter(Boolean)

    for (const rn of allNames) { const r = guild.roles.cache.find(x => x.name === rn); if (r && member.roles.cache.has(r.id)) try { await member.roles.remove(r) } catch {} }
    const added = []
    for (const rn of selected) { const r = guild.roles.cache.find(x => x.name === rn); if (r) { try { await member.roles.add(r); added.push(rn) } catch {} } }

    await interaction.reply({ content: `✅ Roles: ${added.join(', ') || 'None'}`, ephemeral: true })
  }
})

// ═══════════════════════════════════════════
//  MESSAGE HANDLER (XP, AFK, Auto-mod)
// ═══════════════════════════════════════════
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return

  // ── XP SYSTEM ──
  const newLevel = addXP(message.author.id, Math.floor(Math.random() * 5) + 1)
  if (newLevel) {
    const e = new EmbedBuilder().setColor(C.accent)
      .setTitle('🎉  Level Up!')
      .setDescription(`${message.author} reached **Level ${newLevel}**! 💪`)
      .setFooter({ text: 'Keep chatting to earn more XP!' })
    await message.channel.send({ embeds: [e] })

    // Auto-role upgrades
    const guild = message.guild
    const member = message.member
    if (newLevel >= 5 && !member.roles.cache.find(r => r.name === '💪 Member')) {
      const role = guild.roles.cache.find(r => r.name === '💪 Member')
      if (role) try { await member.roles.add(role); await message.channel.send({ content: `🎉 ${member} earned the **💪 Member** role!` }) } catch {}
    }
    if (newLevel >= 15 && !member.roles.cache.find(r => r.name === '✅ Verified')) {
      const role = guild.roles.cache.find(r => r.name === '✅ Verified')
      if (role) try { await member.roles.add(role); await message.channel.send({ content: `🎉 ${member} earned the **✅ Verified** role!` }) } catch {}
    }
  }

  // ── AFK CHECK ──
  // Remove AFK if the user speaks
  if (botData.afk[message.author.id]) {
    delete botData.afk[message.author.id]
    saveData(botData)
    await message.reply({ content: '👋 Welcome back! Your AFK has been removed.', allowedMentions: { repliedUser: false } }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000))
  }

  // Notify if mentioning an AFK user
  for (const mentioned of message.mentions.users.values()) {
    if (botData.afk[mentioned.id]) {
      const afk = botData.afk[mentioned.id]
      const ago = Math.floor((Date.now() - afk.since) / 60000)
      await message.reply({ content: `💤 **${mentioned.username}** is AFK: *${afk.reason}* (${ago}m ago)`, allowedMentions: { repliedUser: false } })
    }
  }

  // ── AUTO-MOD: Spam detection (5+ messages in 5s) ──
  // Simple rate limit per user
  if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    const key = `spam_${message.author.id}`
    if (!client[key]) client[key] = []
    client[key].push(Date.now())
    client[key] = client[key].filter(t => Date.now() - t < 5000)
    if (client[key].length >= 5) {
      try {
        await message.member.timeout(60000, 'Auto-mod: spam detected')
        await message.channel.send({ content: `⚠️ ${message.author} has been timed out for 1 minute (spam).` })
        const modLogs = message.guild.channels.cache.find(c => c.name.includes('mod-logs'))
        if (modLogs) await modLogs.send({ embeds: [new EmbedBuilder().setColor(C.red).setTitle('🤖 Auto-Mod: Spam').setDescription(`${message.author.tag} was timed out for spam in ${message.channel}`).setTimestamp()] })
      } catch {}
      client[key] = []
    }
  }
})

// ═══════════════════════════════════════════
//  WELCOME + GOODBYE
// ═══════════════════════════════════════════
client.on(Events.GuildMemberAdd, async member => {
  const newbieRole = member.guild.roles.cache.find(r => r.name === '🆕 Newbie')
  if (newbieRole) try { await member.roles.add(newbieRole) } catch {}

  const welcomeCh = member.guild.channels.cache.find(c => c.name.includes('welcome') && c.type === ChannelType.GuildText)
  if (welcomeCh) {
    const e = new EmbedBuilder().setColor(C.accent)
      .setTitle(`Welcome, ${member.user.username}! 🏋️`)
      .setDescription(`Hey ${member}! Welcome to **REPMAX**.\n\n> 📜 Read the rules\n> 🎭 Get your roles\n> 👋 Introduce yourself\n> 💬 Start chatting!\n\nYou're member **#${member.guild.memberCount}**! 🎉`)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: 'Train. Track. Dominate.' })
    await welcomeCh.send({ embeds: [e] })
  }
})

client.on(Events.GuildMemberRemove, async member => {
  const modLogs = member.guild.channels.cache.find(c => c.name.includes('mod-logs'))
  if (modLogs) {
    await modLogs.send({ embeds: [new EmbedBuilder().setColor(C.red).setTitle('👋 Member Left').setDescription(`**${member.user.tag}** left the server.\nMembers: ${member.guild.memberCount}`).setTimestamp()] })
  }
})

// ═══════════════════════════════════════════
//  MESSAGE DELETE LOG
// ═══════════════════════════════════════════
client.on(Events.MessageDelete, async message => {
  if (message.author?.bot) return
  const modLogs = message.guild?.channels.cache.find(c => c.name.includes('mod-logs'))
  if (modLogs && message.content) {
    await modLogs.send({ embeds: [new EmbedBuilder().setColor(0xFFA500).setTitle('🗑️ Message Deleted')
      .addFields({ name: 'Author', value: message.author?.tag || 'Unknown', inline: true }, { name: 'Channel', value: `${message.channel}`, inline: true }, { name: 'Content', value: message.content.slice(0, 1000) || '[embed/attachment]', inline: false })
      .setTimestamp()] })
  }
})

// ═══════════════════════════════════════════
//  DAILY MOTIVATION (8 AM)
// ═══════════════════════════════════════════
function scheduleDailyMotivation() {
  const now = new Date()
  const target = new Date(now)
  target.setHours(8, 0, 0, 0)
  if (now >= target) target.setDate(target.getDate() + 1)
  const ms = target - now

  setTimeout(() => {
    postDailyMotivation()
    setInterval(postDailyMotivation, 24 * 60 * 60 * 1000)
  }, ms)

  log(`⏰ Daily motivation scheduled (next: ${target.toLocaleString()})`)
}

async function postDailyMotivation() {
  const guild = client.guilds.cache.get(GUILD_ID)
  if (!guild) return
  const motivCh = guild.channels.cache.find(c => c.name.includes('motivation') && c.type === ChannelType.GuildText)
  if (!motivCh) return

  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)]
  const e = new EmbedBuilder().setColor(C.accent)
    .setTitle('☀️  Good Morning REPMAX!')
    .setDescription(`> *"${quote.text}"*\n> — ${quote.author}\n\nLet's crush it today! 💪`)
    .setFooter({ text: `Daily Motivation • ${new Date().toLocaleDateString()}` })

  await motivCh.send({ embeds: [e] })
  log('☀️ Daily motivation posted')
}

// ═══════════════════════════════════════════
client.on('error', e => log(`❌ ${e.message}`))
process.on('unhandledRejection', e => log(`❌ ${e?.message || e}`))
client.login(BOT_TOKEN)

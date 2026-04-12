const { EmbedBuilder, SlashCommandBuilder } = require('discord.js')

const MESSAGE_XP_COOLDOWN_MS = 60 * 1000
const DAILY_COOLDOWN_MS = 20 * 60 * 60 * 1000
const DAILY_STREAK_WINDOW_MS = 48 * 60 * 60 * 1000

const PROGRESSION_COMMAND_BUILDERS = [
  new SlashCommandBuilder().setName('rank').setDescription('View a richer rank card').addUserOption(o => o.setName('user').setDescription('User to view')),
  new SlashCommandBuilder().setName('daily').setDescription('Claim your daily XP reward'),
]

function ensureProgressionDefaults(data = {}) {
  return {
    xp: data.xp || {},
    dailyRewards: data.dailyRewards || {},
  }
}

function xpForLevel(level) {
  if (level <= 1) return 0
  return 40 * level * (level - 1)
}

function getLevel(xp = 0) {
  let level = 1
  while (xp >= xpForLevel(level + 1)) {
    level += 1
  }
  return level
}

function getProgressState(xp = 0) {
  const level = getLevel(xp)
  const currentFloor = xpForLevel(level)
  const nextLevelXP = xpForLevel(level + 1)
  const needed = Math.max(1, nextLevelXP - currentFloor)
  const inLevelXp = xp - currentFloor
  const progress = Math.max(0, Math.min(100, Math.floor((inLevelXp / needed) * 100)))
  return {
    level,
    currentFloor,
    nextLevelXP,
    needed,
    inLevelXp,
    remaining: Math.max(0, nextLevelXP - xp),
    progress,
  }
}

function awardXp(data, userId, amount) {
  if (!data.xp[userId]) data.xp[userId] = 0
  const oldLevel = getLevel(data.xp[userId])
  data.xp[userId] += amount
  const newLevel = getLevel(data.xp[userId])

  return {
    xp: data.xp[userId],
    amount,
    oldLevel,
    newLevel,
    leveledUp: newLevel > oldLevel,
    progress: getProgressState(data.xp[userId]),
  }
}

function isQualifyingMessage(message) {
  const trimmed = String(message?.content || '').trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/')) return false
  return trimmed.replace(/\s/g, '').length >= 6
}

function canAwardMessageXp(cooldowns, userId, now = Date.now()) {
  const lastAward = cooldowns.get(userId) || 0
  if (now - lastAward < MESSAGE_XP_COOLDOWN_MS) return false
  cooldowns.set(userId, now)
  return true
}

function getDailyState(data, userId, now = Date.now()) {
  const reward = data.dailyRewards[userId] || { streak: 0, lastClaimAt: 0 }
  const nextClaimAt = reward.lastClaimAt + DAILY_COOLDOWN_MS

  return {
    streak: reward.streak || 0,
    lastClaimAt: reward.lastClaimAt || 0,
    canClaim: !reward.lastClaimAt || now >= nextClaimAt,
    remainingMs: Math.max(0, nextClaimAt - now),
  }
}

function claimDailyReward(data, userId, now = Date.now()) {
  const current = data.dailyRewards[userId] || { streak: 0, lastClaimAt: 0 }
  if (current.lastClaimAt && now < current.lastClaimAt + DAILY_COOLDOWN_MS) {
    return {
      success: false,
      state: getDailyState(data, userId, now),
    }
  }

  const elapsed = current.lastClaimAt ? now - current.lastClaimAt : null
  const nextStreak = !current.lastClaimAt
    ? 1
    : elapsed <= DAILY_STREAK_WINDOW_MS
      ? current.streak + 1
      : 1
  const rewardAmount = 20 + Math.min(nextStreak * 5, 30)

  data.dailyRewards[userId] = {
    streak: nextStreak,
    lastClaimAt: now,
  }

  const xpResult = awardXp(data, userId, rewardAmount)

  return {
    success: true,
    rewardAmount,
    streak: nextStreak,
    progress: xpResult.progress,
    leveledUp: xpResult.leveledUp,
  }
}

function formatDuration(ms = 0) {
  const totalMinutes = Math.ceil(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours <= 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

function buildProgressBar(progress = 0) {
  const filled = Math.max(0, Math.min(10, Math.round(progress / 10)))
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`
}

function buildRankEmbed({ user, xp, streak, colors, footer = 'REPMAX progression' }) {
  const state = getProgressState(xp)
  const embed = new EmbedBuilder()
    .setColor(colors.accent)
    .setTitle(`🏋️ ${user.username}'s Rank`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Level', value: `**${state.level}**`, inline: true },
      { name: 'XP', value: `**${xp}**`, inline: true },
      { name: 'Daily streak', value: `${streak} day${streak === 1 ? '' : 's'}`, inline: true },
      { name: 'Progress', value: `\`${buildProgressBar(state.progress)}\` ${state.progress}%`, inline: false },
      { name: 'Next milestone', value: `${state.remaining} XP to Level ${state.level + 1}`, inline: false },
    )
    .setFooter({ text: footer })

  return embed
}

async function handleProgressionCommand(interaction, context) {
  const { commandName } = interaction
  const { botData, colors } = context

  if (commandName === 'rank') {
    const user = interaction.options.getUser('user') || interaction.user
    const xp = botData.xp[user.id] || 0
    const streak = botData.dailyRewards[user.id]?.streak || 0
    await interaction.reply({ embeds: [buildRankEmbed({ user, xp, streak, colors })] })
    return true
  }

  if (commandName === 'daily') {
    const result = claimDailyReward(botData, interaction.user.id)
    if (!result.success) {
      const state = result.state
      await interaction.reply({
        content: `⏳ You already claimed your daily. Come back in **${formatDuration(state.remainingMs)}**.`,
        ephemeral: true,
      })
      return true
    }

    const embed = new EmbedBuilder()
      .setColor(colors.gold)
      .setTitle('🎁 Daily XP claimed')
      .setDescription(`You earned **${result.rewardAmount} XP** and pushed your streak to **${result.streak}**.`)
      .addFields(
        { name: 'Level', value: `**${result.progress.level}**`, inline: true },
        { name: 'Progress', value: `\`${buildProgressBar(result.progress.progress)}\` ${result.progress.progress}%`, inline: true },
        { name: 'Next milestone', value: `${result.progress.remaining} XP left`, inline: true },
      )
      .setFooter({ text: result.leveledUp ? 'Level up unlocked. Keep the streak alive.' : 'Claim again in 20 hours.' })

    await interaction.reply({ embeds: [embed] })
    return true
  }

  return false
}

module.exports = {
  DAILY_COOLDOWN_MS,
  DAILY_STREAK_WINDOW_MS,
  MESSAGE_XP_COOLDOWN_MS,
  PROGRESSION_COMMAND_BUILDERS,
  ensureProgressionDefaults,
  getLevel,
  xpForLevel,
  getProgressState,
  awardXp,
  isQualifyingMessage,
  canAwardMessageXp,
  getDailyState,
  claimDailyReward,
  formatDuration,
  buildProgressBar,
  buildRankEmbed,
  handleProgressionCommand,
}

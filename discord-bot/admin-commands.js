const { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } = require('discord.js')

const ADMIN_COMMAND_BUILDERS = [
  new SlashCommandBuilder().setName('serverpulse').setDescription('View a server health snapshot (Admin only)'),
]

async function handleAdminCommand(interaction, context) {
  const { commandName } = interaction
  const { botData, colors, getLevel } = context

  if (commandName !== 'serverpulse') return false

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: '❌ Admin only.', ephemeral: true })
    return true
  }

  const entries = Object.entries(botData.xp || {})
  const totalUsersTracked = entries.length
  const totalXp = entries.reduce((sum, [, xp]) => sum + xp, 0)
  const levelTwoPlus = entries.filter(([, xp]) => getLevel(xp) >= 2).length
  const topUsers = entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([userId, xp], index) => `#${index + 1} <@${userId}> — L${getLevel(xp)} (${xp} XP)`)
    .join('\n') || 'No XP data yet.'

  const activeDailyUsers = Object.values(botData.dailyRewards || {}).filter((entry) => (entry?.streak || 0) > 0).length
  const healthLabel = totalUsersTracked === 0
    ? 'Booting'
    : levelTwoPlus / Math.max(1, totalUsersTracked) >= 0.45
      ? 'Healthy'
      : 'Needs tuning'

  const embed = new EmbedBuilder()
    .setColor(colors.blue)
    .setTitle('📡 Server Pulse')
    .addFields(
      { name: 'Members', value: `${interaction.guild.memberCount}`, inline: true },
      { name: 'Tracked athletes', value: `${totalUsersTracked}`, inline: true },
      { name: 'Leveling health', value: healthLabel, inline: true },
      { name: 'Level 2+', value: `${levelTwoPlus}`, inline: true },
      { name: 'Daily claimers', value: `${activeDailyUsers}`, inline: true },
      { name: 'Total XP', value: `${totalXp}`, inline: true },
      { name: 'Top grinders', value: topUsers, inline: false },
    )

  await interaction.reply({ embeds: [embed], ephemeral: true })
  return true
}

module.exports = {
  ADMIN_COMMAND_BUILDERS,
  handleAdminCommand,
}

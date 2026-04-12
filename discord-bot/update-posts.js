const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } = require('discord.js')

function normalizeChangelogVersion(version = '') {
  return version.trim().replace(/^v/i, '').trim()
}

function getChangelogChannel(guild) {
  return guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.includes('changelog'))
}

function getAnnouncementsChannel(guild) {
  return guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.includes('announcement'))
}

function getUpdatesRole(guild, notificationMap) {
  return guild.roles.cache.find(r => r.name === notificationMap.updates || r.name.toLowerCase().includes('app updates'))
}

function bulletList(items = []) {
  return items.filter(Boolean).map(item => `• ${item}`).join('\n')
}

function slugifyKey(value = '') {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function buildChangelogEmbed({ version, headline, newItems, fixItems, authorTag, colors }) {
  const embed = new EmbedBuilder()
    .setColor(colors.green)
    .setTitle(`📰 REPMAX v${version} — Latest Update`)
    .setDescription(headline)
    .setTimestamp()
    .setFooter({ text: `Posted by ${authorTag} • More updates coming soon!` })

  if (newItems.length) {
    embed.addFields({ name: '🆕 What\'s New', value: bulletList(newItems), inline: false })
  }

  if (fixItems.length) {
    embed.addFields({ name: '🐛 Bug Fixes', value: bulletList(fixItems), inline: false })
  }

  return embed
}

function buildAnnouncementEmbed({ title, summary, highlights, cta, authorTag, colors }) {
  const embed = new EmbedBuilder()
    .setColor(colors.blue)
    .setTitle(`📣 ${title}`)
    .setDescription(summary)
    .setTimestamp()
    .setFooter({ text: `Posted by ${authorTag} • REPMAX announcements` })

  if (highlights.length) {
    embed.addFields({ name: '⚡ Highlights', value: bulletList(highlights), inline: false })
  }

  if (cta) {
    embed.addFields({ name: '🚀 Next Move', value: cta, inline: false })
  }

  return embed
}

function buildUpdateButtons(kind = 'announcement') {
  const primaryLabel = kind === 'changelog' ? '📱 Open REPMAX' : '🚀 Open App'
  const primaryUrl = kind === 'changelog' ? 'https://www.rep-max.app' : 'https://www.rep-max.app/app'

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel(primaryLabel).setStyle(ButtonStyle.Link).setURL(primaryUrl),
    new ButtonBuilder().setLabel('💬 Join Discord').setStyle(ButtonStyle.Link).setURL('https://discord.gg/repmax'),
  )
}

module.exports = {
  normalizeChangelogVersion,
  getChangelogChannel,
  getAnnouncementsChannel,
  getUpdatesRole,
  slugifyKey,
  buildChangelogEmbed,
  buildAnnouncementEmbed,
  buildUpdateButtons,
}

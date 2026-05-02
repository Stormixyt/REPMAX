const { EmbedBuilder, SlashCommandBuilder } = require('discord.js')

const FUN_COMMAND_BUILDERS = [
  new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball').addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin'),
  new SlashCommandBuilder().setName('choose').setDescription('Let REPMAX choose from your options').addStringOption(o => o.setName('options').setDescription('Split options with |').setRequired(true)),
  new SlashCommandBuilder().setName('poll').setDescription('Create a quick poll').addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true)).addStringOption(o => o.setName('options').setDescription('Options split with |').setRequired(true)),
]

const EIGHT_BALL_REPLIES = [
  'Lock in. That is a yes.',
  'Yes. Stop overthinking it.',
  'Probably, if you actually stay consistent.',
  'Looks good from here.',
  'Not today.',
  'That is a no.',
  'Ask again after your next workout.',
  'Energy is mixed. Recheck the plan.',
]

async function handleFunCommand(interaction, context) {
  const { commandName } = interaction
  const { colors } = context

  if (commandName === '8ball') {
    const question = interaction.options.getString('question', true)
    const reply = EIGHT_BALL_REPLIES[Math.floor(Math.random() * EIGHT_BALL_REPLIES.length)]
    const embed = new EmbedBuilder()
      .setColor(colors.purple)
      .setTitle('🎱 REPMAX 8-Ball')
      .addFields(
        { name: 'Question', value: question, inline: false },
        { name: 'Answer', value: reply, inline: false },
      )
    await interaction.reply({ embeds: [embed] })
    return true
  }

  if (commandName === 'coinflip') {
    const result = Math.random() > 0.5 ? 'Heads' : 'Tails'
    await interaction.reply({ content: `🪙 **${result}**` })
    return true
  }

  if (commandName === 'choose') {
    const options = interaction.options.getString('options', true).split('|').map(option => option.trim()).filter(Boolean)
    if (options.length < 2) {
      await interaction.reply({ content: '❌ Give me at least 2 options separated with `|`.', ephemeral: true })
      return true
    }
    const picked = options[Math.floor(Math.random() * options.length)]
    await interaction.reply({ content: `🎯 I choose: **${picked}**` })
    return true
  }

  if (commandName === 'poll') {
    const question = interaction.options.getString('question', true)
    const options = interaction.options.getString('options', true).split('|').map(option => option.trim()).filter(Boolean).slice(0, 5)
    if (options.length < 2) {
      await interaction.reply({ content: '❌ Give me 2 to 5 options separated with `|`.', ephemeral: true })
      return true
    }

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']
    const embed = new EmbedBuilder()
      .setColor(colors.blue)
      .setTitle('📊 REPMAX Poll')
      .setDescription(options.map((option, index) => `${emojis[index]} ${option}`).join('\n'))
      .addFields({ name: 'Question', value: question, inline: false })
      .setFooter({ text: `Started by ${interaction.user.username}` })

    await interaction.reply({ embeds: [embed], fetchReply: true })
    const pollMessage = await interaction.fetchReply()
    for (let index = 0; index < options.length; index += 1) {
      await pollMessage.react(emojis[index]).catch(() => {})
    }
    return true
  }

  return false
}

module.exports = {
  FUN_COMMAND_BUILDERS,
  handleFunCommand,
}

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js')

const TRAINING_COMMAND_BUILDERS = [
  new SlashCommandBuilder().setName('repcalc').setDescription('Estimate a 1RM from weight and reps')
    .addNumberOption(o => o.setName('weight').setDescription('Weight used').setRequired(true))
    .addIntegerOption(o => o.setName('reps').setDescription('Reps completed').setRequired(true)),
  new SlashCommandBuilder().setName('plates').setDescription('Get plate math for a target weight')
    .addNumberOption(o => o.setName('target_weight').setDescription('Target total weight').setRequired(true))
    .addStringOption(o => o.setName('units').setDescription('kg or lbs').setRequired(true).addChoices(
      { name: 'kg', value: 'kg' },
      { name: 'lbs', value: 'lbs' },
    ))
    .addNumberOption(o => o.setName('bar_weight').setDescription('Barbell weight').setRequired(false)),
  new SlashCommandBuilder().setName('splithelp').setDescription('Get split guidance for your goal and schedule')
    .addStringOption(o => o.setName('goal').setDescription('Primary goal').setRequired(true).addChoices(
      { name: 'Hypertrophy', value: 'hypertrophy' },
      { name: 'Strength', value: 'strength' },
      { name: 'General fitness', value: 'general' },
      { name: 'Athletic', value: 'athletic' },
    ))
    .addIntegerOption(o => o.setName('days').setDescription('Days per week').setRequired(true))
    .addStringOption(o => o.setName('equipment').setDescription('Equipment access').setRequired(true).addChoices(
      { name: 'Full gym', value: 'full_gym' },
      { name: 'Dumbbells', value: 'dumbbells' },
      { name: 'Bodyweight / home', value: 'bodyweight' },
    )),
]

function getPlateBreakdown(targetWeight, barWeight, units) {
  const plates = units === 'kg'
    ? [25, 20, 15, 10, 5, 2.5, 1.25]
    : [45, 35, 25, 10, 5, 2.5]
  let perSide = Math.max(0, (targetWeight - barWeight) / 2)
  const result = []

  for (const plate of plates) {
    const count = Math.floor(perSide / plate)
    if (count > 0) {
      result.push(`${count} x ${plate}${units}`)
      perSide -= count * plate
    }
  }

  return result
}

function getSplitAdvice(goal, days, equipment) {
  if (days <= 2) {
    return {
      split: 'Full Body',
      why: 'With only 1-2 days, full body gives you the cleanest frequency.',
    }
  }

  if (days === 3) {
    return {
      split: goal === 'strength' ? 'Full Body Strength' : 'Push / Pull / Legs',
      why: 'Three days is perfect for either a balanced full-body strength setup or a clean PPL starter split.',
    }
  }

  if (days === 4) {
    return {
      split: 'Upper / Lower',
      why: 'Four days usually means upper/lower is the most recoverable and progression-friendly option.',
    }
  }

  if (days >= 5 && equipment === 'bodyweight') {
    return {
      split: 'Bodyweight Push / Pull / Legs + Upper',
      why: 'Higher frequency works best when bodyweight days rotate movement emphasis and fatigue stays controlled.',
    }
  }

  return {
    split: goal === 'hypertrophy' ? 'Push / Pull / Legs' : 'Arnold / Upper Lower hybrid',
    why: 'At 5+ days you can bias volume harder while still keeping pattern variety.',
  }
}

async function handleTrainingCommand(interaction, context) {
  const { commandName } = interaction
  const { colors } = context

  if (commandName === 'repcalc') {
    const weight = interaction.options.getNumber('weight', true)
    const reps = interaction.options.getInteger('reps', true)
    const estimated = Math.round(weight * (1 + reps / 30))
    const embed = new EmbedBuilder()
      .setColor(colors.orange)
      .setTitle('📈 Estimated 1RM')
      .setDescription(`**${estimated}** from **${weight} x ${reps}** using the Epley formula.`)
    await interaction.reply({ embeds: [embed] })
    return true
  }

  if (commandName === 'plates') {
    const units = interaction.options.getString('units', true)
    const targetWeight = interaction.options.getNumber('target_weight', true)
    const barWeight = interaction.options.getNumber('bar_weight') || (units === 'kg' ? 20 : 45)
    if (targetWeight <= barWeight) {
      await interaction.reply({ content: '❌ Target weight needs to be heavier than the bar.', ephemeral: true })
      return true
    }

    const breakdown = getPlateBreakdown(targetWeight, barWeight, units)
    const embed = new EmbedBuilder()
      .setColor(colors.accent)
      .setTitle('🏋️ Plate Math')
      .setDescription(`Load **${targetWeight}${units}** with a **${barWeight}${units}** bar.`)
      .addFields({ name: 'Per side', value: breakdown.length ? breakdown.join('\n') : 'No plates needed', inline: false })
    await interaction.reply({ embeds: [embed] })
    return true
  }

  if (commandName === 'splithelp') {
    const goal = interaction.options.getString('goal', true)
    const days = interaction.options.getInteger('days', true)
    const equipment = interaction.options.getString('equipment', true)
    const advice = getSplitAdvice(goal, days, equipment)
    const embed = new EmbedBuilder()
      .setColor(colors.green)
      .setTitle('🧠 Split Guidance')
      .addFields(
        { name: 'Recommended split', value: advice.split, inline: false },
        { name: 'Why', value: advice.why, inline: false },
        { name: 'Input', value: `${goal} goal · ${days} days · ${equipment.replace(/_/g, ' ')}`, inline: false },
      )
      .setFooter({ text: 'Use REPMAX for the full personalized version.' })
    await interaction.reply({ embeds: [embed] })
    return true
  }

  return false
}

module.exports = {
  TRAINING_COMMAND_BUILDERS,
  handleTrainingCommand,
}

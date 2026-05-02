// Debug: check channel permissions for onboarding eligibility
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js')
const { getBotConfig } = require('./config')

const { BOT_TOKEN, GUILD_ID } = getBotConfig()

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
client.once('ready', async () => {
  const guild = client.guilds.cache.get(GUILD_ID)
  const chs = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).sort((a,b) => a.position - b.position)
  
  console.log('Channel permissions for @everyone:\n')
  const writable = []
  
  for (const [,ch] of chs) {
    const perms = ch.permissionsFor(guild.id)
    const v = perms?.has(PermissionsBitField.Flags.ViewChannel)
    const s = perms?.has(PermissionsBitField.Flags.SendMessages)
    const tag = `${v?'VIEW':'----'} ${s?'SEND':'----'}`
    console.log(`  ${tag}  ${ch.name}  (${ch.id})  [${ch.parent?.name || 'no-cat'}]`)
    if (v && s) writable.push(ch)
  }
  
  console.log(`\n${writable.length} writable channels. Need 7+ for onboarding defaults (5+ writable).\n`)
  console.log('Recommended default_channel_ids:')
  // Pick channels from different categories
  const cats = new Map()
  for (const ch of writable) {
    const catName = ch.parent?.name || 'none'
    if (!cats.has(catName)) cats.set(catName, [])
    cats.get(catName).push(ch)
  }
  const picked = []
  for (const [cat, chs] of cats) {
    picked.push(chs[0])
    console.log(`  ${chs[0].name} (${chs[0].id}) — from "${cat}"`)
    if (picked.length >= 7) break
  }
  // Fill more if needed
  if (picked.length < 7) {
    for (const ch of writable) {
      if (!picked.includes(ch) && picked.length < 7) {
        picked.push(ch)
        console.log(`  ${ch.name} (${ch.id}) — from "${ch.parent?.name}"`)
      }
    }
  }
  
  console.log(`\nIDs: [${picked.map(c => `"${c.id}"`).join(', ')}]`)
  process.exit(0)
})
client.login(BOT_TOKEN)

const fs = require('fs')
const path = require('path')

const ENV_PATH = path.join(__dirname, '.env')

function loadEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return

  const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    const rawValue = trimmed.slice(equalsIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')

    if (key && !process.env[key]) {
      process.env[key] = value
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing ${name}. Add it to discord-bot/.env or your shell environment.`)
  }
  return value
}

function optionalEnv(name) {
  const value = process.env[name]?.trim()
  return value || ''
}

loadEnvFile()

function getBotConfig() {
  return {
    BOT_TOKEN: requiredEnv('DISCORD_BOT_TOKEN'),
    GUILD_ID: requiredEnv('DISCORD_GUILD_ID'),
    GROQ_API_KEY: optionalEnv('GROQ_API_KEY'),
    GROQ_MODEL: optionalEnv('GROQ_MODEL'),
  }
}

module.exports = {
  getBotConfig,
}

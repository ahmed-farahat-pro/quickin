import fs from 'node:fs'
import path from 'node:path'

// English is the source of truth; every other locale must match its key set exactly.
const basePath = path.resolve('src/messages/en.json')
const locales = ['ar', 'fr', 'es']

const base = JSON.parse(fs.readFileSync(basePath, 'utf8'))

function flattenKeys(obj, prefix = '') {
  const keys = []
  for (const [key, value] of Object.entries(obj)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, nextPrefix))
    } else {
      keys.push(nextPrefix)
    }
  }
  return keys
}

const baseKeys = new Set(flattenKeys(base))
let failed = false

for (const locale of locales) {
  const comparePath = path.resolve(`src/messages/${locale}.json`)
  if (!fs.existsSync(comparePath)) {
    console.error(`Missing locale file: src/messages/${locale}.json`)
    failed = true
    continue
  }
  const compare = JSON.parse(fs.readFileSync(comparePath, 'utf8'))
  const compareKeys = new Set(flattenKeys(compare))

  const missing = [...baseKeys].filter((key) => !compareKeys.has(key))
  const extra = [...compareKeys].filter((key) => !baseKeys.has(key))

  if (missing.length || extra.length) {
    failed = true
    if (missing.length) {
      console.error(`Missing keys in ${locale}.json:`)
      for (const key of missing) console.error(`  - ${key}`)
    }
    if (extra.length) {
      console.error(`Extra keys in ${locale}.json:`)
      for (const key of extra) console.error(`  - ${key}`)
    }
  } else {
    console.log(`${locale}.json: key parity OK (${compareKeys.size} keys)`)
  }
}

if (failed) process.exit(1)
console.log('i18n key parity check passed for all locales.')

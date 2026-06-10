import fs from 'node:fs'
import path from 'node:path'

const basePath = path.resolve('src/messages/en.json')
const comparePath = path.resolve('src/messages/ar.json')

const base = JSON.parse(fs.readFileSync(basePath, 'utf8'))
const compare = JSON.parse(fs.readFileSync(comparePath, 'utf8'))

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
const compareKeys = new Set(flattenKeys(compare))

const missingInAr = [...baseKeys].filter((key) => !compareKeys.has(key))
const extraInAr = [...compareKeys].filter((key) => !baseKeys.has(key))

if (missingInAr.length || extraInAr.length) {
  if (missingInAr.length) {
    console.error('Missing keys in ar.json:')
    for (const key of missingInAr) console.error(`  - ${key}`)
  }
  if (extraInAr.length) {
    console.error('Extra keys in ar.json:')
    for (const key of extraInAr) console.error(`  - ${key}`)
  }
  process.exit(1)
}

console.log('i18n key parity check passed.')


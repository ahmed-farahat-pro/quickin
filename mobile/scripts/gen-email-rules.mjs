// Generates the mobile clients' copy of the email-address data from the one
// source of truth: the backend's `src/lib/local/email-core.ts`.
//
//   node quickin-mono/mobile/scripts/gen-email-rules.mjs
//
// Writes:
//   ios/Sources/EmailData.swift
//   android/app/src/main/java/com/quickin/app/EmailData.kt
//
// Why generate rather than hand-copy. The four clients (web, this API, iOS,
// Android) all decide whether an address may open an account, and they open it
// in the SAME `users` row. A rule that holds on three doors and not the fourth
// does not hold. The web and the backend keep parity by being byte-identical
// TypeScript (`scripts/check-email-core-parity.mjs`); Swift and Kotlin can't do
// that, so they get the data mechanically instead of by hand — a hand-copied
// TLD list is a list that is wrong within a year.
//
// Only DATA is generated. The decision logic lives in `EmailRules.swift` and
// `EmailRules.kt`, hand-written to mirror `checkEmail`, because that part is
// short, stable and worth reading in the language it runs in.
//
// Re-run this after refreshing the root zone (`npm run check:tlds` on the
// frontend). It is idempotent — commit whatever it produces.
import { readFileSync, writeFileSync } from 'node:fs'

const SOURCE = new URL(
  '../../../backend/quickin-backend/src/lib/local/email-core.ts',
  import.meta.url
)

const src = (() => {
  try {
    return readFileSync(SOURCE, 'utf8')
  } catch {
    console.error(
      `cannot read ${SOURCE.pathname}\n` +
      `   (this generator assumes quickin-mono and backend/ are siblings under projects/quickin/)`
    )
    process.exit(1)
  }
})()

/** The space-separated root-zone blob assigned to `TLD_DATA`. */
function tlds() {
  const start = src.indexOf('const TLD_DATA =')
  if (start < 0) throw new Error('TLD_DATA not found')
  const end = src.indexOf('\n\n', start)
  const literals = src.slice(start, end).match(/"([^"]*)"/g) || []
  const joined = literals.map((s) => s.slice(1, -1)).join('')
  const list = joined.trim().split(/\s+/).filter(Boolean)
  if (list.length < 1000) throw new Error(`only ${list.length} TLDs — parse looks wrong`)
  return list
}

/**
 * The quoted entries of a `new Set([...])` or `[...]` declaration. Comments are
 * stripped first: several lists have apostrophes in their prose ("isn't"), and
 * a bare quote-scan would happily lift `t` out of one.
 */
function entries(name) {
  const start = src.indexOf(name)
  if (start < 0) throw new Error(`${name} not found`)
  const open = src.indexOf('[', start)
  const close = src.indexOf('\n])', start) >= 0 && src.indexOf('\n])', start) < src.indexOf('\n]', start) + 1
    ? src.indexOf('\n])', start)
    : src.indexOf('\n]', start)
  const body = src.slice(open, close)
  const withoutComments = body.replace(/\/\/[^\n]*/g, '')
  const found = [...withoutComments.matchAll(/'([^']+)'/g)].map((m) => m[1])
  if (!found.length) throw new Error(`${name} parsed to nothing`)
  return [...new Set(found)]
}

const TLDS = tlds()
const TRUSTED = entries('const TRUSTED_DOMAINS = new Set(')
const DISPOSABLE = entries('const DISPOSABLE_DOMAINS = new Set(')
const POPULAR_DOMAINS = entries('const POPULAR_DOMAINS = ')
const POPULAR_TLDS = entries('const POPULAR_TLDS = ')

const BANNER = (lang) => `// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by quickin-mono/mobile/scripts/gen-email-rules.mjs from the backend's
// src/lib/local/email-core.ts, which is byte-identical to the web's copy. Edit
// that file and re-run the generator; editing this one just means the phone
// disagrees with the server about who may open an account.
//
//   node quickin-mono/mobile/scripts/gen-email-rules.mjs
//
// ${TLDS.length} delegated TLDs · ${TRUSTED.length} trusted providers · ${DISPOSABLE.length} disposable domains.
`

/** Wrap a list of quoted strings at ~78 columns so the diff stays readable. */
function wrap(items, indent, quote = '"') {
  const out = []
  let line = indent
  for (const item of items) {
    const piece = `${quote}${item}${quote}, `
    if (line.length + piece.length > 78 && line.trim()) {
      out.push(line.trimEnd())
      line = indent
    }
    line += piece
  }
  if (line.trim()) out.push(line.trimEnd())
  return out.join('\n')
}

// ---- Swift ----------------------------------------------------------------
// The root zone ships as one space-separated string split on first use, not as a
// 1,450-element array literal: the literal costs the Swift type-checker minutes
// and the string costs nothing.
const swift = `${BANNER('swift')}
import Foundation

enum EmailData {
    /// Every delegated top-level domain, lowercased, space-separated.
    static let tldBlob = ${JSON.stringify(TLDS.join(' '))}

    static let validTlds: Set<String> = Set(tldBlob.split(separator: " ").map(String.init))

    /// Mailbox providers accepted without further checks. A FAST PATH, not the
    /// policy — a domain missing here still passes if its TLD is real and it is
    /// not disposable, which is what keeps company and university mail working.
    static let trustedDomains: Set<String> = [
${wrap(TRUSTED, '        ')}
    ]

    /// Disposable / temp-mail domains, matched on the domain and every parent.
    static let disposableDomains: Set<String> = [
${wrap(DISPOSABLE, '        ')}
    ]

    /// The did-you-mean shortlists. Suggestions never come from the full root
    /// zone — \`con\` is one edit from \`cn\` as well as \`com\`.
    static let popularDomains: [String] = [
${wrap(POPULAR_DOMAINS, '        ')}
    ]

    static let popularTlds: [String] = [
${wrap(POPULAR_TLDS, '        ')}
    ]
}
`

// ---- Kotlin ---------------------------------------------------------------
const kotlin = `${BANNER('kotlin')}
package com.quickin.app

object EmailData {
    /** Every delegated top-level domain, lowercased, space-separated. */
    private const val TLD_BLOB = ${JSON.stringify(TLDS.join(' '))}

    val validTlds: Set<String> by lazy { TLD_BLOB.split(" ").toSet() }

    /**
     * Mailbox providers accepted without further checks. A FAST PATH, not the
     * policy — a domain missing here still passes if its TLD is real and it is
     * not disposable, which is what keeps company and university mail working.
     */
    val trustedDomains: Set<String> = setOf(
${wrap(TRUSTED, '        ')}
    )

    /** Disposable / temp-mail domains, matched on the domain and every parent. */
    val disposableDomains: Set<String> = setOf(
${wrap(DISPOSABLE, '        ')}
    )

    /**
     * The did-you-mean shortlists. Suggestions never come from the full root
     * zone — \`con\` is one edit from \`cn\` as well as \`com\`.
     */
    val popularDomains: List<String> = listOf(
${wrap(POPULAR_DOMAINS, '        ')}
    )

    val popularTlds: List<String> = listOf(
${wrap(POPULAR_TLDS, '        ')}
    )
}
`

const iosOut = new URL('../ios/Sources/EmailData.swift', import.meta.url)
const androidOut = new URL('../android/app/src/main/java/com/quickin/app/EmailData.kt', import.meta.url)
writeFileSync(iosOut, swift)
writeFileSync(androidOut, kotlin)

console.log(`✅ ${TLDS.length} TLDs · ${TRUSTED.length} trusted · ${DISPOSABLE.length} disposable`)
console.log(`   ios/Sources/EmailData.swift`)
console.log(`   android/app/src/main/java/com/quickin/app/EmailData.kt`)

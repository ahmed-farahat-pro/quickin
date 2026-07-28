package com.quickin.app

import org.json.JSONObject

/**
 * Null-safe `org.json` string reads.
 *
 * **Why this exists:** Android's [JSONObject.optString] does NOT return null for a JSON `null`.
 * It stringifies [JSONObject.NULL] and hands back the literal four-character string `"null"`.
 * That is how `{"reservation_code": null}` used to become the reservation code `"null"`, which
 * then flowed into `ShareLinks.stay(...)` and produced the broken `/stay/null` URL guests reported.
 *
 * [optStringOrNull] collapses all three "there is no value here" shapes to a real Kotlin null:
 *  • the key is absent, or its value is [JSONObject.NULL],
 *  • the value is the literal string `"null"` (what `optString` yields for a JSON null, and what
 *    a sloppy server-side `String(x)` can also emit),
 *  • the value is empty / whitespace only.
 *
 * Values are trimmed. Free text that is genuinely the word "null" is treated as absent too —
 * that trade is deliberate: a stray `"null"` reaching a URL or a QR code is far worse than a
 * caption we decline to render.
 */
fun JSONObject.optStringOrNull(key: String): String? {
    if (!has(key) || isNull(key)) return null
    val raw = optString(key).trim()
    if (raw.isEmpty() || raw.equals("null", ignoreCase = true)) return null
    return raw
}

/**
 * [optStringOrNull] with a [fallback] for fields the app models as non-null (e.g. a status that
 * defaults to "pending"). Pass `""` where the empty string is the right blank.
 */
fun JSONObject.optStringOr(key: String, fallback: String): String =
    optStringOrNull(key) ?: fallback

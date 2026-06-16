package com.quickin.app

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.runtime.mutableStateMapOf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Multi-currency DISPLAY holder (Section 9 — MOCK). A process-wide singleton that:
 *  • holds the FX rates (EGP base + USD/EUR/GBP/SAR/AED), seeded with baked-in [STATIC_RATES] so the
 *    app formats correctly before — or without ever — hitting the network,
 *  • on [init] loads `GET /api/local/currencies` once and merges any returned rates over the
 *    baked-in ones (a network failure is silently ignored — the static rates remain),
 *  • persists the user's chosen display currency in SharedPreferences (key [KEY_CURRENCY], default
 *    "EGP") so it survives relaunch, and
 *  • exposes the current selection + rates as Compose state ([currency], [rates]) so every price
 *    [Text] that calls [format] recomposes the instant the user picks a new currency.
 *
 * Conversion is display-only: `amountInTarget = amountEgp * rates[target]`. All backend amounts —
 * and every booking / payment — stay in EGP regardless of what's shown.
 */
object CurrencyManager {

    /** The platform base currency. All amounts passed to [format] are in this currency. */
    const val BASE = "EGP"

    /** SharedPreferences file + key for the persisted display-currency choice. */
    private const val PREFS_NAME = "qk_currency_prefs"
    const val KEY_CURRENCY = "qk_currency"

    /**
     * The currencies the switcher offers, in display order. The first (EGP) is the base. Each entry
     * is the ISO code; [symbolFor] resolves a display symbol. Kept as the source of truth for the
     * picker even when the backend returns extra/fewer rates.
     */
    val SUPPORTED: List<String> = listOf("EGP", "USD", "EUR", "GBP", "SAR", "AED")

    /**
     * Baked-in fallback rates (EGP → target multiplier), matching the backend's
     * `GET /api/local/currencies` so display is correct offline / before the fetch resolves.
     */
    val STATIC_RATES: Map<String, Double> = linkedMapOf(
        "EGP" to 1.0,
        "USD" to 0.0203,
        "EUR" to 0.0188,
        "GBP" to 0.016,
        "SAR" to 0.0762,
        "AED" to 0.0746
    )

    /** Live FX rates as Compose state — seeded from [STATIC_RATES], overlaid by the fetch. */
    private val _rates: SnapshotStateMap<String, Double> =
        mutableStateMapOf<String, Double>().apply { putAll(STATIC_RATES) }
    val rates: Map<String, Double> get() = _rates

    /** The currently-selected display currency as Compose state (defaults to [BASE]). */
    private val currencyState = mutableStateOf(BASE)
    val currency: String get() = currencyState.value

    /** True once [init] has been called (so a second call from another screen is a no-op). */
    @Volatile
    private var initialized = false

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /**
     * Loads the persisted currency choice and (once) refreshes the rates from the backend. Safe to
     * call from any composable's first appearance — repeat calls after the first are no-ops. On a
     * network failure the baked-in [STATIC_RATES] simply remain in effect.
     */
    fun init(context: Context) {
        if (initialized) return
        initialized = true
        val saved = prefs(context).getString(KEY_CURRENCY, BASE)
        currencyState.value = normalize(saved)
        scope.launch {
            val fetched = SupabaseService.fetchCurrencies()
            if (fetched != null && fetched.rates.isNotEmpty()) {
                // Merge over the baked-in rates so any currency the backend omits still formats.
                _rates.putAll(fetched.rates)
            }
        }
    }

    /**
     * Sets and persists the display currency (a no-op for an unknown code). Updates the Compose
     * [currency] state so price Text recomposes immediately.
     */
    fun setCurrency(context: Context, code: String) {
        val next = normalize(code)
        if (next == currencyState.value) return
        currencyState.value = next
        prefs(context).edit().putString(KEY_CURRENCY, next).apply()
    }

    /**
     * Formats an EGP [amountEgp] in the currently-selected display currency, e.g. "EGP 1,200" or
     * "$24" or "€22". Converts via the live [rates] (falling back to 1.0 for an unknown code, i.e.
     * the original EGP magnitude). Reading [currency] / [rates] here makes any composable that calls
     * this recompose when the selection or rates change.
     */
    fun format(amountEgp: Double): String {
        val code = currencyState.value
        val rate = _rates[code] ?: 1.0
        val converted = amountEgp * rate
        return symbolFor(code) + formatAmount(converted, code)
    }

    /** Convenience overload for Int EGP amounts. */
    fun format(amountEgp: Int): String = format(amountEgp.toDouble())

    /**
     * A display symbol/prefix for [code], e.g. "$", "€", "£" or, for codes without a common glyph,
     * the code itself followed by a space ("EGP ", "SAR ", "AED ").
     */
    fun symbolFor(code: String): String = when (normalize(code)) {
        "USD" -> "$"
        "EUR" -> "€"
        "GBP" -> "£"
        "EGP" -> "EGP "
        "SAR" -> "SAR "
        "AED" -> "AED "
        else -> "${normalize(code)} "
    }

    /**
     * Rounds + groups [amount] for display. EGP/SAR/AED (whole-number magnitudes) show no decimals;
     * the symbol-prefixed western currencies (USD/EUR/GBP) keep two so small converted values like
     * "$24.36" stay legible. Always formatted with US grouping so digits read the same in both
     * locales (Arabic numerals are handled by the platform per-locale, but grouping stays stable).
     */
    private fun formatAmount(amount: Double, code: String): String {
        return when (normalize(code)) {
            "EGP", "SAR", "AED" -> String.format(java.util.Locale.US, "%,d", Math.round(amount))
            else -> String.format(java.util.Locale.US, "%,.2f", amount)
        }
    }

    /** Upper-cases + trims a code; blank/unknown falls back to [BASE]. */
    private fun normalize(code: String?): String {
        val c = code?.trim()?.uppercase().orEmpty()
        return if (c.isBlank()) BASE else c
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}

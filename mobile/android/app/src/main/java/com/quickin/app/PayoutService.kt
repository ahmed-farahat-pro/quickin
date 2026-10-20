package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * A destination Quick In can send a host's earnings to. [key] matches
 * `host_payout_methods.method` on the server.
 *
 * [WALLET] was RETIRED on 2026-10-20: the server refuses to save one, but a row saved before then
 * still decodes and shows, with a prompt to switch. Pickers list [CHOOSABLE], never [entries].
 */
enum class PayoutMethodKind(val key: String) {
    BANK_ACCOUNT("bank_account"),
    INSTAPAY("instapay"),
    WALLET("wallet");

    val isRetired: Boolean get() = this !in CHOOSABLE

    companion object {
        /** What a host may pick today — mirrors `PAYOUT_METHODS` in payout-method-core. */
        val CHOOSABLE: List<PayoutMethodKind> = listOf(BANK_ACCOUNT, INSTAPAY)

        fun fromKey(key: String?): PayoutMethodKind? =
            entries.firstOrNull { it.key.equals(key?.trim(), ignoreCase = true) }
    }
}

/**
 * A host's saved payout method, as `GET /api/local/host/payout-method` returns it.
 *
 * Every field comes back whole — an IBAN is meant to be handed out, and a masked one is one a host
 * cannot check. [accountRef] is the canonical destination the server derived: the IBAN (or the
 * account number when there is no IBAN), the InstaPay address, or (retired) the wallet number.
 * [ibanFormatted] is the IBAN in the 4-character groups banks print it in.
 */
data class HostPayoutMethod(
    val method: String,
    val accountName: String,
    val accountRef: String,
    val bankName: String,
    val iban: String,
    val ibanFormatted: String,
    val accountNumber: String,
    val swiftBic: String,
    val branch: String,
    val provider: String,
    val display: String,
    val updatedAt: String? = null
) {
    val kind: PayoutMethodKind? get() = PayoutMethodKind.fromKey(method)
}

/** What the editor submits. Fields for the other method are ignored by the server. */
data class PayoutDraft(
    val method: PayoutMethodKind = PayoutMethodKind.BANK_ACCOUNT,
    val accountName: String = "",
    val bankName: String = "",
    val iban: String = "",
    val accountNumber: String = "",
    val swiftBic: String = "",
    val branch: String = "",
    val instapayAddress: String = ""
)

/**
 * Minimal HTTP client for the host's payout method. Mirrors [TrustService] / [ProfileService]:
 * HttpURLConnection + org.json on Dispatchers.IO, bearer-token auth, and an [HttpError] so callers
 * can tell 401 (sign in) and 403 (not a host) from 400 (the host's input to fix).
 *
 *   GET    {base}/api/local/host/payout-method  -> { payout_method, payout_ready }
 *   PUT    {base}/api/local/host/payout-method  { method, account_name, … }
 *   DELETE {base}/api/local/host/payout-method
 *
 * The server validates everything (IBAN checksum included) and answers 400 with the wording the
 * host should read, which [extractError] surfaces verbatim.
 */
object PayoutService {

    /** Thrown so callers can distinguish sign-in (401) / not-a-host (403) from validation (400). */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

    private const val PATH = "/api/local/host/payout-method"

    /** Loads the signed-in host's payout method, or null when they have not added one. */
    suspend fun fetch(token: String): HostPayoutMethod? = withContext(Dispatchers.IO) {
        parse(JSONObject(request("GET", token, null)))
    }

    /** Saves (or replaces) the host's payout method and returns what was stored. */
    suspend fun save(token: String, draft: PayoutDraft): HostPayoutMethod? = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("method", draft.method.key)
            put("account_name", draft.accountName)
            put("bank_name", draft.bankName)
            put("iban", draft.iban)
            put("account_number", draft.accountNumber)
            put("swift_bic", draft.swiftBic)
            put("branch", draft.branch)
            put("instapay_address", draft.instapayAddress)
        }
        parse(JSONObject(request("PUT", token, body)))
    }

    /** Removes the host's payout method. Idempotent on the server. */
    suspend fun remove(token: String): Unit = withContext(Dispatchers.IO) {
        request("DELETE", token, null)
        Unit
    }

    // ---- Parsing --------------------------------------------------------------

    private fun parse(raw: JSONObject): HostPayoutMethod? {
        // `payout_method` is JSON null when nothing is set, which is not an error.
        if (raw.isNull("payout_method")) return null
        val o = raw.optJSONObject("payout_method") ?: return null
        val method = o.optStringOrNull("method") ?: return null
        return HostPayoutMethod(
            method = method,
            // optString hands back the literal "null" for a JSON null — always go through
            // optStringOr so an empty bank name never renders as the word "null".
            accountName = o.optStringOr("account_name", ""),
            accountRef = o.optStringOr("account_ref", ""),
            bankName = o.optStringOr("bank_name", ""),
            iban = o.optStringOr("iban", ""),
            ibanFormatted = o.optStringOr("iban_formatted", ""),
            accountNumber = o.optStringOr("account_number", ""),
            swiftBic = o.optStringOr("swift_bic", ""),
            branch = o.optStringOr("branch", ""),
            provider = o.optStringOr("provider", ""),
            display = o.optStringOr("display", ""),
            updatedAt = o.optStringOrNull("updated_at")
        )
    }

    // ---- HTTP helpers (mirror TrustService) ------------------------------------

    private fun request(method: String, token: String, body: JSONObject?): String {
        val conn = (URL("${Config.API_BASE_URL}$PATH").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            if (body != null) {
                conn.outputStream.use { out -> out.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            val text = readBody(conn, code)
            if (code !in 200..299) throw HttpError(code, extractError(text, code))
            return text
        } finally {
            conn.disconnect()
        }
    }

    private fun readBody(conn: HttpURLConnection, code: Int): String {
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        return stream?.bufferedReader()?.use { it.readText() }.orEmpty()
    }

    private fun extractError(text: String, code: Int): String {
        val parsed = runCatching { JSONObject(text).optStringOrNull("error") }.getOrNull()
        return parsed ?: "Request failed ($code)"
    }
}

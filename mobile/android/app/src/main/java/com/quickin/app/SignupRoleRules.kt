package com.quickin.app

/**
 * The role-aware, multi-step first-time signup (2026-11-13): the user picks Guest or Host on a
 * first screen (Guest preselected), then walks numbered steps:
 *
 *   guest: account -> identity -> refund (optional, skippable)
 *   host:  account -> identity -> hosting -> payout (required)
 *
 * The Google "Complete your account" screen walks the same steps minus `account`.
 *
 * The Kotlin twin of the backend's `signup-role-core.ts` (+ the destination half of
 * `payout-method-core.ts`). Everything here is pure value logic: no Android framework and no
 * org.json, so it runs on the desktop JVM (see SignupRoleRulesTest). Bodies are built as plain
 * maps; the service turns them into JSON.
 *
 * KEEP IN SYNC with signup-role-core: the steps must refuse exactly what the API refuses, or the
 * user learns about it from a 400 instead of from the field.
 */
enum class SignupRole(val apiValue: String) {
    Guest("guest"),
    Host("host");

    companion object {
        /** Anything but "host" is a guest — the API's `normalizeSignupRole`. */
        fun from(raw: String?): SignupRole =
            if (raw?.trim()?.lowercase() == "host") Host else Guest
    }
}

/** Every page of the flow. [Role] is the unnumbered first screen; the rest are counted steps. */
enum class SignupStep { Role, Account, Identity, Refund, Hosting, Payout }

/** The host-only "Hosting details" page. */
data class HostingDetailsDraft(
    val hostType: HostType = HostType.Individual,
    val address: String = "",
    val company: String = "",
    val notes: String = "",
    val termsAccepted: Boolean = false
)

object SignupRoleRules {

    // Field keys — match the API's 400 `fields` map.
    const val FIELD_ROLE = "role"
    const val FIELD_EMAIL = "email"
    const val FIELD_PASSWORD = "password"
    const val FIELD_FULL_NAME = "full_name"
    const val FIELD_HOST_TYPE = "host_type"
    const val FIELD_ADDRESS = "address"
    const val FIELD_COMPANY = "company"
    const val FIELD_NOTES = "notes"
    const val FIELD_TERMS = "terms"
    const val FIELD_PAYOUT = "payout"
    const val FIELD_REFUND_METHOD = "refund_method"

    const val MAX_ADDRESS_CHARS = 300
    const val MAX_COMPANY_CHARS = 120
    const val MAX_NOTES_CHARS = 1000

    /**
     * The numbered steps for [role] — what the "Step N of M" indicator counts. The email signup
     * starts with [SignupStep.Account]; the Google completion ([includeAccount] = false) skips it.
     */
    fun steps(role: SignupRole, includeAccount: Boolean = true): List<SignupStep> = buildList {
        if (includeAccount) add(SignupStep.Account)
        add(SignupStep.Identity)
        when (role) {
            SignupRole.Guest -> add(SignupStep.Refund)
            SignupRole.Host -> { add(SignupStep.Hosting); add(SignupStep.Payout) }
        }
    }

    /** Every page in order, the role screen first. */
    fun flow(role: SignupRole, includeAccount: Boolean = true): List<SignupStep> =
        listOf(SignupStep.Role) + steps(role, includeAccount)

    /** 1-based position of [step] among the numbered steps, or null for the role screen / a foreign step. */
    fun stepNumber(step: SignupStep, role: SignupRole, includeAccount: Boolean = true): Int? =
        steps(role, includeAccount).indexOf(step).takeIf { it >= 0 }?.plus(1)

    /** The page after [step], or null when [step] is the last one (Next becomes "submit"). */
    fun next(step: SignupStep, role: SignupRole, includeAccount: Boolean = true): SignupStep? {
        val all = flow(role, includeAccount)
        val i = all.indexOf(step)
        return if (i < 0) all.first() else all.getOrNull(i + 1)
    }

    /** The page before [step], or null on the role screen. */
    fun previous(step: SignupStep, role: SignupRole, includeAccount: Boolean = true): SignupStep? {
        val all = flow(role, includeAccount)
        val i = all.indexOf(step)
        return if (i <= 0) null else all[i - 1]
    }

    fun isLast(step: SignupStep, role: SignupRole, includeAccount: Boolean = true): Boolean =
        next(step, role, includeAccount) == null

    /** Only the guest's refund step may be skipped. */
    fun isSkippable(step: SignupStep): Boolean = step == SignupStep.Refund

    /** The page that shows the server error keyed [field], or null for an unknown key. */
    fun stepFor(field: String): SignupStep? = when (field) {
        FIELD_ROLE -> SignupStep.Role
        FIELD_EMAIL, FIELD_PASSWORD, FIELD_FULL_NAME, "name" -> SignupStep.Account
        SignupIdentityRules.FIELD_PHONE,
        SignupIdentityRules.FIELD_DOC_TYPE,
        SignupIdentityRules.FIELD_ID_NUMBER,
        SignupIdentityRules.FIELD_ID_FRONT,
        SignupIdentityRules.FIELD_ID_BACK -> SignupStep.Identity
        FIELD_HOST_TYPE, FIELD_ADDRESS, FIELD_COMPANY, FIELD_NOTES, FIELD_TERMS -> SignupStep.Hosting
        FIELD_PAYOUT -> SignupStep.Payout
        FIELD_REFUND_METHOD -> SignupStep.Refund
        else -> null
    }

    /**
     * Every step's errors arrive in one 400; the flow jumps to the EARLIEST page (in this role's
     * order) that owns one of [fields]. Null when none of them belongs to a page of this flow.
     */
    fun firstStepWithError(
        fields: Collection<String>,
        role: SignupRole,
        includeAccount: Boolean = true
    ): SignupStep? {
        val owned = fields.mapNotNull { stepFor(it) }.toSet()
        return flow(role, includeAccount).firstOrNull { it in owned }
    }

    // ---- Local validation -------------------------------------------------------------------

    enum class HostingProblem { AddressMissing, AddressTooLong, CompanyTooLong, NotesTooLong, TermsNotAccepted }

    /** Spaces collapsed and trimmed, as the API's `str()` does before measuring. */
    fun collapse(v: String): String = v.replace(Regex("\\s+"), " ").trim()

    /** Whether the company field is shown (and sent) — company and brokerage only. */
    fun showsCompany(type: HostType): Boolean = type != HostType.Individual

    /** Every hosting field still unacceptable, keyed like the API's `fields`. Empty = ready. */
    fun hostingProblems(d: HostingDetailsDraft): Map<String, HostingProblem> = buildMap {
        val address = collapse(d.address)
        when {
            address.isEmpty() -> put(FIELD_ADDRESS, HostingProblem.AddressMissing)
            address.length > MAX_ADDRESS_CHARS -> put(FIELD_ADDRESS, HostingProblem.AddressTooLong)
        }
        if (showsCompany(d.hostType) && collapse(d.company).length > MAX_COMPANY_CHARS) {
            put(FIELD_COMPANY, HostingProblem.CompanyTooLong)
        }
        if (d.notes.trim().length > MAX_NOTES_CHARS) put(FIELD_NOTES, HostingProblem.NotesTooLong)
        if (!d.termsAccepted) put(FIELD_TERMS, HostingProblem.TermsNotAccepted)
    }

    /**
     * Presence check of a money destination (refund or payout) — mirrors `validatePayout`'s
     * required fields: a name, then either a bank + (IBAN or account number) or an InstaPay
     * address. The server does the real validation (IBAN checksum, shapes). Retired wallet = never.
     */
    fun destinationComplete(d: PayoutDraft): Boolean {
        if (d.accountName.trim().length < 2) return false
        return when (d.method) {
            PayoutMethodKind.BANK_ACCOUNT ->
                d.bankName.trim().length >= 2 && (d.iban.isNotBlank() || d.accountNumber.isNotBlank())
            PayoutMethodKind.INSTAPAY -> d.instapayAddress.isNotBlank()
            PayoutMethodKind.WALLET -> false
        }
    }

    /** Whether anything at all was typed into a destination — a refund step left blank is a skip. */
    fun destinationTouched(d: PayoutDraft): Boolean =
        listOf(d.accountName, d.bankName, d.iban, d.accountNumber, d.swiftBic, d.branch, d.instapayAddress)
            .any { it.isNotBlank() }

    // ---- Body building ----------------------------------------------------------------------

    /**
     * One destination object, the same body as `PUT /api/local/host/payout-method`: bank accounts
     * send only the bank fields (optional ones only when typed), InstaPay only its address.
     */
    fun destinationBody(d: PayoutDraft): Map<String, String> = buildMap {
        put("method", d.method.key)
        put("account_name", d.accountName.trim())
        when (d.method) {
            PayoutMethodKind.BANK_ACCOUNT -> {
                put("bank_name", d.bankName.trim())
                d.iban.trim().takeIf { it.isNotEmpty() }?.let { put("iban", it) }
                d.accountNumber.trim().takeIf { it.isNotEmpty() }?.let { put("account_number", it) }
                d.swiftBic.trim().takeIf { it.isNotEmpty() }?.let { put("swift_bic", it) }
                d.branch.trim().takeIf { it.isNotEmpty() }?.let { put("branch", it) }
            }
            PayoutMethodKind.INSTAPAY -> put("instapay_address", d.instapayAddress.trim())
            PayoutMethodKind.WALLET -> Unit // retired: never offered, never sent
        }
    }

    /**
     * The role half of the request — added beside the account + identity fields of
     * `POST /api/auth/signup` and `POST /api/local/account/identity`.
     *
     * guest: `role` + `refund_method` only when [refund] is non-null (a skipped step omits it).
     * host:  `role`, `host_type`, `address`, `company` (company/brokerage, when typed), `notes`
     *        (when typed), `terms_accepted`, `payout`.
     */
    fun roleBody(
        role: SignupRole,
        hosting: HostingDetailsDraft?,
        refund: PayoutDraft?,
        payout: PayoutDraft?
    ): Map<String, Any> = buildMap {
        put("role", role.apiValue)
        when (role) {
            SignupRole.Guest -> {
                if (refund != null) put(FIELD_REFUND_METHOD, destinationBody(refund))
            }
            SignupRole.Host -> {
                val h = hosting ?: HostingDetailsDraft()
                put(FIELD_HOST_TYPE, h.hostType.apiValue)
                put(FIELD_ADDRESS, collapse(h.address))
                if (showsCompany(h.hostType)) {
                    collapse(h.company).takeIf { it.isNotEmpty() }?.let { put(FIELD_COMPANY, it) }
                }
                h.notes.trim().takeIf { it.isNotEmpty() }?.let { put(FIELD_NOTES, it) }
                put("terms_accepted", h.termsAccepted)
                if (payout != null) put(FIELD_PAYOUT, destinationBody(payout))
            }
        }
    }

    /**
     * Maps a signup refusal that carries NO `fields` (the API checks email, password and name
     * first and answers each alone) onto the Account step's field key, so it shows under that
     * field and the flow jumps back there. [hint] is the response's `emailProblem` /
     * `passwordProblem` / `nameProblem` key that was present, or null; a 409 is always the email.
     */
    fun accountFieldFor(status: Int, hint: String?): String? = when {
        status == 409 -> FIELD_EMAIL
        status != 400 -> null
        hint == "emailProblem" -> FIELD_EMAIL
        hint == "passwordProblem" -> FIELD_PASSWORD
        hint == "nameProblem" -> FIELD_FULL_NAME
        else -> FIELD_EMAIL // "Email and password are required"
    }
}

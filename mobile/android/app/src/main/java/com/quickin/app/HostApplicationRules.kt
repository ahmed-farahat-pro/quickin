package com.quickin.app

/**
 * The become-a-host application on the SAME account (2026-11-13).
 *
 * A guest already gave their name, phone and ID at signup, so the application never asks for them
 * again: `GET /api/local/host/application` returns them as `profile` (shown read-only, "From your
 * profile") plus `profile.missing` — the only profile fields the form may ask for (an account from
 * before the signup rule). `POST /api/local/host/apply` takes those three from the profile and
 * ignores submitted ones, and adds the host-only facts: host type, address, a payout destination
 * (`payout`, unless one is on file) and `terms_accepted: true`.
 *
 * The Kotlin twin of the backend's `host-application-core.ts`. Pure — no Android framework, no
 * org.json — so `HostApplicationRulesTest` runs it on the desktop JVM.
 */
object HostApplicationRules {

    /** Profile fields an application needs, in the order the form shows them. */
    const val FULL_NAME = "full_name"
    const val PHONE = "phone"
    const val NATIONAL_ID = "national_id"
    val PROFILE_FIELDS: List<String> = listOf(FULL_NAME, PHONE, NATIONAL_ID)

    /** Server `fields` keys that belong to the application's own sections. */
    const val ADDRESS = "address"
    const val HOST_TYPE = "host_type"
    const val TERMS = "terms"
    const val PAYOUT = "payout"

    /**
     * What `GET /api/local/host/application` said about the applicant's profile. [missing] is
     * already filtered to [PROFILE_FIELDS]; a null [ApplicantProfile] means an older server that
     * does not send `profile` at all.
     */
    data class ApplicantProfile(
        val fullName: String? = null,
        val phone: String? = null,
        val nationalId: String? = null,
        val docType: String? = null,
        val verificationStatus: String? = null,
        val missing: List<String> = emptyList()
    ) {
        /** The value on file for [field], or null. */
        fun valueOf(field: String): String? = when (field) {
            FULL_NAME -> fullName
            PHONE -> phone
            NATIONAL_ID -> nationalId
            else -> null
        }?.trim()?.takeUnless { it.isEmpty() }
    }

    /**
     * Keeps only known profile field names from a server `missing` list, de-duplicated and in
     * [PROFILE_FIELDS] order. Unknown names are dropped — a field this build has no input for must
     * not block the submit button forever.
     */
    fun normalizeMissing(raw: List<String?>): List<String> {
        val wanted = raw.mapNotNull { it?.trim()?.lowercase() }.toSet()
        return PROFILE_FIELDS.filter { it in wanted }
    }

    /**
     * Which profile fields the form shows an INPUT for.
     *
     * With a [profile] from the server: exactly its `missing` list, plus any field the profile
     * somehow has no value for (belt-and-braces — the server would refuse it as blank).
     * Without one (an older server that still reads the submitted values): all three, the
     * pre-2026-11-13 form.
     */
    fun fieldsToAsk(profile: ApplicantProfile?): List<String> {
        if (profile == null) return PROFILE_FIELDS
        val missing = profile.missing.toSet()
        return PROFILE_FIELDS.filter { it in missing || profile.valueOf(it) == null }
    }

    /** The profile fields shown read-only in the "From your profile" card, with their values. */
    fun onFile(profile: ApplicantProfile?): List<Pair<String, String>> {
        if (profile == null) return emptyList()
        val asked = fieldsToAsk(profile).toSet()
        return PROFILE_FIELDS.filter { it !in asked }.mapNotNull { f -> profile.valueOf(f)?.let { f to it } }
    }

    /**
     * Must the application carry a payout destination? Only when none is on file — the twin of
     * `payoutRequired`. A re-applicant who already keeps one is not made to type it again.
     */
    fun payoutRequired(hasPayoutOnFile: Boolean): Boolean = !hasPayoutOnFile

    /**
     * Is [draft] complete enough to send? Presence only — the server does the real validation
     * (IBAN checksum, InstaPay shape) and its message comes back as the `payout` field error. This
     * mirrors `validatePayout`'s required fields so the button never enables on a draft the server
     * is certain to refuse for a missing value.
     */
    fun payoutDraftComplete(draft: PayoutDraft): Boolean {
        if (draft.accountName.trim().length < 2) return false
        return when (draft.method) {
            PayoutMethodKind.BANK_ACCOUNT ->
                draft.bankName.trim().length >= 2 &&
                    (draft.iban.isNotBlank() || draft.accountNumber.isNotBlank())
            PayoutMethodKind.INSTAPAY -> draft.instapayAddress.isNotBlank()
            PayoutMethodKind.WALLET -> false // retired: never savable
        }
    }

    /** Everything the submit button waits for. */
    data class Readiness(
        /** Values typed into the inputs for [fieldsToAsk]; keyed by profile field name. */
        val askedValues: Map<String, String>,
        val askedFields: List<String>,
        /** Whether a typed name passes [NameRules]; ignored when the name input is not shown. */
        val nameOk: Boolean,
        val address: String,
        val idDocumentsReady: Boolean,
        val payoutOnFile: Boolean,
        val payoutDraft: PayoutDraft,
        val termsAccepted: Boolean
    )

    fun canSubmit(r: Readiness): Boolean {
        val profileOk = r.askedFields.all { r.askedValues[it].orEmpty().isNotBlank() } &&
            (FULL_NAME !in r.askedFields || r.nameOk)
        val payoutOk = !payoutRequired(r.payoutOnFile) || payoutDraftComplete(r.payoutDraft)
        return profileOk && r.address.isNotBlank() && r.idDocumentsReady && payoutOk && r.termsAccepted
    }

    /**
     * Whether a payout object goes in the request: always when none is on file; when one is, only
     * if the applicant chose to replace it (the server then validates and saves the new one).
     */
    fun sendPayout(payoutOnFile: Boolean, replacing: Boolean): Boolean = !payoutOnFile || replacing

    /**
     * The host terms, on the same site as the profile's legal links (`/terms`), opened at the host
     * agreement (the page's `#host` section).
     */
    const val TERMS_PATH = "/terms#host"

    fun termsUrl(webBase: String): String = webBase.trimEnd('/') + TERMS_PATH
}

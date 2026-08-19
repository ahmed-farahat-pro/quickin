package com.quickin.app

/**
 * One identity, verified once from the profile, serving guest and host alike.
 *
 * The Kotlin twin of the backend's `nationalIdForApplication`
 * (`host-verification-core.ts`) and of iOS's `IdentityRules` (TrustService.swift).
 * It decides what the become-a-host form puts in its National ID field.
 *
 * A **verified** submission's number is the one an admin already approved, so it
 * is shown and locked rather than asked for: an application carrying a different
 * number leaves the reviewer holding two answers, with nothing to say which one
 * is the person's. Anything else is only a seed — a reapply's own answer first,
 * then the number on a submission still under review (or a rejected one; the
 * photos were refused, the number typed alongside them was not) — and stays
 * editable, because nothing about it has been approved yet.
 *
 * The documents themselves reach the application the same way — see
 * [IdentityRules.needsIdentityDocuments]. A user who already submitted them from
 * the Profile tab's "Verify your identity" card is asked for neither the number
 * nor the photos again; everyone else uploads them as part of applying, because
 * the server will not file an application it cannot review.
 *
 * KEEP IN SYNC with `nationalIdForApplication` and iOS's `IdentityRules` — all
 * three forms write the same `host_applications.national_id`, and a field one
 * client fills in while another asks for it is exactly the redundancy this
 * closes.
 */
object IdentityRules {

    /** What the National ID field starts with, and whether it may be edited. */
    data class NationalIdField(
        /** Never null, so a text field can bind to it directly. */
        val value: String,
        /** True when the value came from an approved ID: show it, don't ask for it. */
        val locked: Boolean
    )

    /**
     * [status] is the raw `verification_status` ("unverified" | "pending" |
     * "verified" | "rejected"; anything unknown reads as unverified, so an
     * unrecognised value never locks a field). [submittedIdNumber] is the number
     * on the identity submission we hold, [previousNationalId] the one on a
     * previous application when reapplying.
     */
    fun nationalId(
        status: String?,
        submittedIdNumber: String?,
        previousNationalId: String? = null
    ): NationalIdField {
        val submitted = submittedIdNumber.orEmpty().trim()
        if (status.orEmpty().trim().lowercase() == "verified" && submitted.isNotEmpty()) {
            return NationalIdField(submitted, locked = true)
        }
        val previous = previousNationalId.orEmpty().trim()
        return NationalIdField(previous.ifEmpty { submitted }, locked = false)
    }

    /**
     * Must someone with this verification [status] photograph their ID to apply as a host?
     *
     * The twin of `needsIdentityDocuments` in the backend's `host-verification-core.ts`, which
     * `POST /api/local/host/apply` enforces: an application with no document behind it gives the
     * reviewer nothing to read the declared name and national ID against, so the API refuses it
     * (400 with a per-field `fields` map). This is what keeps the form from letting an applicant
     * reach that refusal.
     *
     * "verified" is already approved and "pending" is already in the reviewer's queue — it is
     * decided together with the application — so neither uploads again. "rejected" and "no
     * submission" must: a rejection means "these are not good enough", and refiling the same row
     * would put the same refused photos back in front of the reviewer.
     *
     * An unknown or missing status reads as no submission, the safe direction — asking for a
     * document we turn out not to need costs an upload, while skipping one we do need costs the
     * applicant a refused request.
     */
    fun needsIdentityDocuments(status: String?): Boolean =
        when (status.orEmpty().trim().lowercase()) {
            "verified", "pending" -> false
            else -> true
        }
}

/**
 * The documents a host may submit, matching `DOC_TYPES` in the backend's host-verification-core.
 * [apiValue] is sent as `doc_type`; the reviewer checks the photo against the declared type, which
 * is why the server refuses an unknown one rather than quietly filing it as a National ID.
 */
enum class IdDocType(
    val apiValue: String,
    @androidx.annotation.StringRes val labelRes: Int
) {
    NationalId("national_id", R.string.doc_type_national_id),
    Passport("passport", R.string.doc_type_passport),
    ResidencePermit("residence_permit", R.string.doc_type_residence_permit);

    companion object {
        /** Maps a raw "doc_type" value to the enum; unknown / null → [NationalId]. */
        fun from(raw: String?): IdDocType = when (raw?.trim()?.lowercase()) {
            "passport" -> Passport
            "residence_permit" -> ResidencePermit
            else -> NationalId
        }
    }
}

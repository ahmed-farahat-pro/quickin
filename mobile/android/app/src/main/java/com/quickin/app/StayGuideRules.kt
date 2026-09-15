package com.quickin.app

/**
 * WHICH face of the stay guide a reservation-detail screen shows — the host's builder, the guest's
 * read-only copy, the one-line "approve it first" note, or nothing at all.
 *
 * Pulled out of the composable so the decision is assertable in a plain JVM test: the branch this
 * file exists to guard has four inputs and is exactly the kind of thing that drifts.
 *
 * THE regression this file exists for: the "approve it first" note was shown to **any** host-ish
 * viewer with no guide to read, whatever state the booking was in. On a REJECTED reservation that
 * put "You can build the stay guide once you approve this reservation" at the bottom of a request
 * the host had already turned down (and, before [Reservation.isViewerHost] was the gate, in front
 * of the guest as well). The note promises a future unlock; only a still-pending request has one.
 *
 * WHO may see each face is not decided here — that is [Reservation.isViewerHost], and it is the
 * caller's job to have asked it. This answers only WHAT, given a viewer's role.
 */
object StayGuideRules {

    /** What [viewFor] decided to render. */
    enum class View {
        /** Nothing at all — no card, no empty state, no explanation. */
        Hidden,

        /**
         * Host-only, and only while the request is still PENDING: one line saying the builder
         * unlocks when they approve it. Never on a rejected or cancelled booking, whose guide
         * will never open.
         */
        AwaitingApproval,

        /** The host's builder — the existing items plus add / edit / reorder / delete. */
        Editor,

        /** The guide as the guest reads it: grouped, read-only, no controls. */
        ReadOnly,
    }

    /**
     * @param isHost whether the viewer hosts THIS reservation ([Reservation.isViewerHost]) — never
     *   the account-level `is_host`.
     * @param hasStayPass [Reservation.hasStayPass] — approved AND paid. The guest's gate, the same
     *   one the QR uses: the guide is what the pass leads to, so it must not open before payment.
     * @param canEdit [Reservation.canEditStayGuide] — the booking is in a state the backend accepts
     *   writes for (confirmed). Looser than [hasStayPass] on purpose: a host should be writing
     *   check-in notes while the guest pays.
     * @param awaitingApproval [Reservation.isAwaitingApproval] — still pending, so approval (and
     *   with it the builder) is genuinely ahead of this booking rather than behind it.
     * @param itemCount how many items the guide holds.
     * @param loading whether the guide is still being fetched — an empty-but-loading guide keeps
     *   its card so the spinner has somewhere to live.
     */
    fun viewFor(
        isHost: Boolean,
        hasStayPass: Boolean,
        canEdit: Boolean,
        awaitingApproval: Boolean,
        itemCount: Int,
        loading: Boolean,
    ): View {
        // The builder outranks everything: a host mid-write has content to show even when the
        // guest's pass is still closed behind an unpaid transfer.
        if (isHost && canEdit) return View.Editor

        // Readers — the guest, and a host who can no longer edit (a checked-out booking) — get the
        // card only when there is something in it. No empty state for content that isn't theirs.
        if (hasStayPass && (itemCount > 0 || loading)) return View.ReadOnly

        // Nothing to read and no builder to offer. The only thing left worth saying is "approve it
        // and you can write one", and only to the host of a request that can still BE approved.
        return if (isHost && awaitingApproval) View.AwaitingApproval else View.Hidden
    }
}

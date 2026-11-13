package com.quickin.app

/**
 * The App guide (onboarding walkthrough) — the pure half. Which steps a tour shows for this
 * account, whether the main tour may start by itself, and what the last step's buttons are.
 * The overlay that draws it lives in `ui/AppGuide.kt`; this file holds only the decisions, so
 * they can be unit-tested without a device (`GuideRulesTest`).
 *
 * One spec for iOS, Android and web: `mobile/APP-GUIDE-SPEC.md`. The step order and the
 * signed-out / pending / host variants below are that document's tables, row for row.
 */
object GuideRules {

    /** SharedPreferences key: set once the main tour ends in any way (Done, Skip or X). */
    const val SEEN_KEY = "qk.guide.main.v1.seen"

    enum class Tour { MAIN, HOST }

    /** Every step either tour can show. The `_SIGNED_OUT` / `_PENDING` / `_HOST` rows are variants. */
    enum class StepId {
        WELCOME, SEARCH, REGIONS, FILTERS, WISHLIST, TRIPS, PROFILE, PROFILE_SIGNED_OUT,
        FINISH, FINISH_HOST,
        HOST_INTRO, HOST_PROFILE_TAB, HOST_BECOME_HOST, HOST_SIGN_IN_FIRST, HOST_PENDING,
        HOST_ALREADY_HOST, HOST_REQUIREMENTS, HOST_REVIEW, HOST_AFTER_APPROVAL
    }

    /** What a step highlights. [NONE] shows the card centred, with no cutout. */
    enum class Anchor {
        NONE,
        EXPLORE_SEARCH, EXPLORE_REGIONS, EXPLORE_FILTERS,
        TAB_WISHLIST, TAB_TRIPS, TAB_PROFILE,
        PROFILE_HOST_CARD, PROFILE_SIGN_IN, PROFILE_HOST_DASHBOARD
    }

    /** The tab a step needs on screen before its anchor can be found; null = wherever we are. */
    enum class Screen { EXPLORE, PROFILE }

    /** The last step's actions besides Skip / Back. [DONE] always comes last. */
    enum class FinalButton { SHOW_ME_HOW, APPLY_NOW, SIGN_IN, DONE }

    data class Step(val id: StepId, val anchor: Anchor = Anchor.NONE, val screen: Screen? = null)

    /**
     * The steps of [tour] for this account. Both tours keep a fixed length (8 and 6) whatever the
     * account, so a sign-in mid-tour swaps a step's variant without moving the current index.
     */
    fun steps(tour: Tour, signedIn: Boolean, isHost: Boolean, hostApplicationPending: Boolean): List<Step> =
        when (tour) {
            Tour.MAIN -> listOf(
                // The welcome lands on Explore too, so a replay started from Profile does not
                // jump tabs between step 1 and step 2.
                Step(StepId.WELCOME, screen = Screen.EXPLORE),
                Step(StepId.SEARCH, Anchor.EXPLORE_SEARCH, Screen.EXPLORE),
                Step(StepId.REGIONS, Anchor.EXPLORE_REGIONS, Screen.EXPLORE),
                Step(StepId.FILTERS, Anchor.EXPLORE_FILTERS, Screen.EXPLORE),
                Step(StepId.WISHLIST, Anchor.TAB_WISHLIST),
                Step(StepId.TRIPS, Anchor.TAB_TRIPS),
                Step(if (signedIn) StepId.PROFILE else StepId.PROFILE_SIGNED_OUT, Anchor.TAB_PROFILE),
                Step(if (signedIn && isHost) StepId.FINISH_HOST else StepId.FINISH)
            )
            Tour.HOST -> listOf(
                Step(StepId.HOST_INTRO),
                Step(StepId.HOST_PROFILE_TAB, Anchor.TAB_PROFILE),
                when {
                    !signedIn -> Step(StepId.HOST_SIGN_IN_FIRST, Anchor.PROFILE_SIGN_IN, Screen.PROFILE)
                    isHost -> Step(StepId.HOST_ALREADY_HOST, Anchor.PROFILE_HOST_DASHBOARD, Screen.PROFILE)
                    hostApplicationPending -> Step(StepId.HOST_PENDING, Anchor.PROFILE_HOST_CARD, Screen.PROFILE)
                    else -> Step(StepId.HOST_BECOME_HOST, Anchor.PROFILE_HOST_CARD, Screen.PROFILE)
                },
                Step(StepId.HOST_REQUIREMENTS),
                Step(StepId.HOST_REVIEW),
                Step(StepId.HOST_AFTER_APPROVAL)
            )
        }

    /**
     * Whether the main tour may start by itself now: only while it has never ended on this
     * device, and never on top of something else (splash, the signup completion screen, the
     * notification primer, any sheet or dialog). A refusal is retried later, never queued.
     */
    fun shouldAutoStart(seen: Boolean, blockingUIShown: Boolean): Boolean = !seen && !blockingUIShown

    /**
     * The last step's actions. Main tour: "Show me how" (into the host tour) for anyone not
     * already a host. Host tour: "Apply now" for a signed-in guest with nothing pending, "Sign in"
     * when signed out, otherwise just Done. Any step that is not the last gets none.
     */
    fun finalButtons(step: StepId, signedIn: Boolean, isHost: Boolean, hostApplicationPending: Boolean): List<FinalButton> =
        when (step) {
            StepId.FINISH -> listOf(FinalButton.SHOW_ME_HOW, FinalButton.DONE)
            StepId.FINISH_HOST -> listOf(FinalButton.DONE)
            StepId.HOST_AFTER_APPROVAL -> when {
                !signedIn -> listOf(FinalButton.SIGN_IN, FinalButton.DONE)
                !isHost && !hostApplicationPending -> listOf(FinalButton.APPLY_NOW, FinalButton.DONE)
                else -> listOf(FinalButton.DONE)
            }
            else -> emptyList()
        }

    /**
     * The tab a tap on [anchor]'s cutout switches to ("Explore" / "wishlist" / "Trips" /
     * "Profile", MainActivity's tab keys), or null when the tap is simply Next. A tab target
     * navigates AND advances; anything else must not fire under the tour (no search sheet, no
     * application form).
     */
    fun tabForTap(anchor: Anchor): String? = when (anchor) {
        Anchor.TAB_WISHLIST -> "wishlist"
        Anchor.TAB_TRIPS -> "Trips"
        Anchor.TAB_PROFILE -> "Profile"
        else -> null
    }
}

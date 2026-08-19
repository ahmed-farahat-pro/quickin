package com.quickin.app.ui

import com.quickin.app.EmailRules
import com.quickin.app.NameRules

/**
 * The parts of [AuthScreen]'s form logic that are plain value logic rather than layout, kept out
 * of the composable so they can be run on the desktop JVM (see AuthFormStateTest) — the same
 * split EmailRules/NameRules already use.
 */

/**
 * True when everything the current mode needs is in place APART from the address.
 *
 * Sign-up means a usable name and a new password typed identically twice; sign-in means simply
 * that a password has been entered. It answers one question: "is the address the only thing left
 * to fix?" — which is what decides whether the email hint should speak up on its own.
 */
fun authOtherFieldsReady(
    isSignUp: Boolean,
    name: String,
    password: String,
    confirmPassword: String
): Boolean = if (isSignUp) {
    NameRules.isValid(name) && passwordMeetsMin(password) && confirmPassword == password
} else {
    password.isNotEmpty()
}

/**
 * Whether the inline email hint is allowed to speak.
 *
 * [touched] is the ordinary trigger — the user left the field, so the address is finished being
 * typed. It is deliberately dropped when the sign-in/sign-up toggle is flipped, so the form the
 * user arrives at starts clean instead of carrying the previous mode's complaint.
 *
 * That leaves one gap: an address the new mode refuses (a temp-mail domain is fine to sign in
 * with and refused at sign-up) would keep the submit button dead with nothing on screen to
 * explain it. So the hint also arms itself once [otherFieldsReady] — at that point the address is
 * the only thing left, and silence would be the worse failure. Never while the field is
 * [focused], because an address is not wrong while it is still being typed.
 */
fun authEmailHintArmed(
    email: String,
    touched: Boolean,
    focused: Boolean,
    otherFieldsReady: Boolean
): Boolean = EmailRules.normalized(email).isNotEmpty() && (touched || (!focused && otherFieldsReady))

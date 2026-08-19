package com.quickin.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.quickin.app.EmailRules
import com.quickin.app.R

/**
 * The localized sentence for an address [EmailRules] refused, shared by the
 * sign-up / sign-in form and the password-reset screen so the two can never
 * disagree about how a typo reads.
 *
 * It names the actual problem rather than a generic "invalid": `layla@gmail.con`
 * comes back as “.con” isn't a valid domain extension. Did you mean
 * layla@gmail.com? — which is the whole point, because a user who cannot see
 * what is wrong with their own address just leaves.
 */
@Composable
fun emailProblemMessage(problem: EmailRules.Problem, raw: String): String = when (problem) {
    is EmailRules.Problem.Required,
    is EmailRules.Problem.Format -> stringResource(R.string.auth_email_invalid)
    is EmailRules.Problem.TooLong -> stringResource(R.string.auth_email_too_long)
    is EmailRules.Problem.Disposable -> stringResource(R.string.auth_email_disposable)
    is EmailRules.Problem.UnknownTld -> {
        val head = stringResource(R.string.auth_email_bad_tld, problem.tld)
        val suggestion = problem.suggestion
        if (suggestion == null) {
            head
        } else {
            val value = EmailRules.normalized(raw)
            val local = value.substringBeforeLast('@', "")
            head + " " + stringResource(R.string.auth_email_did_you_mean, "$local@$suggestion")
        }
    }
}

/**
 * The inline hint for an email field, or null when there is nothing to say.
 *
 * [fullPolicy] picks which rule applies. Sign-up passes true and gets the whole
 * thing, temp-mail included. Sign-in and password reset pass false: they only
 * ever touch an account that already exists, so refusing a disposable domain
 * there would lock out whoever signed up before the blocklist without stopping
 * a single new account. The server draws the line in the same place.
 *
 * [touched] keeps the hint quiet until the user has committed to something —
 * an address is not wrong while it is still being typed.
 */
@Composable
fun emailFieldError(raw: String, touched: Boolean, fullPolicy: Boolean): String? {
    if (!touched || EmailRules.normalized(raw).isEmpty()) return null
    val problem = EmailRules.problemWith(raw) ?: return null
    if (!fullPolicy && problem is EmailRules.Problem.Disposable) return null
    return emailProblemMessage(problem, raw)
}

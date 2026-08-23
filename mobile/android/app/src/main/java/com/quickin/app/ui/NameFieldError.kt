package com.quickin.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.quickin.app.NameRules
import com.quickin.app.R

/**
 * The localized sentence for a name [NameRules] refused, shared by every screen
 * that takes a person's name so none of them can disagree about how the same
 * `12345` reads. Structured like [emailProblemMessage] beside it.
 *
 * The wording matches `nameProblemMessage` in the backend's name-policy.ts, so a
 * rejection the phone catches and one the server catches say the same thing —
 * only the phone's arrives at the field instead of after a round trip.
 */
@Composable
fun nameProblemMessage(problem: NameRules.Problem): String = when (problem) {
    is NameRules.Problem.Required -> stringResource(R.string.auth_name_required)
    is NameRules.Problem.InvalidCharacters -> stringResource(R.string.auth_name_invalid_characters)
    is NameRules.Problem.NoLetters -> stringResource(R.string.auth_name_no_letters)
    is NameRules.Problem.TooShort -> stringResource(R.string.auth_name_too_short, NameRules.MIN_LETTERS)
    is NameRules.Problem.TooLong -> stringResource(R.string.auth_name_too_long, NameRules.MAX_LENGTH)
}

/**
 * The inline hint under a name field, or null when there is nothing to say.
 *
 * [touched] keeps it quiet until the user has committed to something — a name is
 * not wrong while it is still being typed, and an account created before the
 * rule existed may already hold a name that fails it. Being shouted at on open,
 * about something you did not just do, is not how anyone wants to find out.
 */
@Composable
fun nameFieldError(raw: String, touched: Boolean): String? {
    if (!touched) return null
    val problem = NameRules.problemWith(raw) ?: return null
    return nameProblemMessage(problem)
}

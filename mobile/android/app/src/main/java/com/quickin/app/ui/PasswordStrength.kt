package com.quickin.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.R
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.StrengthGood
import com.quickin.app.ui.theme.StrengthStrong
import com.quickin.app.ui.theme.StrengthWeak
import com.quickin.app.ui.theme.Tan

/**
 * Animated password-strength meter + a live requirements checklist, shown under every
 * "new password" field (sign-up, reset, change-password). Matches the boutique redesign:
 * a rounded track with a spring-filled bar that ramps red → gold → green → deep-green, and
 * one checklist row per rule whose [DrawCheckmark] draws on the moment the rule is met.
 *
 * RTL-safe: rows lay out start→end (the checkmark sits on the leading edge) and the bar fill
 * grows from the leading edge, so under Arabic everything mirrors automatically.
 */

/** The five password rules we score against, in checklist order. */
private enum class PwRule(val labelRes: Int, val test: (String) -> Boolean) {
    MinLength(R.string.pw_rule_length, { it.length >= 8 }),
    Uppercase(R.string.pw_rule_uppercase, { pw -> pw.any { it.isUpperCase() } }),
    Lowercase(R.string.pw_rule_lowercase, { pw -> pw.any { it.isLowerCase() } }),
    Digit(R.string.pw_rule_number, { pw -> pw.any { it.isDigit() } }),
    Special(R.string.pw_rule_special, { pw -> pw.any { !it.isLetterOrDigit() && !it.isWhitespace() } })
}

/**
 * The minimum bar to enable a "set password" action: length ≥ 8 plus upper, lower and a digit
 * (a special character is bonus that lifts the score, but isn't required). Drives the primary
 * button's enabled state on each new-password screen.
 */
fun passwordMeetsMin(pw: String): Boolean =
    PwRule.MinLength.test(pw) &&
        PwRule.Uppercase.test(pw) &&
        PwRule.Lowercase.test(pw) &&
        PwRule.Digit.test(pw)

/** Maps a 0..5 [score] to its label + color, per the spec's ramp. */
private fun strengthLabelRes(score: Int): Int = when {
    score >= 5 -> R.string.pw_strength_strong
    score == 4 -> R.string.pw_strength_good
    score == 3 -> R.string.pw_strength_fair
    else -> R.string.pw_strength_weak
}

private fun strengthColor(score: Int): Color = when {
    score >= 5 -> StrengthStrong
    score == 4 -> StrengthGood
    score == 3 -> Gold
    else -> StrengthWeak
}

/**
 * The animated strength meter. Hidden entirely while [password] is blank; otherwise shows the
 * label + animated bar and the requirements checklist.
 */
@Composable
fun PasswordStrength(
    password: String,
    modifier: Modifier = Modifier
) {
    if (password.isEmpty()) return

    val rulesMet = PwRule.entries.map { it.test(password) }
    val score = rulesMet.count { it }
    val color by animateColorAsState(
        targetValue = strengthColor(score),
        animationSpec = tween(360, easing = QkSwapEasing),
        label = "pwStrengthColor"
    )
    val fraction by animateFloatAsState(
        targetValue = score / 5f,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 220f),
        label = "pwStrengthFill"
    )

    Column(modifier = modifier.fillMaxWidth()) {
        // Label row: "Password strength" caption + the live strength word in its color.
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                stringResource(R.string.pw_strength_label),
                color = Muted,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
            Spacer(Modifier.weight(1f))
            Text(
                stringResource(strengthLabelRes(score)),
                color = color,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(Modifier.height(6.dp))

        // Animated track + fill. The fill width animates (spring) and its color animates (tween).
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(50))
                .background(Tan)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fraction.coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(50))
                    .background(color)
            )
        }

        Spacer(Modifier.height(10.dp))

        // Requirements checklist — one row per rule, the check drawing on when satisfied.
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            PwRule.entries.forEachIndexed { index, rule ->
                RequirementRow(
                    label = stringResource(rule.labelRes),
                    met = rulesMet[index]
                )
            }
        }
    }
}

/**
 * A single checklist row: a leading indicator (an animated [DrawCheckmark] when met, a muted ○
 * when not) followed by the rule label. The label tints Ink when met, Muted when not.
 */
@Composable
private fun RequirementRow(
    label: String,
    met: Boolean
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier.size(16.dp),
            contentAlignment = Alignment.Center
        ) {
            if (met) {
                // DrawCheckmark "draws on" each time the rule becomes satisfied (its LaunchedEffect
                // re-runs because the composable enters composition when `met` flips to true).
                DrawCheckmark(
                    size = 16.dp,
                    circleColor = StrengthGood,
                    checkColor = StrengthGood
                )
            } else {
                // Unmet: a hollow muted ring.
                Box(
                    modifier = Modifier
                        .size(14.dp)
                        .clip(CircleShape)
                        .border(1.5.dp, Muted, CircleShape)
                )
            }
        }
        Text(
            label,
            color = if (met) Ink else Muted,
            fontSize = 13.sp,
            fontWeight = if (met) FontWeight.Medium else FontWeight.Normal
        )
    }
}

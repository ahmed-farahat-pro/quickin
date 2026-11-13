package com.quickin.app.ui

import android.content.Context
import android.provider.Settings
import androidx.annotation.StringRes
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddHome
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.GuideRules
import com.quickin.app.GuideRules.FinalButton
import com.quickin.app.GuideRules.StepId
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The App guide's drawing half (the decisions are in `GuideRules`): where each anchor is on
 * screen, the dimmed overlay with its cutout and tooltip card, the "seen" flag, and the Profile →
 * "App guide" chooser. Spec: `mobile/APP-GUIDE-SPEC.md`.
 */

/** The device-local "main tour has ended" flag. No backend: a reinstall shows the tour again. */
object AppGuidePrefs {
    private const val PREFS_NAME = "qk_app_guide"

    fun seen(context: Context): Boolean =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(GuideRules.SEEN_KEY, false)

    fun markSeen(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putBoolean(GuideRules.SEEN_KEY, true).apply()
    }
}

/**
 * Where each guide anchor currently sits, in root coordinates. Screens report into it through
 * [guideTarget]; the overlay reads it. [active] is the anchor the current step wants, so a screen
 * can bring its target into view (scroll to top, leave map mode) while that step is showing.
 */
@Stable
class GuideTargets {
    // owner → bounds: during a tab cross-fade the outgoing and incoming copies of a screen both
    // report the same anchor, and only the one that wrote last may erase it on dispose.
    private val bounds = mutableStateMapOf<GuideRules.Anchor, Pair<Any, Rect>>()

    var active by mutableStateOf<GuideRules.Anchor?>(null)

    internal fun report(anchor: GuideRules.Anchor, owner: Any, rect: Rect) {
        val current = bounds[anchor]
        if (current == null || current.first !== owner || current.second != rect) bounds[anchor] = owner to rect
    }

    internal fun remove(anchor: GuideRules.Anchor, owner: Any) {
        if (bounds[anchor]?.first === owner) bounds.remove(anchor)
    }

    /** The anchor's on-screen bounds, or null when it is not laid out or scrolled/clipped away. */
    fun boundsOf(anchor: GuideRules.Anchor): Rect? =
        bounds[anchor]?.second?.takeIf { it.width > 1f && it.height > 1f }
}

/** Null outside the tabbed shell, which makes [guideTarget] a no-op there. */
val LocalGuideTargets = staticCompositionLocalOf<GuideTargets?> { null }

/** Marks this element as the target of [anchor]'s guide step. */
fun Modifier.guideTarget(anchor: GuideRules.Anchor): Modifier = composed {
    val targets = LocalGuideTargets.current
    if (targets == null) {
        Modifier
    } else {
        val owner = remember { Any() }
        DisposableEffect(targets, anchor) { onDispose { targets.remove(anchor, owner) } }
        // boundsInRoot is already clipped by scrolling parents, so a target scrolled off screen
        // reports an empty rect and the step falls back to the centred card.
        Modifier.onGloballyPositioned { targets.report(anchor, owner, it.boundsInRoot()) }
    }
}

/** Title + body string resources for a step. HOST_REQUIREMENTS has no body: it shows a checklist. */
private fun stepCopy(id: StepId): Pair<Int, Int?> = when (id) {
    StepId.WELCOME -> R.string.guide_welcome_title to R.string.guide_welcome_body
    StepId.SEARCH -> R.string.guide_search_title to R.string.guide_search_body
    StepId.REGIONS -> R.string.guide_regions_title to R.string.guide_regions_body
    StepId.FILTERS -> R.string.guide_filters_title to R.string.guide_filters_body
    StepId.WISHLIST -> R.string.guide_wishlist_title to R.string.guide_wishlist_body
    StepId.TRIPS -> R.string.guide_trips_title to R.string.guide_trips_body
    StepId.PROFILE -> R.string.guide_profile_title to R.string.guide_profile_body
    StepId.PROFILE_SIGNED_OUT -> R.string.guide_profile_signed_out_title to R.string.guide_profile_signed_out_body
    StepId.FINISH -> R.string.guide_finish_title to R.string.guide_finish_body
    StepId.FINISH_HOST -> R.string.guide_finish_title to R.string.guide_finish_host_body
    StepId.HOST_INTRO -> R.string.guide_host_intro_title to R.string.guide_host_intro_body
    StepId.HOST_PROFILE_TAB -> R.string.guide_host_profile_tab_title to R.string.guide_host_profile_tab_body
    StepId.HOST_BECOME_HOST -> R.string.guide_host_become_title to R.string.guide_host_become_body
    StepId.HOST_SIGN_IN_FIRST -> R.string.guide_host_sign_in_title to R.string.guide_host_sign_in_body
    StepId.HOST_PENDING -> R.string.guide_host_pending_title to R.string.guide_host_pending_body
    StepId.HOST_ALREADY_HOST -> R.string.guide_host_already_title to R.string.guide_host_already_body
    StepId.HOST_REQUIREMENTS -> R.string.guide_host_requirements_title to null
    StepId.HOST_REVIEW -> R.string.guide_host_review_title to R.string.guide_host_review_body
    StepId.HOST_AFTER_APPROVAL -> R.string.guide_host_after_title to R.string.guide_host_after_body
}

private val REQUIREMENTS = listOf(
    R.string.guide_req_host_type,
    R.string.guide_req_name_id,
    R.string.guide_req_phone,
    R.string.guide_req_address,
    R.string.guide_req_id_photos
)

@StringRes
private fun finalButtonLabel(button: FinalButton): Int = when (button) {
    FinalButton.SHOW_ME_HOW -> R.string.guide_show_me_how
    FinalButton.APPLY_NOW -> R.string.guide_apply_now
    FinalButton.SIGN_IN -> R.string.guide_sign_in
    FinalButton.DONE -> R.string.guide_done
}

/** "Remove animations" is on — the Android analogue of iOS Reduce Motion. */
@Composable
private fun rememberGuideReduceMotion(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}

/**
 * The full-screen guide layer, drawn above the tabbed Scaffold: black at 55% with a rounded
 * cutout around [target] (8dp padding, 12dp corners, a 2dp burgundy ring) and the tooltip card
 * above or below it, whichever side has more room. No target → the card is centred, no cutout.
 * Taps on the dim do nothing; a tap inside the cutout calls [onTargetTap].
 */
@Composable
fun AppGuideOverlay(
    step: GuideRules.Step,
    index: Int,
    count: Int,
    target: Rect?,
    finalButtons: List<FinalButton>,
    onNext: () -> Unit,
    onBack: () -> Unit,
    onSkip: () -> Unit,
    onClose: () -> Unit,
    onTargetTap: () -> Unit,
    onFinalButton: (FinalButton) -> Unit,
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    val reduceMotion = rememberGuideReduceMotion()
    // The overlay's own origin in root coordinates, so target bounds (root) map into it.
    var origin by remember { mutableStateOf(Offset.Zero) }
    val padPx = with(density) { 8.dp.toPx() }
    val radiusPx = with(density) { 12.dp.toPx() }
    val ringPx = with(density) { 2.dp.toPx() }
    val hole = target?.translate(-origin)?.inflate(padPx)

    // The cutout glides to each new step's target (~0.25s); within a step it tracks the target
    // exactly (scrolling, a tab sliding in). Reduce Motion snaps.
    val anim = remember { Animatable(Rect.Zero, Rect.VectorConverter) }
    var lastStep by remember { mutableStateOf<StepId?>(null) }
    LaunchedEffect(hole) {
        if (hole == null) return@LaunchedEffect
        val glide = !reduceMotion && anim.value != Rect.Zero && lastStep != step.id
        lastStep = step.id
        if (glide) anim.animateTo(hole, tween(250, easing = FastOutSlowInEasing)) else anim.snapTo(hole)
    }
    val cutout = if (hole != null && anim.value != Rect.Zero) anim.value else null

    val (titleRes, bodyRes) = stepCopy(step.id)
    val title = stringResource(titleRes)
    val body = bodyRes?.let { stringResource(it) }
        ?: REQUIREMENTS.map { stringResource(it) }.joinToString(". ")
    val a11y = stringResource(R.string.guide_a11y_step, index + 1, count, title, body)

    val insets = WindowInsets.systemBars
    val topInset = insets.getTop(density)
    val bottomInset = insets.getBottom(density)

    Box(
        modifier = modifier
            .fillMaxSize()
            .onGloballyPositioned { origin = it.positionInRoot() }
            .semantics { paneTitle = title }
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(cutout) {
                    detectTapGestures { pos -> if (cutout?.contains(pos) == true) onTargetTap() }
                }
        ) {
            val path = Path().apply {
                fillType = PathFillType.EvenOdd
                addRect(Rect(Offset.Zero, size))
                if (cutout != null) addRoundRect(RoundRect(cutout, CornerRadius(radiusPx)))
            }
            drawPath(path, Color.Black.copy(alpha = 0.55f))
            if (cutout != null) {
                drawRoundRect(
                    color = Burgundy,
                    topLeft = cutout.topLeft,
                    size = cutout.size,
                    cornerRadius = CornerRadius(radiusPx),
                    style = Stroke(width = ringPx)
                )
            }
        }

        // The card, placed by hand: centred horizontally, above or below the cutout.
        Layout(
            content = {
                GuideCard(
                    stepId = step.id,
                    title = title,
                    body = bodyRes?.let { stringResource(it) },
                    a11y = a11y,
                    index = index,
                    count = count,
                    finalButtons = finalButtons,
                    onNext = onNext,
                    onBack = onBack,
                    onSkip = onSkip,
                    onClose = onClose,
                    onFinalButton = onFinalButton
                )
            },
            modifier = Modifier.fillMaxSize()
        ) { measurables, constraints ->
            val side = 16.dp.roundToPx()
            val gap = 12.dp.roundToPx()
            val maxW = min(constraints.maxWidth - side * 2, 440.dp.roundToPx()).coerceAtLeast(0)
            val card = measurables.first().measure(
                Constraints(minWidth = maxW, maxWidth = maxW, maxHeight = constraints.maxHeight)
            )
            layout(constraints.maxWidth, constraints.maxHeight) {
                val h = constraints.maxHeight
                val x = (constraints.maxWidth - card.width) / 2
                val minY = topInset + side
                val maxY = (h - bottomInset - side - card.height).coerceAtLeast(minY)
                val y = if (cutout == null) {
                    (h - card.height) / 2
                } else {
                    val above = cutout.top - minY
                    val below = (h - bottomInset) - cutout.bottom
                    if (below >= above) (cutout.bottom + gap).roundToInt()
                    else (cutout.top - gap - card.height).roundToInt()
                }.coerceIn(minY, maxY)
                card.place(x, y)
            }
        }
    }
}

@Composable
private fun GuideCard(
    stepId: StepId,
    title: String,
    body: String?,
    a11y: String,
    index: Int,
    count: Int,
    finalButtons: List<FinalButton>,
    onNext: () -> Unit,
    onBack: () -> Unit,
    onSkip: () -> Unit,
    onClose: () -> Unit,
    onFinalButton: (FinalButton) -> Unit
) {
    val isLast = index == count - 1
    // Done always closes the footer; anything else the last step offers rides above it.
    val extras = finalButtons.filter { it != FinalButton.DONE }
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(20.dp),
        shadowElevation = 12.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(start = 18.dp, end = 6.dp, top = 6.dp, bottom = 10.dp)) {
            // Step indicator ("3 of 8" + dots) and the close button.
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.guide_step_of, index + 1, count),
                    color = Muted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clearAndSetSemantics { }
                )
                Spacer(Modifier.width(10.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.weight(1f).clearAndSetSemantics { }
                ) {
                    repeat(count) { i ->
                        val w by animateDpAsState(if (i == index) 16.dp else 6.dp, tween(200), label = "dot")
                        Box(
                            Modifier
                                .height(6.dp)
                                .width(w)
                                .background(if (i == index) Burgundy else Tan, CircleShape)
                        )
                    }
                }
                IconButton(onClick = onClose) {
                    Icon(
                        Icons.Filled.Close,
                        contentDescription = stringResource(R.string.guide_close),
                        tint = Muted
                    )
                }
            }

            // Title + body, read as one: "Step 3 of 8. <title>. <body>", re-announced on change.
            Column(
                modifier = Modifier
                    .padding(end = 12.dp)
                    .clearAndSetSemantics {
                        contentDescription = a11y
                        liveRegion = LiveRegionMode.Polite
                    }
            ) {
                Text(title, color = Ink, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                if (body != null) {
                    Text(
                        body,
                        color = Muted,
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }
                if (stepId == StepId.HOST_REQUIREMENTS) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(top = 10.dp)
                    ) {
                        REQUIREMENTS.forEach { res ->
                            Row(verticalAlignment = androidx.compose.ui.Alignment.Top) {
                                Icon(
                                    Icons.Filled.CheckCircle,
                                    contentDescription = null,
                                    tint = Burgundy,
                                    modifier = Modifier.padding(top = 1.dp).size(18.dp)
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(stringResource(res), color = Ink, fontSize = 14.sp, lineHeight = 19.sp)
                            }
                        }
                    }
                }
            }

            if (extras.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                extras.forEach { button ->
                    GradientButton(
                        onClick = { onFinalButton(button) },
                        radius = 14.dp,
                        height = 46.dp,
                        modifier = Modifier.fillMaxWidth().padding(end = 12.dp)
                    ) {
                        Text(
                            stringResource(finalButtonLabel(button)),
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                    }
                }
            }

            // Footer: Skip (leading) · Back (from step 2) · Next / Done (primary).
            Spacer(Modifier.height(8.dp))
            Row(
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().padding(end = 12.dp)
            ) {
                TextButton(onClick = onSkip) {
                    Text(stringResource(R.string.guide_skip), color = Muted)
                }
                Spacer(Modifier.weight(1f))
                if (index > 0) {
                    TextButton(onClick = onBack) {
                        Text(stringResource(R.string.guide_back), color = Burgundy)
                    }
                    Spacer(Modifier.width(4.dp))
                }
                val primaryLabel = stringResource(if (isLast) R.string.guide_done else R.string.guide_next)
                val primary = if (isLast) { { onFinalButton(FinalButton.DONE) } } else onNext
                if (extras.isNotEmpty()) {
                    // The extra action is the filled one; Done steps back to an outline.
                    OutlinedButton(
                        onClick = primary,
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, Tan),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Burgundy)
                    ) { Text(primaryLabel, fontWeight = FontWeight.SemiBold) }
                } else {
                    GradientButton(onClick = primary, radius = 14.dp, height = 42.dp) {
                        Text(primaryLabel, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    }
                }
            }
        }
    }
}

/** The "App guide" row's subtitle-bearing settings row (Profile → Support & legal). */
@Composable
fun AppGuideRow(onClick: () -> Unit, modifier: Modifier = Modifier) {
    SettingsRow(
        icon = Icons.AutoMirrored.Filled.MenuBook,
        title = stringResource(R.string.guide_entry_title),
        subtitle = stringResource(R.string.guide_entry_sub),
        onClick = onClick,
        modifier = modifier
    )
}

/** The small chooser behind Profile → "App guide": replay the app tour, or learn how to host. */
@Composable
fun AppGuideChooser(
    onMainTour: () -> Unit,
    onHostTour: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.guide_entry_title), fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SettingsRow(
                    icon = Icons.Filled.Explore,
                    title = stringResource(R.string.guide_take_tour),
                    onClick = onMainTour
                )
                SettingsRow(
                    icon = Icons.Filled.AddHome,
                    title = stringResource(R.string.guide_how_to_host),
                    onClick = onHostTour
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel), color = Muted)
            }
        },
        containerColor = Cream
    )
}

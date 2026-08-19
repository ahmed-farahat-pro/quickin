package com.quickin.app.ui

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Flight
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.BurgundyDark
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.GoldLight
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * QuickIn branded travel header — the Android port of iOS `QKBrandHeader`
 * (`mobile/ios/Sources/BrandHeader.swift`). It replaces the stock Material
 * `TopAppBar` on the root tabs with a boutique burgundy "boarding pass" banner:
 * on appear a little plane climbs in along a dashed gold contrail and, in its
 * wake, the eyebrow + title/wordmark + subtitle are "delivered" with a gentle
 * rise.
 *
 * Fully RTL-aware (the climb and the plane mirror) and honors the system
 * "remove animations" setting — everything just settles, no flight.
 */
@Composable
fun QkBrandHeader(
    modifier: Modifier = Modifier,
    eyebrow: String? = null,
    title: String = "",
    subtitle: String? = null,
    /** Renders the two-tone "QuickIn" brand mark instead of [title] (Explore). */
    wordmark: Boolean = false,
    /** When set, a frosted back disc is placed before the text column (Wishlist). */
    onBack: (() -> Unit)? = null,
    backContentDescription: String? = null,
    /** Optional accessories (avatar / bell / messages) laid over the burgundy. */
    trailing: @Composable RowScope.() -> Unit = {}
) {
    val shape = RoundedCornerShape(28.dp)
    val reduceMotion = rememberReduceMotion()
    // Plane progress 0→1 (also gates the title reveal timing).
    val progress = remember { Animatable(0f) }
    // Text reveal (rise + fade), kicked off shortly after the plane departs.
    val reveal = remember { Animatable(0f) }

    LaunchedEffect(reduceMotion) {
        if (reduceMotion) {
            progress.snapTo(1f)
            reveal.snapTo(1f)
        } else {
            launch { progress.animateTo(1f, tween(1050, easing = QkSwapEasing)) }
            reveal.animateTo(1f, tween(500, delayMillis = 300, easing = QkSwapEasing))
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp)
            .padding(top = 6.dp)
            .shadow(14.dp, shape, ambientColor = Burgundy, spotColor = Burgundy)
            .clip(shape)
            .background(BurgundyGradient)
            // Soft gold glow in the top-trailing corner — the "sky". Drawn after the
            // gradient (so it sits on top of it) but under the content, and clipped
            // by the rounded shape above.
            .drawWithCache {
                val towardsEnd = if (layoutDirection == LayoutDirection.Rtl) 0f else size.width
                val glow = Brush.radialGradient(
                    colors = listOf(GoldLight.copy(alpha = 0.26f), Color.Transparent),
                    center = Offset(towardsEnd, 0f),
                    radius = 240.dp.toPx()
                )
                onDrawBehind { drawRect(glow) }
            }
            .border(1.dp, Cream.copy(alpha = 0.14f), shape)
            .padding(horizontal = 20.dp)
            .padding(top = 12.dp, bottom = 18.dp)
    ) {
        QkFlightTrail(
            progress = progress.value,
            modifier = Modifier
                .fillMaxWidth()
                .height(32.dp)
        )
        Spacer(Modifier.height(10.dp))

        // Where the eyebrow goes: normally the full banner width, because Explore
        // carries three accessories where iOS carries one and the title row would
        // squeeze "Discover · Stay · Explore" into an ellipsis. With a leading back
        // disc it joins the text column instead, so all three lines share one margin.
        val eyebrowLine: @Composable () -> Unit = {
            if (eyebrow != null) {
                Text(
                    eyebrow.uppercase(),
                    color = GoldLight,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 2.2.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.alpha(reveal.value)
                )
            }
        }
        if (eyebrow != null && onBack == null) {
            eyebrowLine()
            Spacer(Modifier.height(5.dp))
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            if (onBack != null) {
                QkHeaderIconButton(
                    icon = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = backContentDescription,
                    onClick = onBack
                )
                Spacer(Modifier.width(12.dp))
            }

            Column(
                verticalArrangement = Arrangement.spacedBy(5.dp),
                modifier = Modifier.weight(1f)
            ) {
                if (onBack != null) eyebrowLine()
                QkBrandTitle(
                    title = title,
                    wordmark = wordmark,
                    reveal = reveal.value
                )

                if (subtitle != null) {
                    Text(
                        subtitle,
                        color = Cream.copy(alpha = 0.84f),
                        fontSize = 13.5.sp,
                        lineHeight = 18.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.alpha(reveal.value)
                    )
                }
            }

            Spacer(Modifier.width(8.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.alpha(reveal.value),
                content = trailing
            )
        }
    }
}

/**
 * The banner headline: either the two-tone "QuickIn" wordmark (cream "Quick" +
 * gold "In") or the screen [title] in the serif display face. Both rise 10dp and
 * fade in as [reveal] runs 0→1.
 */
@Composable
private fun QkBrandTitle(title: String, wordmark: Boolean, reveal: Float) {
    val riseModifier = Modifier
        .alpha(reveal)
        .offset { IntOffset(0, ((1f - reveal) * 10.dp.toPx()).roundToInt()) }
    val titleShadow = Shadow(
        color = BurgundyDark.copy(alpha = 0.4f),
        offset = Offset(0f, 4f),
        blurRadius = 8f
    )

    if (wordmark) {
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(color = Cream)) { append("Quick") }
                withStyle(SpanStyle(color = GoldLight)) { append("In") }
            },
            fontSize = 38.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Serif,
            style = androidx.compose.ui.text.TextStyle(shadow = titleShadow),
            maxLines = 1,
            modifier = riseModifier
        )
    } else {
        Text(
            title,
            color = Cream,
            fontSize = 29.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Serif,
            style = androidx.compose.ui.text.TextStyle(shadow = titleShadow),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = riseModifier
        )
    }
}

/**
 * A gentle climbing arc with a dashed gold contrail that draws on, a plane at its
 * head and a soft glow. [progress] (0→1) is driven by the parent so the title
 * reveal can be timed to the plane's path. RTL flips the climb and the plane.
 *
 * The geometry is computed in absolute (LTR) coordinates and mirrored by hand, so
 * the content runs with `LayoutDirection.Ltr` forced — otherwise Compose would
 * mirror the already-mirrored offsets a second time.
 */
@Composable
private fun QkFlightTrail(
    progress: Float,
    modifier: Modifier = Modifier,
    tint: Color = GoldLight
) {
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val density = LocalDensity.current

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(modifier) {
            val w = constraints.maxWidth.toFloat()
            val h = constraints.maxHeight.toFloat()
            // A steady climb (takeoff) from the bottom-leading edge up to the
            // top-trailing edge. Mirrored for RTL so it still reads "forward".
            val p0 = Offset(if (rtl) w else 0f, h * 0.94f)
            val c = Offset(w * (if (rtl) 0.55f else 0.45f), h * 0.30f)
            val p1 = Offset(if (rtl) w * 0.05f else w * 0.95f, h * 0.10f)
            val head = quadPoint(p0, c, p1, progress)

            Canvas(Modifier.matchParentSize()) {
                if (progress <= 0f) return@Canvas
                val path = Path().apply {
                    moveTo(p0.x, p0.y)
                    quadraticTo(c.x, c.y, p1.x, p1.y)
                }
                // Draw the contrail only up to the plane's current position.
                val drawn = Path()
                val measure = PathMeasure().apply { setPath(path, false) }
                measure.getSegment(0f, measure.length * progress, drawn, true)
                drawPath(
                    path = drawn,
                    color = tint.copy(alpha = 0.55f),
                    style = Stroke(
                        width = 2.dp.toPx(),
                        cap = StrokeCap.Round,
                        pathEffect = PathEffect.dashPathEffect(
                            floatArrayOf(1.5.dp.toPx(), 7.dp.toPx()),
                            0f
                        )
                    )
                )
            }

            if (progress > 0.04f) {
                val planeSize = 19.dp
                val halfPx = with(density) { planeSize.toPx() / 2f }
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.absoluteOffset {
                        IntOffset((head.x - halfPx).roundToInt(), (head.y - halfPx).roundToInt())
                    }
                ) {
                    // Soft gold glow around the plane (iOS uses a shadow of the tint).
                    Box(
                        modifier = Modifier
                            .size(planeSize * 1.8f)
                            .background(
                                Brush.radialGradient(
                                    listOf(tint.copy(alpha = 0.35f), Color.Transparent)
                                ),
                                CircleShape
                            )
                    )
                    Icon(
                        Icons.Filled.Flight,
                        contentDescription = null,
                        tint = tint,
                        // The Material glyph flies nose-up; turn it to face the
                        // travel direction with the same 12° climb tilt as iOS.
                        modifier = Modifier
                            .size(planeSize)
                            .rotate(if (rtl) -78f else 78f)
                    )
                }
            }
        }
    }
}

/** Point on the quadratic Bézier P0→(control C)→P1 at parameter [t]. */
private fun quadPoint(p0: Offset, c: Offset, p1: Offset, t: Float): Offset {
    val mt = 1f - t
    return Offset(
        mt * mt * p0.x + 2f * mt * t * c.x + t * t * p1.x,
        mt * mt * p0.y + 2f * mt * t * c.y + t * t * p1.y
    )
}

/**
 * A circular header action that sits on the burgundy banner: a frosted cream disc
 * with a cream glyph and an optional gold unread [badge] (capped at "99+").
 * The Android port of iOS `QKHeaderIconButton`.
 */
@Composable
fun QkHeaderIconButton(
    icon: ImageVector,
    contentDescription: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    badge: Int = 0
) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(Cream.copy(alpha = 0.16f))
                .border(1.dp, Cream.copy(alpha = 0.28f), CircleShape)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                icon,
                contentDescription = contentDescription,
                tint = Cream,
                modifier = Modifier.size(20.dp)
            )
        }
        if (badge > 0) {
            Surface(
                color = GoldLight,
                shape = CircleShape,
                border = BorderStroke(1.dp, Burgundy.copy(alpha = 0.25f)),
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 6.dp, y = (-5).dp)
            ) {
                Text(
                    text = if (badge > 99) "99+" else badge.toString(),
                    color = Burgundy,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                )
            }
        }
    }
}

/**
 * The Explore banner's account entry, mirroring iOS `AnimatedProfileAvatar` /
 * `ProfileAvatarButton(onDark:)`: it springs in on appear and a soft cream ring
 * "pings" outward to draw the eye.
 *
 * Signed in it shows the gold initials avatar and opens the Profile tab; signed
 * out it shows a frosted cream account glyph that opens the auth flow — the same
 * affordance iOS gives a guest, in place of the old plain "Log in" text button.
 */
@Composable
fun QkHeaderProfileAction(
    isAuthenticated: Boolean,
    initials: String,
    onOpenProfile: () -> Unit,
    onSignIn: () -> Unit,
    contentDescription: String? = null,
    modifier: Modifier = Modifier
) {
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }
    val scale by animateFloatAsState(
        targetValue = if (appeared) 1f else 0.4f,
        animationSpec = spring(dampingRatio = 0.55f, stiffness = Spring.StiffnessLow),
        label = "headerAvatarIn"
    )
    val ping = rememberInfiniteTransition(label = "headerAvatarPing")
    val pingScale by ping.animateFloat(
        initialValue = 0.95f, targetValue = 1.7f,
        animationSpec = infiniteRepeatable(tween(1700, easing = LinearEasing), RepeatMode.Restart),
        label = "pingScale"
    )
    val pingAlpha by ping.animateFloat(
        initialValue = 0.55f, targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(1700, easing = LinearEasing), RepeatMode.Restart),
        label = "pingAlpha"
    )

    Box(modifier = modifier.size(46.dp), contentAlignment = Alignment.Center) {
        // The expanding "ping" ring — cream, so it reads on the burgundy banner.
        Box(
            modifier = Modifier
                .size(40.dp)
                .scale(pingScale)
                .alpha(pingAlpha)
                .border(2.dp, Cream.copy(alpha = 0.4f), CircleShape)
        )
        Box(
            modifier = Modifier
                .scale(scale)
                .size(40.dp)
                .clip(CircleShape)
                .clickable { if (isAuthenticated) onOpenProfile() else onSignIn() },
            contentAlignment = Alignment.Center
        ) {
            if (isAuthenticated) {
                GradientAvatar(initials = initials.ifBlank { "?" }, size = 40.dp)
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .border(1.5.dp, Cream.copy(alpha = 0.4f), CircleShape)
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Cream.copy(alpha = 0.16f))
                        .border(1.dp, Cream.copy(alpha = 0.28f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Outlined.AccountCircle,
                        contentDescription = contentDescription,
                        tint = Cream,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
        }
    }
}

/**
 * Whether the system is set to remove animations ("Animation off" in Developer
 * options / the accessibility "Remove animations" toggle) — the Android analogue
 * of iOS `accessibilityReduceMotion`.
 */
@Composable
private fun rememberReduceMotion(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        Settings.Global.getFloat(
            context.contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1f
        ) == 0f
    }
}

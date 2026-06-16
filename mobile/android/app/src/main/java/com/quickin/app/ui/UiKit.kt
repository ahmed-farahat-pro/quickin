package com.quickin.app.ui

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.IosShare
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.quickin.app.AvatarImage
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.BurgundyLight
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.GoldSoft
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import com.quickin.app.ui.theme.TanWarm

/**
 * Shared boutique design primitives so every QuickIn screen reads as one cohesive,
 * premium app — now carrying the redesign's gold-accented visual language + the
 * 7-animation kit (qkSwap / qkZoom / qkPop / qkDraw / qkPress / qkPulse).
 *
 * The curves are matched to the spec:
 *  • swaps   → tween(420, CubicBezierEasing(0.22,1,0.36,1))
 *  • press   → spring(dampingRatio 0.55, stiffness 320), scale 0.97
 *  • Ken Burns → infinite scale 1→1.09 over 14s, reverse
 */

/** The app-wide card corner radius (boutique 28dp, per the redesign). */
val CardRadius = 28.dp

/** The signature swap easing: cubic-bezier(0.22, 1, 0.36, 1). */
val QkSwapEasing = CubicBezierEasing(0.22f, 1f, 0.36f, 1f)

/** On-brand burgundy CTA gradient: linear-gradient(135deg, #5B0F16, #8a2530). */
val BurgundyGradient = Brush.linearGradient(listOf(Burgundy, BurgundyLight))

/** Gold avatar / badge gradient: linear-gradient(135deg, #B07A2A, #d8a55a). */
val GoldGradient = Brush.linearGradient(listOf(Gold, GoldSoft))

/** Tan tile gradient. */
val TanGradient = Brush.linearGradient(listOf(TanWarm, Tan))

/**
 * qkPress — the signature press feel. Scales the element to 0.97 while pressed with a
 * springy curve (dampingRatio 0.55, stiffness 320), then springs back. Wire the supplied
 * [MutableInteractionSource] to the element's `clickable` so presses are observed.
 *
 * Compose auto-mirrors scale (it's symmetric) so this is RTL-safe.
 */
fun Modifier.qkPress(interaction: MutableInteractionSource): Modifier = composed {
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.97f else 1f,
        animationSpec = spring(dampingRatio = 0.55f, stiffness = 320f),
        label = "qkPress"
    )
    this.scale(scale)
}

/**
 * qkSwap — screen / tab content enter transition. The incoming content slides in from a
 * touch off the leading edge (in the direction of travel) and fades, while the outgoing
 * fades away. Uses the exact 420ms cubic-bezier(0.22,1,0.36,1) easing.
 *
 * The horizontal offset uses `targetState`/`initialState` so forward navigation slides
 * from the end and back navigation from the start — Compose mirrors slide offsets under
 * RTL automatically, so this reads correctly in Arabic.
 */
fun <S> AnimatedContentTransitionScope<S>.qkSwap(
    forward: Boolean = true
): ContentTransform {
    val enterSlide = slideInHorizontally(
        animationSpec = tween(420, easing = QkSwapEasing)
    ) { full -> if (forward) full / 6 else -full / 6 }
    return (fadeIn(tween(420, easing = QkSwapEasing)) + enterSlide) togetherWith
        fadeOut(tween(200))
}

/**
 * A white boutique card with a resting soft shadow that lifts on press, plus a gentle
 * qkPress scale when [onClick] is supplied. Mirrors the web `.qk-card` (rest shadow →
 * lifted shadow + translate on hover; active scale 0.97).
 */
@Composable
fun BoutiqueCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    shadow: Dp = 8.dp,
    radius: Dp = CardRadius,
    color: Color = Color.White,
    content: @Composable () -> Unit
) {
    if (onClick != null) {
        val interaction = remember { MutableInteractionSource() }
        val pressed by interaction.collectIsPressedAsState()
        // Resting → lifted elevation on press (the Compose analogue of the web hover-lift).
        val elevation by animateFloatAsState(
            targetValue = if (pressed) shadow.value + 8f else shadow.value,
            animationSpec = tween(400, easing = QkSwapEasing),
            label = "cardElev"
        )
        Surface(
            shape = RoundedCornerShape(radius),
            color = color,
            shadowElevation = elevation.dp,
            modifier = modifier
                .qkPress(interaction)
                .clickable(interactionSource = interaction, indication = null, onClick = onClick)
        ) { content() }
    } else {
        Surface(
            shape = RoundedCornerShape(radius),
            color = color,
            shadowElevation = shadow,
            modifier = modifier
        ) { content() }
    }
}

/**
 * A Ken Burns cover image (`qkZoom`): slowly scales 1 → 1.09 over 14s and reverses, giving
 * heroes a living, cinematic drift. Falls back to a [PhotoPlaceholder] when [url] is null.
 * Clips to the box bounds so the zoom never bleeds outside its container.
 */
@Composable
fun KenBurnsImage(
    url: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    placeholderIcon: ImageVector? = null
) {
    val transition = rememberInfiniteTransition(label = "kenburns")
    val scale by transition.animateFloat(
        initialValue = 1f,
        targetValue = 1.09f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 14000, easing = androidx.compose.animation.core.LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "kenburnsScale"
    )
    Box(modifier = modifier.clip(RoundedCornerShape(0.dp))) {
        if (url != null) {
            AsyncImage(
                model = url,
                contentDescription = contentDescription,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .scale(scale)
                    .background(Tan)
            )
        } else if (placeholderIcon != null) {
            PhotoPlaceholder(modifier = Modifier.fillMaxSize(), icon = placeholderIcon, iconSize = 56.dp)
        } else {
            PhotoPlaceholder(modifier = Modifier.fillMaxSize(), iconSize = 56.dp)
        }
    }
}

/**
 * A gold ★ rating row: a filled gold star + a bold value (e.g. "4.92"). Used on cards,
 * detail heroes and saved-stay rows per the redesign.
 */
@Composable
fun GoldRatingRow(
    rating: String,
    modifier: Modifier = Modifier,
    starSize: Dp = 14.dp,
    fontSize: androidx.compose.ui.unit.TextUnit = 13.sp,
    color: Color = Ink
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = modifier
    ) {
        Icon(Icons.Filled.Star, contentDescription = null, tint = Gold, modifier = Modifier.size(starSize))
        Text(rating, fontWeight = FontWeight.Bold, color = color, fontSize = fontSize)
    }
}

/**
 * Shows a listing's real rating as a gold ★ row ("4.9 · 12") or, when the stay has no reviews
 * yet, a muted "New" pill. Drives the rating display on cards + the detail hero per the redesign.
 * [reviewsLabel] is the localized "(%d reviews)"-style count formatter applied when [reviewCount] > 0.
 */
@Composable
fun RatingOrNew(
    rating: Double,
    reviewCount: Int,
    modifier: Modifier = Modifier,
    starSize: Dp = 14.dp,
    fontSize: androidx.compose.ui.unit.TextUnit = 13.sp,
    color: Color = Ink,
    countText: ((Int) -> String)? = null
) {
    if (reviewCount > 0 && rating > 0.0) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = modifier
        ) {
            Icon(Icons.Filled.Star, contentDescription = null, tint = Gold, modifier = Modifier.size(starSize))
            Text(
                String.format(java.util.Locale.US, "%.1f", rating),
                fontWeight = FontWeight.Bold,
                color = color,
                fontSize = fontSize
            )
            if (countText != null) {
                Text(countText(reviewCount), color = Muted, fontSize = fontSize)
            }
        }
    } else {
        // No reviews yet — a muted "New" tag.
        Text(
            stringResource(R.string.listing_new),
            color = color,
            fontWeight = FontWeight.SemiBold,
            fontSize = fontSize,
            modifier = modifier
        )
    }
}

/**
 * A row of five stars with the first [rating] (1–5) filled gold and the rest a faint outline —
 * used to render an individual review's score and as the editable star picker (when [onRate] is
 * supplied, tapping a star sets the rating). RTL-safe: the Row lays out start→end so under Arabic
 * the first star sits on the right, matching reading order.
 */
@Composable
fun StarRatingRow(
    rating: Int,
    modifier: Modifier = Modifier,
    starSize: Dp = 18.dp,
    onRate: ((Int) -> Unit)? = null
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        modifier = modifier
    ) {
        for (i in 1..5) {
            val filled = i <= rating
            val starModifier = if (onRate != null) {
                Modifier
                    .size(starSize + 6.dp)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null
                    ) { onRate(i) }
                    .padding(3.dp)
            } else {
                Modifier.size(starSize)
            }
            Icon(
                imageVector = Icons.Filled.Star,
                contentDescription = null,
                tint = if (filled) Gold else Tan,
                modifier = starModifier
            )
        }
    }
}

/**
 * A gradient avatar: a gold-gradient circle bearing the given [initials] in white.
 * Used in chat headers, profile, etc. The diameter is [size].
 */
@Composable
fun GradientAvatar(
    initials: String,
    modifier: Modifier = Modifier,
    size: Dp = 48.dp,
    brush: Brush = GoldGradient
) {
    Box(
        modifier = modifier
            .size(size)
            .background(brush, CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Text(
            initials,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = (size.value * 0.36f).sp
        )
    }
}

/**
 * A circular profile avatar that renders the user's photo from [avatarUrl] and otherwise falls
 * back to a [GradientAvatar] showing [initials]:
 *  • `data:image/...;base64,…`  → decoded to a Bitmap off the main thread and shown (Coil 2.7.0
 *    has no data-URI fetcher), falling back to initials if the data URL can't be decoded.
 *  • `http(s)://…`              → loaded via Coil's [AsyncImage].
 *  • null / blank               → initials.
 *
 * The image is clipped to a circle and cropped to fill, matching the initials avatar's footprint.
 */
@Composable
fun ProfileAvatar(
    avatarUrl: String?,
    initials: String,
    modifier: Modifier = Modifier,
    size: Dp = 48.dp,
    contentDescription: String? = null
) {
    val url = avatarUrl?.takeIf { it.isNotBlank() }
    when {
        url == null -> GradientAvatar(initials = initials, modifier = modifier, size = size)

        AvatarImage.isDataUrl(url) -> {
            // Decode the (small, ≤256px) data URL off the composition; re-decode if the URL changes.
            var bitmap by remember(url) { mutableStateOf<android.graphics.Bitmap?>(null) }
            LaunchedEffect(url) { bitmap = AvatarImage.decodeDataUrlToBitmap(url) }
            val bmp = bitmap
            if (bmp != null) {
                Image(
                    bitmap = bmp.asImageBitmap(),
                    contentDescription = contentDescription,
                    contentScale = ContentScale.Crop,
                    modifier = modifier
                        .size(size)
                        .clip(CircleShape)
                        .background(Tan, CircleShape)
                )
            } else {
                GradientAvatar(initials = initials, modifier = modifier, size = size)
            }
        }

        else -> AsyncImage(
            model = url,
            contentDescription = contentDescription,
            contentScale = ContentScale.Crop,
            modifier = modifier
                .size(size)
                .clip(CircleShape)
                .background(Tan, CircleShape)
        )
    }
}

/**
 * A pop-in badge wrapper (`qkPop`): scales its [content] in (.5 → ~1.1 → 1) with a springy
 * overshoot the first time it appears. Used for guest-favorite badges, hearts and confirmed
 * checkmarks.
 */
@Composable
fun PopIn(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    androidx.compose.animation.AnimatedVisibility(
        visible = true,
        enter = scaleIn(
            initialScale = 0.5f,
            animationSpec = spring(dampingRatio = 0.5f, stiffness = 300f)
        ) + fadeIn(tween(200)),
        exit = fadeOut(),
        modifier = modifier
    ) { content() }
}

/**
 * qkDraw — an animated drawn checkmark inside a circle, for confirmed bookings. The circle
 * and tick stroke "draw on" over ~700ms (the Compose analogue of stroke-dashoffset). The
 * whole mark also pops in. [size] is the circle diameter.
 */
@Composable
fun DrawCheckmark(
    modifier: Modifier = Modifier,
    size: Dp = 72.dp,
    circleColor: Color = com.quickin.app.ui.theme.SuccessGreen,
    checkColor: Color = Color.White
) {
    val progress = remember { androidx.compose.animation.core.Animatable(0f) }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        progress.animateTo(1f, animationSpec = tween(700, easing = QkSwapEasing))
    }
    Box(
        modifier = modifier
            .size(size)
            .background(circleColor.copy(alpha = 0.12f), CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(size * 0.62f)
                .drawBehind {
                    val w = this.size.width
                    val h = this.size.height
                    val stroke = Stroke(width = w * 0.11f, cap = StrokeCap.Round)
                    // A two-segment tick: down-stroke then up-stroke, drawn progressively.
                    val p0 = Offset(w * 0.16f, h * 0.54f)
                    val p1 = Offset(w * 0.42f, h * 0.78f)
                    val p2 = Offset(w * 0.84f, h * 0.26f)
                    val seg1 = 0.42f
                    val t = progress.value
                    if (t > 0f) {
                        val firstT = (t / seg1).coerceAtMost(1f)
                        val mid = Offset(
                            p0.x + (p1.x - p0.x) * firstT,
                            p0.y + (p1.y - p0.y) * firstT
                        )
                        drawLine(circleColor, p0, mid, strokeWidth = stroke.width, cap = StrokeCap.Round)
                        if (t > seg1) {
                            val secondT = ((t - seg1) / (1f - seg1)).coerceIn(0f, 1f)
                            val end = Offset(
                                p1.x + (p2.x - p1.x) * secondT,
                                p1.y + (p2.y - p1.y) * secondT
                            )
                            drawLine(circleColor, p1, end, strokeWidth = stroke.width, cap = StrokeCap.Round)
                        }
                    }
                }
        )
    }
}

/**
 * An on-brand burgundy gradient primary button with qkPress feedback. When [pulse] is true,
 * a soft expanding ring pulses around it (`qkPulse`) — used for the main CTA on a screen.
 * Honors [enabled]; dims to 40% when disabled.
 */
@Composable
fun GradientButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    pulse: Boolean = false,
    radius: Dp = 16.dp,
    height: Dp = 54.dp,
    content: @Composable () -> Unit
) {
    val interaction = remember { MutableInteractionSource() }

    // qkPulse — an expanding, fading ring drawn behind the button.
    val pulseProgress = if (pulse && enabled) {
        val t = rememberInfiniteTransition(label = "pulse")
        t.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(1600, easing = androidx.compose.animation.core.LinearEasing),
                repeatMode = RepeatMode.Restart
            ),
            label = "pulseRing"
        ).value
    } else 0f

    Box(
        modifier = modifier
            .height(height)
            .qkPress(interaction)
            .then(
                if (pulse && enabled) Modifier.drawBehind {
                    val ringInset = -(pulseProgress * 14.dp.toPx())
                    val alpha = (1f - pulseProgress) * 0.30f
                    drawRoundRect(
                        color = Burgundy.copy(alpha = alpha),
                        topLeft = Offset(ringInset, ringInset),
                        size = androidx.compose.ui.geometry.Size(
                            size.width - ringInset * 2,
                            size.height - ringInset * 2
                        ),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(
                            (radius.toPx() + (-ringInset)),
                            (radius.toPx() + (-ringInset))
                        ),
                        style = Stroke(width = 2.dp.toPx())
                    )
                } else Modifier
            )
            .clip(RoundedCornerShape(radius))
            .background(
                if (enabled) BurgundyGradient
                else Brush.linearGradient(listOf(Burgundy.copy(alpha = 0.4f), BurgundyLight.copy(alpha = 0.4f)))
            )
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = enabled,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 20.dp)
        ) { content() }
    }
}

/**
 * A gold eyebrow label: small, bold, wide letter-spacing, uppercase, gold — e.g.
 * "NORTH COAST · EGYPT". Used above hero / section headlines per the redesign.
 */
@Composable
fun GoldEyebrow(text: String, modifier: Modifier = Modifier) {
    Text(
        text.uppercase(),
        color = Gold,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.8.sp,
        modifier = modifier
    )
}

/**
 * A consistent section header: a bold Ink title with an optional Muted caption beneath,
 * and an optional gold [eyebrow] above (small uppercase label).
 */
@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    caption: String? = null,
    eyebrow: String? = null
) {
    Column(modifier = modifier) {
        if (eyebrow != null) {
            GoldEyebrow(eyebrow, modifier = Modifier.padding(bottom = 4.dp))
        }
        Text(title, fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink)
        if (caption != null) {
            Text(caption, fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

/**
 * A clean stat chip — an icon over a bold value and a Muted label — on a soft tan tile.
 * Used for the listing specs row (guests / beds / baths) so each metric reads as a unit.
 */
@Composable
fun StatChip(
    icon: ImageVector,
    value: String,
    label: String,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Tan.copy(alpha = 0.55f),
        modifier = modifier
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(vertical = 12.dp, horizontal = 6.dp)
        ) {
            Icon(icon, contentDescription = null, tint = Burgundy, modifier = Modifier.size(22.dp))
            Text(
                value,
                fontWeight = FontWeight.Bold,
                color = Ink,
                fontSize = 16.sp,
                modifier = Modifier.padding(top = 6.dp)
            )
            Text(label, color = Muted, fontSize = 12.sp)
        }
    }
}

/**
 * A tappable settings row: a leading icon in a soft gold/burgundy circle, a title (+ optional
 * subtitle), and a trailing chevron. The whole row scales slightly on press (qkPress) and lifts
 * its shadow. [accent] tints the icon (gold for premium rows, burgundy for default).
 */
@Composable
fun SettingsRow(
    icon: ImageVector,
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    accent: Color = Burgundy,
    showChevron: Boolean = true
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val elevation by animateFloatAsState(
        targetValue = if (pressed) 10f else 4f,
        animationSpec = tween(300, easing = QkSwapEasing),
        label = "rowElev"
    )
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = elevation.dp,
        modifier = modifier
            .fillMaxWidth()
            .qkPress(interaction)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(accent.copy(alpha = 0.12f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                if (subtitle != null) {
                    Text(subtitle, color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 1.dp))
                }
            }
            if (showChevron) {
                Icon(
                    Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = null,
                    tint = Muted,
                    modifier = Modifier.size(22.dp)
                )
            }
        }
    }
}

/**
 * qkSlideUp — reveals [content] with a one-shot slide-up + fade the first time it enters
 * composition (translateY 36 → 0). Used for list cards and content blocks so they ease in
 * rather than snapping. Honors layout direction implicitly (vertical only).
 */
@Composable
fun SlideUpOnAppear(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val visible = remember { androidx.compose.runtime.mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(Unit) { visible.value = true }
    androidx.compose.animation.AnimatedVisibility(
        visible = visible.value,
        enter = androidx.compose.animation.slideInVertically(
            animationSpec = tween(420, easing = QkSwapEasing)
        ) { full -> full / 8 } + fadeIn(tween(360)),
        modifier = modifier
    ) { content() }
}

/**
 * A springy "heart" save button (`qkHeart`): a translucent white circle with a heart icon
 * that pops in. Tapping triggers a springy scale bounce. Placed on listing cards / detail
 * heroes per the redesign.
 *
 * Two modes:
 *  • **Controlled** — pass [filled] (a real saved flag) + [onToggle]; the host (a ViewModel) owns
 *    the state and persists it via the wishlist API. This is the wired-up wishlist heart.
 *  • **Uncontrolled / purely visual** — omit both; the heart manages its own local fill (legacy use).
 */
@Composable
fun HeartButton(
    modifier: Modifier = Modifier,
    filled: Boolean? = null,
    onToggle: (() -> Unit)? = null,
    initiallyFilled: Boolean = false,
    size: Dp = 36.dp
) {
    var localFilled by remember { mutableStateOf(initiallyFilled) }
    val isFilled = filled ?: localFilled
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 1.16f else 1f,
        animationSpec = spring(dampingRatio = 0.45f, stiffness = 350f),
        label = "heart"
    )
    Box(
        modifier = modifier
            .size(size)
            .scale(scale)
            .background(Color.White.copy(alpha = 0.92f), CircleShape)
            .clickable(interactionSource = interaction, indication = null) {
                if (onToggle != null) onToggle() else localFilled = !localFilled
            },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Filled.Favorite,
            contentDescription = stringResource(R.string.cd_save),
            tint = if (isFilled) Burgundy else Ink,
            modifier = Modifier.size(size * 0.5f)
        )
    }
}

/**
 * A springy "share" button mirroring [HeartButton]'s frosted treatment: a translucent white
 * circle bearing an on-brand share glyph that scales up on press. Used as a hero overlay (next
 * to the heart) and anywhere a circular share affordance fits the boutique look.
 *
 * RTL-safe (the circle + scale are symmetric). The share-sheet wiring is the caller's via
 * [onClick] (see [com.quickin.app.shareText]).
 */
@Composable
fun ShareButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 36.dp,
    tint: Color = Ink
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 1.16f else 1f,
        animationSpec = spring(dampingRatio = 0.45f, stiffness = 350f),
        label = "share"
    )
    Box(
        modifier = modifier
            .size(size)
            .scale(scale)
            .background(Color.White.copy(alpha = 0.92f), CircleShape)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Filled.IosShare,
            contentDescription = stringResource(R.string.cd_share),
            tint = tint,
            modifier = Modifier.size(size * 0.5f)
        )
    }
}

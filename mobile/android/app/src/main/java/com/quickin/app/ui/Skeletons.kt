package com.quickin.app.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.quickin.app.ui.theme.Tan

/**
 * Reusable shimmer placeholder building blocks shown while list content loads in.
 *
 * The shimmer is an animated horizontal gradient that sweeps left→right across the
 * placeholder boxes, hinting that real content is on its way. Skeleton cards mirror the
 * shape of the real cards (an image block + a couple of text-line blocks) so the layout
 * doesn't visibly jump when the data arrives.
 */

// Shimmer band colours — kept in the warm tan family so the effect reads as part of the
// boutique palette rather than a generic grey loader.
private val ShimmerBase = Tan
private val ShimmerHighlight = Color(0xFFF7F1E8)

/**
 * A [Modifier] that paints an animated horizontal shimmer gradient as the element's
 * background, clipped to [shape]. Share a single [rememberInfiniteTransition] driver so
 * every placeholder in a card shimmers in sync.
 *
 * @param progress the 0f→1f sweep position from the shared infinite transition.
 */
private fun Modifier.shimmer(progress: Float, shape: RoundedCornerShape): Modifier {
    // Translate a fixed-width gradient across a wide virtual span so the band travels
    // smoothly off both edges.
    val span = 1200f
    val start = (progress * 2f - 1f) * span
    val brush = Brush.horizontalGradient(
        colors = listOf(ShimmerBase, ShimmerHighlight, ShimmerBase),
        startX = start,
        endX = start + span
    )
    return this
        .clip(shape)
        .background(brush)
}

/** A single rounded shimmer block (used for images and text lines). */
@Composable
private fun ShimmerBox(
    progress: Float,
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 8.dp
) {
    Surface(
        color = Color.Transparent,
        modifier = modifier.shimmer(progress, RoundedCornerShape(cornerRadius))
    ) {}
}

/**
 * A placeholder shaped like a [ListingCard] / [ServiceCard]: a large image block on top and
 * a couple of text-line blocks below, all shimmering. [imageHeight] lets callers match the
 * exact card variant (listings use 220.dp, services 200.dp, reservations 180.dp).
 */
@Composable
fun SkeletonListingCard(
    progress: Float,
    modifier: Modifier = Modifier,
    imageHeight: Dp = 220.dp
) {
    Surface(
        shape = RoundedCornerShape(28.dp),
        color = Color.White,
        shadowElevation = 8.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        Column {
            // Image block.
            ShimmerBox(
                progress = progress,
                cornerRadius = 0.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(imageHeight)
            )
            Column(modifier = Modifier.padding(14.dp)) {
                // Title line (wide).
                ShimmerBox(
                    progress = progress,
                    modifier = Modifier
                        .fillMaxWidth(0.7f)
                        .height(18.dp)
                )
                Spacer(Modifier.height(10.dp))
                // Subtitle / location line (medium).
                ShimmerBox(
                    progress = progress,
                    modifier = Modifier
                        .fillMaxWidth(0.45f)
                        .height(14.dp)
                )
                Spacer(Modifier.height(10.dp))
                // Price line (short).
                ShimmerBox(
                    progress = progress,
                    modifier = Modifier
                        .width(90.dp)
                        .height(14.dp)
                )
            }
        }
    }
}

/**
 * Drop-in replacement for the per-screen loading spinner: a [LazyColumn] of shimmering
 * [SkeletonListingCard]s shaped like the real list, so the content appears to load in place.
 *
 * @param count number of placeholder cards (4–6 reads well on a phone screen).
 * @param imageHeight image-block height to match the real card variant.
 */
@Composable
fun SkeletonListColumn(
    modifier: Modifier = Modifier,
    count: Int = 5,
    imageHeight: Dp = 220.dp,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    spacing: Dp = 20.dp
) {
    // One shared shimmer driver for the whole list keeps every card in phase.
    val transition = rememberInfiniteTransition(label = "skeleton-shimmer")
    val progress by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1100),
            repeatMode = RepeatMode.Restart
        ),
        label = "skeleton-shimmer-progress"
    )

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = contentPadding,
        verticalArrangement = Arrangement.spacedBy(spacing)
    ) {
        items(count) {
            SkeletonListingCard(progress = progress, imageHeight = imageHeight)
        }
    }
}

// ---------------------------------------------------------------------------
// Shapes beyond the feed
//
// SkeletonListColumn covered the browse feeds — listings, services, reservations,
// subscriptions. Everything a guest reaches AFTER one of those still centres a
// CircularProgressIndicator: tapping a card, opening a thread, checking earnings.
// A spinner there says "something is happening somewhere"; these say what is
// coming, in the shape it will arrive in.
//
// A spinner inside a button is a different thing and stays — it means THIS action
// is running, which is true and useful. Only the ones standing in for content
// belong here.
// ---------------------------------------------------------------------------

/**
 * One shimmer driver, shared by everything in a screen so the placeholders sweep
 * in phase. Each skeleton below runs its own rather than threading a progress
 * value through call sites that have no reason to know about it.
 */
@Composable
private fun rememberShimmerProgress(): Float {
    val transition = rememberInfiniteTransition(label = "skeleton-shimmer")
    val progress by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1100),
            repeatMode = RepeatMode.Restart
        ),
        label = "skeleton-shimmer-progress"
    )
    return progress
}

/**
 * A detail screen: hero image, title, a row of facts, then body copy. Shaped for
 * ListingDetailScreen and ReservationDetailScreen.
 */
@Composable
fun SkeletonDetail(
    modifier: Modifier = Modifier,
    heroHeight: Dp = 300.dp
) {
    val progress = rememberShimmerProgress()
    Column(modifier = modifier.fillMaxSize()) {
        ShimmerBox(
            progress = progress,
            cornerRadius = 0.dp,
            modifier = Modifier.fillMaxWidth().height(heroHeight)
        )
        Column(modifier = Modifier.padding(18.dp)) {
            ShimmerBox(progress, Modifier.fillMaxWidth(0.66f).height(24.dp))
            Spacer(Modifier.height(12.dp))
            ShimmerBox(progress, Modifier.fillMaxWidth(0.42f).height(14.dp))

            // The facts strip — nights, guests, rating.
            Spacer(Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                repeat(3) {
                    Column(modifier = Modifier.weight(1f)) {
                        ShimmerBox(progress, Modifier.width(52.dp).height(10.dp))
                        Spacer(Modifier.height(6.dp))
                        ShimmerBox(progress, Modifier.fillMaxWidth().height(14.dp))
                    }
                }
            }

            Spacer(Modifier.height(22.dp))
            repeat(4) { i ->
                ShimmerBox(
                    progress,
                    if (i == 3) Modifier.fillMaxWidth(0.5f).height(12.dp)
                    else Modifier.fillMaxWidth().height(12.dp)
                )
                Spacer(Modifier.height(9.dp))
            }
        }
    }
}

/**
 * A chat transcript: bubbles alternating sides so it reads as a conversation
 * rather than a list. Matches the 12.dp corner radius ChatScreen uses.
 */
@Composable
fun SkeletonChat(
    modifier: Modifier = Modifier,
    count: Int = 5
) {
    val progress = rememberShimmerProgress()
    // Fixed widths and sides — a placeholder that reshuffles on every recomposition
    // is more distracting than the spinner it replaced.
    val bubbles = listOf(
        210.dp to false, 150.dp to true, 240.dp to false,
        120.dp to true, 180.dp to false, 140.dp to true
    )
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(count) { i ->
            val (width, mine) = bubbles[i % bubbles.size]
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start
            ) {
                ShimmerBox(progress, Modifier.width(width).height(40.dp), cornerRadius = 12.dp)
            }
        }
    }
}

/**
 * A grid of headline-number tiles, for the host dashboard, analytics and money
 * screens — the places that answer "how am I doing?" with a spinner today.
 */
@Composable
fun SkeletonStatTiles(
    modifier: Modifier = Modifier,
    rows: Int = 2
) {
    val progress = rememberShimmerProgress()
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(rows) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                repeat(2) {
                    Surface(
                        shape = RoundedCornerShape(18.dp),
                        color = Color.White,
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            ShimmerBox(progress, Modifier.width(84.dp).height(24.dp))
                            Spacer(Modifier.height(8.dp))
                            ShimmerBox(progress, Modifier.width(108.dp).height(11.dp))
                        }
                    }
                }
            }
        }
    }
}

/** Label-and-field pairs, for the settings and editor screens. */
@Composable
fun SkeletonForm(
    modifier: Modifier = Modifier,
    fields: Int = 4,
    showsButton: Boolean = true
) {
    val progress = rememberShimmerProgress()
    Column(
        modifier = modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        repeat(fields) {
            Column {
                ShimmerBox(progress, Modifier.width(96.dp).height(11.dp))
                Spacer(Modifier.height(7.dp))
                ShimmerBox(progress, Modifier.fillMaxWidth().height(44.dp), cornerRadius = 12.dp)
            }
        }
        if (showsButton) {
            ShimmerBox(
                progress,
                Modifier.fillMaxWidth().height(48.dp),
                cornerRadius = 999.dp
            )
        }
    }
}

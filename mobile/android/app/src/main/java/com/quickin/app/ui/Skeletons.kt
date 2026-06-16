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

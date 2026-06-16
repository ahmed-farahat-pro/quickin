package com.quickin.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.House
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

/**
 * On-brand stand-in shown wherever a listing/experience has NO photo, instead of loading a stock
 * image. A soft Tan→Cream rounded box with a centered Muted icon and a "No photo" caption.
 *
 * Pass the same shape/size [Modifier] you'd give the [coil.compose.AsyncImage] it replaces so the
 * placeholder occupies the exact same footprint in cards, galleries, and detail headers.
 *
 * @param icon the glyph to center (defaults to a house; pass e.g. Sailing for experiences).
 * @param showCaption whether to render the "No photo" caption under the icon (hidden on tiny tiles).
 */
@Composable
fun PhotoPlaceholder(
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Outlined.House,
    iconSize: androidx.compose.ui.unit.Dp = 40.dp,
    cornerRadius: androidx.compose.ui.unit.Dp = 0.dp,
    showCaption: Boolean = true
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(cornerRadius))
            .background(Tan),
        contentAlignment = Alignment.Center
    ) {
        // A faint inner Cream wash so the icon reads against the Tan field.
        Box(
            modifier = Modifier
                .size(iconSize + 28.dp)
                .clip(RoundedCornerShape(50))
                .background(Cream),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    icon,
                    contentDescription = "No photo",
                    tint = Muted,
                    modifier = Modifier.size(iconSize)
                )
            }
        }
        if (showCaption) {
            Text(
                "No photo",
                color = Muted,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .background(Cream.copy(alpha = 0.0f))
                    .padding(bottom = 12.dp)
            )
        }
    }
}

package com.quickin.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.quickin.app.R
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage

/**
 * Launch splash: the QuickIn logo zooms in from far/small to full size on a Cream
 * background. Scale animates ~0.2f -> 1.0f and alpha 0 -> 1 over ~1100ms with an
 * ease-out curve, giving the logo a "flying toward you" feel.
 */
@Composable
fun SplashScreen(modifier: Modifier = Modifier) {
    val scale = remember { Animatable(0.2f) }
    val alpha = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        // Fade in slightly faster than the zoom so the logo is already visible
        // as it grows, rather than popping in at the end.
        alpha.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = 700, easing = LinearOutSlowInEasing)
        )
    }
    LaunchedEffect(Unit) {
        scale.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = 1100, easing = LinearOutSlowInEasing)
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(CreamPage),
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = painterResource(R.drawable.logo),
            contentDescription = "QuickIn",
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .fillMaxWidth(0.62f)
                .padding(horizontal = 24.dp)
                .scale(scale.value)
                .alpha(alpha.value)
        )
    }
}

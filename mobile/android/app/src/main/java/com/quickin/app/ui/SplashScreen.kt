package com.quickin.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.GoldLight
import kotlin.math.PI
import kotlin.math.sin

/**
 * Launch splash: the QuickIn logo flies in (0.2x -> 1x, fading) and then gently
 * bobs over a cream background, while layered waves roll continuously across the
 * bottom — giving the splash a lively, premium feel.
 */
@Composable
fun SplashScreen(modifier: Modifier = Modifier) {
    val scale = remember { Animatable(0.2f) }
    val alpha = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        alpha.animateTo(1f, animationSpec = tween(700, easing = LinearOutSlowInEasing))
    }
    LaunchedEffect(Unit) {
        scale.animateTo(1f, animationSpec = tween(1100, easing = LinearOutSlowInEasing))
    }

    // Continuous motion: a rolling wave phase + a slow vertical bob for the logo.
    val motion = rememberInfiniteTransition(label = "splash")
    val phase by motion.animateFloat(
        initialValue = 0f,
        targetValue = (2f * PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(4200, easing = LinearEasing), RepeatMode.Restart),
        label = "wavePhase"
    )
    val bob by motion.animateFloat(
        initialValue = -6f,
        targetValue = 6f,
        animationSpec = infiniteRepeatable(tween(1800, easing = LinearEasing), RepeatMode.Reverse),
        label = "bob"
    )

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(CreamPage),
        contentAlignment = Alignment.Center
    ) {
        // Waves rolling across the bottom.
        SplashWaves(
            phase = phase,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .height(220.dp)
        )

        // Logo — flown in, then gently bobbing, lifted a touch above center.
        Image(
            painter = painterResource(R.drawable.logo),
            contentDescription = "QuickIn",
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .fillMaxWidth(0.62f)
                .padding(horizontal = 24.dp)
                .offset(y = (-28).dp + bob.dp)
                .scale(scale.value)
                .alpha(alpha.value)
        )
    }
}

/** Three layered sine waves rolling horizontally, tinted in the QuickIn palette. */
@Composable
private fun SplashWaves(phase: Float, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height

        fun wavePath(ampFrac: Float, baseFrac: Float, cycles: Float, ph: Float): Path {
            val path = Path()
            val amp = h * ampFrac
            val mid = h * baseFrac
            path.moveTo(0f, mid)
            var x = 0f
            while (x <= w) {
                val y = mid + amp * sin(2f * PI.toFloat() * (x / w) * cycles + ph)
                path.lineTo(x, y)
                x += 6f
            }
            path.lineTo(w, h)
            path.lineTo(0f, h)
            path.close()
            return path
        }

        drawPath(wavePath(0.060f, 0.40f, 1.3f, phase * 0.80f), color = GoldLight.copy(alpha = 0.32f))
        drawPath(wavePath(0.080f, 0.54f, 1.1f, phase * 1.15f + 1.6f), color = Burgundy.copy(alpha = 0.24f))
        drawPath(
            wavePath(0.052f, 0.66f, 1.6f, phase * 1.55f + 3.1f),
            brush = Brush.verticalGradient(listOf(Burgundy, Gold.copy(alpha = 0.85f)))
        )
    }
}

package com.quickin.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.BitmapDrawable
import coil.compose.AsyncImage
import com.quickin.app.Listing
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.CustomZoomButtonsController
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker

/** Default camera target: the whole of Egypt, so the map opens here rather than the world. */
private val EGYPT_CENTER = 26.8206 to 30.8025
private const val EGYPT_ZOOM = 5.5

/**
 * The three Egyptian coast regions offered as quick-jump tabs above the map.
 * Tapping one flies the camera to that resort belt.
 */
enum class MapRegion(val label: String, val lat: Double, val lng: Double, val zoom: Double) {
    NORTH_COAST("North Coast", 30.95, 28.75, 9.0),
    EL_GOUNA("El Gouna", 27.3954, 33.6781, 12.0),
    AIN_SOKHNA("Ain Sokhna", 29.6000, 32.3500, 11.0)
}

/** Mutable, non-Compose-state scratch the AndroidView `update` lambda uses to act
 *  only on real changes (new pins / a region tap), never on plain recompositions. */
private class CameraSync {
    var lastFramedKey: String? = null
    var lastNonce: Int = 0
}

/**
 * OpenStreetMap (osmdroid) map of the current listings.
 *
 * Each listing that has both [Listing.lat] and [Listing.lng] becomes a pin titled with the
 * listing name and a "$price/night" snippet. Tapping a pin opens its info window AND surfaces a
 * bottom card (photo + title + price + "View") that deep-links into [onSelect].
 *
 * The map starts framed to fit all pins (a [BoundingBox] over the points); with a single pin it
 * centers on it at a moderate zoom. Lifecycle is bridged to the host composable so the MapView's
 * tile threads are paused/resumed and torn down on dispose (no leaks).
 */
@Composable
fun ListingsMap(
    listings: List<Listing>,
    onSelect: (Listing) -> Unit,
    onClose: () -> Unit = {},
    /**
     * "Search this area": invoked with the map's current visible viewport as a
     * `minLng,minLat,maxLng,maxLat` (GeoJSON west,south,east,north) bbox string.
     */
    onSearchArea: (String) -> Unit = {},
    /** True while a fetch is in flight (disables the "Search this area" button). */
    isSearching: Boolean = false,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // Only listings we can actually place on the map.
    val located = remember(listings) {
        listings.filter { it.lat != null && it.lng != null }
    }

    // The listing whose bottom card is currently shown (tapped pin). Cleared on dismiss.
    var selected by remember { mutableStateOf<Listing?>(null) }

    // Active region tab (null = camera frames the pins). `regionNonce` bumps on every
    // tap so re-tapping the same region re-centers the camera too.
    var selectedRegion by remember { mutableStateOf<MapRegion?>(null) }
    var regionNonce by remember { mutableIntStateOf(0) }

    // A non-state holder so the AndroidView `update` lambda can tell a *real* change
    // (new pins / a region tap) from an ordinary recomposition — without itself
    // triggering a recompose. Identity of the located set keys the camera framing.
    val locatedKey = remember(located) { located.joinToString("|") { "${it.id}:${it.lat},${it.lng}" } }
    val cam = remember { CameraSync() }

    // Build the MapView once; keep it across recompositions.
    val mapView = remember {
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            // We provide our own (cleaner) gestures; hide the legacy +/- overlay buttons.
            zoomController.setVisibility(CustomZoomButtonsController.Visibility.NEVER)
            setBackgroundColor(Tan.toArgb())
            // Open on Egypt (not the world) until the camera frames the actual pins.
            controller.setZoom(EGYPT_ZOOM)
            controller.setCenter(GeoPoint(EGYPT_CENTER.first, EGYPT_CENTER.second))
        }
    }

    // Bridge Compose lifecycle -> MapView.onResume()/onPause(); detach on dispose to free
    // tile-loading threads and listeners (osmdroid does not do this automatically).
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        mapView.onResume()
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            mapView.onPause()
            mapView.onDetach()
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            factory = { mapView },
            modifier = Modifier.fillMaxSize(),
            update = { map ->
                // Rebuild markers whenever the (searched) listings change.
                map.overlays.clear()
                located.forEach { listing ->
                    val point = GeoPoint(listing.lat!!, listing.lng!!)
                    val marker = Marker(map).apply {
                        position = point
                        setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                        icon = pricePillIcon(context, listing.priceText)
                        title = listing.title
                        snippet = "${listing.priceText}/night"
                        setOnMarkerClickListener { m, _ ->
                            m.showInfoWindow()
                            map.controller.animateTo(m.position)
                            selected = listing
                            true
                        }
                    }
                    map.overlays.add(marker)
                }

                // Frame the view to the pins, but ONLY when the located set actually
                // changes — not on every recompose (otherwise tapping a pin or a region
                // would yank the camera back to the full bounds). zoomToBoundingBox needs
                // the view laid out, so post it; a single pin gets center + fixed zoom.
                if (locatedKey != cam.lastFramedKey) {
                    cam.lastFramedKey = locatedKey
                    if (selectedRegion == null) {
                        when {
                            located.size == 1 -> {
                                val only = located.first()
                                map.controller.setZoom(12.0)
                                map.controller.setCenter(GeoPoint(only.lat!!, only.lng!!))
                            }
                            located.size > 1 -> {
                                val box = BoundingBox.fromGeoPointsSafe(
                                    located.map { GeoPoint(it.lat!!, it.lng!!) }
                                )
                                map.post { map.zoomToBoundingBox(box, false, 96) }
                            }
                        }
                    }
                }

                // A region tab tap flies the camera to that resort belt.
                if (regionNonce != cam.lastNonce) {
                    cam.lastNonce = regionNonce
                    selectedRegion?.let { r ->
                        map.controller.animateTo(GeoPoint(r.lat, r.lng), r.zoom, 800L)
                    }
                }
                map.invalidate()
            }
        )

        if (located.isEmpty()) {
            // Markers can't be placed without coordinates — tell the user rather than show a blank map.
            Surface(
                color = Color.White.copy(alpha = 0.92f),
                shape = RoundedCornerShape(18.dp),
                shadowElevation = 4.dp,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(24.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 14.dp)
                ) {
                    Icon(Icons.Filled.Map, contentDescription = null, tint = Burgundy)
                    Spacer(Modifier.width(10.dp))
                    Text("No stays have a location to map yet", color = Ink, fontSize = 14.sp)
                }
            }
        }

        // Region quick-jump tabs (North Coast / El Gouna / Ain Sokhna). Scrolls
        // horizontally and leaves room on the right for the close (X) button.
        if (located.isNotEmpty()) {
            MapRegionTabs(
                selected = selectedRegion,
                onSelect = { selectedRegion = it; regionNonce++ },
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(start = 16.dp, top = 16.dp, end = 64.dp)
            )
        }

        // "Search this area" — re-queries listings within the map's current visible viewport.
        // Reads the visible bounds straight off the MapView and builds a GeoJSON-order bbox
        // (minLng,minLat,maxLng,maxLat). Top-center so it clears the region tabs / close button.
        SearchThisAreaButton(
            enabled = !isSearching,
            onClick = {
                val box = mapView.boundingBox
                val bbox = "${box.lonWest},${box.latSouth},${box.lonEast},${box.latNorth}"
                onSearchArea(bbox)
            },
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 16.dp)
        )

        // Close-the-map (X) button → returns the Explore tab to the list.
        Surface(
            onClick = onClose,
            shape = CircleShape,
            color = Color.White,
            shadowElevation = 4.dp,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp)
                .size(40.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Close, contentDescription = "Close map", tint = Ink)
            }
        }

        // Bottom card for the tapped pin: photo + title + price + a "View" button into the detail screen.
        selected?.let { listing ->
            MapSelectionCard(
                listing = listing,
                onView = { onSelect(listing) },
                onDismiss = { selected = null },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(16.dp)
            )
        }
    }
}

@Composable
private fun MapSelectionCard(
    listing: Listing,
    onView: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(22.dp),
        shadowElevation = 8.dp,
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onView)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val thumbUrl = listing.sortedImageUrls.firstOrNull()
            if (thumbUrl != null) {
                AsyncImage(
                    model = thumbUrl,
                    contentDescription = listing.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(72.dp)
                        .background(Tan, RoundedCornerShape(16.dp))
                        .clip(RoundedCornerShape(16.dp))
                )
            } else {
                PhotoPlaceholder(
                    modifier = Modifier.size(72.dp),
                    cornerRadius = 16.dp,
                    iconSize = 22.dp,
                    showCaption = false
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    listing.title,
                    fontWeight = FontWeight.Bold,
                    color = Ink,
                    fontSize = 15.sp,
                    maxLines = 1
                )
                if (listing.location != null) {
                    Text(listing.location, color = Muted, fontSize = 13.sp, maxLines = 1)
                }
                Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.padding(top = 2.dp)) {
                    Text(listing.priceText, fontWeight = FontWeight.Bold, color = Burgundy, fontSize = 14.sp)
                    Text(" / night", color = Muted, fontSize = 12.sp)
                }
            }
            Spacer(Modifier.width(8.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Filled.Close, contentDescription = "Dismiss", tint = Muted)
                }
                Button(
                    onClick = onView,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp, vertical = 6.dp)
                ) {
                    Text("View", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                }
            }
        }
    }
}

/**
 * Floating "Search this area" pill shown over the map. Tapping it re-queries listings within
 * the map's current visible viewport. Disabled (dimmed) while a fetch is in flight.
 */
@Composable
private fun SearchThisAreaButton(
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(50),
        color = Burgundy,
        contentColor = Color.White,
        shadowElevation = 6.dp,
        modifier = modifier
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp)
        ) {
            Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                stringResource(R.string.filters_search_this_area),
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp
            )
        }
    }
}

/** Horizontal quick-jump pills for the three Egyptian coast regions. */
@Composable
private fun MapRegionTabs(
    selected: MapRegion?,
    onSelect: (MapRegion) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        MapRegion.values().forEach { region ->
            val on = selected == region
            Surface(
                onClick = { onSelect(region) },
                shape = RoundedCornerShape(50),
                color = if (on) Burgundy else Color.White,
                shadowElevation = 3.dp
            ) {
                Text(
                    region.label,
                    color = if (on) Color.White else Ink,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 9.dp)
                )
            }
        }
    }
}

/**
 * Draws an Airbnb-style burgundy PRICE PILL (rounded rect + white price + a little pointer)
 * as a marker icon, so each pin shows e.g. "$420" instead of a generic pin.
 */
private fun pricePillIcon(context: Context, label: String): BitmapDrawable {
    val d = context.resources.displayMetrics.density
    val padH = 12f * d
    val padV = 7f * d
    val pointer = 7f * d
    val burgundy = 0xFF5B0F16.toInt()

    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFFFFFFF.toInt()
        textSize = 13f * d
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val fm = textPaint.fontMetrics
    val textW = textPaint.measureText(label)
    val textH = fm.descent - fm.ascent
    val w = Math.ceil((textW + padH * 2).toDouble()).toInt()
    val pillH = textH + padV * 2
    val h = Math.ceil((pillH + pointer).toDouble()).toInt()

    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val rect = RectF(0f, 0f, w.toFloat(), pillH)
    val radius = pillH / 2f

    val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = burgundy }
    canvas.drawRoundRect(rect, radius, radius, bg)
    // downward pointer to the exact coordinate
    val path = Path().apply {
        moveTo(w / 2f - pointer, pillH - 1f)
        lineTo(w / 2f + pointer, pillH - 1f)
        lineTo(w / 2f, pillH + pointer)
        close()
    }
    canvas.drawPath(path, bg)
    // white outline
    val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFFFFFFF.toInt(); style = Paint.Style.STROKE; strokeWidth = 1.5f * d
    }
    canvas.drawRoundRect(rect, radius, radius, border)
    canvas.drawText(label, padH, padV - fm.ascent, textPaint)

    return BitmapDrawable(context.resources, bmp)
}

package com.quickin.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import com.quickin.app.CalendarDay
import com.quickin.app.CalendarPriceChange
import com.quickin.app.DayStatus
import com.quickin.app.HostCalendarUiState
import com.quickin.app.HostCalendarViewModel
import com.quickin.app.Listing
import com.quickin.app.PriceSource
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamSurface2
import com.quickin.app.ui.theme.ErrorCoral
import com.quickin.app.ui.theme.GoldDeep
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import com.quickin.app.ui.theme.TanDeep
import com.quickin.app.ui.theme.TanWarm
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * The host's day-by-day calendar for one listing: what each night costs, where that price came
 * from, and whether the night is still sellable.
 *
 * Selection is Airbnb-style and multi-day:
 *   • tap a day to add or remove it,
 *   • long-press and drag across days to sweep a range in or out,
 *   • the bar at the bottom then prices, resets, blocks or opens everything selected in one
 *     request.
 *
 * The drag deliberately starts on a LONG press rather than immediately: the grid lives inside a
 * vertical scroller, and a drag that claimed the pointer straight away would eat every attempt to
 * scroll the months.
 *
 * Prices shown are the host's RAW rates — the numbers they type and are paid — with the
 * guest-inclusive figure alongside. Booked days are inert: they can't be selected, so the action
 * bar can never be aimed at a night a guest already holds.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostCalendarScreen(
    listing: Listing,
    state: HostCalendarUiState,
    onBack: () -> Unit,
    onOpen: (String) -> Unit,
    onLoadMonth: (String) -> Unit,
    onToggleDay: (String) -> Unit,
    onSweep: (anchor: String, to: String, adding: Boolean) -> Unit,
    onToggleMonth: (String) -> Unit,
    onClearSelection: () -> Unit,
    onSave: (CalendarPriceChange, Boolean?) -> Unit,
    onGuestPreview: (String) -> Double?,
    isEditable: (String) -> Boolean
) {
    LaunchedEffect(listing.id) { onOpen(listing.id) }

    var priceText by remember(listing.id) { mutableStateOf("") }
    var localError by remember(listing.id) { mutableStateOf<String?>(null) }

    val months = remember { (0 until HostCalendarViewModel.MONTHS_VISIBLE).map(HostCalendarViewModel::monthKey) }
    val currency = state.currency

    Scaffold(
        containerColor = Cream,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.calendar_title), fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = Burgundy)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Tan, titleContentColor = Burgundy)
            )
        },
        bottomBar = {
            if (state.selected.isNotEmpty()) {
                ActionBar(
                    state = state,
                    currency = currency,
                    priceText = priceText,
                    onPriceChange = { priceText = it; localError = null },
                    guestPreview = onGuestPreview(priceText),
                    localError = localError,
                    onSetPrice = {
                        val amount = priceText.trim().toDoubleOrNull()
                        when {
                            // An empty box with "Set price" is an unfinished thought, not a reset —
                            // resetting has its own button, which says so.
                            priceText.isBlank() -> localError = "required"
                            amount == null || amount <= 0 -> localError = "invalid"
                            else -> {
                                localError = null
                                onSave(CalendarPriceChange.Set(amount), null)
                                priceText = ""
                            }
                        }
                    },
                    onReset = { onSave(CalendarPriceChange.Reset, null) },
                    onBlock = { onSave(CalendarPriceChange.Unchanged, true) },
                    onUnblock = { onSave(CalendarPriceChange.Unchanged, false) },
                    onClear = { onClearSelection(); priceText = ""; localError = null }
                )
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(listing.title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                    Text(
                        stringResource(R.string.calendar_subtitle, money(listing.pricePerNight), currency),
                        fontSize = 13.sp, color = Muted
                    )
                    if (state.isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = Burgundy)
                    }
                    state.savedUpdated?.let { updated ->
                        Text(
                            if (state.savedSkipped > 0) {
                                stringResource(R.string.calendar_saved_with_skips, updated, state.savedSkipped)
                            } else {
                                stringResource(R.string.calendar_saved, updated)
                            },
                            fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Burgundy
                        )
                    }
                    Legend()
                }
            }

            items(months, key = { it }) { month ->
                MonthSection(
                    firstOfMonth = month,
                    state = state,
                    currency = currency,
                    onLoadMonth = onLoadMonth,
                    onToggleDay = onToggleDay,
                    onSweep = onSweep,
                    onToggleMonth = onToggleMonth,
                    isEditable = isEditable
                )
            }
        }
    }
}

@Composable
private fun Legend() {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        LegendItem(Color.White, stringResource(R.string.calendar_legend_default))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("1,500", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = GoldDeep)
            Spacer(Modifier.width(4.dp))
            Text(stringResource(R.string.calendar_legend_custom), fontSize = 11.sp, color = Muted)
        }
        LegendItem(TanDeep, stringResource(R.string.calendar_legend_blocked))
        LegendItem(TanWarm, stringResource(R.string.calendar_legend_booked))
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(13.dp)
                .background(color, RoundedCornerShape(4.dp))
                .border(1.dp, TanDeep, RoundedCornerShape(4.dp))
        )
        Spacer(Modifier.width(4.dp))
        Text(label, fontSize = 11.sp, color = Muted)
    }
}

/** Height of one day cell. Also the unit the drag hit-test divides by, so the two cannot drift. */
private val CELL_HEIGHT = 58.dp
private val CELL_GAP = 4.dp

@Composable
private fun MonthSection(
    firstOfMonth: String,
    state: HostCalendarUiState,
    currency: String,
    onLoadMonth: (String) -> Unit,
    onToggleDay: (String) -> Unit,
    onSweep: (String, String, Boolean) -> Unit,
    onToggleMonth: (String) -> Unit,
    isEditable: (String) -> Boolean
) {
    LaunchedEffect(firstOfMonth) { onLoadMonth(firstOfMonth) }

    val blanks = remember(firstOfMonth) { HostCalendarViewModel.leadingBlanks(firstOfMonth) }
    val days = remember(firstOfMonth) { HostCalendarViewModel.daysOfMonth(firstOfMonth) }
    // null for the leading blanks, then each day. One flat list so the drag hit-test can map a
    // position straight to an index.
    val cells = remember(firstOfMonth) { List(blanks) { null } + days }
    val rows = (cells.size + 6) / 7

    var gridWidth by remember { mutableStateOf(0f) }
    val density = LocalDensity.current
    val cellHeightPx = with(density) { (CELL_HEIGHT + CELL_GAP).toPx() }

    // Fixed when the finger goes down, so sweeping back and forth over a day doesn't flip it.
    var dragAnchor by remember { mutableStateOf<String?>(null) }
    var dragAdds by remember { mutableStateOf(true) }

    fun dayAt(offset: Offset): String? {
        if (gridWidth <= 0f) return null
        val columnWidth = gridWidth / 7f
        val column = (offset.x / columnWidth).toInt()
        val row = (offset.y / cellHeightPx).toInt()
        if (column !in 0..6 || row < 0) return null
        val index = row * 7 + column
        return cells.getOrNull(index)
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(monthLabel(firstOfMonth), fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Burgundy)
            TextButton(onClick = { onToggleMonth(firstOfMonth) }) {
                Text(stringResource(R.string.calendar_select_month), fontSize = 13.sp, color = Burgundy)
            }
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(CELL_GAP)) {
            weekdayInitials().forEach { name ->
                Text(
                    name, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Muted,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // A hand-laid grid rather than LazyVerticalGrid: a lazy grid inside a LazyColumn needs a
        // fixed height anyway, and this way one gesture covers the whole month. A gesture attached
        // per cell only ever sees its own bounds, so a finger moving to the next day would end the
        // sweep instead of extending it.
        Column(
            verticalArrangement = Arrangement.spacedBy(CELL_GAP),
            modifier = Modifier
                .fillMaxWidth()
                .onGloballyPositioned { gridWidth = it.size.width.toFloat() }
                .pointerInput(firstOfMonth, state.days, state.selected) {
                    detectDragGesturesAfterLongPress(
                        onDragStart = { offset ->
                            val day = dayAt(offset)
                            if (day != null && isEditable(day)) {
                                dragAnchor = day
                                dragAdds = day !in state.selected
                                onSweep(day, day, dragAdds)
                            }
                        },
                        onDrag = { change, _ ->
                            val anchor = dragAnchor ?: return@detectDragGesturesAfterLongPress
                            val day = dayAt(change.position) ?: return@detectDragGesturesAfterLongPress
                            onSweep(anchor, day, dragAdds)
                        },
                        onDragEnd = { dragAnchor = null },
                        onDragCancel = { dragAnchor = null }
                    )
                }
        ) {
            for (row in 0 until rows) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(CELL_GAP)) {
                    for (column in 0 until 7) {
                        val cell = cells.getOrNull(row * 7 + column)
                        if (cell == null) {
                            Box(Modifier.weight(1f).height(CELL_HEIGHT))
                        } else {
                            DayCell(
                                date = cell,
                                day = state.days[cell],
                                selected = cell in state.selected,
                                editable = isEditable(cell),
                                past = cell < HostCalendarViewModel.today(),
                                currency = currency,
                                onTap = { onToggleDay(cell) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    date: String,
    day: CalendarDay?,
    selected: Boolean,
    editable: Boolean,
    past: Boolean,
    currency: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier
) {
    val booked = day?.status == DayStatus.BOOKED
    val blocked = day?.status == DayStatus.BLOCKED
    val custom = day?.source == PriceSource.CUSTOM

    val background = when {
        selected -> Burgundy
        booked -> TanWarm
        past -> CreamSurface2
        blocked -> TanDeep
        else -> Color.White
    }
    val foreground = when {
        selected -> Color.White
        past || booked -> Muted
        else -> Ink
    }

    Box(
        modifier = modifier
            .height(CELL_HEIGHT)
            .background(background, RoundedCornerShape(10.dp))
            .border(1.dp, if (selected) Burgundy else TanDeep, RoundedCornerShape(10.dp))
            .then(
                // A tap is only wired up for a day the host may act on; a booked or past day is
                // inert rather than showing a ripple that does nothing.
                if (editable) Modifier.pointerInput(date) {
                    detectTapGestures { onTap() }
                } else Modifier
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(date.takeLast(2), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = foreground)
            if (day != null && !past) {
                Text(
                    money(day.price),
                    fontSize = 10.sp,
                    fontWeight = if (custom) FontWeight.Bold else FontWeight.Normal,
                    color = if (selected) Color.White else if (custom) GoldDeep else Muted
                )
            }
            when {
                booked -> Text("●", fontSize = 8.sp, color = if (selected) Color.White else Muted)
                blocked -> Text("✕", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = if (selected) Color.White else Muted)
            }
        }
    }
}

@Composable
private fun ActionBar(
    state: HostCalendarUiState,
    currency: String,
    priceText: String,
    onPriceChange: (String) -> Unit,
    guestPreview: Double?,
    localError: String?,
    onSetPrice: () -> Unit,
    onReset: () -> Unit,
    onBlock: () -> Unit,
    onUnblock: () -> Unit,
    onClear: () -> Unit
) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                stringResource(R.string.calendar_nights_selected, state.selected.size),
                fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Ink
            )
            TextButton(onClick = onClear) {
                Text(stringResource(R.string.calendar_clear), fontSize = 13.sp, color = Muted)
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = priceText,
                onValueChange = onPriceChange,
                placeholder = { Text(stringResource(R.string.calendar_price_placeholder), fontSize = 14.sp) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.weight(1f)
            )
            Button(
                onClick = onSetPrice,
                enabled = !state.isSaving,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
            ) {
                Text(
                    if (state.isSaving) stringResource(R.string.calendar_saving) else stringResource(R.string.calendar_set_price),
                    fontSize = 14.sp, fontWeight = FontWeight.Bold
                )
            }
        }

        guestPreview?.let {
            Text(stringResource(R.string.calendar_guests_pay, money(it), currency), fontSize = 12.sp, color = Muted)
        }

        // Only the actions that would actually change something. Offering "Open" for a selection
        // with nothing blocked in it invites the host to press a button that can only be a no-op.
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (state.selectedCustom > 0) {
                SecondaryAction(stringResource(R.string.calendar_reset_price), state.isSaving, onReset)
            }
            if (state.selectedBlocked < state.selected.size) {
                SecondaryAction(stringResource(R.string.calendar_block), state.isSaving, onBlock)
            }
            if (state.selectedBlocked > 0) {
                SecondaryAction(stringResource(R.string.calendar_unblock), state.isSaving, onUnblock)
            }
        }

        val message = when {
            localError == "required" -> stringResource(R.string.calendar_error_price_required)
            localError == "invalid" -> stringResource(R.string.calendar_error_price_invalid)
            state.error == "notSignedIn" -> stringResource(R.string.calendar_error_sign_in)
            state.error == "saveFailed" -> stringResource(R.string.calendar_error_save_failed)
            // Anything else is the server's own `{ error }`, already in plain English.
            state.error != null -> state.error
            else -> null
        }
        message?.let {
            Text(it, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = ErrorCoral)
        }
    }
}

@Composable
private fun SecondaryAction(label: String, disabled: Boolean, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        enabled = !disabled,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, TanDeep),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Cream, contentColor = Ink)
    ) {
        Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

// ---- Formatting ----------------------------------------------------------------

/** Grouped whole EGP, in en-US digits so it matches the rest of the pricing UI. */
private fun money(amount: Double): String {
    val f = NumberFormat.getNumberInstance(Locale.US)
    f.maximumFractionDigits = 0
    return f.format(amount)
}

/** "August 2026" for a `yyyy-MM-01`, in the device's language. */
@Composable
private fun monthLabel(firstOfMonth: String): String {
    val parser = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    val date = parser.parse(firstOfMonth) ?: return firstOfMonth
    val out = SimpleDateFormat("LLLL yyyy", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    return out.format(date)
}

/**
 * Sunday-first weekday initials in the device's language. Anchored on 2023-01-01, a Sunday, so the
 * header can't shift with the current date.
 */
@Composable
private fun weekdayInitials(): List<String> {
    val out = SimpleDateFormat("EEEEE", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    val parser = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    val sunday = parser.parse("2023-01-01") ?: return List(7) { "" }
    val cal = java.util.Calendar.getInstance(TimeZone.getTimeZone("UTC"), Locale.US)
    return (0 until 7).map { offset ->
        cal.time = sunday
        cal.add(java.util.Calendar.DAY_OF_MONTH, offset)
        out.format(cal.time)
    }
}

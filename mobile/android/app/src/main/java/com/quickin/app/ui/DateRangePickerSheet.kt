package com.quickin.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.border
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import com.quickin.app.AvailabilityRange
import com.quickin.app.R
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

/**
 * A custom, brand-styled date-range calendar shown in a [ModalBottomSheet]. Used for both the
 * Explore search dates and the listing-detail reserve dates. Deliberately does NOT use the
 * Material3 `DatePicker` / `DatePickerDialog` or the native `android.app.DatePickerDialog` —
 * it's a hand-built month grid on a Cream surface in the QuickIn palette.
 *
 * @param initialCheckIn pre-selected check-in as "yyyy-MM-dd", or null.
 * @param initialCheckOut pre-selected check-out as "yyyy-MM-dd", or null.
 * @param unavailableRanges booked + host-blocked spans for this listing. Each span is half-open
 *   `[start, end)` (the checkout day is free again); a day is greyed out + unselectable when it
 *   falls in any span, and a check-in → check-out range that straddles such a span is rejected.
 * @param onApply called with the chosen range (yyyy-MM-dd strings, or nulls) and dismisses.
 * @param onDismiss called when the sheet is dismissed without applying.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateRangePickerSheet(
    initialCheckIn: String?,
    initialCheckOut: String?,
    unavailableRanges: List<AvailabilityRange> = emptyList(),
    onApply: (checkIn: String?, checkOut: String?) -> Unit,
    onDismiss: () -> Unit
) {
    val today = remember { LocalDate.now() }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Pre-parse the unavailable spans into LocalDate pairs once. A day is blocked when
    // start <= day < end (half-open).
    val blockedSpans = remember(unavailableRanges) {
        unavailableRanges.mapNotNull { r ->
            val s = parseLocalDate(r.start) ?: return@mapNotNull null
            val e = parseLocalDate(r.end) ?: return@mapNotNull null
            if (e.isAfter(s)) s to e else null
        }
    }
    val isUnavailable: (LocalDate) -> Boolean = remember(blockedSpans) {
        { day -> blockedSpans.any { (s, e) -> !day.isBefore(s) && day.isBefore(e) } }
    }

    var start by remember { mutableStateOf(parseLocalDate(initialCheckIn)) }
    var end by remember { mutableStateOf(parseLocalDate(initialCheckOut)) }
    // The month currently displayed in the grid. Starts on the check-in's month if set,
    // otherwise the current month.
    var visibleMonth by remember {
        mutableStateOf(YearMonth.from(start ?: today))
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = CreamPage,
        contentColor = Ink
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp)
        ) {
            // A small branded title so the sheet reads as a premium, deliberate calendar.
            Text(
                "Select your dates",
                color = Ink,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                modifier = Modifier.padding(top = 4.dp, bottom = 2.dp)
            )
            Text(
                "Tap a check-in, then a check-out.",
                color = Muted,
                fontSize = 13.sp
            )

            MonthHeader(
                month = visibleMonth,
                canGoBack = visibleMonth > YearMonth.from(today),
                onPrev = { visibleMonth = visibleMonth.minusMonths(1) },
                onNext = { visibleMonth = visibleMonth.plusMonths(1) }
            )

            Spacer(Modifier.height(12.dp))
            WeekdayRow()
            Spacer(Modifier.height(4.dp))

            // Set when the user picks a check-out whose range would straddle a booked/blocked
            // span — we refuse it and show this hint instead of silently selecting it.
            var straddleWarning by remember { mutableStateOf(false) }

            MonthGrid(
                month = visibleMonth,
                today = today,
                start = start,
                end = end,
                isUnavailable = isUnavailable,
                onDayClick = { day ->
                    when {
                        // No start yet, or a full range already chosen -> begin a new range.
                        start == null || end != null -> {
                            start = day
                            end = null
                            straddleWarning = false
                        }
                        // Second tap after the start: only accept it if no unavailable day lies
                        // strictly inside the chosen stay (nights start..<day must all be free).
                        day.isAfter(start) -> {
                            if (rangeStraddlesUnavailable(start!!, day, isUnavailable)) {
                                // Reject: the range would cover a booked/blocked night.
                                straddleWarning = true
                            } else {
                                end = day
                                straddleWarning = false
                            }
                        }
                        // Tapped on or before the start -> restart from the new (earlier) day.
                        else -> {
                            start = day
                            end = null
                            straddleWarning = false
                        }
                    }
                }
            )

            if (straddleWarning) {
                Spacer(Modifier.height(8.dp))
                Text(
                    stringResource(R.string.availability_range_unavailable),
                    color = Burgundy,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(Modifier.height(16.dp))
            Footer(
                start = start,
                end = end,
                onClear = {
                    start = null
                    end = null
                    straddleWarning = false
                },
                onApply = {
                    onApply(start?.let(::formatLocalDate), end?.let(::formatLocalDate))
                }
            )
        }
    }
}

@Composable
private fun MonthHeader(
    month: YearMonth,
    canGoBack: Boolean,
    onPrev: () -> Unit,
    onNext: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onPrev, enabled = canGoBack) {
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                contentDescription = "Previous month",
                tint = if (canGoBack) Burgundy else Muted.copy(alpha = 0.4f)
            )
        }
        Text(
            text = "${month.month.getDisplayName(TextStyle.FULL, Locale.ENGLISH)} ${month.year}",
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center,
            color = Ink,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp
        )
        IconButton(onClick = onNext) {
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "Next month",
                tint = Burgundy
            )
        }
    }
}

@Composable
private fun WeekdayRow() {
    // Sunday-first week, matching the requested "S M T W T F S".
    val labels = listOf("S", "M", "T", "W", "T", "F", "S")
    Row(modifier = Modifier.fillMaxWidth()) {
        labels.forEach { label ->
            Text(
                text = label,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center,
                color = Muted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp
            )
        }
    }
}

/**
 * The 7-column month grid, drawn as a Column of week Rows. Leading blanks pad the first week so
 * the 1st lands under the correct weekday (Sunday-first). The in-range "band" is rendered as a
 * continuous Tan strip behind interior cells.
 */
@Composable
private fun MonthGrid(
    month: YearMonth,
    today: LocalDate,
    start: LocalDate?,
    end: LocalDate?,
    isUnavailable: (LocalDate) -> Boolean,
    onDayClick: (LocalDate) -> Unit
) {
    val daysInMonth = month.lengthOfMonth()
    val firstOfMonth = month.atDay(1)
    // DayOfWeek: MONDAY=1 .. SUNDAY=7. Convert to Sunday-first index 0..6.
    val leadingBlanks = firstOfMonth.dayOfWeek.value % 7

    // Build a flat list of cells (null = blank padding) then chunk into weeks of 7.
    val cells: List<LocalDate?> = buildList {
        repeat(leadingBlanks) { add(null) }
        for (d in 1..daysInMonth) add(month.atDay(d))
        // Trailing blanks to complete the final week row.
        while (size % 7 != 0) add(null)
    }

    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        cells.chunked(7).forEach { week ->
            Row(modifier = Modifier.fillMaxWidth()) {
                week.forEach { day ->
                    Box(modifier = Modifier.weight(1f)) {
                        if (day != null) {
                            DayCell(
                                day = day,
                                today = today,
                                start = start,
                                end = end,
                                unavailable = isUnavailable(day),
                                onClick = { onDayClick(day) }
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
    day: LocalDate,
    today: LocalDate,
    start: LocalDate?,
    end: LocalDate?,
    unavailable: Boolean,
    onClick: () -> Unit
) {
    val isPast = day.isBefore(today)
    // Past days and booked/blocked days are both unselectable and dimmed.
    val isDisabled = isPast || unavailable
    val isStart = day == start
    val isEnd = day == end
    val isEndpoint = isStart || isEnd
    val inBetween = start != null && end != null && day.isAfter(start) && day.isBefore(end)
    val isToday = day == today

    // The continuous Tan band: interior days fill their whole cell; endpoints fill the half of
    // the cell that faces the range so the strip stays connected to the circle.
    val bandStartHalf = inBetween || (isStart && end != null) || (isEnd)
    val bandEndHalf = inBetween || (isEnd && start != null) || (isStart && end != null)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .clickable(enabled = !isDisabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        // Range band behind the circle (only when there's a full range to span).
        if (start != null && end != null && (inBetween || isEndpoint) && day in start..end) {
            Box(modifier = Modifier.fillMaxWidth().height(40.dp)) {
                if (bandStartHalf) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.CenterStart)
                            .fillMaxWidth(0.5f)
                            .height(40.dp)
                            .background(Tan)
                    )
                }
                if (bandEndHalf) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.CenterEnd)
                            .fillMaxWidth(0.5f)
                            .height(40.dp)
                            .background(Tan)
                    )
                }
            }
        }

        // The day circle. Booked/blocked days (not past, not an endpoint) get a faint tan disc
        // so they read as "taken" rather than merely dim.
        val circleModifier = when {
            isEndpoint -> Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(50))
                .background(Burgundy)
            unavailable && !isPast -> Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(50))
                .background(Tan.copy(alpha = 0.45f))
            isToday -> Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(50))
                .border(1.5.dp, Burgundy, RoundedCornerShape(50))
            else -> Modifier.size(40.dp)
        }

        Box(modifier = circleModifier, contentAlignment = Alignment.Center) {
            Text(
                text = day.dayOfMonth.toString(),
                color = when {
                    isEndpoint -> Color.White
                    isDisabled -> Muted.copy(alpha = 0.35f)
                    else -> Ink
                },
                // Strike through booked/blocked days so they're unmistakably unavailable.
                textDecoration = if (unavailable && !isEndpoint)
                    androidx.compose.ui.text.style.TextDecoration.LineThrough else null,
                fontWeight = if (isEndpoint || isToday) FontWeight.Bold else FontWeight.Normal,
                fontSize = 14.sp
            )
        }
    }
}

@Composable
private fun Footer(
    start: LocalDate?,
    end: LocalDate?,
    onClear: () -> Unit,
    onApply: () -> Unit
) {
    val nights = if (start != null && end != null) {
        nightsBetweenDates(start, end)
    } else 0

    val summary = when {
        start != null && end != null ->
            "${shortLabel(start)} → ${shortLabel(end)} · $nights night${if (nights == 1) "" else "s"}"
        start != null -> "${shortLabel(start)} → Select check-out"
        else -> "Select dates"
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = summary,
            color = if (start != null) Ink else Muted,
            fontWeight = if (start != null) FontWeight.SemiBold else FontWeight.Normal,
            fontSize = 15.sp
        )
        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(
                onClick = onClear,
                colors = ButtonDefaults.textButtonColors(contentColor = Muted)
            ) {
                Text("Clear", fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.weight(1f))
            Button(
                onClick = onApply,
                enabled = start != null && end != null,
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Burgundy,
                    contentColor = Color.White,
                    disabledContainerColor = Burgundy.copy(alpha = 0.4f),
                    disabledContentColor = Color.White
                ),
                contentPadding = PaddingValues(horizontal = 28.dp, vertical = 12.dp)
            ) {
                Text("Apply", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

/**
 * True when a stay from [start] (check-in) to [end] (check-out) would cover any unavailable
 * night. The booked nights of a stay are `start .. end-1` (you sleep there start through the night
 * before checkout), so a check-out that lands exactly on a blocked span's start is still allowed
 * (back-to-back stays). Mirrors the half-open `[start, end)` span semantics used for blocking.
 */
private fun rangeStraddlesUnavailable(
    start: LocalDate,
    end: LocalDate,
    isUnavailable: (LocalDate) -> Boolean
): Boolean {
    var day = start
    while (day.isBefore(end)) {
        if (isUnavailable(day)) return true
        day = day.plusDays(1)
    }
    return false
}

/** "Mar 10" style short label for the footer summary. */
private fun shortLabel(date: LocalDate): String =
    "${date.month.getDisplayName(TextStyle.SHORT, Locale.ENGLISH)} ${date.dayOfMonth}"

/** Parses "yyyy-MM-dd" into a [LocalDate], or null if blank / malformed. */
fun parseLocalDate(value: String?): LocalDate? {
    if (value.isNullOrBlank()) return null
    return try {
        LocalDate.parse(value)
    } catch (e: Exception) {
        null
    }
}

/** Formats a [LocalDate] as "yyyy-MM-dd". */
fun formatLocalDate(date: LocalDate): String = date.toString()

/** Nights between two [LocalDate]s (>= 0). */
fun nightsBetweenDates(start: LocalDate, end: LocalDate): Int {
    val days = java.time.temporal.ChronoUnit.DAYS.between(start, end)
    return if (days > 0) days.toInt() else 0
}

/**
 * Number of nights between two "yyyy-MM-dd" strings, or 0 if invalid / non-positive.
 * Replaces the old DateField helper so the reserve total keeps working.
 */
fun nightsBetween(checkIn: String, checkOut: String): Int {
    val a = parseLocalDate(checkIn) ?: return 0
    val b = parseLocalDate(checkOut) ?: return 0
    return nightsBetweenDates(a, b)
}

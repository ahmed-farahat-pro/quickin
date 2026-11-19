package com.quickin.app.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PageSize
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.CalendarDay
import com.quickin.app.CalendarPriceChange
import com.quickin.app.DayStatus
import com.quickin.app.HostCalendarSelection
import com.quickin.app.HostCalendarSelection.RunPosition
import com.quickin.app.HostCalendarUiState
import com.quickin.app.HostCalendarViewModel
import com.quickin.app.Listing
import com.quickin.app.PriceSource
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.ErrorCoral
import com.quickin.app.ui.theme.GoldDeep
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

// The web calendar's palette (calendar-editor.tsx COLORS), so the two read the same.
private val Band = Color(0x1F5B0F16)          // burgundy at 12%
private val Line = Color(0x1F5B0F16)
private val Amber = GoldDeep                  // #8A5A00 — custom prices
private val AmberOnSolid = Color(0xFFF3C66B)
private val InertBg = Color(0x0D2A2220)       // ink at 5%
private val Hatch = Color(0x172A2220)         // ink at 9%
private val Danger = Color(0xFFB3261E)

/** Two months side by side from this width; one below it. */
private val WIDE_WIDTH = 840.dp
private val CELL_HEIGHT = 50.dp
private val ROW_GAP = 4.dp

/**
 * The host's day-by-day pricing calendar for one listing: what each night costs, where that price
 * came from, and whether the night is still sellable. The Android port of the web's
 * `calendar-editor.tsx`; the selection rules live in [HostCalendarSelection] (unit-tested).
 *
 *   • One month at a time (two side by side on a wide screen), paged with the arrows, a
 *     horizontal swipe (mirrored in RTL by the pager), the "Today" button, or the month title,
 *     which opens a picker for the whole 24-month horizon. Months load as they are paged to.
 *   • Selection is "tap start, tap end": tap a day, then another → the range between them is
 *     selected; tap the first day again → keep just that day; tap a selected day → remove it.
 *     Ranges accumulate and survive paging. "Select month" toggles a whole month.
 *   • The editor is a bottom panel: hidden with nothing selected, a slim hint while a range is
 *     half-made, the full price / reset / block / open editor once it is complete. The scaffold
 *     pads the grid by the panel's height (keyboard included), so the month stays visible.
 *
 * Prices shown are the host's RAW rates — the numbers they type and are paid — with the
 * guest-inclusive figure alongside. Booked and past days are inert. After every save the days come
 * back from the server rather than being patched locally.
 *
 * [onSweep] is unused since the long-press sweep was replaced by tap start / tap end; it stays so
 * the call site in MainActivity is untouched.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Suppress("UNUSED_PARAMETER")
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
    var pickerOpen by remember { mutableStateOf(false) }

    val currency = state.currency
    val today = HostCalendarViewModel.today()
    val snackbar = remember { SnackbarHostState() }
    val resources = LocalContext.current.resources

    // One confirmation per save, fading on its own — it isn't something to dismiss.
    LaunchedEffect(state.saveSeq) {
        val updated = state.savedUpdated ?: return@LaunchedEffect
        if (state.saveSeq == 0) return@LaunchedEffect
        val message = if (state.savedSkipped > 0) {
            resources.getString(R.string.calendar_saved_with_skips, updated, state.savedSkipped)
        } else {
            resources.getString(R.string.calendar_saved, updated)
        }
        snackbar.showSnackbar(
            message,
            duration = if (state.savedSkipped > 0) SnackbarDuration.Long else SnackbarDuration.Short
        )
    }

    val clearAll = {
        onClearSelection()
        priceText = ""
        localError = null
    }

    Scaffold(
        containerColor = Cream,
        snackbarHost = { SnackbarHost(snackbar) },
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
                EditorPanel(
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
                    onClear = clearAll
                )
            }
        }
    ) { padding ->
        BoxWithConstraints(Modifier.fillMaxSize().padding(padding)) {
            val visible = if (maxWidth >= WIDE_WIDTH) 2 else 1
            val horizon = HostCalendarSelection.MAX_MONTHS_AHEAD
            val pagerState = rememberPagerState(pageCount = { horizon })
            val scope = rememberCoroutineScope()
            val page = HostCalendarSelection.clampMonthOffset(pagerState.currentPage, visible, horizon)
            val lastPage = HostCalendarSelection.clampMonthOffset(Int.MAX_VALUE, visible, horizon)
            val goTo: (Int) -> Unit = { to ->
                pickerOpen = false
                scope.launch {
                    pagerState.animateScrollToPage(HostCalendarSelection.clampMonthOffset(to, visible, horizon))
                }
            }

            // The months on screen plus one ahead, so the next arrow tap already has prices on
            // it. Keyed on listingId too: the first pass runs before open() has set it.
            LaunchedEffect(page, visible, state.listingId) {
                if (state.listingId == null) return@LaunchedEffect
                for (i in page..page + visible) {
                    if (i < horizon) onLoadMonth(HostCalendarViewModel.monthKey(i))
                }
            }

            val months = remember(today, page, visible) {
                (0 until visible).map { HostCalendarViewModel.monthKey(page + it) }
            }

            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(listing.title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                    Text(
                        stringResource(R.string.calendar_subtitle, money(listing.pricePerNight), currency),
                        fontSize = 13.sp, color = Muted
                    )
                }

                MonthNav(
                    title = if (visible == 2) {
                        "${monthLabel(months[0], "LLL yyyy")} – ${monthLabel(months[1], "LLL yyyy")}"
                    } else {
                        monthLabel(months[0], "LLLL yyyy")
                    },
                    canPrev = page > 0,
                    canNext = page < lastPage,
                    pickerOpen = pickerOpen,
                    loading = state.isLoading,
                    onPrev = { goTo(page - 1) },
                    onNext = { goTo(page + 1) },
                    onToday = { goTo(0) },
                    onTitle = { pickerOpen = true }
                )

                Legend()

                HorizontalPager(
                    state = pagerState,
                    pageSize = if (visible == 2) TwoUp else PageSize.Fill,
                    pageSpacing = if (visible == 2) 24.dp else 0.dp,
                    verticalAlignment = Alignment.Top,
                    beyondViewportPageCount = 1,
                    key = { it },
                    modifier = Modifier.fillMaxWidth()
                ) { index ->
                    MonthPage(
                        firstOfMonth = HostCalendarViewModel.monthKey(index),
                        state = state,
                        today = today,
                        showTitle = visible == 2,
                        isEditable = isEditable,
                        onTapDay = { date ->
                            localError = null
                            onToggleDay(date)
                        },
                        onToggleMonth = onToggleMonth
                    )
                }

                if (state.selected.isEmpty()) {
                    HowTo()
                }
            }

            if (pickerOpen) {
                MonthPicker(
                    today = today,
                    page = page,
                    visible = visible,
                    state = state,
                    onPick = goTo,
                    onDismiss = { pickerOpen = false }
                )
            }
        }
    }
}

/** Two months per viewport on a wide screen; the pager still steps one month at a time. */
private object TwoUp : PageSize {
    override fun Density.calculateMainAxisPageSize(availableSpace: Int, pageSpacing: Int): Int =
        (availableSpace - pageSpacing) / 2
}

// ---- Month navigation ---------------------------------------------------------------

@Composable
private fun MonthNav(
    title: String,
    canPrev: Boolean,
    canNext: Boolean,
    pickerOpen: Boolean,
    loading: Boolean,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onToday: () -> Unit,
    onTitle: () -> Unit
) {
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        NavArrow(
            icon = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
            label = stringResource(R.string.calendar_prev_month),
            enabled = canPrev,
            onClick = onPrev
        )
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
            val jump = stringResource(R.string.calendar_jump_to_month)
            TextButton(
                onClick = onTitle,
                modifier = Modifier.heightIn(min = 48.dp).semantics { contentDescription = "$title — $jump" },
                contentPadding = PaddingValues(horizontal = 8.dp)
            ) {
                Text(
                    title,
                    fontFamily = FontFamily.Serif,
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    color = Burgundy,
                    maxLines = 1
                )
                Icon(
                    Icons.Filled.ArrowDropDown,
                    contentDescription = null,
                    tint = Burgundy.copy(alpha = 0.7f),
                    modifier = Modifier.size(20.dp).then(
                        if (pickerOpen) Modifier.drawWithContent {
                            // Point the caret up while the picker is open.
                            drawContext.transform.scale(1f, -1f, center)
                            drawContent()
                        } else Modifier
                    )
                )
                if (loading) {
                    Spacer(Modifier.width(4.dp))
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp, color = Burgundy)
                }
            }
        }
        NavArrow(
            icon = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            label = stringResource(R.string.calendar_next_month),
            enabled = canNext,
            onClick = onNext
        )
        OutlinedButton(
            onClick = onToday,
            enabled = canPrev,
            shape = RoundedCornerShape(999.dp),
            border = BorderStroke(1.dp, Line),
            contentPadding = PaddingValues(horizontal = 12.dp),
            colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Ink),
            modifier = Modifier.heightIn(min = 40.dp)
        ) {
            Text(stringResource(R.string.calendar_today), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun NavArrow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    enabled: Boolean,
    onClick: () -> Unit
) {
    // 48dp touch target; the auto-mirrored chevrons flip themselves in RTL.
    IconButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .size(48.dp)
            .padding(2.dp)
            .border(1.dp, Line, CircleShape)
            .alpha(if (enabled) 1f else 0.35f),
        colors = IconButtonDefaults.iconButtonColors(
            containerColor = Color.White,
            contentColor = Burgundy,
            disabledContainerColor = Color.White,
            disabledContentColor = Burgundy
        )
    ) {
        Icon(icon, contentDescription = label)
    }
}

// ---- Month picker ---------------------------------------------------------------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MonthPicker(
    today: String,
    page: Int,
    visible: Int,
    state: HostCalendarUiState,
    onPick: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    // Which months carry custom prices or part of the selection — a dot each, so the picker
    // doubles as an overview of the year.
    val customMonths = remember(state.days, today) {
        state.days.values.filter { it.source == PriceSource.CUSTOM && it.date >= today }
            .map { it.date.take(7) }.toSet()
    }
    val selectedMonths = remember(state.selected) { state.selected.map { it.take(7) }.toSet() }
    val all = remember(today) {
        (0 until HostCalendarSelection.MAX_MONTHS_AHEAD).map { it to HostCalendarViewModel.monthKey(it) }
    }
    val years = all.groupBy { it.second.take(4) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Color.White
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 16.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                stringResource(R.string.calendar_jump_to_month),
                fontFamily = FontFamily.Serif, fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Burgundy
            )
            years.forEach { (year, months) ->
                Text(year, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Muted, modifier = Modifier.padding(top = 4.dp))
                months.chunked(4).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        row.forEach { (i, first) ->
                            val onPage = i >= page && i < page + visible
                            val key = first.take(7)
                            Box(
                                Modifier
                                    .weight(1f)
                                    .height(48.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (onPage) Burgundy else Color.White)
                                    .border(1.dp, if (onPage) Burgundy else Line, RoundedCornerShape(10.dp))
                                    .clickable { onPick(i) }
                                    .semantics { selected = onPage },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    monthLabel(first, "LLL"),
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (onPage) Color.White else Ink
                                )
                                Row(
                                    Modifier.align(Alignment.BottomCenter).padding(bottom = 5.dp),
                                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                                ) {
                                    if (key in selectedMonths) {
                                        Box(Modifier.size(5.dp).background(if (onPage) Color.White else Burgundy, CircleShape))
                                    }
                                    if (key in customMonths) {
                                        Box(Modifier.size(5.dp).background(if (onPage) AmberOnSolid else Amber, CircleShape))
                                    }
                                }
                            }
                        }
                        // Pad a partial year to a full row so every chip is the same width.
                        repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
    }
}

// ---- Legend + how-to --------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Legend() {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        LegendItem(Swatch.DEFAULT, stringResource(R.string.calendar_legend_default))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("1,500", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Amber)
            Spacer(Modifier.width(5.dp))
            Text(stringResource(R.string.calendar_legend_custom), fontSize = 12.sp, color = Muted)
        }
        LegendItem(Swatch.SELECTED, stringResource(R.string.calendar_legend_selected))
        LegendItem(Swatch.BLOCKED, stringResource(R.string.calendar_legend_blocked))
        LegendItem(Swatch.BOOKED, stringResource(R.string.calendar_legend_booked))
    }
}

private enum class Swatch { DEFAULT, SELECTED, BLOCKED, BOOKED }

@Composable
private fun LegendItem(swatch: Swatch, label: String) {
    val shape = RoundedCornerShape(4.dp)
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(14.dp)
                .clip(shape)
                .background(
                    when (swatch) {
                        Swatch.SELECTED -> Burgundy
                        Swatch.BOOKED -> Color(0x1A2A2220)
                        else -> Color.White
                    }
                )
                .then(if (swatch == Swatch.BLOCKED) Modifier.hatched(Color(0x2E2A2220), 3.dp) else Modifier)
                .border(1.dp, if (swatch == Swatch.SELECTED) Burgundy else Line, shape)
        )
        Spacer(Modifier.width(5.dp))
        Text(label, fontSize = 12.sp, color = Muted)
    }
}

@Composable
private fun HowTo() {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(16.dp))
            .border(1.dp, Line, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            stringResource(R.string.calendar_empty_title),
            fontFamily = FontFamily.Serif, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Burgundy
        )
        listOf(R.string.calendar_howto_start, R.string.calendar_howto_end, R.string.calendar_howto_price)
            .forEachIndexed { i, res ->
                Row {
                    Text("${i + 1}.", fontSize = 13.5.sp, color = Muted, modifier = Modifier.width(20.dp))
                    Text(stringResource(res), fontSize = 13.5.sp, color = Muted, lineHeight = 20.sp)
                }
            }
        Text(
            stringResource(R.string.calendar_howto_tip),
            fontSize = 12.5.sp, color = Muted, modifier = Modifier.padding(top = 6.dp)
        )
    }
}

// ---- One month -------------------------------------------------------------------------

@Composable
private fun MonthPage(
    firstOfMonth: String,
    state: HostCalendarUiState,
    today: String,
    showTitle: Boolean,
    isEditable: (String) -> Boolean,
    onTapDay: (String) -> Unit,
    onToggleMonth: (String) -> Unit
) {
    val blanks = remember(firstOfMonth) { HostCalendarViewModel.leadingBlanks(firstOfMonth) }
    val days = remember(firstOfMonth) { HostCalendarViewModel.daysOfMonth(firstOfMonth) }
    val cells = remember(firstOfMonth) { List<String?>(blanks) { null } + days }
    val editableDays = days.filter(isEditable)
    val fullySelected = HostCalendarSelection.isMonthFullySelected(state.selected, editableDays)
    val anchor = state.pendingAnchor

    val loading = firstOfMonth in state.loadingMonths
    val pulse = if (loading) {
        val t = rememberInfiniteTransition(label = "monthLoading")
        t.animateFloat(1f, 0.55f, infiniteRepeatable(tween(600), RepeatMode.Reverse), label = "pulse").value
    } else 1f

    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 36.dp),
            horizontalArrangement = if (showTitle) Arrangement.SpaceBetween else Arrangement.End,
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (showTitle) {
                Text(
                    monthLabel(firstOfMonth, "LLLL yyyy"),
                    fontFamily = FontFamily.Serif, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Burgundy
                )
            }
            if (editableDays.isNotEmpty()) {
                TextButton(onClick = { onToggleMonth(firstOfMonth) }) {
                    Text(
                        stringResource(if (fullySelected) R.string.calendar_unselect_month else R.string.calendar_select_month),
                        fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Burgundy,
                        textDecoration = TextDecoration.Underline
                    )
                }
            }
        }

        Row(Modifier.fillMaxWidth()) {
            weekdayInitials().forEach { name ->
                Text(
                    name, fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = Muted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f).padding(vertical = 4.dp)
                )
            }
        }

        Column(Modifier.fillMaxWidth().alpha(pulse), verticalArrangement = Arrangement.spacedBy(ROW_GAP)) {
            cells.chunked(7).forEach { row ->
                Row(Modifier.fillMaxWidth()) {
                    for (column in 0 until 7) {
                        val date = row.getOrNull(column)
                        Box(Modifier.weight(1f).height(CELL_HEIGHT)) {
                            if (date != null) {
                                DayCell(
                                    date = date,
                                    day = state.days[date],
                                    position = HostCalendarSelection.runPosition(state.selected, date),
                                    roundStart = column == 0 || date == days.first(),
                                    roundEnd = column == 6 || date == days.last(),
                                    pending = date == anchor,
                                    editable = isEditable(date),
                                    past = date < today,
                                    isToday = date == today,
                                    onTap = { onTapDay(date) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * One day. A selected run is drawn as one band behind its days: run ends and single days are
 * solid burgundy, middle days sit on a 12% burgundy band that rounds off at week-row and month
 * edges. The half-band behind a run's start / end is drawn on the side facing the run, which
 * flips in RTL.
 */
@Composable
private fun DayCell(
    date: String,
    day: CalendarDay?,
    position: RunPosition?,
    roundStart: Boolean,
    roundEnd: Boolean,
    pending: Boolean,
    editable: Boolean,
    past: Boolean,
    isToday: Boolean,
    onTap: () -> Unit
) {
    val booked = day?.status == DayStatus.BOOKED
    val blocked = day?.status == DayStatus.BLOCKED
    val custom = day?.source == PriceSource.CUSTOM
    val solid = position == RunPosition.SINGLE || position == RunPosition.START || position == RunPosition.END
    val band = position == RunPosition.MIDDLE
    val inert = !solid && !band && (booked || past)
    val shape = RoundedCornerShape(12.dp)
    val bandRadius = 12.dp

    val bandModifier = when (position) {
        RunPosition.MIDDLE -> Modifier.background(
            Band,
            RoundedCornerShape(
                topStart = if (roundStart) bandRadius else 0.dp,
                bottomStart = if (roundStart) bandRadius else 0.dp,
                topEnd = if (roundEnd) bandRadius else 0.dp,
                bottomEnd = if (roundEnd) bandRadius else 0.dp
            )
        )
        // A run's start connects toward the END side (right in LTR, left in RTL); nothing to
        // connect to when it sits on the row's last column or the month's last day.
        RunPosition.START -> if (roundEnd) Modifier else Modifier.halfBand(towardEnd = true)
        RunPosition.END -> if (roundStart) Modifier else Modifier.halfBand(towardEnd = false)
        else -> Modifier
    }

    val ringAlpha = if (pending) {
        val t = rememberInfiniteTransition(label = "anchorRing")
        t.animateFloat(1f, 0.45f, infiniteRepeatable(tween(700), RepeatMode.Reverse), label = "ring").value
    } else 1f

    val numberColor = when {
        solid -> Color.White
        band -> Burgundy
        inert -> Muted
        isToday -> Burgundy
        else -> Ink
    }
    val priceColor = when {
        solid -> Color.White.copy(alpha = 0.92f)
        band -> Burgundy
        custom -> Amber
        else -> Muted
    }

    val description = buildString {
        append(date)
        if (booked) append(" — booked")
        if (blocked) append(" — blocked")
        if (custom) append(" — custom price")
        if (day != null && !past) append(" — ${money(day.price)}")
    }

    Box(Modifier.fillMaxSize().then(bandModifier)) {
        Box(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 2.dp)
                .clip(shape)
                .background(
                    when {
                        solid -> Burgundy
                        band -> Color.Transparent
                        inert -> InertBg
                        else -> Color.White
                    }
                )
                .then(if (blocked && !solid && !band && !inert) Modifier.hatched(Hatch, 5.dp) else Modifier)
                .then(
                    when {
                        solid || band || inert -> Modifier
                        isToday -> Modifier.border(2.dp, Burgundy.copy(alpha = 0.45f), shape)
                        else -> Modifier.border(1.dp, Line, shape)
                    }
                )
                .then(
                    if (isToday && band) Modifier.border(2.dp, Burgundy.copy(alpha = 0.45f), shape) else Modifier
                )
                .then(
                    // The pending anchor: a pulsing white ring inside the solid day.
                    if (pending) Modifier.drawWithContent {
                        drawContent()
                        val inset = 3.dp.toPx()
                        val stroke = 1.5.dp.toPx()
                        drawRoundRect(
                            color = Color.White.copy(alpha = ringAlpha),
                            topLeft = Offset(inset, inset),
                            size = Size(size.width - inset * 2, size.height - inset * 2),
                            cornerRadius = CornerRadius(9.dp.toPx()),
                            style = Stroke(width = stroke)
                        )
                    } else Modifier
                )
                // A booked or past day is inert rather than showing a ripple that does nothing.
                .then(if (editable) Modifier.clickable(onClick = onTap) else Modifier)
                .semantics {
                    contentDescription = description
                    selected = position != null
                }
        ) {
            Column(
                Modifier.align(Alignment.Center),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    date.takeLast(2).trimStart('0'),
                    fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = numberColor, lineHeight = 14.sp
                )
                if (day != null && !past && !booked) {
                    Text(
                        HostCalendarSelection.compactPrice(day.price),
                        fontSize = 10.5.sp,
                        lineHeight = 12.sp,
                        fontWeight = if (custom) FontWeight.ExtraBold else FontWeight.Medium,
                        color = priceColor,
                        textDecoration = if (blocked) TextDecoration.LineThrough else null,
                        maxLines = 1
                    )
                }
                if (booked) {
                    Text("●", fontSize = 9.sp, color = Muted, lineHeight = 10.sp)
                }
            }
            if (custom && !past && !booked) {
                Box(
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 5.dp, end = 5.dp)
                        .size(6.dp)
                        .background(if (solid) AmberOnSolid else Amber, CircleShape)
                )
            }
        }
    }
}

/** Half of a cell's band, on the start or end side — mirrored with the layout direction. */
private fun Modifier.halfBand(towardEnd: Boolean): Modifier = drawBehind {
    val half = size.width / 2f
    val endIsRight = layoutDirection == LayoutDirection.Ltr
    val onRight = towardEnd == endIsRight
    drawRect(Band, topLeft = Offset(if (onRight) half else 0f, 0f), size = Size(half, size.height))
}

/** 135° hatching, like the web's repeating-linear-gradient for blocked days. */
private fun Modifier.hatched(color: Color, spacing: androidx.compose.ui.unit.Dp): Modifier = drawBehind {
    val step = spacing.toPx() * 2
    val stroke = spacing.toPx()
    var x = -size.height
    while (x < size.width + size.height) {
        drawLine(color, Offset(x, size.height), Offset(x + size.height, 0f), strokeWidth = stroke)
        x += step
    }
}

// ---- Editor panel -----------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EditorPanel(
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
    val anchor = state.pendingAnchor
    val total = state.selected.size
    val maxHeight = (LocalConfiguration.current.screenHeightDp * 0.62f).dp

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        shadowElevation = 12.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            Modifier
                // Rises with the keyboard; `union` so the nav-bar inset isn't added on top of it.
                .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime))
                .heightIn(max = maxHeight)
                .verticalScroll(rememberScrollState())
                .padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                Modifier
                    .align(Alignment.CenterHorizontally)
                    .size(width = 38.dp, height = 4.dp)
                    .background(Color(0x2E2A2220), RoundedCornerShape(99.dp))
            )
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    pluralStringResource(R.plurals.calendar_nights_selected_count, total, total),
                    fontSize = 15.5.sp, fontWeight = FontWeight.Bold, color = Ink
                )
                TextButton(onClick = onClear) {
                    Text(stringResource(R.string.calendar_clear), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Muted)
                }
            }

            if (anchor != null) {
                // Slim while a range is half-made: just say what the next tap does.
                Text(
                    stringResource(R.string.calendar_pending_hint, dayLabel(anchor)),
                    fontSize = 12.5.sp, color = Ink, lineHeight = 18.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Cream, RoundedCornerShape(10.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp)
                )
            } else {
                val runs = remember(state.selected) { HostCalendarSelection.selectionRuns(state.selected) }
                val span = remember(state.selected, state.days) {
                    HostCalendarSelection.priceSpan(state.selected) { state.days[it]?.price }
                }
                val summary = runs.take(3).joinToString(" · ") {
                    if (it.days == 1) dayLabel(it.start) else "${dayLabel(it.start)} – ${dayLabel(it.end)}"
                }
                val more = if (runs.size > 3) {
                    " · " + pluralStringResource(R.plurals.calendar_more_ranges, runs.size - 3, runs.size - 3)
                } else ""
                Column {
                    Text(summary + more, fontSize = 13.sp, color = Muted, lineHeight = 19.sp)
                    if (span != null) {
                        Text(
                            if (span.min == span.max) {
                                stringResource(R.string.calendar_currently, money(span.min), currency)
                            } else {
                                stringResource(R.string.calendar_currently_range, money(span.min), money(span.max), currency)
                            },
                            fontSize = 13.sp, color = Muted, lineHeight = 19.sp
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = priceText,
                        onValueChange = onPriceChange,
                        placeholder = {
                            Text(
                                span?.let { money(it.min) } ?: stringResource(R.string.calendar_price_placeholder),
                                fontSize = 15.sp
                            )
                        },
                        suffix = { Text(currency, fontSize = 13.sp, color = Muted) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { onSetPrice() }),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Cream,
                            unfocusedContainerColor = Cream,
                            focusedBorderColor = Burgundy,
                            unfocusedBorderColor = Line
                        ),
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = onSetPrice,
                        enabled = !state.isSaving,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.heightIn(min = 52.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
                    ) {
                        Text(
                            if (state.isSaving) stringResource(R.string.calendar_saving) else stringResource(R.string.calendar_set_price),
                            fontSize = 14.sp, fontWeight = FontWeight.Bold
                        )
                    }
                }

                guestPreview?.let {
                    Text(stringResource(R.string.calendar_guests_pay, money(it), currency), fontSize = 12.5.sp, color = Muted)
                }

                // Only the actions that would actually change something. Offering "Open" for a
                // selection with nothing blocked in it invites a press that can only be a no-op.
                val showReset = state.selectedCustom > 0
                val showBlock = state.selectedBlocked < total
                val showOpen = state.selectedBlocked > 0
                if (showReset || showBlock || showOpen) {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        if (showReset) SecondaryAction(stringResource(R.string.calendar_reset_price), state.isSaving, onReset)
                        if (showBlock) SecondaryAction(stringResource(R.string.calendar_block), state.isSaving, onBlock)
                        if (showOpen) SecondaryAction(stringResource(R.string.calendar_unblock), state.isSaving, onUnblock)
                    }
                }
            }

            val max = HostCalendarSelection.MAX_DATES_PER_REQUEST
            val message = when {
                localError == "required" -> stringResource(R.string.calendar_error_price_required)
                localError == "invalid" -> stringResource(R.string.calendar_error_price_invalid)
                state.error == "tooLong" -> pluralStringResource(R.plurals.calendar_error_too_long, max, max)
                state.error == "notSignedIn" -> stringResource(R.string.calendar_error_sign_in)
                state.error == "saveFailed" -> stringResource(R.string.calendar_error_save_failed)
                // Anything else is the server's own `{ error }`, already in plain English.
                state.error != null -> state.error
                else -> null
            }
            message?.let {
                Text(it, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, color = Danger)
            }
        }
    }
}

@Composable
private fun SecondaryAction(label: String, disabled: Boolean, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        enabled = !disabled,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, Line),
        modifier = Modifier.heightIn(min = 46.dp),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Ink)
    ) {
        Text(label, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

// ---- Formatting -------------------------------------------------------------------------

/** Grouped whole EGP, in en-US digits so it matches the rest of the pricing UI. */
private fun money(amount: Double): String {
    val f = NumberFormat.getNumberInstance(Locale.US)
    f.maximumFractionDigits = 0
    return f.format(amount)
}

private val UTC: TimeZone = TimeZone.getTimeZone("UTC")

private fun parseDay(date: String): java.util.Date? =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = UTC }.parse(date)

/** A `yyyy-MM-dd` in the device's language with [pattern] — "August 2026", "Aug". */
private fun monthLabel(date: String, pattern: String): String {
    val parsed = parseDay(date) ?: return date
    return SimpleDateFormat(pattern, Locale.getDefault()).apply { timeZone = UTC }.format(parsed)
}

/** "Dec 3" in the device's language. */
private fun dayLabel(date: String): String {
    val parsed = parseDay(date) ?: return date
    return SimpleDateFormat("MMM d", Locale.getDefault()).apply { timeZone = UTC }.format(parsed)
}

/**
 * Sunday-first weekday initials in the device's language. Anchored on 2023-01-01, a Sunday, so the
 * header can't shift with the current date.
 */
@Composable
private fun weekdayInitials(): List<String> = remember(Locale.getDefault()) {
    val out = SimpleDateFormat("EEEEE", Locale.getDefault()).apply { timeZone = UTC }
    val sunday = parseDay("2023-01-01") ?: return@remember List(7) { "" }
    val cal = java.util.Calendar.getInstance(UTC, Locale.US)
    (0 until 7).map { offset ->
        cal.time = sunday
        cal.add(java.util.Calendar.DAY_OF_MONTH, offset)
        out.format(cal.time)
    }
}

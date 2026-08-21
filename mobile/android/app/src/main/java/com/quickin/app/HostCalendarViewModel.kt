package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * State for the host's pricing calendar: what each night of a listing costs, where that price came
 * from, and whether the host may still touch it.
 *
 * [days] is keyed by `yyyy-MM-dd` and is the server's description of each day — never patched
 * locally after a save, because a day whose pinned price was just reset takes its new value from
 * the listing's weekend / month / base ladder, which only the server can evaluate.
 */
data class HostCalendarUiState(
    val listingId: String? = null,
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val days: Map<String, CalendarDay> = emptyMap(),
    /** Days the host has selected, `yyyy-MM-dd`. */
    val selected: Set<String> = emptySet(),
    /** The platform markup in force, for the "guests will see X" hint. */
    val commissionRate: Double = 0.0,
    val currency: String = "EGP",
    val error: String? = null,
    /** Result of the last save, for a one-line confirmation. Null once cleared. */
    val savedUpdated: Int? = null,
    /** How many selected days the last save refused because they are booked. */
    val savedSkipped: Int = 0
) {
    /** Selected days that are currently closed — enables an "Open" action. */
    val selectedBlocked: Int
        get() = selected.count { days[it]?.status == DayStatus.BLOCKED }

    /** Selected days carrying a pinned price — enables a "Reset to default" action. */
    val selectedCustom: Int
        get() = selected.count { days[it]?.source == PriceSource.CUSTOM }
}

/**
 * Owns the host calendar for one listing: month-by-month reads and the per-day price /
 * availability writes.
 *
 * Reads the bearer token straight from SharedPreferences ("qk_auth" / "token"), like the other
 * view-models. The token is not optional here even though the endpoint is public: it is what makes
 * the server return the host's RAW rates instead of the marked-up guest ones, and a host editing
 * the marked-up figure would inflate their own listing on every save.
 */
class HostCalendarViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val _state = MutableStateFlow(HostCalendarUiState())
    val state: StateFlow<HostCalendarUiState> = _state.asStateFlow()

    /** Months already fetched (keyed by their first day) so scrolling doesn't refetch. */
    private val loadedMonths = mutableSetOf<String>()

    private fun token(): String? = prefs.getString("token", null)?.takeIf { it.isNotBlank() }

    /**
     * Point the calendar at a listing. Clears everything when the listing changes, so days from
     * the last listing can never be shown — or worse, saved — against this one.
     */
    fun open(listingId: String) {
        if (_state.value.listingId == listingId) return
        loadedMonths.clear()
        _state.value = HostCalendarUiState(listingId = listingId)
        loadMonth(monthKey(0))
    }

    /**
     * Fetch one month, INCLUSIVE of both ends. Cheap to call repeatedly — a month already loaded
     * is a no-op, and a month that failed is dropped from the set so it can be retried.
     */
    fun loadMonth(firstOfMonth: String) {
        val listingId = _state.value.listingId ?: return
        val token = token() ?: return
        if (!loadedMonths.add(firstOfMonth)) return
        val last = lastDayOfMonth(firstOfMonth) ?: return

        _state.value = _state.value.copy(isLoading = true)
        viewModelScope.launch {
            try {
                val calendar = BookingService.fetchCalendar(token, listingId, firstOfMonth, last)
                _state.value = _state.value.copy(
                    isLoading = false,
                    days = _state.value.days + calendar.days.associateBy { it.date },
                    commissionRate = calendar.commissionRate,
                    currency = calendar.currency
                )
            } catch (e: Exception) {
                loadedMonths.remove(firstOfMonth)
                // A month that fails shows its days unpriced and stays editable; not worth an
                // error banner over the whole screen.
                _state.value = _state.value.copy(isLoading = false)
            }
        }
    }

    /** A day the host may act on: not in the past, not held by a reservation. */
    fun isEditable(date: String): Boolean {
        if (date < today()) return false
        return _state.value.days[date]?.isEditable ?: true
    }

    /** Add or remove one day. */
    fun toggle(date: String) {
        if (!isEditable(date)) return
        val selected = _state.value.selected
        _state.value = _state.value.copy(
            selected = if (date in selected) selected - date else selected + date,
            error = null,
            savedUpdated = null
        )
    }

    /**
     * Apply a swept range. [adding] is fixed when the drag starts, so sweeping back and forth over
     * a day doesn't flip it repeatedly.
     */
    fun sweep(anchor: String, to: String, adding: Boolean) {
        val span = expandRange(anchor, to).filter(::isEditable)
        if (span.isEmpty()) return
        val selected = _state.value.selected
        _state.value = _state.value.copy(
            selected = if (adding) selected + span else selected - span.toSet(),
            error = null,
            savedUpdated = null
        )
    }

    /**
     * Select every selectable day of a month — or clear them, when they are all already selected,
     * so a mis-tap doesn't cost the host a month of manual deselection.
     */
    fun toggleMonth(firstOfMonth: String) {
        val days = daysOfMonth(firstOfMonth).filter(::isEditable)
        if (days.isEmpty()) return
        val selected = _state.value.selected
        _state.value = _state.value.copy(
            selected = if (days.all { it in selected }) selected - days.toSet() else selected + days,
            error = null,
            savedUpdated = null
        )
    }

    fun clearSelection() {
        _state.value = _state.value.copy(selected = emptySet(), error = null, savedUpdated = null)
    }

    fun clearNotice() {
        _state.value = _state.value.copy(savedUpdated = null, savedSkipped = 0, error = null)
    }

    /**
     * Save one edit across the selected days. Days already held by a reservation come back as
     * `skipped` rather than failing the request; the count is surfaced so the host is told, since
     * a day silently left alone is one they believe they priced.
     */
    fun save(price: CalendarPriceChange = CalendarPriceChange.Unchanged, blocked: Boolean? = null) {
        val listingId = _state.value.listingId ?: return
        val dates = _state.value.selected.sorted()
        if (dates.isEmpty()) return
        val token = token()
        if (token == null) {
            _state.value = _state.value.copy(error = "notSignedIn")
            return
        }

        _state.value = _state.value.copy(isSaving = true, error = null, savedUpdated = null)
        viewModelScope.launch {
            try {
                val result = BookingService.updateCalendar(token, listingId, dates, price, blocked)
                _state.value = _state.value.copy(
                    isSaving = false,
                    days = _state.value.days + result.calendar.days.associateBy { it.date },
                    commissionRate = result.calendar.commissionRate,
                    selected = emptySet(),
                    savedUpdated = result.updated,
                    savedSkipped = result.skipped.size
                )
            } catch (e: AuthService.HttpError) {
                _state.value = _state.value.copy(isSaving = false, error = e.message ?: "saveFailed")
            } catch (e: Exception) {
                _state.value = _state.value.copy(isSaving = false, error = "saveFailed")
            }
        }
    }

    /**
     * What a guest would see for a price the host is typing, or null when it isn't a price yet.
     * Mirrors the server's `withCommission`: mark up, settle to piasters, then round UP to the
     * nearest 10 — the float-safe order, so 100 × 1.1 bills 110 rather than 120.
     */
    fun guestPreview(raw: String): Double? {
        val amount = raw.trim().toDoubleOrNull() ?: return null
        val rate = _state.value.commissionRate
        if (amount <= 0 || rate <= 0) return null
        val settled = Math.round(amount * (1 + rate) * 100.0) / 100.0
        return Math.ceil(settled / 10.0) * 10.0
    }

    // ---- Calendar maths --------------------------------------------------------
    //
    // All of it UTC on a Gregorian calendar, deliberately: a night belongs to a calendar day, not
    // an instant, and a device in a half-hour timezone (or on a Hijri calendar) must not shift
    // which day a price lands on. Same rule as `date-pricing-core.ts` on the server.

    companion object {
        /** How many months the grid paints. */
        const val MONTHS_VISIBLE = 12

        private val UTC: TimeZone = TimeZone.getTimeZone("UTC")

        private fun formatter(): SimpleDateFormat =
            SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = UTC }

        private fun utcCalendar(): Calendar = Calendar.getInstance(UTC, Locale.US)

        /**
         * Today in the LISTING's timezone, not the device's. A host abroad must not be told
         * tonight is in the past, and the API answers the same question in Cairo.
         */
        fun today(): String {
            val f = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            f.timeZone = TimeZone.getTimeZone("Africa/Cairo")
            return f.format(java.util.Date())
        }

        /** `yyyy-MM-01` for the month [offset] months after this one. */
        fun monthKey(offset: Int): String {
            val cal = utcCalendar()
            cal.time = formatter().parse(today()) ?: java.util.Date()
            cal.set(Calendar.DAY_OF_MONTH, 1)
            cal.add(Calendar.MONTH, offset)
            return formatter().format(cal.time)
        }

        /** The last day of the month starting at [firstOfMonth], or null if unparseable. */
        fun lastDayOfMonth(firstOfMonth: String): String? {
            val cal = utcCalendar()
            cal.time = formatter().parse(firstOfMonth) ?: return null
            cal.set(Calendar.DAY_OF_MONTH, cal.getActualMaximum(Calendar.DAY_OF_MONTH))
            return formatter().format(cal.time)
        }

        /** Every day of the month starting at [firstOfMonth]. */
        fun daysOfMonth(firstOfMonth: String): List<String> {
            val cal = utcCalendar()
            cal.time = formatter().parse(firstOfMonth) ?: return emptyList()
            val count = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
            val f = formatter()
            return (0 until count).map {
                val c = utcCalendar()
                c.time = cal.time
                c.add(Calendar.DAY_OF_MONTH, it)
                f.format(c.time)
            }
        }

        /**
         * How many blank cells precede the 1st in a Sunday-first grid. `DAY_OF_WEEK` is 1-based
         * with Sunday = 1, so subtracting 1 gives the count directly.
         */
        fun leadingBlanks(firstOfMonth: String): Int {
            val cal = utcCalendar()
            cal.time = formatter().parse(firstOfMonth) ?: return 0
            return cal.get(Calendar.DAY_OF_WEEK) - 1
        }

        /** Every day from [from] to [to], inclusive, in either order. */
        fun expandRange(from: String, to: String): List<String> {
            val f = formatter()
            val a = f.parse(from) ?: return emptyList()
            val b = f.parse(to) ?: return emptyList()
            val (lo, hi) = if (a <= b) a to b else b to a
            val out = ArrayList<String>()
            val cal = utcCalendar()
            cal.time = lo
            // Bounded by the visible year; the cap stops a corrupt pair spinning.
            while (!cal.time.after(hi) && out.size < 800) {
                out += f.format(cal.time)
                cal.add(Calendar.DAY_OF_MONTH, 1)
            }
            return out
        }
    }

    private fun today(): String = Companion.today()
    private fun daysOfMonth(first: String): List<String> = Companion.daysOfMonth(first)
    private fun expandRange(from: String, to: String): List<String> = Companion.expandRange(from, to)
    private fun monthKey(offset: Int): String = Companion.monthKey(offset)
    private fun lastDayOfMonth(first: String): String? = Companion.lastDayOfMonth(first)
}

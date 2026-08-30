package com.quickin.app.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.BookingStatus
import com.quickin.app.HostBookingFilterRules
import com.quickin.app.R

/**
 * Color-coded reservation status badge, shared by the My Reservations list, the
 * reservation detail card, and the host requests list. Maps each [BookingStatus]
 * to a tinted capsule (amber = pending, green = confirmed, red = rejected, etc.).
 *
 * Pass [guestView] = true on the GUEST reservation views (My Reservations list +
 * reservation detail card) to make the badge speak the guest's three reservation
 * states instead of the raw booking status:
 *   • pending                  → "Waiting for approval"
 *   • confirmed && ![isPaid]    → "Approved"   (host has approved; payment due)
 *   • confirmed && [isPaid]     → "Paid"
 * The HOST requests list leaves [guestView] at its default (false) and passes
 * [hostBucket] instead — there "Pending"/"Confirmed" describe the host's own
 * approve/decline action, not the guest's payment state, but an accepted stay
 * still has to say whether the money has arrived. See [hostBucket].
 */
@Composable
fun StatusBadge(
    status: String,
    modifier: Modifier = Modifier,
    guestView: Boolean = false,
    isPaid: Boolean = false,
    hostBucket: HostBookingFilterRules.Bucket? = null
) {
    val s = BookingStatus.from(status)
    // Aligned to the redesign palette: gold for pending, deep boutique green for confirmed.
    val (bg, fg, label) = when {
        // A stay the host has accepted but nobody has paid for is NOT "Confirmed".
        // `bookings.status` flips to confirmed the moment the host taps Accept, so
        // the raw column cannot tell an accepted-and-paid stay from one still owed
        // money — the host read both as green "Confirmed" and had no way to see the
        // difference. The answer comes from [HostBookingFilterRules], the same fold
        // the chip row above the list already runs, so the badge and the chip can
        // never contradict each other. Never re-derive it from the payment columns
        // here.
        //
        // Only this one bucket overrides, deliberately. The rest of the buckets say
        // what the status mapping below already says, except Refunded /
        // Partially refunded, which stay "Cancelled" on the badge — they ARE
        // cancellations, and splitting them here was not what was asked for.
        //
        // Gold, not green: gold is the app's "nothing has landed yet" colour, and it
        // is what iOS and the pending badge already use. Green beside the paid stays
        // would say the money has cleared.
        hostBucket == HostBookingFilterRules.Bucket.AwaitingPayment -> Triple(
            Color(0xFFFBEFD6), Color(0xFF8A5A00),
            stringResource(R.string.host_booking_filter_awaiting_payment)
        )
        else -> when (s) {
            BookingStatus.Pending -> Triple(
                Color(0xFFFBEFD6), Color(0xFF8A5A00),
                if (guestView) stringResource(R.string.reservation_state_waiting) else "Pending"
            )
            BookingStatus.Confirmed -> Triple(
                Color(0xFFD9EBE0), Color(0xFF0F5132),
                when {
                    !guestView -> "Confirmed"
                    isPaid -> stringResource(R.string.reservation_state_paid)
                    else -> stringResource(R.string.reservation_state_approved)
                }
            )
            BookingStatus.Rejected -> Triple(Color(0xFFF7E0DD), Color(0xFFB3261E), "Rejected")
            BookingStatus.Cancelled -> Triple(Color(0xFFEAE6DD), Color(0xFF6B6055), "Cancelled")
            BookingStatus.Completed -> Triple(Color(0xFFE5DFF0), Color(0xFF3A45A8), "Completed")
            BookingStatus.Other -> Triple(
                Color(0xFFEFE6D8), Color(0xFF5B0F16),
                status.replaceFirstChar { it.uppercase() }.ifBlank { "—" }
            )
        }
    }
    Surface(shape = RoundedCornerShape(50), color = bg, modifier = modifier) {
        Text(
            label,
            color = fg,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

package com.quickin.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.AddHome
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.NewReleases
import androidx.compose.material.icons.filled.PrivacyTip
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Sailing
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AuthUiState
import com.quickin.app.CurrencyManager
import com.quickin.app.HOST_STATUS_APPROVED
import com.quickin.app.HOST_STATUS_PENDING
import com.quickin.app.HOST_STATUS_REJECTED
import com.quickin.app.LocaleManager
import com.quickin.app.Profile
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.SuccessGreen
import com.quickin.app.ui.theme.Tan
import java.util.Locale

/** Muted red used for the "not approved" host-application pill (matches the Trust & Safety red). */
private val HostRejectedRed = Color(0xFFB3261E)

/**
 * Profile tab: shows the signed-in user's avatar (photo or initials), name, email, an optional
 * bio, a role/provider pill, and a logout button. Styled to match AuthScreen. [profile] carries
 * the editable profile (bio + avatar) loaded from `/api/local/profile`; it's empty until loaded.
 */
@Composable
fun ProfileScreen(
    state: AuthUiState,
    onLogout: () -> Unit,
    profile: Profile = Profile(),
    receivedReviews: com.quickin.app.ReceivedReviewsUiState = com.quickin.app.ReceivedReviewsUiState(),
    /** Identity-verification state for the "Verify your identity" card. */
    verificationState: com.quickin.app.VerificationUiState = com.quickin.app.VerificationUiState(),
    /** Submits the picked FRONT + BACK ID photos + SELFIE (and an optional id number). */
    onSubmitVerification: (front: android.net.Uri, back: android.net.Uri, selfie: android.net.Uri, idNumber: String?) -> Unit = { _, _, _, _ -> },
    /** Payout-method state for the host's "Payment information" card. */
    payoutState: com.quickin.app.PayoutUiState = com.quickin.app.PayoutUiState(),
    /** Saves (or replaces) where QuickIn sends this host's earnings. */
    onSavePayout: (com.quickin.app.PayoutDraft) -> Unit = {},
    /** Removes the host's payout method. */
    onRemovePayout: () -> Unit = {},
    /** Opens the "Apply to host" form (a first application, or a re-application after a rejection). */
    onOpenHostApplication: () -> Unit = {},
    onOpenHost: () -> Unit = {},
    onOpenMySubscriptions: () -> Unit = {},
    onOpenHostServices: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    /** Opens the Messages inbox (guest ↔ host conversations; web /messages parity). */
    onOpenMessages: () -> Unit = {},
    /** Opens the guest's itemized receipts list (Section 9 — money views). */
    onOpenReceipts: () -> Unit = {},
    /** Opens the host's earnings & payouts screen (Section 9 — money views, host only). */
    onOpenEarnings: () -> Unit = {},
    /** Opens the host's analytics dashboard (Section 10, host only). */
    onOpenAnalytics: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val name = state.userName?.takeUnless { it.isBlank() } ?: stringResource(R.string.profile_guest)
    val email = state.email?.takeUnless { it.isBlank() }
    val provider = state.provider?.takeUnless { it.isBlank() } ?: "email"
    // Unified account: is_host is the single source of truth for host abilities (a host keeps
    // every guest ability too). Drives both the role pill and the hosting section below.
    val isHost = state.isHost
    // Host -> "Host", otherwise "Guest".
    val roleLabel = stringResource(if (isHost) R.string.profile_host else R.string.profile_guest)

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(CreamPage)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .padding(top = 32.dp, bottom = 32.dp)
    ) {
        // Header card: avatar + name + email + role/provider pills, on a white boutique card.
        BoutiqueCard(modifier = Modifier.fillMaxWidth(), shadow = 6.dp) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Avatar — the user's photo (from avatar_url) clipped to a circle, or a
                // gold-gradient circle with white initials as a fallback, set inside a soft gold ring.
                Box(
                    modifier = Modifier
                        .size(108.dp)
                        .border(2.dp, Gold.copy(alpha = 0.45f), CircleShape)
                        .padding(6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    ProfileAvatar(
                        avatarUrl = profile.avatarUrl,
                        initials = initialsOf(name),
                        size = 96.dp,
                        contentDescription = stringResource(R.string.account_photo_desc)
                    )
                }

                Text(
                    name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp,
                    color = Ink,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp)
                )

                if (email != null) {
                    Text(
                        email,
                        color = Muted,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp)
                    )
                }

                // Bio — the user's "about me" blurb, shown only when set.
                val bio = profile.bio.takeUnless { it.isBlank() }
                if (bio != null) {
                    Text(
                        bio,
                        color = Ink,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp)
                    )
                }

                // Role + provider pills (e.g. "Host" • "Google").
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(top = 16.dp)
                ) {
                    InfoPill(roleLabel)
                    InfoPill(provider.replaceFirstChar {
                        if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString()
                    })
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Become a host — surfaced at the very top so it's the first thing a guest sees instead of
        // being buried below the settings sections. The card renders whichever of the four
        // application states the SERVER reports (none / pending / rejected / approved).
        HostApplicationCard(
            status = state.hostStatus,
            reviewNote = state.hostReviewNote,
            onApply = onOpenHostApplication
        )

        Spacer(modifier = Modifier.height(24.dp))

        // "Reviews about you" — the reviews this user has received from hosts (two-way reviews).
        ReviewsAboutYouSection(receivedReviews)

        Spacer(modifier = Modifier.height(24.dp))

        // Account section — settings rows available to everyone.
        SectionHeader(stringResource(R.string.profile_account), modifier = Modifier.padding(start = 4.dp, bottom = 12.dp))

        // "Verify your identity" — status pill + FRONT/BACK ID photo upload (Trust & Safety).
        VerificationCard(
            state = verificationState,
            onSubmit = onSubmitVerification,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(12.dp))

        // "Payment information" — where QuickIn sends this host's earnings. Hosts
        // only; a guest has none, and the card hides itself if the server says so.
        if (isHost) {
            PayoutMethodCard(
                state = payoutState,
                onSave = onSavePayout,
                onRemove = onRemovePayout,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))
        }

        SettingsRow(
            icon = Icons.Filled.Settings,
            title = stringResource(R.string.profile_edit_profile),
            subtitle = stringResource(R.string.profile_edit_profile_sub),
            onClick = onOpenSettings
        )
        Spacer(modifier = Modifier.height(12.dp))
        // Saved / wishlist is now a top-level bottom-bar tab, so it's intentionally not
        // duplicated here as a Profile row.
        SettingsRow(
            icon = Icons.Filled.Sailing,
            title = stringResource(R.string.profile_my_subscriptions),
            subtitle = stringResource(R.string.profile_my_subscriptions_sub),
            onClick = onOpenMySubscriptions
        )
        Spacer(modifier = Modifier.height(12.dp))
        // "Receipts" — the guest's itemized paid receipts (Section 9 — money views).
        SettingsRow(
            icon = Icons.AutoMirrored.Filled.ReceiptLong,
            title = stringResource(R.string.money_receipts),
            subtitle = stringResource(R.string.money_receipts_sub),
            onClick = onOpenReceipts
        )
        Spacer(modifier = Modifier.height(12.dp))
        // "Messages" — the guest ↔ host conversation inbox (web /messages parity).
        SettingsRow(
            icon = Icons.Filled.ChatBubbleOutline,
            title = stringResource(R.string.profile_messages),
            subtitle = stringResource(R.string.profile_messages_sub),
            onClick = onOpenMessages
        )

        // Currency section — multi-currency display switcher (Section 9 — money views).
        Spacer(modifier = Modifier.height(24.dp))
        SectionHeader(stringResource(R.string.money_currency), modifier = Modifier.padding(start = 4.dp, bottom = 12.dp))
        CurrencyPicker()

        // Hosting section — host management entries. The non-host "Become a host" card now lives at
        // the top of the profile (above), so this whole section only renders for a host.
        if (isHost) {
            Spacer(modifier = Modifier.height(24.dp))
            SectionHeader(stringResource(R.string.profile_hosting), modifier = Modifier.padding(start = 4.dp, bottom = 12.dp))
            SettingsRow(
                icon = Icons.Filled.AddHome,
                title = stringResource(R.string.profile_host_dashboard),
                subtitle = stringResource(R.string.profile_host_dashboard_sub),
                onClick = onOpenHost
            )
            Spacer(modifier = Modifier.height(12.dp))
            // "Earnings & payouts" — host money view (Section 9).
            SettingsRow(
                icon = Icons.Filled.Payments,
                title = stringResource(R.string.money_earnings),
                subtitle = stringResource(R.string.money_earnings_sub),
                onClick = onOpenEarnings,
                accent = Gold
            )
            Spacer(modifier = Modifier.height(12.dp))
            // "Analytics" — host performance dashboard (Section 10).
            SettingsRow(
                icon = Icons.Filled.Insights,
                title = stringResource(R.string.analytics_title),
                subtitle = stringResource(R.string.analytics_sub),
                onClick = onOpenAnalytics,
                accent = Burgundy
            )
            Spacer(modifier = Modifier.height(12.dp))
            SettingsRow(
                icon = Icons.Filled.Sailing,
                title = stringResource(R.string.profile_host_services),
                subtitle = stringResource(R.string.profile_host_services_sub),
                onClick = onOpenHostServices
            )
        }

        // Language section — in-app English / العربية switch (live RTL).
        Spacer(modifier = Modifier.height(24.dp))
        SectionHeader(stringResource(R.string.profile_language), modifier = Modifier.padding(start = 4.dp, bottom = 12.dp))
        LanguagePicker()

        // Support & legal — the public web pages, same links as the site footer.
        Spacer(modifier = Modifier.height(24.dp))
        SectionHeader(stringResource(R.string.profile_support_legal), modifier = Modifier.padding(start = 4.dp, bottom = 12.dp))
        LegalLinks()

        Spacer(modifier = Modifier.height(28.dp))

        // Log out
        OutlinedButton(
            onClick = onLogout,
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, Tan),
            colors = ButtonDefaults.outlinedButtonColors(
                containerColor = Color.White,
                contentColor = Burgundy
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            Icon(
                Icons.AutoMirrored.Filled.Logout,
                contentDescription = null,
                tint = Burgundy,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.profile_log_out), fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        }
    }
}

/**
 * Profile tab shown when the user is NOT signed in: the brand logo, a prompt,
 * and a Burgundy CTA that opens the auth screen. Browsing stays fully usable
 * without an account; signing in is only needed to manage trips.
 */
@Composable
fun ProfileSignInCta(
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(CreamPage)
            .padding(horizontal = 28.dp, vertical = 40.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Image(
                painter = painterResource(R.drawable.logo),
                contentDescription = "QuickIn",
                contentScale = ContentScale.Fit,
                modifier = Modifier.height(52.dp)
            )

            Text(
                stringResource(R.string.profile_cta_title),
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                color = Ink,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 28.dp)
            )

            Text(
                stringResource(R.string.profile_cta_subtitle),
                color = Muted,
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp, bottom = 28.dp)
            )

            GradientButton(
                onClick = onSignIn,
                pulse = true,
                radius = 18.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    stringResource(R.string.profile_cta_button),
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp
                )
            }
        }
    }
}

/**
 * The host-application card on the Profile tab (unified account — one account per person, no
 * separate host login). It renders whichever of the four server-derived [status] values applies:
 *
 *  • "none"     — the "Become a host" pitch + a CTA that opens the application form.
 *  • "pending"  — read-only "under review"; there is nothing to do but wait for an admin.
 *  • "rejected" — the decision, the admin's [reviewNote] reason, and an "Apply again" CTA that
 *                 re-opens the form (a re-submission moves the application back to pending).
 *  • "approved" — a quiet confirmation; the real host surfaces are the Hosting section below,
 *                 which gates on `is_host` alone.
 *
 * Applying never grants hosting by itself — only an admin approval flips `is_host`.
 */
@Composable
private fun HostApplicationCard(status: String, reviewNote: String?, onApply: () -> Unit) {
    BoutiqueCard(modifier = Modifier.fillMaxWidth(), shadow = 6.dp) {
        Column(modifier = Modifier.fillMaxWidth().padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(Burgundy.copy(alpha = 0.12f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.AddHome, contentDescription = null, tint = Burgundy, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(14.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        stringResource(
                            when (status) {
                                HOST_STATUS_PENDING -> R.string.host_pending_title
                                HOST_STATUS_REJECTED -> R.string.host_rejected_title
                                HOST_STATUS_APPROVED -> R.string.host_approved_title
                                else -> R.string.become_host
                            }
                        ),
                        color = Ink,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                    Text(
                        stringResource(
                            when (status) {
                                HOST_STATUS_PENDING -> R.string.host_pending_note
                                HOST_STATUS_REJECTED -> R.string.host_rejected_note
                                HOST_STATUS_APPROVED -> R.string.host_approved_note
                                else -> R.string.become_host_sub
                            }
                        ),
                        color = Muted,
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }

            // A colored status pill for every state that has one ("none" is just the pitch above).
            HostStatusPill(status)

            // The admin's reason, shown only on a rejection (and only when they left one).
            if (status == HOST_STATUS_REJECTED && !reviewNote.isNullOrBlank()) {
                Surface(color = Cream, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(
                        stringResource(R.string.host_rejected_reason, reviewNote),
                        color = Ink,
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                    )
                }
            }

            // Only "none" and "rejected" can act — a pending application is read-only, and an
            // approved account uses the Hosting section below.
            if (status != HOST_STATUS_PENDING && status != HOST_STATUS_APPROVED) {
                Spacer(Modifier.height(14.dp))
                GradientButton(
                    onClick = onApply,
                    radius = 16.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        stringResource(
                            if (status == HOST_STATUS_REJECTED) R.string.host_reapply
                            else R.string.become_host
                        ),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                }
            }
        }
    }
}

/** A colored pill for the host-application state (gold pending / red rejected / green approved). */
@Composable
private fun HostStatusPill(status: String) {
    val (labelRes, tint, icon) = when (status) {
        HOST_STATUS_PENDING -> Triple(R.string.host_status_pending, Gold, Icons.Filled.HourglassTop)
        HOST_STATUS_REJECTED -> Triple(R.string.host_status_rejected, HostRejectedRed, Icons.Filled.NewReleases)
        HOST_STATUS_APPROVED -> Triple(R.string.host_status_approved, SuccessGreen, Icons.Filled.Verified)
        // "none" — no application on file yet, so there's no state to badge.
        else -> return
    }
    Surface(
        shape = RoundedCornerShape(50),
        color = tint.copy(alpha = 0.12f),
        modifier = Modifier.padding(top = 12.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                stringResource(labelRes),
                color = tint,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

/**
 * In-app language switch: a dropdown of all languages on a white boutique card. Picking one
 * applies the locale app-wide via [LocaleManager] (AndroidX per-app locales), which persists the
 * choice and re-composes the whole UI translated — Arabic also flips the layout to RTL. Option
 * labels stay in their own language (English / العربية / Français / Español) so each is
 * recognizable regardless of the active locale.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LanguagePicker(modifier: Modifier = Modifier) {
    val current = LocaleManager.currentLanguage()
    var expanded by remember { mutableStateOf(false) }
    val options = listOf(
        LocaleManager.Language.ENGLISH to "English",
        LocaleManager.Language.ARABIC to "العربية",
        LocaleManager.Language.FRENCH to "Français",
        LocaleManager.Language.SPANISH to "Español",
    )
    val currentLabel = options.firstOrNull { it.first == current }?.second ?: "English"

    Surface(
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        shadowElevation = 4.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = it },
            modifier = Modifier.padding(6.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                    .padding(horizontal = 12.dp, vertical = 14.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(Burgundy.copy(alpha = 0.12f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.Language, contentDescription = null, tint = Burgundy, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(14.dp))
                Text(
                    currentLabel,
                    color = Ink,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    modifier = Modifier.weight(1f)
                )
                Icon(Icons.Filled.ArrowDropDown, contentDescription = null, tint = Muted, modifier = Modifier.size(24.dp))
            }
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                options.forEach { (lang, label) ->
                    DropdownMenuItem(
                        text = {
                            Text(
                                label,
                                color = if (lang == current) Burgundy else Ink,
                                fontWeight = if (lang == current) FontWeight.SemiBold else FontWeight.Normal
                            )
                        },
                        onClick = {
                            LocaleManager.setLanguage(lang)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

/**
 * Multi-currency DISPLAY switcher (Section 9 — money views). A dropdown of the supported currencies
 * (EGP base + USD/EUR/GBP/SAR/AED) on a white boutique card. Picking one persists the choice via
 * [CurrencyManager] and updates the shared Compose state, so every price across the app (listing
 * cards, listing detail, reserve/receipt totals) reconverts and recomposes instantly. Conversion is
 * display-only — bookings and payments stay in EGP. RTL-safe (the row follows the layout direction).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CurrencyPicker(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val selected = CurrencyManager.currency
    var expanded by remember { mutableStateOf(false) }

    Surface(
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        shadowElevation = 4.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = it },
            modifier = Modifier.padding(6.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                    .padding(horizontal = 12.dp, vertical = 14.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(Burgundy.copy(alpha = 0.12f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.Payments, contentDescription = null, tint = Burgundy, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(14.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        stringResource(R.string.money_display_currency),
                        color = Ink,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                    Text(currencyLabel(selected), color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 1.dp))
                }
                Icon(Icons.Filled.ArrowDropDown, contentDescription = null, tint = Muted, modifier = Modifier.size(24.dp))
            }
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                CurrencyManager.SUPPORTED.forEach { code ->
                    DropdownMenuItem(
                        text = {
                            Text(
                                currencyLabel(code),
                                color = if (code == selected) Burgundy else Ink,
                                fontWeight = if (code == selected) FontWeight.SemiBold else FontWeight.Normal
                            )
                        },
                        onClick = {
                            CurrencyManager.setCurrency(context, code)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

/** A currency option's label, e.g. "USD ($)" or "EGP". */
private fun currencyLabel(code: String): String {
    val symbol = CurrencyManager.symbolFor(code).trim()
    return if (symbol.isBlank() || symbol == code) code else "$code ($symbol)"
}

/** A small tan capsule with a burgundy dot and a label (role / provider). */
@Composable
private fun InfoPill(label: String, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(50),
        color = Tan,
        modifier = modifier
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(Burgundy, CircleShape)
            )
            Text(
                label,
                color = Ink,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 8.dp)
            )
        }
    }
}

/**
 * "Reviews about you" block on the Profile tab: the reviews the signed-in user has *received*
 * from hosts (two-way reviews, `GET /api/local/guest-reviews?guest_id=`). Shows an average-rating
 * summary header, then one card per review (host name, stars, comment). Renders a quiet empty line
 * when none, and a small spinner while loading.
 */
@Composable
private fun ReviewsAboutYouSection(state: com.quickin.app.ReceivedReviewsUiState) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().padding(start = 4.dp, bottom = 12.dp)
        ) {
            SectionHeader(stringResource(R.string.reviews_about_you), modifier = Modifier.weight(1f))
            if (state.count > 0) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.Star,
                        contentDescription = null,
                        tint = Gold,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        stringResource(
                            R.string.reviews_guest_rating,
                            String.format(Locale.US, "%.1f", state.averageRating),
                            state.count
                        ),
                        color = Ink,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        when {
            state.isLoading && state.reviews.isEmpty() -> Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(start = 4.dp)
            ) {
                androidx.compose.material3.CircularProgressIndicator(
                    color = Burgundy,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(Modifier.width(10.dp))
                Text(stringResource(R.string.reviews_loading), color = Muted, fontSize = 14.sp)
            }
            state.reviews.isEmpty() -> Text(
                stringResource(R.string.reviews_no_guest_reviews),
                color = Muted,
                fontSize = 14.sp,
                modifier = Modifier.padding(start = 4.dp)
            )
            else -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                state.reviews.forEach { review -> GuestReviewCard(review) }
            }
        }
    }
}

/** One review received about the user: the reviewing host's name, a gold star row, and a comment. */
@Composable
private fun GuestReviewCard(review: com.quickin.app.GuestReview) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(18.dp),
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                StarRatingRow(rating = review.rating, starSize = 14.dp)
                Spacer(Modifier.width(10.dp))
                Text(
                    review.hostName?.takeUnless { it.isBlank() } ?: stringResource(R.string.profile_host),
                    fontWeight = FontWeight.SemiBold,
                    color = Ink,
                    fontSize = 14.sp,
                    maxLines = 1
                )
            }
            if (!review.comment.isNullOrBlank()) {
                Text(review.comment, color = Muted, fontSize = 14.sp, lineHeight = 20.sp)
            }
        }
    }
}

/** First letters of up to two name parts, e.g. "Layla Hassan" -> "LH". */
private fun initialsOf(name: String): String {
    val parts = name.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    return when {
        parts.isEmpty() -> "?"
        parts.size == 1 -> parts[0].take(1).uppercase(Locale.getDefault())
        else -> (parts[0].take(1) + parts.last().take(1)).uppercase(Locale.getDefault())
    }
}

/**
 * The "Support & legal" rows — Terms / Privacy / About / Contact, opened in the browser from the
 * public website (same pages the site footer links to). Web parity for the app's Profile tab.
 */
@Composable
private fun LegalLinks() {
    val context = LocalContext.current
    val open: (String) -> Unit = { path ->
        runCatching {
            context.startActivity(
                android.content.Intent(
                    android.content.Intent.ACTION_VIEW,
                    android.net.Uri.parse(com.quickin.app.Config.SHARE_WEB_BASE_URL + path)
                )
            )
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SettingsRow(
            icon = Icons.Filled.Description,
            title = stringResource(R.string.legal_terms),
            onClick = { open("/terms") }
        )
        SettingsRow(
            icon = Icons.Filled.PrivacyTip,
            title = stringResource(R.string.legal_privacy),
            onClick = { open("/privacy") }
        )
        SettingsRow(
            icon = Icons.Filled.Info,
            title = stringResource(R.string.legal_about),
            onClick = { open("/about") }
        )
        SettingsRow(
            icon = Icons.Filled.MailOutline,
            title = stringResource(R.string.legal_contact),
            onClick = { open("/contact") }
        )
    }
}

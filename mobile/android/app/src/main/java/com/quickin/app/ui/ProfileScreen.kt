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
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.PrivacyTip
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Sailing
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AuthUiState
import com.quickin.app.CurrencyManager
import com.quickin.app.LocaleManager
import com.quickin.app.Profile
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import java.util.Locale

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
    /** True while a "Become a host" promotion is in flight (drives the button spinner). */
    becomingHost: Boolean = false,
    /** Promotes this account to a host in-app (POST /api/local/host/become). */
    onBecomeHost: () -> Unit = {},
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
    /** Referral summary for the "Refer friends" section (code + stats). */
    referralState: com.quickin.app.ReferralUiState = com.quickin.app.ReferralUiState(),
    /** Loads the user's referral summary (`GET /api/local/referrals`) when the section appears. */
    onLoadReferrals: () -> Unit = {},
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

        // "Reviews about you" — the reviews this user has received from hosts (two-way reviews).
        ReviewsAboutYouSection(receivedReviews)

        Spacer(modifier = Modifier.height(24.dp))

        // "Refer friends" — the user's shareable referral code + stats (Growth).
        ReferFriendsSection(state = referralState, onLoad = onLoadReferrals)

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

        // Hosting section. Unified account: a non-host sees a "Become a host" card that flips the
        // account to a host in-app (no separate login); a host sees the management entries.
        Spacer(modifier = Modifier.height(24.dp))
        SectionHeader(stringResource(R.string.profile_hosting), modifier = Modifier.padding(start = 4.dp, bottom = 12.dp))
        if (!isHost) {
            BecomeHostCard(loading = becomingHost, onBecomeHost = onBecomeHost)
        }
        if (isHost) {
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
 * "Become a host" card on the Profile tab (unified account). Shown only to accounts that aren't
 * hosts yet: one button that promotes the SAME account to a host in-app (POST
 * /api/local/host/become) — no separate login or account. On success the caller flips
 * [AuthUiState.isHost] and the host-management entries replace this card without a re-login.
 * Shows a spinner while [loading].
 */
@Composable
private fun BecomeHostCard(loading: Boolean, onBecomeHost: () -> Unit) {
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
                        stringResource(R.string.become_host),
                        color = Ink,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                    Text(
                        stringResource(R.string.become_host_sub),
                        color = Muted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 1.dp)
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
            GradientButton(
                onClick = onBecomeHost,
                enabled = !loading,
                radius = 16.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (loading) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                } else {
                    Text(
                        stringResource(R.string.become_host),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                }
            }
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

/**
 * "Refer friends" block on the Profile tab (Growth). Loads the user's referral summary
 * (`GET /api/local/referrals`) on first appearance and renders their shareable code (with a
 * copy-to-clipboard + share button), the friends-referred count, total rewards, and the list of
 * referred friends. RTL-safe — rows follow the layout direction and use localized copy.
 */
@Composable
private fun ReferFriendsSection(
    state: com.quickin.app.ReferralUiState,
    onLoad: () -> Unit
) {
    LaunchedEffect(Unit) { onLoad() }

    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }
    val summary = state.summary

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().padding(start = 4.dp, bottom = 12.dp)
        ) {
            Icon(Icons.Filled.CardGiftcard, contentDescription = null, tint = Burgundy, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            SectionHeader(stringResource(R.string.referral_title), modifier = Modifier.weight(1f))
        }

        BoutiqueCard(modifier = Modifier.fillMaxWidth(), shadow = 6.dp) {
            Column(modifier = Modifier.fillMaxWidth().padding(18.dp)) {
                when {
                    state.isLoading && summary == null -> Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(stringResource(R.string.referral_loading), color = Muted, fontSize = 14.sp)
                    }
                    summary == null -> Text(
                        state.error ?: stringResource(R.string.referral_error),
                        color = Muted,
                        fontSize = 14.sp
                    )
                    else -> {
                        Text(stringResource(R.string.referral_intro), color = Muted, fontSize = 14.sp, lineHeight = 20.sp)

                        Spacer(Modifier.height(14.dp))
                        Text(stringResource(R.string.referral_your_code), color = Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(6.dp))
                        // The code in a tan tile with copy + share actions.
                        Surface(color = Tan, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    summary.code.ifBlank { "—" },
                                    color = Burgundy,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp,
                                    letterSpacing = 2.sp,
                                    modifier = Modifier.weight(1f)
                                )
                                if (summary.code.isNotBlank()) {
                                    IconButton(onClick = {
                                        clipboard.setText(AnnotatedString(summary.code))
                                        copied = true
                                    }) {
                                        Icon(Icons.Filled.ContentCopy, contentDescription = stringResource(R.string.referral_copy), tint = Burgundy, modifier = Modifier.size(20.dp))
                                    }
                                    IconButton(onClick = {
                                        com.quickin.app.shareText(
                                            context = context,
                                            text = context.getString(R.string.referral_share_message, summary.code),
                                            chooserTitle = context.getString(R.string.referral_share)
                                        )
                                    }) {
                                        Icon(Icons.Filled.Share, contentDescription = stringResource(R.string.referral_share), tint = Burgundy, modifier = Modifier.size(20.dp))
                                    }
                                }
                            }
                        }
                        if (copied) {
                            Text(stringResource(R.string.referral_copied), color = Gold, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 6.dp))
                        }

                        Spacer(Modifier.height(14.dp))
                        // Two stat tiles: friends referred + rewards earned.
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                            ReferralStat(
                                icon = Icons.Filled.Group,
                                value = summary.count.toString(),
                                label = stringResource(R.string.referral_invited),
                                modifier = Modifier.weight(1f)
                            )
                            ReferralStat(
                                icon = Icons.Filled.CardGiftcard,
                                value = summary.rewardTotalText,
                                label = stringResource(R.string.referral_reward),
                                modifier = Modifier.weight(1f)
                            )
                        }

                        // The referred-friends list, or a quiet empty line.
                        Spacer(Modifier.height(16.dp))
                        if (summary.referred.isEmpty()) {
                            Text(stringResource(R.string.referral_none), color = Muted, fontSize = 13.sp)
                        } else {
                            Text(stringResource(R.string.referral_invited_list), color = Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(8.dp))
                            summary.referred.forEachIndexed { index, friend ->
                                if (index > 0) HorizontalDivider(color = Tan, modifier = Modifier.padding(vertical = 8.dp))
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                                    Text(friend.name, color = Ink, fontSize = 14.sp, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    friend.rewardText?.let {
                                        Text(it, color = Gold, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** A small stat tile (icon + value + label) used in the referral summary. */
@Composable
private fun ReferralStat(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    label: String,
    modifier: Modifier = Modifier
) {
    Surface(color = Cream, shape = RoundedCornerShape(14.dp), modifier = modifier) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, contentDescription = null, tint = Burgundy, modifier = Modifier.size(20.dp))
            Spacer(Modifier.height(6.dp))
            Text(value, color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text(label, color = Muted, fontSize = 12.sp, textAlign = TextAlign.Center)
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

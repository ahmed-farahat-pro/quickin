package com.quickin.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AuthUiState
import com.quickin.app.GoogleSignIn
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val ErrorRed = Color(0xFFB3261E)

// Roles sent to /api/auth/signup and /api/auth/login: "user" = Guest, "host" = Host.
private const val ROLE_GUEST = "user"
private const val ROLE_HOST = "host"

/**
 * Authentication screen: email sign-in / sign-up plus a real, config-gated
 * "Continue with Google" flow. Reachable from the Profile tab's sign-in CTA;
 * [onBack] (when provided) shows a back arrow to return to browsing.
 *
 * @param onGoogleLaunch invoked with (nonce, state) to start the Google OAuth
 *        Custom Tab. Only called when [GoogleSignIn.isConfigured] is true.
 * @param onGoogleNotConfigured invoked when the user taps Google but no client id
 *        is set, so the caller can surface an inline note (no fake success).
 */
@Composable
fun AuthScreen(
    state: AuthUiState,
    onLogin: (email: String, password: String, role: String) -> Unit,
    onSignup: (name: String, email: String, password: String, role: String, referralCode: String?) -> Unit,
    onGoogleLaunch: (nonce: String, state: String) -> Unit,
    onGoogleNotConfigured: () -> Unit,
    onForgotPassword: () -> Unit,
    /**
     * True when the device has an enrolled biometric AND a previously-stored biometric session
     * exists, so the "Sign in with fingerprint/face" button should be shown. [onBiometricLogin]
     * launches the system prompt (handled by the caller, which owns the FragmentActivity host).
     */
    canBiometricLogin: Boolean = false,
    onBiometricLogin: () -> Unit = {},
    onBack: (() -> Unit)? = null
) {
    var isSignUp by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    // Optional referral code (sign-up only); forwarded to verify-otp to credit the referrer.
    var referralCode by remember { mutableStateOf("") }
    // Selected role: "user" (Guest) or "host". Used in BOTH modes — on sign-up it registers
    // the account with that role; on sign-in, picking Host grants the host role server-side.
    var role by remember { mutableStateOf(ROLE_GUEST) }

    val loading = state.isLoading

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CreamPage)
    ) {
        if (onBack != null) {
            IconButton(
                onClick = onBack,
                enabled = !loading,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .statusBarsPadding()  // sit BELOW the status bar so the arrow is reliably tappable
                    .padding(8.dp)
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.cd_back_to_browsing),
                    tint = Ink
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 28.dp, vertical = 48.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Brand logo (replaces the old "QuickIn" text wordmark).
            Image(
                painter = painterResource(R.drawable.logo),
                contentDescription = "QuickIn",
                contentScale = ContentScale.Fit,
                modifier = Modifier.height(56.dp)
            )
            Text(
                stringResource(R.string.brand_tagline),
                color = Muted,
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 14.dp, bottom = 32.dp)
            )

            // Sign In / Sign Up toggle
            ModeToggle(
                isSignUp = isSignUp,
                enabled = !loading,
                onSelect = { isSignUp = it }
            )

            Spacer(Modifier.height(24.dp))

            // Guest/Host role chooser — shown in both sign-up and sign-in modes. In sign-in,
            // picking Host upgrades the account to a host and signs in as host.
            RoleSelector(
                role = role,
                enabled = !loading,
                isSignUp = isSignUp,
                onSelect = { role = it }
            )
            Spacer(Modifier.height(14.dp))

            if (isSignUp) {
                AuthField(
                    value = name,
                    onValueChange = { name = it },
                    label = stringResource(R.string.auth_full_name),
                    enabled = !loading
                )
                Spacer(Modifier.height(14.dp))
            }

            AuthField(
                value = email,
                onValueChange = { email = it },
                label = stringResource(R.string.auth_email),
                enabled = !loading,
                keyboardType = KeyboardType.Email
            )
            Spacer(Modifier.height(14.dp))

            AuthField(
                value = password,
                onValueChange = { password = it },
                label = stringResource(R.string.auth_password),
                enabled = !loading,
                keyboardType = KeyboardType.Password,
                isPassword = true
            )

            // Animated strength meter + requirements checklist — sign-up only (a new password).
            if (isSignUp) {
                Spacer(Modifier.height(12.dp))
                PasswordStrength(password = password)

                // Optional referral code — a friend's code credits them on verification.
                Spacer(Modifier.height(14.dp))
                AuthField(
                    value = referralCode,
                    onValueChange = { referralCode = it },
                    label = stringResource(R.string.referral_signup_field),
                    enabled = !loading
                )
            }

            // "Forgot password?" — sign-in mode only. Opens the standalone reset route.
            if (!isSignUp) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    Spacer(Modifier.weight(1f))
                    TextButton(
                        onClick = onForgotPassword,
                        enabled = !loading,
                        colors = ButtonDefaults.textButtonColors(contentColor = Burgundy)
                    ) {
                        Text(stringResource(R.string.auth_forgot_password), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    }
                }
            }

            // Inline error / note
            if (state.error != null) {
                Text(
                    state.error,
                    color = ErrorRed,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                )
            }

            Spacer(Modifier.height(22.dp))

            // Primary action — burgundy gradient with a pulsing ring (qkPulse).
            // On sign-up the button stays disabled until the new password meets the minimum bar.
            val canSubmit = !loading && (!isSignUp || passwordMeetsMin(password))
            GradientButton(
                onClick = {
                    if (isSignUp) onSignup(name, email, password, role, referralCode.ifBlank { null })
                    else onLogin(email, password, role)
                },
                enabled = canSubmit,
                pulse = canSubmit,
                radius = 18.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(22.dp)
                    )
                } else {
                    Text(
                        stringResource(if (isSignUp) R.string.auth_create_account else R.string.auth_sign_in),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                }
            }

            Spacer(Modifier.height(24.dp))

            DividerWithLabel(stringResource(R.string.auth_or))

            Spacer(Modifier.height(24.dp))

            // Continue with Google — real, config-gated.
            OutlinedButton(
                onClick = {
                    if (GoogleSignIn.isConfigured) {
                        onGoogleLaunch(GoogleSignIn.newNonce(), GoogleSignIn.newNonce())
                    } else {
                        onGoogleNotConfigured()
                    }
                },
                enabled = !loading,
                shape = RoundedCornerShape(18.dp),
                border = BorderStroke(1.dp, Tan),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = Color.White,
                    contentColor = Ink
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
            ) {
                Image(
                    painter = painterResource(R.drawable.ic_google_g),
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(10.dp))
                Text(stringResource(R.string.auth_continue_google), fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            }

            // Biometric sign-in — only in sign-in mode, and only when the device can run a prompt
            // AND a session was previously stored (the caller computes [canBiometricLogin]). Tapping
            // launches the system fingerprint/face prompt; on success the caller restores the session.
            if (!isSignUp && canBiometricLogin) {
                Spacer(Modifier.height(14.dp))
                OutlinedButton(
                    onClick = onBiometricLogin,
                    enabled = !loading,
                    shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(1.dp, Tan),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = Color.White,
                        contentColor = Burgundy
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp)
                ) {
                    Icon(
                        Icons.Filled.Fingerprint,
                        contentDescription = null,
                        tint = Burgundy,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(stringResource(R.string.auth_biometric_login), fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                }
            }

            // Apple is intentionally NOT offered on Android: Sign in with Apple
            // there requires a web OAuth flow (Apple Services ID + HTTPS return URL),
            // which isn't wired in this build. See OAUTH-SETUP.md.
        }
    }
}

@Composable
private fun ModeToggle(
    isSignUp: Boolean,
    enabled: Boolean,
    onSelect: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Tan, RoundedCornerShape(16.dp))
            .padding(4.dp)
    ) {
        ToggleTab(stringResource(R.string.auth_sign_in_toggle), selected = !isSignUp, enabled = enabled, modifier = Modifier.weight(1f)) {
            onSelect(false)
        }
        ToggleTab(stringResource(R.string.auth_sign_up_toggle), selected = isSignUp, enabled = enabled, modifier = Modifier.weight(1f)) {
            onSelect(true)
        }
    }
}

@Composable
private fun ToggleTab(
    label: String,
    selected: Boolean,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val container = if (selected) Color.White else Color.Transparent
    val content = if (selected) Burgundy else Muted
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(12.dp),
        elevation = null,
        colors = ButtonDefaults.buttonColors(
            containerColor = container,
            contentColor = content,
            disabledContainerColor = container,
            disabledContentColor = content
        ),
        modifier = modifier.height(44.dp)
    ) {
        Text(label, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
    }
}

/**
 * Two-button Guest/Host role chooser used in both auth modes. The labels adapt to [isSignUp]
 * ("Register as …" vs "Sign in as …") for role "user" (Guest) / "host" (Host). The selected
 * button fills burgundy; the other is an outlined tan button — matching the boutique palette.
 */
@Composable
private fun RoleSelector(
    role: String,
    enabled: Boolean,
    isSignUp: Boolean,
    onSelect: (String) -> Unit
) {
    // Distinct strings per (mode, role) so each language can use its natural word order.
    val guestLabel = stringResource(if (isSignUp) R.string.role_register_guest else R.string.role_signin_guest)
    val hostLabel = stringResource(if (isSignUp) R.string.role_register_host else R.string.role_signin_host)
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            stringResource(R.string.role_i_want_to),
            color = Muted,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        Row(modifier = Modifier.fillMaxWidth()) {
            RoleOption(
                label = guestLabel,
                selected = role == ROLE_GUEST,
                enabled = enabled,
                modifier = Modifier.weight(1f),
                onClick = { onSelect(ROLE_GUEST) }
            )
            Spacer(Modifier.width(12.dp))
            RoleOption(
                label = hostLabel,
                selected = role == ROLE_HOST,
                enabled = enabled,
                modifier = Modifier.weight(1f),
                onClick = { onSelect(ROLE_HOST) }
            )
        }
        Text(
            stringResource(if (role == ROLE_HOST) R.string.role_hosts_caption else R.string.role_guests_caption),
            color = Muted,
            fontSize = 12.sp,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

@Composable
private fun RoleOption(
    label: String,
    selected: Boolean,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    if (selected) {
        Button(
            onClick = onClick,
            enabled = enabled,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Burgundy,
                contentColor = Color.White
            ),
            modifier = modifier.height(48.dp)
        ) {
            Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        }
    } else {
        OutlinedButton(
            onClick = onClick,
            enabled = enabled,
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, Tan),
            colors = ButtonDefaults.outlinedButtonColors(
                containerColor = Color.White,
                contentColor = Ink
            ),
            modifier = modifier.height(48.dp)
        ) {
            Text(label, fontWeight = FontWeight.Medium, fontSize = 14.sp)
        }
    }
}

@Composable
private fun AuthField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    enabled: Boolean,
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false
) {
    // Independent reveal state per field; only meaningful when isPassword.
    var passwordVisible by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        enabled = enabled,
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = if (isPassword && !passwordVisible) {
            PasswordVisualTransformation()
        } else {
            VisualTransformation.None
        },
        trailingIcon = if (isPassword) {
            {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                        contentDescription = stringResource(if (passwordVisible) R.string.auth_hide_password else R.string.auth_show_password),
                        tint = Muted
                    )
                }
            }
        } else {
            null
        },
        shape = RoundedCornerShape(18.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Burgundy,
            unfocusedBorderColor = Tan,
            focusedLabelColor = Burgundy,
            cursorColor = Burgundy,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White
        ),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun DividerWithLabel(label: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        HorizontalDivider(modifier = Modifier.weight(1f), color = Tan)
        Text(
            label,
            color = Muted,
            fontSize = 13.sp,
            modifier = Modifier.padding(horizontal = 14.dp)
        )
        HorizontalDivider(modifier = Modifier.weight(1f), color = Tan)
    }
}

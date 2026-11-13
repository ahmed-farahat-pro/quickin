package com.quickin.app.ui

import androidx.activity.compose.BackHandler
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.zIndex
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.quickin.app.AuthUiState
import com.quickin.app.AuthViewModel
import com.quickin.app.GoogleSignIn
import com.quickin.app.EmailRules
import com.quickin.app.NameRules
import com.quickin.app.R
import com.quickin.app.SignupRoleRules
import com.quickin.app.SignupStep
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val ErrorRed = Color(0xFFB3261E)

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
    onLogin: (email: String, password: String) -> Unit,
    /**
     * Creates the account. Every new account gives its phone + an identity document here, before
     * the email OTP: [docType] is the API value, [idFront] / [idBack] the picked photos.
     */
    onSignup: (
        name: String,
        email: String,
        password: String,
        phone: String,
        docType: String,
        idNumber: String,
        idFront: android.net.Uri,
        idBack: android.net.Uri
    ) -> Unit,
    onGoogleLaunch: (nonce: String, state: String) -> Unit,
    onGoogleNotConfigured: () -> Unit,
    onForgotPassword: () -> Unit,
    /**
     * Clears the shared auth error held by the ViewModel. Called when the user switches between
     * sign-in and sign-up: a "wrong email or password" from a failed sign-in says nothing about
     * the account the user is now trying to create, so it must not follow them across the toggle.
     */
    onClearError: () -> Unit = {},
    /** Drops the server's refusal of one identity field (keyed like the API's `fields`) once edited. */
    onClearSignupFieldError: (field: String) -> Unit = {},
    /**
     * True when the device has an enrolled biometric AND a previously-stored biometric session
     * exists, so the "Sign in with fingerprint/face" button should be shown. [onBiometricLogin]
     * launches the system prompt (handled by the caller, which owns the FragmentActivity host).
     */
    canBiometricLogin: Boolean = false,
    onBiometricLogin: () -> Unit = {},
    onBack: (() -> Unit)? = null,
    /**
     * The activity's AuthViewModel (the same instance MainActivity holds). The role-aware stepped
     * sign-up submits through [AuthViewModel.signupWithRole]; [onSignup] is the pre-role entry
     * point, kept so existing callers compile.
     */
    authViewModel: AuthViewModel = viewModel()
) {
    // Saveable: the stepped sign-up keeps every value across Back/Next and a rotation.
    var isSignUp by rememberSaveable { mutableStateOf(false) }
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    // Sign-up only: the password typed a second time. A new account whose password holds a typo
    // can't be signed into at all, so we ask twice. Cleared by the mode toggle below — switching
    // modes hides the field, so coming back to sign-up starts from a clean, un-armed hint.
    var confirmPassword by rememberSaveable { mutableStateOf("") }

    // An empty confirmation is not yet a wrong answer — the hint waits until something is typed.
    val passwordsMismatch = isSignUp && confirmPassword.isNotEmpty() && confirmPassword != password

    // Armed once the name field has been left, so a name is never called wrong
    // while it is still being typed. Sign-up only — sign-in has no name field.
    var nameTouched by rememberSaveable { mutableStateOf(false) }
    val nameError = nameFieldError(raw = name, touched = isSignUp && nameTouched)

    // Armed once the email field has been left, so an address is never called
    // wrong while it is still being typed. Sign-up is subject to the full rule
    // (temp-mail included); sign-in is not, because it only ever touches an
    // account that already exists. See `emailFieldError`.
    var emailTouched by rememberSaveable { mutableStateOf(false) }
    var emailFocused by remember { mutableStateOf(false) }

    // Everything the current mode needs except the address. Doubles as the fallback trigger for
    // the email hint (see `authEmailHintArmed`) and, on sign-up, as the button's gate.
    val otherFieldsReady = authOtherFieldsReady(
        isSignUp = isSignUp,
        name = name,
        password = password,
        confirmPassword = confirmPassword
    )
    val emailError = emailFieldError(
        raw = email,
        touched = authEmailHintArmed(
            email = email,
            touched = emailTouched,
            focused = emailFocused,
            otherFieldsReady = otherFieldsReady
        ),
        fullPolicy = isSignUp
    )
    val emailAcceptable = if (isSignUp) {
        EmailRules.isAcceptableForSignup(email)
    } else {
        EmailRules.isValid(email)
    }

    val loading = state.isLoading

    // Sign-up only: phone + identity document (signup-identity-core on the API).
    val identityForm = rememberIdentityFormState()

    // Sign-up only: the role-aware steps (Guest/Host → Account → Identity → Refund | Hosting → Payout).
    val flow = rememberSignupFlowState(includeAccount = true)
    val onAccountStep = isSignUp && flow.step == SignupStep.Account
    // The sign-in form, or the sign-up's Account page, shows the email + password fields.
    val showCredentials = !isSignUp || onAccountStep
    // Server refusals of the account fields (a taken email, a weak password, a refused name).
    val accountServerError = if (onAccountStep) {
        listOf(SignupRoleRules.FIELD_FULL_NAME, SignupRoleRules.FIELD_EMAIL, SignupRoleRules.FIELD_PASSWORD)
            .firstNotNullOfOrNull { state.signupFieldErrors[it] }
            // The summary line below already says it when it is the same message.
            ?.takeUnless { it == state.error }
    } else null

    // System Back walks the sign-up pages backwards before leaving the screen.
    BackHandler(enabled = isSignUp && flow.step != SignupStep.Role && !loading) { flow.goBack() }

    // Every step's errors arrive in one 400: when a submit ends refused, open the earliest page
    // that owns one of them.
    LaunchedEffect(loading) {
        if (!loading && flow.awaitingResult) {
            flow.awaitingResult = false
            if (state.signupFieldErrors.isNotEmpty()) flow.jumpToFirstError(state.signupFieldErrors.keys)
        }
    }

    val submitSignup: (Boolean) -> Unit = { sendRefund ->
        val front = identityForm.front
        val back = identityForm.back
        if (front != null && back != null) {
            authViewModel.signupWithRole(
                NameRules.normalized(name), email, password,
                identityForm.phone, identityForm.docType.apiValue,
                identityForm.idNumber, front, back,
                flow.roleBody(sendRefund)
            )
        } else {
            flow.awaitingResult = false
            flow.step = SignupStep.Identity
        }
    }

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
                    // Draw + hit-test ABOVE the full-size scrollable form Column below; without this
                    // the Column (declared later, .fillMaxSize().verticalScroll) sits on top and
                    // swallows the tap, so the arrow was visible but not clickable.
                    .zIndex(1f)
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
            // Brand logo (replaces the old "Quick In" text wordmark).
            Image(
                painter = painterResource(R.drawable.logo),
                contentDescription = "Quick In",
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
                onSelect = {
                    if (it != isSignUp) {
                        isSignUp = it
                        // Switching modes starts a fresh attempt at a DIFFERENT thing, so nothing
                        // secret and nothing said about the old attempt may survive the toggle.
                        // The form the user lands on is clean: both password fields are emptied,
                        // the server's error is dropped, and EVERY inline hint is disarmed —
                        // "wrong email or password" from a failed sign-in says nothing about the
                        // account being created, and neither does a complaint about a field the
                        // user has not touched since arriving. The typed email itself is kept:
                        // whoever fails to sign in and decides to register is almost always
                        // registering that same address. It re-arms on the next blur, or by
                        // itself once it is the only thing left (see `authEmailHintArmed`), so a
                        // sign-up-only refusal can still never leave the button dead in silence.
                        password = ""
                        confirmPassword = ""
                        nameTouched = false
                        emailTouched = false
                        flow.reset()
                        onClearError()
                    }
                }
            )

            Spacer(Modifier.height(24.dp))

            if (isSignUp) {
                SignupStepHeader(flow)
                Spacer(Modifier.height(16.dp))
            }
            if (isSignUp && flow.step == SignupStep.Role) {
                SignupRoleCards(
                    selected = flow.role,
                    enabled = !loading,
                    onSelect = { flow.role = it }
                )
            }

            if (onAccountStep) {
                AuthField(
                    value = name,
                    onValueChange = {
                        name = it
                        if (nameTouched) nameTouched = false
                        onClearSignupFieldError(SignupRoleRules.FIELD_FULL_NAME)
                    },
                    label = stringResource(R.string.auth_full_name),
                    enabled = !loading,
                    isError = nameError != null,
                    onFocusLost = { nameTouched = true }
                )
                if (nameError != null) {
                    Text(
                        nameError,
                        color = ErrorRed,
                        fontSize = 13.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp)
                    )
                }
                Spacer(Modifier.height(14.dp))
            }

            if (showCredentials) {
            AuthField(
                value = email,
                onValueChange = {
                    email = it
                    if (emailTouched) emailTouched = false
                    if (isSignUp) onClearSignupFieldError(SignupRoleRules.FIELD_EMAIL)
                },
                label = stringResource(R.string.auth_email),
                enabled = !loading,
                keyboardType = KeyboardType.Email,
                isError = emailError != null,
                onFocusLost = { emailTouched = true },
                onFocusChange = { emailFocused = it }
            )
            if (emailError != null) {
                Text(
                    emailError,
                    color = ErrorRed,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp)
                )
            }
            Spacer(Modifier.height(14.dp))

            // Keyed on the mode so the toggle gives this field fresh internal state. The
            // reveal ("eye") toggle lives inside AuthField and would otherwise stay on across
            // the switch, showing the next mode's password in the clear. The confirm field
            // below needs no key — it is removed with the `if (isSignUp)` branch and rebuilt.
            key(isSignUp) {
                AuthField(
                    value = password,
                    onValueChange = {
                        password = it
                        if (isSignUp) onClearSignupFieldError(SignupRoleRules.FIELD_PASSWORD)
                    },
                    label = stringResource(R.string.auth_password),
                    enabled = !loading,
                    keyboardType = KeyboardType.Password,
                    isPassword = true
                )
            }

            } // showCredentials

            // Animated strength meter + requirements checklist — sign-up only (a new password).
            if (onAccountStep) {
                Spacer(Modifier.height(12.dp))
                PasswordStrength(password = password)

                Spacer(Modifier.height(14.dp))
                AuthField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    label = stringResource(R.string.auth_confirm_password),
                    enabled = !loading,
                    keyboardType = KeyboardType.Password,
                    isPassword = true,
                    isError = passwordsMismatch
                )
                if (passwordsMismatch) {
                    Text(
                        stringResource(R.string.password_mismatch),
                        color = ErrorRed,
                        fontSize = 13.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp)
                    )
                }
            }

            if (accountServerError != null) {
                Text(
                    accountServerError,
                    color = ErrorRed,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                )
            }
            if (onAccountStep && flow.attempted && !(otherFieldsReady && emailAcceptable)) {
                Text(
                    stringResource(R.string.signup_account_incomplete),
                    color = Muted,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                )
            }

            if (isSignUp && flow.step == SignupStep.Identity) {
                IdentityFormFields(
                    form = identityForm,
                    enabled = !loading,
                    serverErrors = state.signupFieldErrors,
                    onFieldEdited = onClearSignupFieldError
                )
                if (flow.attempted && !identityForm.isReady) {
                    Text(
                        stringResource(R.string.identity_required_hint),
                        color = Muted,
                        fontSize = 13.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp)
                    )
                }
            }
            if (isSignUp && flow.step == SignupStep.Refund) {
                MoneyDestinationStep(
                    intro = stringResource(R.string.signup_refund_intro),
                    draft = flow.refund,
                    onChange = { flow.refund = it; onClearSignupFieldError(SignupRoleRules.FIELD_REFUND_METHOD) },
                    enabled = !loading,
                    showLocal = flow.attempted,
                    serverError = state.signupFieldErrors[SignupRoleRules.FIELD_REFUND_METHOD]
                )
            }
            if (isSignUp && flow.step == SignupStep.Hosting) {
                HostingDetailsFields(
                    draft = flow.hosting,
                    onChange = { flow.hosting = it },
                    enabled = !loading,
                    showLocal = flow.attempted,
                    serverErrors = state.signupFieldErrors,
                    onFieldEdited = onClearSignupFieldError
                )
            }
            if (isSignUp && flow.step == SignupStep.Payout) {
                MoneyDestinationStep(
                    intro = stringResource(R.string.host_apply_payout_intro),
                    draft = flow.payout,
                    onChange = { flow.payout = it; onClearSignupFieldError(SignupRoleRules.FIELD_PAYOUT) },
                    enabled = !loading,
                    showLocal = flow.attempted,
                    serverError = state.signupFieldErrors[SignupRoleRules.FIELD_PAYOUT]
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
            // On sign-up the button stays disabled until the new password meets the minimum bar and
            // has been typed identically twice.
            // An address the server would refuse can never sign in or sign up, so
            // the button waits on it too — this screen used to submit anything
            // with an `@` in it and let the user find out from a 400.
            // `12345` is non-empty and is not a name — the name is held to the
            // same rule the server applies, not just to being filled in.
            if (isSignUp) {
                // The stepped sign-up: Back / Next on every page, the last one submits everything
                // once; the guest's refund page can be skipped.
                SignupNavButtons(
                    showBack = flow.step != SignupStep.Role,
                    primaryLabel = stringResource(
                        if (flow.isLast) R.string.auth_create_account else R.string.signup_next
                    ),
                    busy = loading,
                    onBack = { flow.goBack() },
                    onPrimary = {
                        flow.onPrimary(
                            identity = identityForm,
                            // `12345` is non-empty and is not a name — the name is held to the
                            // same rule the server applies; the address to the full sign-up policy.
                            accountReady = otherFieldsReady && emailAcceptable,
                            onAccountIncomplete = { nameTouched = true; emailTouched = true },
                            submit = submitSignup
                        )
                    },
                    onSkip = if (SignupRoleRules.isSkippable(flow.step)) {
                        { flow.awaitingResult = true; submitSignup(false) }
                    } else null
                )
            } else {
            // Primary action — burgundy gradient with a pulsing ring (qkPulse).
            // An address the server would refuse can never sign in, so the button waits on it.
            val canSubmit = !loading && emailAcceptable
            GradientButton(
                onClick = { onLogin(email, password) },
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
                        stringResource(R.string.auth_sign_in),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                }
            }
            }

            if (!isSignUp || flow.step == SignupStep.Role) {
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
            } // Google: sign-in, or the sign-up's role page (completion then asks the rest)

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

@Composable
private fun AuthField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    enabled: Boolean,
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    isError: Boolean = false,
    /** Called when focus leaves the field — used to arm an inline hint. */
    onFocusLost: (() -> Unit)? = null,
    /** Called with the field's focus state on every change — used to keep a hint quiet while typing. */
    onFocusChange: ((Boolean) -> Unit)? = null
) {
    // Independent reveal state per field; only meaningful when isPassword.
    var passwordVisible by remember { mutableStateOf(false) }
    var wasFocused by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        enabled = enabled,
        isError = isError,
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
        modifier = Modifier
            .fillMaxWidth()
            .onFocusChanged { focus ->
                // Fire only on the way OUT. An inline hint that appears the
                // moment you tap the field is telling you your address is wrong
                // before you have typed it.
                onFocusChange?.invoke(focus.isFocused)
                if (focus.isFocused) {
                    wasFocused = true
                } else if (wasFocused) {
                    wasFocused = false
                    onFocusLost?.invoke()
                }
            }
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

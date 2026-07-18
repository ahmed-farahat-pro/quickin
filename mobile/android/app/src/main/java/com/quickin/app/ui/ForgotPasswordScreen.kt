package com.quickin.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.zIndex
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.ForgotPasswordUiState
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val ForgotErrorRed = Color(0xFFB3261E)
private const val RESET_CODE_LENGTH = 6

/**
 * Standalone "Forgot password" route reached from the sign-in form. Two steps driven by
 * [ForgotPasswordUiState.step]:
 *   1. EnterEmail — email field → [onSendCode] (POST /api/auth/forgot-password).
 *   2. EnterCode  — the emailed 6-digit code + a new password → [onReset]
 *      (POST /api/auth/reset-password). On success the ViewModel persists the returned
 *      session, so the user is signed in and this route is dismissed by the caller.
 *
 * Themed to match [OtpScreen] / [AuthScreen]; the new-password field reuses the
 * PasswordVisualTransformation + Visibility eye-toggle pattern from AuthScreen's AuthField.
 *
 * @param onSendCode invoked with the typed email to send the reset code.
 * @param onReset invoked with (code, newPassword) to complete the reset.
 * @param onBack abandons the flow and returns to the sign-in form.
 * @param onClearError clears the inline error when the user edits a field.
 */
@Composable
fun ForgotPasswordScreen(
    state: ForgotPasswordUiState,
    onSendCode: (email: String) -> Unit,
    onReset: (code: String, newPassword: String) -> Unit,
    onBack: () -> Unit,
    onClearError: () -> Unit
) {
    val loading = state.isLoading
    val codeStep = state.step == ForgotPasswordUiState.Step.EnterCode

    var email by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CreamPage)
    ) {
        IconButton(
            onClick = onBack,
            enabled = !loading,
            modifier = Modifier
                .align(Alignment.TopStart)
                .zIndex(1f)  // above the scrollable form Column so the tap isn't swallowed
                .statusBarsPadding()  // sit BELOW the status bar so the arrow is reliably tappable
                .padding(8.dp)
        ) {
            Icon(
                Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back to sign in",
                tint = Ink
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 28.dp, vertical = 64.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                "Reset password",
                fontWeight = FontWeight.Bold,
                fontSize = 26.sp,
                color = Ink,
                textAlign = TextAlign.Center
            )
            Text(
                if (codeStep) {
                    buildString {
                        append("Enter the 6-digit code we sent")
                        if (state.email.isNotBlank()) append(" to ${state.email}")
                        append(", then choose a new password.")
                    }
                } else {
                    "Enter your account email and we'll send you a 6-digit reset code."
                },
                color = Muted,
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 12.dp, bottom = 32.dp)
            )

            if (codeStep) {
                ResetField(
                    value = code,
                    onValueChange = {
                        code = it.filter { ch -> ch.isDigit() }.take(RESET_CODE_LENGTH)
                        onClearError()
                    },
                    label = "6-digit code",
                    enabled = !loading,
                    keyboardType = KeyboardType.NumberPassword
                )
                Spacer(Modifier.height(14.dp))
                ResetField(
                    value = newPassword,
                    onValueChange = { newPassword = it; onClearError() },
                    label = "New password",
                    enabled = !loading,
                    keyboardType = KeyboardType.Password,
                    isPassword = true,
                    passwordVisible = passwordVisible,
                    onTogglePassword = { passwordVisible = !passwordVisible }
                )
                Spacer(Modifier.height(12.dp))
                PasswordStrength(password = newPassword)
            } else {
                ResetField(
                    value = email,
                    onValueChange = { email = it; onClearError() },
                    label = "Email",
                    enabled = !loading,
                    keyboardType = KeyboardType.Email
                )
            }

            if (state.error != null) {
                Text(
                    state.error,
                    color = ForgotErrorRed,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                )
            }

            Spacer(Modifier.height(22.dp))

            val canSubmit = if (codeStep) {
                code.length == RESET_CODE_LENGTH && passwordMeetsMin(newPassword)
            } else {
                email.isNotBlank()
            }
            GradientButton(
                onClick = {
                    if (codeStep) onReset(code, newPassword) else onSendCode(email)
                },
                enabled = !loading && canSubmit,
                pulse = !loading && canSubmit,
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
                        if (codeStep) "Reset password" else "Send reset code",
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                }
            }

            if (codeStep) {
                Spacer(Modifier.height(8.dp))
                TextButton(
                    onClick = { onSendCode(state.email.ifBlank { email }) },
                    enabled = !loading,
                    colors = ButtonDefaults.textButtonColors(contentColor = Burgundy)
                ) {
                    Text("Resend code", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                }
            }
        }
    }
}

@Composable
private fun ResetField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    enabled: Boolean,
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    passwordVisible: Boolean = false,
    onTogglePassword: (() -> Unit)? = null
) {
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
        trailingIcon = if (isPassword && onTogglePassword != null) {
            {
                IconButton(onClick = onTogglePassword) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                        contentDescription = if (passwordVisible) "Hide password" else "Show password",
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

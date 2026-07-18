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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AuthUiState
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val ErrorRed = Color(0xFFB3261E)
private const val OTP_LENGTH = 6

/**
 * Email-OTP verification screen. Shown after sign-up (or an unverified login) once
 * [AuthUiState.pendingEmail] is set: the user enters the 6-digit code mailed to them,
 * taps Verify (-> /verify-otp), and on success the session is stored and login completes.
 * "Resend code" re-sends a fresh code (-> /resend-otp). Themed to match [AuthScreen].
 *
 * @param onVerify invoked with the entered code.
 * @param onResend re-sends the code to the pending email.
 * @param onBack abandons verification and returns to the sign-in form.
 */
@Composable
fun OtpScreen(
    state: AuthUiState,
    onVerify: (code: String) -> Unit,
    onResend: () -> Unit,
    onBack: () -> Unit
) {
    var code by remember { mutableStateOf("") }
    val loading = state.isLoading
    val email = state.pendingEmail.orEmpty()

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
                contentDescription = stringResource(R.string.cd_back_to_sign_in),
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
                stringResource(R.string.otp_verify_email),
                fontWeight = FontWeight.Bold,
                fontSize = 26.sp,
                color = Ink,
                textAlign = TextAlign.Center
            )
            Text(
                if (email.isNotBlank()) stringResource(R.string.otp_prompt_to, email)
                else stringResource(R.string.otp_prompt_plain),
                color = Muted,
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 12.dp, bottom = 32.dp)
            )

            OutlinedTextField(
                value = code,
                onValueChange = { input ->
                    // Digits only, capped at the code length.
                    code = input.filter { it.isDigit() }.take(OTP_LENGTH)
                },
                label = { Text(stringResource(R.string.otp_code_label)) },
                enabled = !loading,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
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

            GradientButton(
                onClick = { onVerify(code) },
                enabled = !loading && code.length == OTP_LENGTH,
                pulse = !loading && code.length == OTP_LENGTH,
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
                    Text(stringResource(R.string.otp_verify), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                }
            }

            Spacer(Modifier.height(8.dp))

            val cooldown = state.otpResendCooldown
            TextButton(
                onClick = onResend,
                enabled = !loading && cooldown == 0,
                colors = ButtonDefaults.textButtonColors(contentColor = Burgundy)
            ) {
                Text(
                    if (cooldown > 0) "Resend in ${cooldown}s"
                    else stringResource(R.string.otp_resend),
                    fontWeight = FontWeight.SemiBold, fontSize = 14.sp
                )
            }
        }
    }
}

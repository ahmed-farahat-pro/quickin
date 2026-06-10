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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
    onSignup: (name: String, email: String, password: String) -> Unit,
    onGoogleLaunch: (nonce: String, state: String) -> Unit,
    onGoogleNotConfigured: () -> Unit,
    onBack: (() -> Unit)? = null
) {
    var isSignUp by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    val loading = state.isLoading

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Cream)
    ) {
        if (onBack != null) {
            IconButton(
                onClick = onBack,
                enabled = !loading,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(8.dp)
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back to browsing",
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
                "Boutique stays, booked in a tap.",
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

            if (isSignUp) {
                AuthField(
                    value = name,
                    onValueChange = { name = it },
                    label = "Full name",
                    enabled = !loading
                )
                Spacer(Modifier.height(14.dp))
            }

            AuthField(
                value = email,
                onValueChange = { email = it },
                label = "Email",
                enabled = !loading,
                keyboardType = KeyboardType.Email
            )
            Spacer(Modifier.height(14.dp))

            AuthField(
                value = password,
                onValueChange = { password = it },
                label = "Password",
                enabled = !loading,
                keyboardType = KeyboardType.Password,
                isPassword = true
            )

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

            // Primary action
            Button(
                onClick = {
                    if (isSignUp) onSignup(name, email, password)
                    else onLogin(email, password)
                },
                enabled = !loading,
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Burgundy,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(22.dp)
                    )
                } else {
                    Text(
                        if (isSignUp) "Create account" else "Sign in",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                }
            }

            Spacer(Modifier.height(24.dp))

            DividerWithLabel("or")

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
                Text(
                    "G",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = Color(0xFF4285F4)
                )
                Spacer(Modifier.width(10.dp))
                Text("Continue with Google", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
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
        ToggleTab("Sign In", selected = !isSignUp, enabled = enabled, modifier = Modifier.weight(1f)) {
            onSelect(false)
        }
        ToggleTab("Sign Up", selected = isSignUp, enabled = enabled, modifier = Modifier.weight(1f)) {
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
    isPassword: Boolean = false
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        enabled = enabled,
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
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

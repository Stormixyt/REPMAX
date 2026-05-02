package com.repmax.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onBack: () -> Unit,
    onLogin: (email: String, password: String) -> Unit,
    onSignUp: (email: String, password: String, name: String) -> Unit,
    isLoading: Boolean = false,
    errorMessage: String? = null,
) {
    var isSignUp by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current

    val inputColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = NeonLime,
        unfocusedBorderColor = Border,
        focusedLabelColor = NeonLime,
        unfocusedLabelColor = TextTertiary,
        cursorColor = NeonLime,
        focusedTextColor = TextPrimary,
        unfocusedTextColor = TextPrimary,
        focusedContainerColor = Card,
        unfocusedContainerColor = Card,
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .systemBarsPadding()
            .padding(horizontal = 28.dp),
    ) {
        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp, bottom = 24.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, "Back", tint = TextPrimary)
            }
            Spacer(Modifier.weight(1f))
            Text(
                text = "repmax.",
                style = MaterialTheme.typography.headlineMedium.copy(
                    color = NeonLime,
                    fontStyle = FontStyle.Italic,
                    fontWeight = FontWeight.Black,
                ),
            )
        }

        // Title
        Text(
            text = if (isSignUp) "CREATE\nACCOUNT" else "WELCOME\nBACK",
            style = MaterialTheme.typography.displayMedium.copy(
                fontWeight = FontWeight.Black,
                lineHeight = 36.sp,
            ),
        )

        Spacer(Modifier.height(8.dp))

        Text(
            text = if (isSignUp) "Join the grind." else "Time to get after it.",
            style = MaterialTheme.typography.bodyLarge.copy(color = TextSecondary),
        )

        Spacer(Modifier.height(32.dp))

        // Name field (sign up only)
        if (isSignUp) {
            OutlinedTextField(
                value = displayName,
                onValueChange = { displayName = it },
                label = { Text("Display Name") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(6.dp),
                colors = inputColors,
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) }),
            )
            Spacer(Modifier.height(16.dp))
        }

        // Email
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(6.dp),
            colors = inputColors,
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) }),
        )

        Spacer(Modifier.height(16.dp))

        // Password
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(6.dp),
            colors = inputColors,
            singleLine = true,
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = {
                focusManager.clearFocus()
                if (isSignUp) onSignUp(email, password, displayName) else onLogin(email, password)
            }),
            trailingIcon = {
                IconButton(onClick = { showPassword = !showPassword }) {
                    Icon(
                        if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                        "Toggle password",
                        tint = TextTertiary,
                    )
                }
            },
        )

        // Error message
        if (errorMessage != null) {
            Spacer(Modifier.height(12.dp))
            Text(
                text = errorMessage,
                style = MaterialTheme.typography.bodySmall.copy(color = Danger),
            )
        }

        Spacer(Modifier.height(28.dp))

        // Submit button
        Button(
            onClick = {
                if (isSignUp) onSignUp(email, password, displayName) else onLogin(email, password)
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(6.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = NeonLime,
                contentColor = TextOnAccent,
            ),
            enabled = !isLoading && email.isNotBlank() && password.isNotBlank(),
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = TextOnAccent,
                    strokeWidth = 2.dp,
                )
            } else {
                Text(
                    text = if (isSignUp) "CREATE ACCOUNT" else "LOG IN",
                    style = MaterialTheme.typography.labelLarge.copy(
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        letterSpacing = 1.sp,
                        color = TextOnAccent,
                    ),
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        // Toggle sign up / login
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = if (isSignUp) "Already have an account?" else "Don't have an account?",
                style = MaterialTheme.typography.bodyMedium.copy(color = TextTertiary),
            )
            TextButton(onClick = { isSignUp = !isSignUp }) {
                Text(
                    text = if (isSignUp) "Log in" else "Sign up",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        color = NeonLime,
                        fontWeight = FontWeight.Bold,
                    ),
                )
            }
        }
    }
}

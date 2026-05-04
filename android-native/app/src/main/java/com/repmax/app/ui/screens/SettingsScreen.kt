package com.repmax.app.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.data.Profile
import com.repmax.app.ui.theme.*

@Composable
fun SettingsScreen(
    profile: Profile?,
    onBack: () -> Unit,
    onToggleUnit: () -> Unit,
    onLogout: () -> Unit,
    onEditName: (String) -> Unit,
) {
    var showEditName by remember { mutableStateOf(false) }
    var nameValue by remember { mutableStateOf(profile?.display_name ?: "") }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var toast by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(toast) {
        if (toast != null) {
            kotlinx.coroutines.delay(3000)
            toast = null
        }
    }

    val initials = (profile?.display_name ?: "U")
        .split(" ")
        .mapNotNull { it.firstOrNull()?.uppercaseChar() }
        .take(2)
        .joinToString("")

    val unitLabel = if ((profile?.unit_preference ?: "kg") == "kg") "Kilograms (kg)" else "Pounds (lbs)"
    val unitToggle = profile?.unit_preference ?: "kg"

    Box(modifier = Modifier.fillMaxSize().background(Black)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp)
        ) {
            Spacer(Modifier.height(16.dp))

            // Back button
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { onBack() },
            ) {
                Icon(Icons.Default.ArrowBack, "Back", tint = TextSecondary, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Back", color = TextSecondary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }

            Spacer(Modifier.height(20.dp))

            // Title
            Text(
                "SETTINGS",
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp,
                    color = TextPrimary,
                ),
            )

            Spacer(Modifier.height(24.dp))

            // Profile card
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Card, RoundedCornerShape(16.dp))
                    .border(1.dp, Border, RoundedCornerShape(16.dp))
                    .padding(16.dp),
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(48.dp)
                        .background(NeonLime.copy(alpha = 0.15f), CircleShape)
                        .border(1.5.dp, NeonLime.copy(alpha = 0.4f), CircleShape),
                ) {
                    Text(initials, color = NeonLime, fontWeight = FontWeight.Black, fontSize = 16.sp)
                }
                Spacer(Modifier.width(14.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            profile?.display_name ?: "Athlete",
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary,
                            fontSize = 15.sp,
                        )
                        if (profile?.subscription_tier == "pro" || profile?.subscription_tier == "ultra") {
                            Spacer(Modifier.width(8.dp))
                            Text(
                                profile.subscription_tier?.uppercase() ?: "",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.sp,
                                color = NeonLime,
                                modifier = Modifier
                                    .background(NeonLime.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                        }
                    }
                    Text(
                        profile?.email ?: "",
                        color = TextTertiary,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            Spacer(Modifier.height(24.dp))

            // Account Section
            SectionTitle("Account")
            SettingsItem(
                icon = Icons.Filled.Person,
                label = "Display Name",
                value = profile?.display_name ?: "Not set",
                onClick = { showEditName = true },
            )
            SettingsItem(
                icon = Icons.Filled.Lock,
                label = "Change Password",
                value = "Via email reset",
                onClick = { toast = "Password reset email sent!" },
            )

            Spacer(Modifier.height(20.dp))

            // Training Section
            SectionTitle("Training")
            SettingsItem(
                icon = Icons.Filled.FitnessCenter,
                label = "Weight Units",
                value = unitLabel,
                trailing = unitToggle,
                onClick = {
                    onToggleUnit()
                    toast = "Units toggled"
                },
            )

            Spacer(Modifier.height(20.dp))

            // Notifications Section
            SectionTitle("Notifications")
            SettingsToggleItem(
                icon = Icons.Filled.Notifications,
                label = "Training Reminders",
                value = "Daily workout reminders",
                isOn = true,
            )
            SettingsToggleItem(
                icon = Icons.Filled.Notifications,
                label = "Friend Nudges",
                value = "When friends nudge you to train",
                isOn = true,
            )

            Spacer(Modifier.height(20.dp))

            // Privacy Section
            SectionTitle("Privacy")
            SettingsItem(
                icon = Icons.Filled.VisibilityOff,
                label = "Profile Visibility",
                value = when (profile?.toString()?.contains("friends") == true) {
                    true -> "Friends Only"
                    false -> "Public"
                },
                onClick = { toast = "Privacy cycled" },
            )

            Spacer(Modifier.height(20.dp))

            // Danger Zone
            SectionTitle("Danger Zone", isDestructive = true)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF1A0A0A), RoundedCornerShape(14.dp))
                    .border(1.dp, Color(0xFF3D1111), RoundedCornerShape(14.dp))
                    .clickable { showDeleteConfirm = true }
                    .padding(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(36.dp)
                            .background(Color(0xFF3D1111), RoundedCornerShape(10.dp)),
                    ) {
                        Icon(Icons.Filled.DeleteForever, null, tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text("Delete Account", color = Color(0xFFEF4444), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("Permanently delete all your data", color = TextTertiary, fontSize = 11.sp)
                    }
                }
            }

            Spacer(Modifier.height(28.dp))

            // Sign Out
            Button(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Surface,
                    contentColor = TextPrimary,
                ),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, Border),
            ) {
                Icon(Icons.Default.Logout, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Sign Out", fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(16.dp))

            // App version
            Text(
                "REPMAX v5.0 · Made with grit",
                color = TextTertiary,
                fontSize = 11.sp,
                modifier = Modifier.fillMaxWidth(),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )

            Spacer(Modifier.height(40.dp))
        }

        // Toast
        if (toast != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 100.dp)
                    .background(NeonLime.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
                    .border(1.dp, NeonLime.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 20.dp, vertical = 12.dp),
            ) {
                Text(toast!!, color = NeonLime, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
        }

        // Edit Name Dialog
        if (showEditName) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.7f))
                    .clickable { showEditName = false },
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    modifier = Modifier
                        .padding(32.dp)
                        .fillMaxWidth()
                        .background(Card, RoundedCornerShape(20.dp))
                        .border(1.dp, Border, RoundedCornerShape(20.dp))
                        .clickable(enabled = false) {} // prevent dismiss on card click
                        .padding(24.dp),
                ) {
                    Text("Edit Name", fontWeight = FontWeight.Black, fontSize = 18.sp, color = TextPrimary)
                    Spacer(Modifier.height(16.dp))
                    OutlinedTextField(
                        value = nameValue,
                        onValueChange = { nameValue = it },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = NeonLime,
                            unfocusedBorderColor = Border,
                            cursorColor = NeonLime,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                        ),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true,
                    )
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = {
                            onEditName(nameValue)
                            showEditName = false
                            toast = "Name updated!"
                        },
                        modifier = Modifier.fillMaxWidth().height(46.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = NeonLime, contentColor = Black),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Icon(Icons.Default.Check, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Save", fontWeight = FontWeight.Black)
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(title: String, isDestructive: Boolean = false) {
    Text(
        title.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = 1.5.sp,
        color = if (isDestructive) Color(0xFFEF4444) else NeonLime.copy(alpha = 0.6f),
        modifier = Modifier.padding(bottom = 10.dp),
    )
}

@Composable
private fun SettingsItem(
    icon: ImageVector,
    label: String,
    value: String,
    trailing: String? = null,
    onClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
            .background(Card, RoundedCornerShape(14.dp))
            .border(1.dp, Border, RoundedCornerShape(14.dp))
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(36.dp)
                .background(Surface, RoundedCornerShape(10.dp))
                .border(1.dp, Border, RoundedCornerShape(10.dp)),
        ) {
            Icon(icon, null, tint = NeonLime, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
            Text(value, fontSize = 11.sp, color = TextTertiary)
        }
        if (trailing != null) {
            Text(
                trailing,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = NeonLime,
                modifier = Modifier
                    .background(NeonLime.copy(alpha = 0.1f), RoundedCornerShape(6.dp))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            )
        } else {
            Icon(Icons.Default.ChevronRight, null, tint = TextTertiary, modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
private fun SettingsToggleItem(
    icon: ImageVector,
    label: String,
    value: String,
    isOn: Boolean,
) {
    var toggled by remember { mutableStateOf(isOn) }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
            .background(Card, RoundedCornerShape(14.dp))
            .border(1.dp, Border, RoundedCornerShape(14.dp))
            .clickable { toggled = !toggled }
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(36.dp)
                .background(Surface, RoundedCornerShape(10.dp))
                .border(1.dp, Border, RoundedCornerShape(10.dp)),
        ) {
            Icon(icon, null, tint = NeonLime, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
            Text(value, fontSize = 11.sp, color = TextTertiary)
        }
        // Simple toggle indicator
        Box(
            modifier = Modifier
                .width(44.dp)
                .height(24.dp)
                .background(
                    if (toggled) NeonLime.copy(alpha = 0.25f) else Surface,
                    RoundedCornerShape(12.dp),
                )
                .border(
                    1.dp,
                    if (toggled) NeonLime.copy(alpha = 0.5f) else Border,
                    RoundedCornerShape(12.dp),
                ),
            contentAlignment = if (toggled) Alignment.CenterEnd else Alignment.CenterStart,
        ) {
            Box(
                modifier = Modifier
                    .padding(3.dp)
                    .size(18.dp)
                    .background(
                        if (toggled) NeonLime else TextTertiary,
                        CircleShape,
                    ),
            )
        }
    }
}

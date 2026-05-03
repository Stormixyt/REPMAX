package com.repmax.app.ui.screens

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.data.*
import com.repmax.app.ui.theme.*

@Composable
fun ProfileScreen(
    profile: Profile?,
    workoutHistory: List<Workout>,
    personalRecords: List<PersonalRecord>,
    onLogout: () -> Unit,
) {
    val displayName = profile?.display_name ?: profile?.username ?: "Athlete"
    val streak = profile?.current_streak ?: 0
    val goal = profile?.fitness_goal ?: "Build muscle"
    val level = profile?.experience_level ?: "Intermediate"
    val trainingDays = profile?.training_days ?: emptyList()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .verticalScroll(rememberScrollState())
            .systemBarsPadding()
    ) {
        Spacer(Modifier.height(24.dp))

        // ═══ AVATAR + NAME ═══
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(Card)
                    .border(3.dp, NeonLime, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    displayName.take(2).uppercase(),
                    style = MaterialTheme.typography.headlineMedium.copy(
                        color = NeonLime,
                        fontWeight = FontWeight.Black,
                    ),
                )
            }
            Spacer(Modifier.height(12.dp))
            Text(
                displayName,
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black),
            )
            Spacer(Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProfileBadge(level)
                if (streak > 0) ProfileBadge("🔥 $streak day streak")
            }
        }

        Spacer(Modifier.height(24.dp))

        // ═══ STATS BAR ═══
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            ProfileStat("Workouts", "${workoutHistory.size}")
            ProfileStat("PRs", "${personalRecords.size}")
            ProfileStat("Streak", "$streak")
        }

        Spacer(Modifier.height(24.dp))

        // ═══ INFO CARDS ═══
        Column(modifier = Modifier.padding(horizontal = 20.dp)) {
            Text(
                "PROFILE",
                style = MaterialTheme.typography.labelMedium.copy(
                    color = TextTertiary,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.5.sp,
                ),
            )
            Spacer(Modifier.height(10.dp))

            ProfileRow(Icons.Default.FitnessCenter, "Goal", goal)
            ProfileRow(Icons.Default.TrendingUp, "Level", level)
            ProfileRow(Icons.Default.CalendarMonth, "Training Days", trainingDays.joinToString(", "))
        }

        Spacer(Modifier.height(24.dp))

        // ═══ SETTINGS (COMING SOON) ═══
        Column(modifier = Modifier.padding(horizontal = 20.dp)) {
            Text(
                "SETTINGS",
                style = MaterialTheme.typography.labelMedium.copy(
                    color = TextTertiary,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.5.sp,
                ),
            )
            Spacer(Modifier.height(10.dp))

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Card, RoundedCornerShape(12.dp))
                    .border(1.dp, Border, RoundedCornerShape(12.dp))
                    .padding(20.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("🚧", fontSize = 32.sp)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "COMING SOON",
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Black,
                            letterSpacing = 2.sp,
                        ),
                    )
                    Text(
                        "Theme, units, notifications & more",
                        style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary),
                    )
                }
            }
        }

        Spacer(Modifier.height(24.dp))

        // ═══ LOGOUT ═══
        Button(
            onClick = onLogout,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .height(50.dp),
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF1A1A1A),
                contentColor = Color(0xFFEF4444),
            ),
            border = BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.3f)),
        ) {
            Icon(Icons.Default.Logout, null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "LOG OUT",
                style = MaterialTheme.typography.labelLarge.copy(
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp,
                ),
            )
        }

        Spacer(Modifier.height(16.dp))

        // Footer
        Text(
            "BUILT DIFFERENT. MADE TO WIN.",
            style = MaterialTheme.typography.labelSmall.copy(
                color = TextTertiary,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp,
                fontSize = 9.sp,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

@Composable
private fun ProfileStat(label: String, value: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .background(Card, RoundedCornerShape(12.dp))
            .border(1.dp, Border, RoundedCornerShape(12.dp))
            .padding(horizontal = 20.dp, vertical = 12.dp),
    ) {
        Text(
            value,
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Black),
        )
        Text(
            label,
            style = MaterialTheme.typography.labelSmall.copy(color = TextTertiary),
        )
    }
}

@Composable
private fun ProfileBadge(text: String) {
    Box(
        modifier = Modifier
            .background(NeonLimeGlow, RoundedCornerShape(12.dp))
            .border(1.dp, NeonLime.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(
            text,
            style = MaterialTheme.typography.labelSmall.copy(
                color = NeonLime,
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
            ),
        )
    }
}

@Composable
private fun ProfileRow(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .background(Card, RoundedCornerShape(10.dp))
            .border(1.dp, Border, RoundedCornerShape(10.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = NeonLime, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(12.dp))
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium.copy(color = TextTertiary),
            modifier = Modifier.weight(1f),
        )
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
        )
    }
}

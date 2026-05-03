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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.data.*
import com.repmax.app.ui.theme.*

@Composable
fun ProgressScreen(
    workoutHistory: List<Workout>,
    personalRecords: List<PersonalRecord>,
    profile: Profile?,
) {
    var selectedTab by remember { mutableStateOf("overview") }
    val tabs = listOf("overview", "prs", "history")

    val totalVolume = workoutHistory.sumOf { it.total_volume ?: 0.0 }.toLong()
    val streak = profile?.current_streak ?: 0

    // Heatmap: last 30 days
    val now = System.currentTimeMillis()
    val dayMs = 24 * 60 * 60 * 1000L
    val heatmapDays = (29 downTo 0).map { daysAgo ->
        val dateMs = now - daysAgo * dayMs
        val dateStr = java.time.Instant.ofEpochMilli(dateMs).toString().substring(0, 10)
        val count = workoutHistory.count { w -> w.completed_at?.startsWith(dateStr) == true }
        Pair(dateStr, count)
    }

    // Weekly consistency
    val fourWeeksAgo = now - 28 * dayMs
    val recentCount = workoutHistory.count { w ->
        w.completed_at?.let { try { java.time.Instant.parse(it).toEpochMilli() > fourWeeksAgo } catch (_: Exception) { false } } ?: false
    }
    val planned = (profile?.training_days?.size ?: 3) * 4
    val consistency = if (planned > 0) minOf(100, (recentCount * 100) / planned) else 0

    // Best PRs by exercise
    val bestPRs = mutableMapOf<String, PersonalRecord>()
    personalRecords.forEach { pr ->
        val existing = bestPRs[pr.exercise_name]
        if (existing == null || pr.weight > existing.weight) bestPRs[pr.exercise_name] = pr
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .systemBarsPadding()
    ) {
        // Header
        Text(
            text = "Your Progress",
            style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Black),
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
        )

        // Tab selector
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .background(Card, RoundedCornerShape(8.dp))
                .padding(4.dp),
        ) {
            tabs.forEach { tab ->
                val selected = tab == selectedTab
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (selected) NeonLime else Color.Transparent)
                        .clickable { selectedTab = tab }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = if (tab == "prs") "PRs" else tab.replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = if (selected) FontWeight.Black else FontWeight.Medium,
                            color = if (selected) TextOnAccent else TextSecondary,
                        ),
                    )
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
        ) {
            when (selectedTab) {
                "overview" -> {
                    // Stats row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                    ) {
                        ProgressStatBox("Workouts", "${workoutHistory.size}")
                        ProgressStatBox("Volume", "${totalVolume / 1000}K KG")
                        ProgressStatBox("Streak", "$streak 🔥")
                    }

                    Spacer(Modifier.height(16.dp))

                    // Consistency
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Card, RoundedCornerShape(12.dp))
                            .border(1.dp, Border, RoundedCornerShape(12.dp))
                            .padding(16.dp),
                    ) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column {
                                    Text("Weekly Consistency", style = MaterialTheme.typography.labelMedium.copy(color = TextTertiary))
                                    Text(
                                        "$recentCount / $planned sessions (4 weeks)",
                                        style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary),
                                    )
                                }
                                Text(
                                    "$consistency%",
                                    style = MaterialTheme.typography.headlineMedium.copy(
                                        fontWeight = FontWeight.Black,
                                        color = if (consistency >= 80) NeonLime else if (consistency >= 50) Color(0xFFF59E0B) else Color(0xFFEF4444),
                                    ),
                                )
                            }
                            Spacer(Modifier.height(10.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(6.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(Elevated),
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth(consistency / 100f)
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp))
                                        .background(if (consistency >= 80) NeonLime else if (consistency >= 50) Color(0xFFF59E0B) else Color(0xFFEF4444)),
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(16.dp))

                    // Activity heatmap
                    Text(
                        "LAST 30 DAYS",
                        style = MaterialTheme.typography.labelMedium.copy(
                            color = TextTertiary,
                            letterSpacing = 1.5.sp,
                            fontWeight = FontWeight.ExtraBold,
                        ),
                    )
                    Spacer(Modifier.height(8.dp))

                    // Heatmap grid
                    val rows = heatmapDays.chunked(10)
                    rows.forEach { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            row.forEach { (_, count) ->
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .aspectRatio(1f)
                                        .clip(RoundedCornerShape(3.dp))
                                        .background(
                                            when {
                                                count >= 2 -> NeonLime
                                                count == 1 -> NeonLime.copy(alpha = 0.4f)
                                                else -> Elevated
                                            }
                                        ),
                                )
                            }
                        }
                        Spacer(Modifier.height(4.dp))
                    }

                    Spacer(Modifier.height(16.dp))

                    if (workoutHistory.isEmpty()) {
                        EmptyState("📊", "No data yet", "Complete your first workout to start tracking.")
                    }
                }

                "prs" -> {
                    if (bestPRs.isEmpty()) {
                        EmptyState("🏆", "No PRs yet", "Keep training — your first PR is coming soon.")
                    } else {
                        bestPRs.values.sortedByDescending { it.weight }.forEach { pr ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                                    .background(Card, RoundedCornerShape(12.dp))
                                    .border(1.dp, Border, RoundedCornerShape(12.dp))
                                    .padding(14.dp),
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("🏆", fontSize = 24.sp)
                                    Spacer(Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            pr.exercise_name,
                                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                        )
                                        Text(
                                            "${pr.weight.toInt()} KG × ${pr.reps} reps",
                                            style = MaterialTheme.typography.bodySmall.copy(color = NeonLime, fontWeight = FontWeight.Bold),
                                        )
                                    }
                                    Text(
                                        pr.achieved_at?.substring(0, 10) ?: "",
                                        style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary),
                                    )
                                }
                            }
                        }
                    }
                }

                "history" -> {
                    if (workoutHistory.isEmpty()) {
                        EmptyState("📋", "No workouts yet", "Start your first workout to see history.")
                    } else {
                        workoutHistory.take(20).forEach { w ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                                    .background(Card, RoundedCornerShape(12.dp))
                                    .border(1.dp, Border, RoundedCornerShape(12.dp))
                                    .padding(14.dp),
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column {
                                        Text(
                                            w.day_name ?: "Workout",
                                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                        )
                                        Text(
                                            w.completed_at?.substring(0, 10) ?: "",
                                            style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary),
                                        )
                                    }
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text(
                                            "${((w.total_volume ?: 0.0) / 1000).toInt()}K KG",
                                            style = MaterialTheme.typography.titleSmall.copy(color = NeonLime, fontWeight = FontWeight.Bold),
                                        )
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

@Composable
private fun ProgressStatBox(label: String, value: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .background(Card, RoundedCornerShape(10.dp))
            .border(1.dp, Border, RoundedCornerShape(10.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Text(
            value,
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Black, fontSize = 18.sp),
        )
        Text(
            label,
            style = MaterialTheme.typography.labelSmall.copy(color = TextTertiary, fontWeight = FontWeight.Medium),
        )
    }
}

@Composable
fun EmptyState(emoji: String, title: String, subtitle: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(emoji, fontSize = 48.sp)
        Spacer(Modifier.height(12.dp))
        Text(title, style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold))
        Spacer(Modifier.height(4.dp))
        Text(subtitle, style = MaterialTheme.typography.bodyMedium.copy(color = TextTertiary))
    }
}

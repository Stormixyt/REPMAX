package com.repmax.app.ui.screens

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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.data.*
import com.repmax.app.ui.theme.*
import java.time.LocalDate
import java.time.format.TextStyle as JavaTextStyle
import java.util.*

@Composable
fun DashboardScreen(
    profile: Profile?,
    program: Program?,
    workoutHistory: List<Workout>,
    personalRecords: List<PersonalRecord>,
    onStartWorkout: (ProgramDay) -> Unit,
    onViewPlan: () -> Unit,
    onNavigate: (String) -> Unit,
) {
    val scrollState = rememberScrollState()
    val firstName = profile?.display_name?.split(" ")?.firstOrNull() ?: "Athlete"
    val streak = profile?.current_streak ?: 0
    val avatarInitials = firstName.take(2).uppercase()

    // Compute today's workout
    val todayWorkout = remember(program) {
        val trainingDays = profile?.training_days ?: emptyList()
        val today = LocalDate.now()
        val dayAbbrevs = mapOf(
            java.time.DayOfWeek.MONDAY to "Mon", java.time.DayOfWeek.TUESDAY to "Tue",
            java.time.DayOfWeek.WEDNESDAY to "Wed", java.time.DayOfWeek.THURSDAY to "Thu",
            java.time.DayOfWeek.FRIDAY to "Fri", java.time.DayOfWeek.SATURDAY to "Sat",
            java.time.DayOfWeek.SUNDAY to "Sun"
        )
        val shortDay = dayAbbrevs[today.dayOfWeek] ?: ""
        val dayIndex = trainingDays.indexOf(shortDay)
        if (dayIndex >= 0) {
            val currentWeek = program?.program_data?.weeks?.getOrNull((program.current_week ?: 1) - 1)
            currentWeek?.days?.getOrNull(dayIndex)
        } else null
    }

    // Weekly stats
    val weeklyWorkouts = workoutHistory.size.coerceAtMost(99)
    val weeklyVolume = workoutHistory.sumOf { it.total_volume ?: 0.0 }.toLong()
    val weeklyPRs = personalRecords.size.coerceAtMost(99)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .verticalScroll(scrollState)
            .systemBarsPadding()
    ) {
        // ═══ TOP BAR ═══
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "repmax.",
                style = MaterialTheme.typography.headlineMedium.copy(
                    color = NeonLime,
                    fontStyle = FontStyle.Italic,
                    fontWeight = FontWeight.Black,
                    fontSize = 20.sp,
                ),
            )

            Spacer(Modifier.weight(1f))

            // Streak badge
            if (streak > 0) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .background(NeonLimeGlow, RoundedCornerShape(20.dp))
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                ) {
                    Text("🔥", fontSize = 12.sp)
                    Spacer(Modifier.width(4.dp))
                    Text(
                        text = "$streak",
                        style = MaterialTheme.typography.titleSmall.copy(
                            color = NeonLime,
                            fontWeight = FontWeight.ExtraBold,
                        ),
                    )
                }
                Spacer(Modifier.width(12.dp))
            }

            // Avatar circle
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(Card)
                    .border(1.dp, BorderAccent, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = avatarInitials,
                    style = MaterialTheme.typography.titleSmall.copy(
                        color = NeonLime,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                    ),
                )
            }
        }

        // ═══ GREETING ═══
        Column(modifier = Modifier.padding(horizontal = 20.dp)) {
            Text(
                text = "YO $firstName 👋",
                style = MaterialTheme.typography.bodyMedium.copy(
                    color = NeonLime,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                ),
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "READY TO\nGET AFTER IT?",
                style = MaterialTheme.typography.displaySmall.copy(
                    fontWeight = FontWeight.Black,
                    fontSize = 28.sp,
                    lineHeight = 32.sp,
                ),
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = "Your AI has your back.\nLet's hit a new PR.",
                style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary),
            )
        }

        Spacer(Modifier.height(20.dp))

        // ═══ AI COACH CARD ═══
        Row(
            modifier = Modifier
                .padding(horizontal = 20.dp)
                .fillMaxWidth()
                .background(Card, RoundedCornerShape(8.dp))
                .border(1.dp, Border, RoundedCornerShape(8.dp))
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "AI COACH",
                    style = MaterialTheme.typography.labelMedium.copy(
                        color = NeonLime,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 1.5.sp,
                    ),
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Your plan is optimized\nfor your goals.",
                    style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary),
                )
            }
            Spacer(Modifier.width(12.dp))
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(NeonLimeGlow, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Psychology,
                    contentDescription = "AI",
                    tint = NeonLime,
                    modifier = Modifier.size(28.dp),
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        // VIEW PLAN button
        OutlinedButton(
            onClick = onViewPlan,
            modifier = Modifier.padding(horizontal = 20.dp),
            shape = RoundedCornerShape(6.dp),
            border = BorderStroke(1.dp, Border),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
        ) {
            Text(
                text = "VIEW PLAN",
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    color = TextPrimary,
                ),
            )
        }

        Spacer(Modifier.height(24.dp))

        // ═══ WEEK OVERVIEW ═══
        Column(modifier = Modifier.padding(horizontal = 20.dp)) {
            Text(
                text = "WEEK OVERVIEW",
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.5.sp,
                    color = TextSecondary,
                ),
            )
            Spacer(Modifier.height(12.dp))

            // Day circles (M T W T F S S)
            val dayLabels = listOf("M", "T", "W", "T", "F", "S", "S")
            val todayIndex = LocalDate.now().dayOfWeek.value - 1 // 0=Mon
            val trainingDayIndices = (profile?.training_days ?: emptyList()).map {
                listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun").indexOf(it)
            }.filter { it >= 0 }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                dayLabels.forEachIndexed { index, label ->
                    val isToday = index == todayIndex
                    val isTrainingDay = index in trainingDayIndices
                    val isPast = index < todayIndex

                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(
                                when {
                                    isToday -> NeonLime
                                    isPast && isTrainingDay -> NeonLimeGlow
                                    else -> Color.Transparent
                                }
                            )
                            .then(
                                if (!isToday) Modifier.border(1.dp, if (isTrainingDay) BorderAccent else Border, CircleShape)
                                else Modifier
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.titleSmall.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = when {
                                    isToday -> TextOnAccent
                                    isPast && isTrainingDay -> NeonLime
                                    else -> TextTertiary
                                },
                            ),
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // ═══ TODAY'S WORKOUT (Push Day card) ═══
        if (todayWorkout != null) {
            Row(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .fillMaxWidth()
                    .background(Card, RoundedCornerShape(8.dp))
                    .border(1.dp, BorderAccent, RoundedCornerShape(8.dp))
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "PUSH DAY",
                        style = MaterialTheme.typography.headlineSmall.copy(
                            fontWeight = FontWeight.Black,
                        ),
                    )
                    Text(
                        text = todayWorkout.target_muscles?.joinToString(" • ") ?: "Chest • Shoulders • Triceps",
                        style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary),
                    )
                }
                Button(
                    onClick = { onStartWorkout(todayWorkout) },
                    shape = RoundedCornerShape(6.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NeonLime,
                        contentColor = TextOnAccent,
                    ),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                ) {
                    Text(
                        text = "START WORKOUT",
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = FontWeight.Black,
                            letterSpacing = 0.5.sp,
                            color = TextOnAccent,
                        ),
                    )
                    Spacer(Modifier.width(4.dp))
                    Icon(Icons.Default.ArrowForward, null, modifier = Modifier.size(16.dp))
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // ═══ PROGRESS ROW ═══
        Column(modifier = Modifier.padding(horizontal = 20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "PROGRESS",
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 1.5.sp,
                        color = TextSecondary,
                    ),
                )
                Text(
                    text = "This Week",
                    style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary),
                )
            }

            Spacer(Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                StatBox("WORKOUTS", "$weeklyWorkouts", Modifier.weight(1f))
                StatBox("VOLUME", "${weeklyVolume / 1000}K KG", Modifier.weight(1f))
                StatBox("CALORIES", "${(weeklyVolume * 0.23).toLong()}", Modifier.weight(1f))
                StatBox("PRs", "$weeklyPRs", Modifier.weight(1f))
            }
        }

        Spacer(Modifier.height(20.dp))

        // ═══ MOTIVATIONAL FOOTER ═══
        Row(
            modifier = Modifier
                .padding(horizontal = 20.dp)
                .fillMaxWidth()
                .background(Card, RoundedCornerShape(8.dp))
                .border(1.dp, Border, RoundedCornerShape(8.dp))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "DISCIPLINE TODAY",
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 1.sp,
                    ),
                )
                Text(
                    text = "DOMINANCE TOMORROW.",
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 1.sp,
                    ),
                )
            }
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(NeonLimeGlow, RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Bolt,
                    contentDescription = null,
                    tint = NeonLime,
                    modifier = Modifier.size(22.dp),
                )
            }
        }

        Spacer(Modifier.height(100.dp)) // Bottom nav padding
    }
}

@Composable
private fun StatBox(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(Card, RoundedCornerShape(6.dp))
            .border(1.dp, Border, RoundedCornerShape(6.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall.copy(
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
                color = TextTertiary,
                fontSize = 9.sp,
            ),
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.headlineSmall.copy(
                fontWeight = FontWeight.Black,
                color = NeonLime,
                fontSize = 16.sp,
            ),
        )
    }
}

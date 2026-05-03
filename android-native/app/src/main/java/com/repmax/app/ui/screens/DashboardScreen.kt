package com.repmax.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.animation.core.*
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.R
import com.repmax.app.data.*
import com.repmax.app.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun DashboardScreen(
    profile: Profile?,
    program: Program?,
    workoutHistory: List<Workout>,
    personalRecords: List<PersonalRecord>,
    onStartWorkout: (ProgramDay?) -> Unit,
    onViewPlan: () -> Unit,
    onNavigate: (String) -> Unit,
) {
    val displayName = profile?.display_name ?: profile?.username ?: "Athlete"
    val firstName = displayName.split(" ").firstOrNull() ?: displayName
    val greeting = "YO ${firstName.uppercase()} 🤙"
    val streak = profile?.current_streak ?: 0
    val trainingDays = profile?.training_days ?: emptyList()

    // Get current week data
    val currentWeek = program?.program_data?.weeks?.getOrNull((program.current_week ?: 1) - 1)
    val allDays = currentWeek?.days ?: emptyList()

    // Find today's workout
    val dayOfWeek = java.time.LocalDate.now().dayOfWeek
    val dayAbbrevMap = mapOf(
        java.time.DayOfWeek.MONDAY to "Mon", java.time.DayOfWeek.TUESDAY to "Tue",
        java.time.DayOfWeek.WEDNESDAY to "Wed", java.time.DayOfWeek.THURSDAY to "Thu",
        java.time.DayOfWeek.FRIDAY to "Fri", java.time.DayOfWeek.SATURDAY to "Sat",
        java.time.DayOfWeek.SUNDAY to "Sun"
    )
    val todayAbbrev = dayAbbrevMap[dayOfWeek] ?: ""
    val todayDayIndex = trainingDays.indexOf(todayAbbrev)
    val todayDay = if (todayDayIndex >= 0) allDays.getOrNull(todayDayIndex) else allDays.firstOrNull()
    val todayDayName = todayDay?.day_name ?: "PUSH DAY"
    val targetMuscles = todayDay?.target_muscles?.joinToString(" · ") ?: "Chest · Shoulders · Triceps"

    // Weekly stats
    val weekAgo = System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000
    val weekWorkouts = workoutHistory.filter { w ->
        w.completed_at?.let { try { java.time.Instant.parse(it).toEpochMilli() > weekAgo } catch (_: Exception) { false } } ?: false
    }
    val weekVolume = weekWorkouts.sumOf { it.total_volume ?: 0.0 }.toLong()
    val weekPRs = personalRecords.count { pr ->
        pr.achieved_at?.let { try { java.time.Instant.parse(it).toEpochMilli() > weekAgo } catch (_: Exception) { false } } ?: false
    }
    // Estimated calories from volume (rough: 1kg lifted ≈ 0.23 cal)
    val weekCalories = (weekVolume * 0.23).toLong()

    val motivations = listOf(
        "DISCIPLINE TODAY.\nDOMINANCE TOMORROW.",
        "NO EXCUSES.\nJUST EXECUTION.",
        "YOUR ONLY LIMIT\nIS YOU.",
        "LIGHT WEIGHT, BABY!",
    )
    val motivation = remember { motivations.random() }

    // Staggered animations
    var show1 by remember { mutableStateOf(false) }
    var show2 by remember { mutableStateOf(false) }
    var show3 by remember { mutableStateOf(false) }
    var show4 by remember { mutableStateOf(false) }
    var show5 by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(80); show1 = true
        delay(120); show2 = true
        delay(120); show3 = true
        delay(120); show4 = true
        delay(120); show5 = true
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .verticalScroll(rememberScrollState())
            .systemBarsPadding()
    ) {
        // ═══ TOP BAR ═══
        AnimatedVisibility(visible = show1, enter = fadeIn(tween(500)) + slideInVertically(tween(500)) { -30 }) {
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
                        fontSize = 22.sp,
                    ),
                )
                Spacer(Modifier.weight(1f))

                // Streak badge
                if (streak > 0) {
                    Box(
                        modifier = Modifier
                            .background(NeonLimeGlow, RoundedCornerShape(12.dp))
                            .border(1.dp, NeonLime.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("🔥", fontSize = 12.sp)
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "$streak",
                                style = MaterialTheme.typography.labelSmall.copy(color = NeonLime, fontWeight = FontWeight.ExtraBold),
                            )
                        }
                    }
                    Spacer(Modifier.width(8.dp))
                }

                // Avatar circle
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Card)
                        .border(2.dp, NeonLime, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        firstName.take(2).uppercase(),
                        style = MaterialTheme.typography.labelSmall.copy(color = NeonLime, fontWeight = FontWeight.Black, fontSize = 12.sp),
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        // ═══ GREETING + HERO ═══
        AnimatedVisibility(visible = show2, enter = fadeIn(tween(600)) + slideInVertically(tween(600)) { 40 }) {
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                Text(
                    text = greeting,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        color = TextTertiary, fontWeight = FontWeight.Bold, letterSpacing = 1.sp,
                    ),
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "READY TO\nGET AFTER IT?",
                    style = MaterialTheme.typography.displayMedium.copy(
                        fontWeight = FontWeight.Black, fontSize = 30.sp, lineHeight = 34.sp,
                    ),
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Your AI has your back.\nLet's hit a new PR.",
                    style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary),
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        // ═══ AI COACH CARD with wireframe face image ═══
        AnimatedVisibility(visible = show2, enter = fadeIn(tween(700)) + slideInHorizontally(tween(700)) { -60 }) {
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Card, RoundedCornerShape(12.dp))
                        .border(1.dp, Border, RoundedCornerShape(12.dp))
                        .padding(16.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "AI COACH",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    color = NeonLime, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.5.sp,
                                ),
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "Your plan is optimized\nfor your goals.",
                                style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary),
                            )
                        }
                        Spacer(Modifier.width(12.dp))

                        // Real wireframe face image
                        Image(
                            painter = painterResource(R.drawable.wireframe_face),
                            contentDescription = "AI Coach",
                            modifier = Modifier
                                .size(72.dp)
                                .clip(RoundedCornerShape(8.dp)),
                            contentScale = ContentScale.Crop,
                        )
                    }
                }

                Spacer(Modifier.height(8.dp))

                // VIEW PLAN button
                OutlinedButton(
                    onClick = onViewPlan,
                    shape = RoundedCornerShape(6.dp),
                    border = BorderStroke(1.dp, Border),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                ) {
                    Text(
                        "VIEW PLAN",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp),
                    )
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // ═══ WEEK OVERVIEW ═══
        AnimatedVisibility(visible = show3, enter = fadeIn(tween(500)) + slideInVertically(tween(500)) { 30 }) {
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                Text(
                    "WEEK OVERVIEW",
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = FontWeight.ExtraBold, letterSpacing = 1.5.sp, color = TextTertiary,
                    ),
                )
                Spacer(Modifier.height(10.dp))

                val weekDays = listOf("M", "T", "W", "T", "F", "S", "S")
                val weekFull = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
                val todayIdx = dayOfWeek.value - 1

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    weekDays.forEachIndexed { i, label ->
                        val isToday = i == todayIdx
                        val isTrainingDay = weekFull[i] in trainingDays
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(
                                    if (isToday) NeonLime else if (isTrainingDay) Card else Color.Transparent
                                )
                                .then(
                                    if (!isToday && isTrainingDay) Modifier.border(1.dp, Border, CircleShape)
                                    else Modifier
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                label,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = if (isToday) FontWeight.Black else FontWeight.Medium,
                                    color = if (isToday) TextOnAccent else if (isTrainingDay) TextPrimary else TextTertiary,
                                ),
                            )
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // ═══ TODAY'S WORKOUT CARD ═══
        AnimatedVisibility(visible = show3, enter = fadeIn(tween(600)) + scaleIn(tween(600), initialScale = 0.95f)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .background(Card, RoundedCornerShape(12.dp))
                    .border(1.dp, Border, RoundedCornerShape(12.dp))
                    .padding(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            todayDayName.uppercase(),
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Black, fontSize = 17.sp),
                        )
                        Text(
                            targetMuscles,
                            style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary),
                        )
                    }
                    Button(
                        onClick = { onStartWorkout(todayDay) },
                        shape = RoundedCornerShape(6.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = NeonLime, contentColor = TextOnAccent),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                    ) {
                        Text(
                            "START WORKOUT",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Black, letterSpacing = 0.5.sp, fontSize = 10.sp,
                            ),
                        )
                        Spacer(Modifier.width(4.dp))
                        Icon(Icons.Default.ArrowForward, null, modifier = Modifier.size(14.dp))
                    }
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // ═══ PROGRESS THIS WEEK ═══
        AnimatedVisibility(visible = show4, enter = fadeIn(tween(500)) + slideInVertically(tween(500)) { 30 }) {
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "PROGRESS",
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = FontWeight.ExtraBold, letterSpacing = 1.5.sp, color = TextTertiary,
                        ),
                    )
                    Text(
                        "This Week",
                        style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary),
                    )
                }
                Spacer(Modifier.height(10.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Card, RoundedCornerShape(12.dp))
                        .border(1.dp, Border, RoundedCornerShape(12.dp))
                        .padding(vertical = 14.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    DashStatItem("WORKOUTS", "${weekWorkouts.size}")
                    DashStatDivider()
                    DashStatItem("VOLUME", formatVolume(weekVolume))
                    DashStatDivider()
                    DashStatItem("CALORIES", "${weekCalories}")
                    DashStatDivider()
                    DashStatItem("PRs", "$weekPRs")
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // ═══ MOTIVATIONAL FOOTER ═══
        AnimatedVisibility(visible = show5, enter = fadeIn(tween(800)) + slideInVertically(tween(800)) { 40 }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .background(Card, RoundedCornerShape(12.dp))
                    .border(1.dp, Border, RoundedCornerShape(12.dp))
                    .padding(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        motivation,
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Black, fontSize = 13.sp, lineHeight = 18.sp,
                        ),
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(12.dp))
                    Icon(Icons.Default.FlashOn, null, tint = NeonLime, modifier = Modifier.size(28.dp))
                }
            }
        }

        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun DashStatItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            value,
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Black, fontSize = 16.sp, color = TextPrimary),
        )
        Text(
            label,
            style = MaterialTheme.typography.labelSmall.copy(color = TextTertiary, fontWeight = FontWeight.Medium, fontSize = 9.sp, letterSpacing = 1.sp),
        )
    }
}

@Composable
private fun DashStatDivider() {
    Box(
        modifier = Modifier
            .width(1.dp)
            .height(32.dp)
            .background(Border),
    )
}

private fun formatVolume(volume: Long): String {
    return if (volume >= 1000) {
        val k = volume / 1000
        val remainder = (volume % 1000) / 100
        if (remainder > 0) "${k},${(volume % 1000).toString().padStart(3, '0')}" else "${k},000"
    } else "$volume"
}

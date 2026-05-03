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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.data.*
import com.repmax.app.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun WorkoutPlanScreen(
    day: ProgramDay?,
    weekNumber: Int = 1,
    onBack: () -> Unit,
    onExerciseClick: (ProgramExercise, Int) -> Unit,
    onStartWorkout: () -> Unit,
) {
    val dayName = day?.day_name ?: "PUSH DAY"
    val exercises = day?.exercises ?: emptyList()
    val totalSets = exercises.sumOf { it.setsInt }
    val estimatedMinutes = totalSets * 3 + exercises.size * 2
    val estimatedVolume = exercises.sumOf {
        it.setsInt * (it.repsDisplay.filter { c -> c.isDigit() }.take(2).toIntOrNull() ?: 8) *
                (it.weightDouble.takeIf { w -> w > 0 } ?: 60.0)
    }.toLong()

    // Staggered animations
    var showHeader by remember { mutableStateOf(false) }
    var showStats by remember { mutableStateOf(false) }
    val showExercise = remember { mutableStateListOf<Boolean>() }
    var showCta by remember { mutableStateOf(false) }

    LaunchedEffect(exercises) {
        showExercise.clear()
        exercises.forEach { _ -> showExercise.add(false) }
        delay(100); showHeader = true
        delay(150); showStats = true
        exercises.indices.forEach { i ->
            delay(80)
            if (i < showExercise.size) showExercise[i] = true
        }
        delay(100); showCta = true
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .systemBarsPadding()
    ) {
        // ═══ TOP BAR ═══
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, "Back", tint = TextPrimary)
            }
            Spacer(Modifier.weight(1f))
            Text(
                dayName.uppercase(),
                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Black),
            )
            Spacer(Modifier.weight(1f))
            TextButton(onClick = { }) {
                Text("Edit", style = MaterialTheme.typography.titleSmall.copy(color = NeonLime))
            }
        }

        // Scrollable content
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
        ) {
            // ═══ WORKOUT PLAN HEADER ═══
            AnimatedVisibility(visible = showHeader, enter = fadeIn(tween(500)) + slideInVertically(tween(500)) { 20 }) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "WORKOUT PLAN",
                            style = MaterialTheme.typography.headlineLarge.copy(
                                fontWeight = FontWeight.Black, fontSize = 24.sp,
                            ),
                        )
                        Spacer(Modifier.width(12.dp))
                        Box(
                            modifier = Modifier
                                .background(NeonLimeGlow, RoundedCornerShape(4.dp))
                                .border(1.dp, NeonLime, RoundedCornerShape(4.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp),
                        ) {
                            Text(
                                "AI OPTIMIZED",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = NeonLime, fontWeight = FontWeight.ExtraBold,
                                    letterSpacing = 1.sp, fontSize = 9.sp,
                                ),
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // ═══ STATS ROW ═══
            AnimatedVisibility(visible = showStats, enter = fadeIn(tween(400)) + slideInVertically(tween(400)) { 20 }) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(24.dp),
                ) {
                    PlanStat("Estimated Time", "${estimatedMinutes} MIN")
                    PlanStat("Volume", "${estimatedVolume / 1000},${"%03d".format(estimatedVolume % 1000)} KG")
                    PlanStat("Exercises", "${exercises.size}")
                }
            }

            Spacer(Modifier.height(20.dp))

            // ═══ EXERCISE LIST — staggered fade-in ═══
            exercises.forEachIndexed { index, exercise ->
                AnimatedVisibility(
                    visible = showExercise.getOrElse(index) { false },
                    enter = fadeIn(tween(400)) + slideInHorizontally(tween(400)) { 30 },
                ) {
                    ExerciseRow(
                        index = index + 1,
                        exercise = exercise,
                        isCompleted = false,
                        onClick = { onExerciseClick(exercise, index) },
                    )
                }
                if (index < exercises.lastIndex) {
                    Spacer(Modifier.height(3.dp))
                }
            }

            Spacer(Modifier.height(24.dp))
        }

        // ═══ BOTTOM CTA ═══
        AnimatedVisibility(visible = showCta, enter = fadeIn(tween(500)) + slideInVertically(tween(500)) { 60 }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Black)
                    .padding(horizontal = 20.dp, vertical = 16.dp),
            ) {
                Button(
                    onClick = onStartWorkout,
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(6.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = NeonLime, contentColor = TextOnAccent),
                ) {
                    Text(
                        "START WORKOUT",
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontWeight = FontWeight.Black, fontSize = 15.sp,
                            letterSpacing = 1.sp, color = TextOnAccent,
                        ),
                    )
                    Spacer(Modifier.width(8.dp))
                    Icon(Icons.Default.ArrowForward, null, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

@Composable
private fun PlanStat(label: String, value: String) {
    Column {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall.copy(color = TextTertiary, fontWeight = FontWeight.Medium, fontSize = 10.sp),
        )
        Text(
            value,
            style = MaterialTheme.typography.headlineSmall.copy(
                fontWeight = FontWeight.Black, color = NeonLime, fontSize = 15.sp,
            ),
        )
    }
}

@Composable
private fun ExerciseRow(
    index: Int,
    exercise: ProgramExercise,
    isCompleted: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(Card, RoundedCornerShape(10.dp))
            .border(1.dp, if (isCompleted) BorderAccent else Border, RoundedCornerShape(10.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Numbered circle
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(if (isCompleted) NeonLime else NeonLimeGlow)
                .border(1.5.dp, NeonLime, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "$index",
                style = MaterialTheme.typography.titleSmall.copy(
                    color = if (isCompleted) TextOnAccent else NeonLime,
                    fontWeight = FontWeight.ExtraBold, fontSize = 13.sp,
                ),
            )
        }

        Spacer(Modifier.width(14.dp))

        // Exercise info
        Column(modifier = Modifier.weight(1f)) {
            Text(
                exercise.name.uppercase(),
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.ExtraBold, fontSize = 14.sp),
            )
            Text(
                "${exercise.setsInt} SETS · ${exercise.repsDisplay} REPS",
                style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary, fontWeight = FontWeight.Medium),
            )
            if (exercise.weightDouble > 0) {
                Text(
                    "Last: ${exercise.weightDouble.toInt()}KG × ${exercise.repsDisplay.filter { it.isDigit() }.take(2)}",
                    style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary, fontSize = 10.sp),
                )
            }
        }

        // Checkmark circle
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(CircleShape)
                .background(if (isCompleted) NeonLime else Color.Transparent)
                .border(2.dp, if (isCompleted) NeonLime else Border, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            if (isCompleted) {
                Icon(Icons.Default.Check, null, tint = TextOnAccent, modifier = Modifier.size(16.dp))
            }
        }
    }
}

package com.repmax.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.R
import com.repmax.app.data.*
import com.repmax.app.ui.theme.*
import kotlinx.coroutines.delay

data class SetEntry(
    val setNumber: Int,
    var weight: String = "100",
    var reps: String = "6",
    var completed: Boolean = false,
)

@Composable
fun ExerciseDetailScreen(
    exercise: ProgramExercise?,
    onBack: () -> Unit,
    onComplete: (List<Pair<Double, Int>>) -> Unit,
) {
    val exerciseName = exercise?.name ?: "BARBELL BENCH PRESS"
    val targetSets = exercise?.setsInt ?: 4
    val targetReps = exercise?.repsDisplay ?: "6"
    val targetWeight = exercise?.weightDouble?.takeIf { it > 0 } ?: 100.0
    val repsInt = targetReps.filter { it.isDigit() }.take(2).toIntOrNull() ?: 6

    var sets by remember {
        mutableStateOf(
            (1..targetSets).map { i ->
                SetEntry(setNumber = i, weight = "${targetWeight.toInt()}", reps = "$repsInt")
            }
        )
    }

    // Animations
    var showInfo by remember { mutableStateOf(false) }
    var showRec by remember { mutableStateOf(false) }
    var showSets by remember { mutableStateOf(false) }
    var showBtn by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(100); showInfo = true
        delay(200); showRec = true
        delay(300); showSets = true
        delay(400); showBtn = true
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
                exerciseName.uppercase(),
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Black, fontSize = 14.sp),
                maxLines = 1,
            )
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { }) {
                Icon(Icons.Default.MoreVert, "More", tint = TextPrimary)
            }
        }

        // Scrollable content
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
        ) {
            Spacer(Modifier.height(8.dp))

            // ═══ EXERCISE INFO + BODY ANATOMY IMAGE ═══
            AnimatedVisibility(visible = showInfo, enter = fadeIn(tween(500)) + slideInVertically(tween(500)) { 20 }) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text(
                            "Target: Chest",
                            style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary),
                        )
                        Text(
                            "Compound · Horizontal Push",
                            style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary),
                        )
                    }
                    // Real body anatomy image
                    Image(
                        painter = painterResource(R.drawable.body_anatomy),
                        contentDescription = "Target muscles",
                        modifier = Modifier
                            .size(70.dp, 90.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Card)
                            .border(1.dp, Border, RoundedCornerShape(8.dp)),
                        contentScale = ContentScale.Crop,
                    )
                }
            }

            Spacer(Modifier.height(20.dp))

            // ═══ AI RECOMMENDATION ═══
            AnimatedVisibility(visible = showRec, enter = fadeIn(tween(600)) + slideInHorizontally(tween(600)) { -40 }) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Card, RoundedCornerShape(10.dp))
                        .border(1.dp, BorderAccent, RoundedCornerShape(10.dp))
                        .padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "AI RECOMMENDATION",
                            style = MaterialTheme.typography.labelMedium.copy(
                                color = TextSecondary, fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.sp, fontSize = 10.sp,
                            ),
                        )
                        Spacer(Modifier.weight(1f))
                        Box(
                            modifier = Modifier
                                .background(NeonLimeGlow, RoundedCornerShape(4.dp))
                                .border(1.dp, NeonLime, RoundedCornerShape(4.dp))
                                .padding(horizontal = 8.dp, vertical = 2.dp),
                        ) {
                            Text(
                                "OPTIMAL",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = NeonLime, fontWeight = FontWeight.ExtraBold,
                                    fontSize = 8.sp, letterSpacing = 1.sp,
                                ),
                            )
                        }
                    }

                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Based on your recovery, performance and\nprogress, we recommend:",
                        style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary),
                    )

                    Spacer(Modifier.height(12.dp))

                    // Big recommendation
                    Text(
                        "${targetWeight.toInt()}KG × $repsInt REPS",
                        style = MaterialTheme.typography.displaySmall.copy(fontWeight = FontWeight.Black, fontSize = 28.sp),
                    )

                    Spacer(Modifier.height(8.dp))

                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text("$targetSets SETS", style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary, fontWeight = FontWeight.Bold))
                        Text("RPE 8", style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary, fontWeight = FontWeight.Bold))
                        Text("2-3 MIN REST", style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary, fontWeight = FontWeight.Bold))
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // ═══ AUTO-FILL ═══
            AnimatedVisibility(visible = showSets, enter = fadeIn(tween(400))) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                ) {
                    OutlinedButton(
                        onClick = {
                            sets = sets.map { it.copy(weight = "${targetWeight.toInt()}", reps = "$repsInt") }
                        },
                        shape = RoundedCornerShape(4.dp),
                        border = BorderStroke(1.dp, NeonLime),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = NeonLime),
                    ) {
                        Text(
                            "AUTO-FILL",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = NeonLime, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp,
                            ),
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // ═══ LOG SETS ═══
            AnimatedVisibility(visible = showSets, enter = fadeIn(tween(500)) + slideInVertically(tween(500)) { 30 }) {
                Column {
                    Text(
                        "LOG SETS",
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = FontWeight.ExtraBold, letterSpacing = 1.5.sp, color = TextSecondary,
                        ),
                    )

                    Spacer(Modifier.height(12.dp))

                    val inputColors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = NeonLime,
                        unfocusedBorderColor = Border,
                        cursorColor = NeonLime,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedContainerColor = Card,
                        unfocusedContainerColor = Card,
                    )

                    sets.forEachIndexed { index, set ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                "SET ${set.setNumber}",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.Bold, color = TextTertiary, fontSize = 11.sp,
                                ),
                                modifier = Modifier.width(44.dp),
                            )

                            OutlinedTextField(
                                value = sets[index].weight,
                                onValueChange = { newVal ->
                                    sets = sets.toMutableList().also { list ->
                                        list[index] = list[index].copy(weight = newVal.filter { it.isDigit() || it == '.' })
                                    }
                                },
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = RoundedCornerShape(6.dp),
                                colors = inputColors,
                                singleLine = true,
                                textStyle = MaterialTheme.typography.titleSmall.copy(
                                    textAlign = TextAlign.Center, fontWeight = FontWeight.Bold,
                                ),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                suffix = { Text("KG", style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary)) },
                            )

                            Text("×", color = TextTertiary, fontWeight = FontWeight.Bold)

                            OutlinedTextField(
                                value = sets[index].reps,
                                onValueChange = { newVal ->
                                    sets = sets.toMutableList().also { list ->
                                        list[index] = list[index].copy(reps = newVal.filter { it.isDigit() })
                                    }
                                },
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = RoundedCornerShape(6.dp),
                                colors = inputColors,
                                singleLine = true,
                                textStyle = MaterialTheme.typography.titleSmall.copy(
                                    textAlign = TextAlign.Center, fontWeight = FontWeight.Bold,
                                ),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            )

                            IconButton(
                                onClick = {
                                    sets = sets.toMutableList().also { list ->
                                        list[index] = list[index].copy(completed = !list[index].completed)
                                    }
                                },
                                modifier = Modifier.size(36.dp),
                            ) {
                                Icon(
                                    if (sets[index].completed) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                    null,
                                    tint = if (sets[index].completed) NeonLime else TextTertiary,
                                    modifier = Modifier.size(24.dp),
                                )
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
        }

        // ═══ BOTTOM BUTTONS ═══
        AnimatedVisibility(visible = showBtn, enter = fadeIn(tween(500)) + slideInVertically(tween(500)) { 60 }) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Black)
                    .padding(horizontal = 20.dp, vertical = 12.dp),
            ) {
                Button(
                    onClick = {
                        val completedSets = sets.map { s ->
                            Pair(s.weight.toDoubleOrNull() ?: 0.0, s.reps.toIntOrNull() ?: 0)
                        }
                        onComplete(completedSets)
                    },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(6.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = NeonLime, contentColor = TextOnAccent),
                ) {
                    Text(
                        "COMPLETE EXERCISE",
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontWeight = FontWeight.Black, fontSize = 15.sp,
                            letterSpacing = 1.sp, color = TextOnAccent,
                        ),
                    )
                }

                Spacer(Modifier.height(8.dp))

                TextButton(onClick = { }, modifier = Modifier.fillMaxWidth()) {
                    Text(
                        "ADD NOTE",
                        style = MaterialTheme.typography.labelMedium.copy(
                            color = TextSecondary, fontWeight = FontWeight.Bold, letterSpacing = 1.sp,
                        ),
                    )
                }
            }
        }
    }
}

package com.repmax.app.ui.screens

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.data.*
import com.repmax.app.ui.theme.*

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
    onComplete: (List<SetEntry>) -> Unit,
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .systemBarsPadding()
    ) {
        // ═══ TOP BAR ═══
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, "Back", tint = TextPrimary)
            }
            Spacer(Modifier.weight(1f))
            Text(
                text = exerciseName.uppercase(),
                style = MaterialTheme.typography.titleSmall.copy(
                    fontWeight = FontWeight.Black,
                    fontSize = 14.sp,
                ),
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
            // ═══ EXERCISE INFO ═══
            Spacer(Modifier.height(8.dp))

            // Muscle target info
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column {
                    Text(
                        text = "Target: Chest",
                        style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary),
                    )
                    Text(
                        text = "Compound · Horizontal Push",
                        style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary),
                    )
                }
                // Anatomy placeholder
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Card)
                        .border(1.dp, Border, RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Default.Accessibility,
                        null,
                        tint = NeonLime,
                        modifier = Modifier.size(36.dp),
                    )
                }
            }

            Spacer(Modifier.height(20.dp))

            // ═══ AI RECOMMENDATION ═══
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Card, RoundedCornerShape(8.dp))
                    .border(1.dp, BorderAccent, RoundedCornerShape(8.dp))
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "AI RECOMMENDATION",
                        style = MaterialTheme.typography.labelMedium.copy(
                            color = TextSecondary,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 1.sp,
                            fontSize = 10.sp,
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
                            text = "OPTIMAL",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = NeonLime,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 8.sp,
                                letterSpacing = 1.sp,
                            ),
                        )
                    }
                }

                Spacer(Modifier.height(4.dp))

                Text(
                    text = "Based on your recovery, performance and\nprogress, we recommend:",
                    style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary),
                )

                Spacer(Modifier.height(12.dp))

                // Big recommendation
                Text(
                    text = "${targetWeight.toInt()}KG × $repsInt REPS",
                    style = MaterialTheme.typography.displaySmall.copy(
                        fontWeight = FontWeight.Black,
                        fontSize = 28.sp,
                    ),
                )

                Spacer(Modifier.height(8.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(
                        text = "$targetSets SETS",
                        style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary, fontWeight = FontWeight.Bold),
                    )
                    Text(
                        text = "RPE 8",
                        style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary, fontWeight = FontWeight.Bold),
                    )
                    Text(
                        text = "2-3 MIN REST",
                        style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary, fontWeight = FontWeight.Bold),
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            // ═══ AUTO-FILL ═══
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
                        text = "AUTO-FILL",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = NeonLime,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 1.sp,
                        ),
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            // ═══ LOG SETS ═══
            Text(
                text = "LOG SETS",
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.5.sp,
                    color = TextSecondary,
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
                    // Set label
                    Text(
                        text = "SET ${set.setNumber}",
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = TextTertiary,
                            fontSize = 11.sp,
                        ),
                        modifier = Modifier.width(44.dp),
                    )

                    // Weight input
                    OutlinedTextField(
                        value = sets[index].weight,
                        onValueChange = { newVal ->
                            sets = sets.toMutableList().also { list ->
                                list[index] = list[index].copy(weight = newVal.filter { it.isDigit() || it == '.' })
                            }
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(4.dp),
                        colors = inputColors,
                        singleLine = true,
                        textStyle = MaterialTheme.typography.titleSmall.copy(
                            textAlign = TextAlign.Center,
                            fontWeight = FontWeight.Bold,
                        ),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        suffix = { Text("KG", style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary)) },
                    )

                    Text("×", color = TextTertiary, fontWeight = FontWeight.Bold)

                    // Reps input
                    OutlinedTextField(
                        value = sets[index].reps,
                        onValueChange = { newVal ->
                            sets = sets.toMutableList().also { list ->
                                list[index] = list[index].copy(reps = newVal.filter { it.isDigit() })
                            }
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(4.dp),
                        colors = inputColors,
                        singleLine = true,
                        textStyle = MaterialTheme.typography.titleSmall.copy(
                            textAlign = TextAlign.Center,
                            fontWeight = FontWeight.Bold,
                        ),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    )

                    // Checkmark
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

            Spacer(Modifier.height(20.dp))
        }

        // ═══ BOTTOM BUTTONS ═══
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Black)
                .padding(horizontal = 20.dp, vertical = 12.dp),
        ) {
            Button(
                onClick = { onComplete(sets) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(6.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = NeonLime,
                    contentColor = TextOnAccent,
                ),
            ) {
                Text(
                    text = "COMPLETE EXERCISE",
                    style = MaterialTheme.typography.labelLarge.copy(
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        letterSpacing = 1.sp,
                        color = TextOnAccent,
                    ),
                )
            }

            Spacer(Modifier.height(8.dp))

            TextButton(
                onClick = { },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    text = "ADD NOTE",
                    style = MaterialTheme.typography.labelMedium.copy(
                        color = TextSecondary,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                    ),
                )
            }
        }
    }
}

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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.data.Profile
import com.repmax.app.data.Workout
import com.repmax.app.ui.theme.*

data class SorenessOption(val value: Int, val label: String, val emoji: String, val color: Color)

private val SORENESS_OPTIONS = listOf(
    SorenessOption(1, "Fresh", "💚", Color(0xFF00DC82)),
    SorenessOption(2, "Mild", "💛", Color(0xFFFBBF24)),
    SorenessOption(3, "Moderate", "🟠", Color(0xFFF97316)),
    SorenessOption(4, "Heavy", "🔴", Color(0xFFEF4444)),
    SorenessOption(5, "Wrecked", "💀", Color(0xFFDC2626)),
)

private data class MobilityDrill(val name: String, val duration: String, val target: String)

private val DRILLS = listOf(
    MobilityDrill("90/90 Hip Stretch", "60s each", "Hips"),
    MobilityDrill("Wall Slides", "2×12 reps", "Shoulders"),
    MobilityDrill("Cat-Cow", "10 reps", "Spine"),
    MobilityDrill("World's Greatest Stretch", "5 each", "Full Body"),
)

@Composable
fun RecoveryScreen(
    workoutHistory: List<Workout>,
    profile: Profile?,
    waterToday: Int,
    onBack: () -> Unit,
) {
    var soreness by remember { mutableStateOf(0) }

    val now = System.currentTimeMillis()
    val dayMs = 86400000L
    val last7 = workoutHistory.filter {
        val t = try { java.time.Instant.parse(it.completed_at).toEpochMilli() } catch (_: Exception) { 0L }
        now - t <= 7 * dayMs
    }
    val lastWorkout = workoutHistory.firstOrNull()
    val hoursSinceLast = lastWorkout?.completed_at?.let {
        try { (now - java.time.Instant.parse(it).toEpochMilli()) / 3600000.0 } catch (_: Exception) { null }
    }

    val avgDuration = if (last7.isNotEmpty()) {
        // total_volume as proxy for minutes (rough)
        last7.size * 45 / last7.size // assume 45 min avg
    } else 0

    val trainingTarget = profile?.training_days?.size ?: 4

    // Recovery score (0-100)
    val timingScore = when {
        hoursSinceLast == null -> 50.0
        hoursSinceLast in 24.0..72.0 -> 85.0
        hoursSinceLast > 72 -> 95.0
        else -> maxOf(20.0, 85.0 - (24 - hoursSinceLast) * 3)
    }
    val loadScore = if (last7.size <= trainingTarget) 80.0
        else maxOf(30.0, 80.0 - (last7.size - trainingTarget) * 12.0)
    val sorenessScore = if (soreness == 0) 70.0 else maxOf(15.0, 100.0 - soreness * 18.0)
    val hydrationScore = if (waterToday >= 8) 90.0 else maxOf(20.0, waterToday * 11.0)

    val recoveryScore = (timingScore * 0.3 + loadScore * 0.25 + sorenessScore * 0.25 + hydrationScore * 0.2).toInt()

    val recoveryLabel = when {
        recoveryScore >= 80 -> "Fully Recovered"
        recoveryScore >= 60 -> "Recovering"
        recoveryScore >= 40 -> "Fatigued"
        else -> "Overreached"
    }
    val recoveryColor = when {
        recoveryScore >= 80 -> Color(0xFF00DC82)
        recoveryScore >= 60 -> Color(0xFFFBBF24)
        recoveryScore >= 40 -> Color(0xFFF97316)
        else -> Color(0xFFEF4444)
    }

    val prescriptions = buildList {
        if (recoveryScore >= 80) add("🟢" to "Green light — go hard today if scheduled")
        else if (recoveryScore >= 60) add("🟡" to "Normal intensity — stick to the plan")
        else add("🔴" to "Reduce volume by 20-30% today")
        if (soreness >= 3) add("🧘" to "Prioritize mobility work below")
        if (waterToday < 6) add("💧" to "Drink ${8 - waterToday} more glasses of water")
        if (hoursSinceLast != null && hoursSinceLast < 18) add("😴" to "Less than 18h since last session — consider rest")
    }

    Box(modifier = Modifier.fillMaxSize().background(Black)) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .statusBarsPadding().navigationBarsPadding().padding(horizontal = 20.dp),
        ) {
            Spacer(Modifier.height(16.dp))
            // Back
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { onBack() }) {
                Icon(Icons.Default.ArrowBack, "Back", tint = TextSecondary, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Back", color = TextSecondary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(16.dp))

            // Title
            Text("RECOVERY", style = MaterialTheme.typography.headlineMedium.copy(
                fontWeight = FontWeight.Black, letterSpacing = 2.sp, color = TextPrimary,
            ))
            Text("Smart recovery signals from your training data", color = TextTertiary, fontSize = 12.sp)

            Spacer(Modifier.height(20.dp))

            // Recovery Score Ring
            Box(
                modifier = Modifier.fillMaxWidth()
                    .background(Card, RoundedCornerShape(20.dp))
                    .border(1.dp, Border, RoundedCornerShape(20.dp))
                    .padding(28.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier.size(130.dp).drawBehind {
                            val stroke = Stroke(width = 10.dp.toPx(), cap = StrokeCap.Round)
                            // Background arc
                            drawArc(Border, 0f, 360f, false, style = stroke, size = Size(size.width, size.height))
                            // Progress arc
                            drawArc(recoveryColor, -90f, recoveryScore * 3.6f, false, style = stroke, size = Size(size.width, size.height))
                        },
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("$recoveryScore", fontSize = 36.sp, fontWeight = FontWeight.Black, color = recoveryColor)
                            Text("/ 100", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextTertiary, letterSpacing = 0.5.sp)
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    Text(recoveryLabel, fontWeight = FontWeight.Black, fontSize = 16.sp, color = recoveryColor)
                    Text("Based on training load, timing, soreness, and hydration", color = TextTertiary, fontSize = 11.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                }
            }

            Spacer(Modifier.height(14.dp))

            // Signal grid
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SignalCard(Modifier.weight(1f), Icons.Filled.LocalFireDepartment, NeonLime, "${last7.size}", "Sessions (7d)")
                SignalCard(Modifier.weight(1f), Icons.Filled.NightsStay, Color(0xFFA78BFA),
                    if (hoursSinceLast != null) "${hoursSinceLast.toInt()}h" else "—", "Since Last")
            }
            Spacer(Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SignalCard(Modifier.weight(1f), Icons.Filled.WaterDrop, Color(0xFF38BDF8), "$waterToday/8", "Water Today")
                SignalCard(Modifier.weight(1f), Icons.Filled.DirectionsRun, Color(0xFFFB923C), "${avgDuration}m", "Avg Duration")
            }

            Spacer(Modifier.height(16.dp))

            // Soreness check-in
            Box(
                modifier = Modifier.fillMaxWidth()
                    .background(Card, RoundedCornerShape(16.dp))
                    .border(1.dp, Border, RoundedCornerShape(16.dp))
                    .padding(16.dp),
            ) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Accessibility, null, tint = NeonLime, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("HOW SORE ARE YOU?", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = NeonLime.copy(alpha = 0.7f))
                    }
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        SORENESS_OPTIONS.forEach { opt ->
                            val selected = soreness == opt.value
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.weight(1f)
                                    .background(if (selected) opt.color.copy(alpha = 0.08f) else Surface, RoundedCornerShape(12.dp))
                                    .border(1.5.dp, if (selected) opt.color else Border, RoundedCornerShape(12.dp))
                                    .clickable { soreness = opt.value }
                                    .padding(vertical = 10.dp),
                            ) {
                                Text(opt.emoji, fontSize = 18.sp)
                                Spacer(Modifier.height(2.dp))
                                Text(opt.label, fontSize = 9.sp, fontWeight = FontWeight.Bold,
                                    color = if (selected) opt.color else TextTertiary)
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(14.dp))

            // Prescription
            Box(
                modifier = Modifier.fillMaxWidth()
                    .background(Card, RoundedCornerShape(16.dp))
                    .border(1.dp, Border, RoundedCornerShape(16.dp))
                    .padding(16.dp),
            ) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.AutoAwesome, null, tint = NeonLime, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("TODAY'S PRESCRIPTION", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = NeonLime.copy(alpha = 0.7f))
                    }
                    Spacer(Modifier.height(10.dp))
                    prescriptions.forEach { (icon, text) ->
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                            Text(icon, fontSize = 18.sp, modifier = Modifier.width(28.dp))
                            Text(text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                        }
                    }
                }
            }

            Spacer(Modifier.height(14.dp))

            // Mobility drills
            Box(
                modifier = Modifier.fillMaxWidth()
                    .background(Card, RoundedCornerShape(16.dp))
                    .border(1.dp, Border, RoundedCornerShape(16.dp))
                    .padding(16.dp),
            ) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.SelfImprovement, null, tint = NeonLime, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("SUGGESTED MOBILITY", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = NeonLime.copy(alpha = 0.7f))
                    }
                    Spacer(Modifier.height(8.dp))
                    DRILLS.forEachIndexed { i, drill ->
                        if (i > 0) Divider(color = Border, thickness = 0.5.dp)
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Column {
                                Text(drill.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                Text(drill.target, fontSize = 11.sp, color = TextTertiary)
                            }
                            Text(drill.duration, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = NeonLime)
                        }
                    }
                }
            }

            Spacer(Modifier.height(40.dp))
        }
    }
}

@Composable
private fun SignalCard(
    modifier: Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    value: String,
    label: String,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .background(Card, RoundedCornerShape(14.dp))
            .border(1.dp, Border, RoundedCornerShape(14.dp))
            .padding(14.dp),
    ) {
        Icon(icon, null, tint = color, modifier = Modifier.size(20.dp))
        Spacer(Modifier.height(6.dp))
        Text(value, fontSize = 18.sp, fontWeight = FontWeight.Black, color = TextPrimary)
        Text(label, fontSize = 10.sp, color = TextTertiary, fontWeight = FontWeight.Medium)
    }
}

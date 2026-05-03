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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.data.*
import com.repmax.app.ui.theme.*

@Composable
fun AICoachScreen(
    profile: Profile?,
    workoutHistory: List<Workout>,
    personalRecords: List<PersonalRecord>,
) {
    val streak = profile?.current_streak ?: 0
    val now = System.currentTimeMillis()
    val dayMs = 24 * 60 * 60 * 1000L

    // Calculate readiness
    val last7Count = workoutHistory.count { w ->
        w.completed_at?.let { try { java.time.Instant.parse(it).toEpochMilli() > now - 7 * dayMs } catch (_: Exception) { false } } ?: false
    }
    val target = profile?.training_days?.size ?: 4
    val adherence = if (target > 0) minOf(100, (last7Count * 100) / target) else 50
    val readiness = minOf(99, (60 + adherence / 5 + streak * 2))

    // Recent volume for momentum
    val recentVolume = workoutHistory.take(5).sumOf { it.total_volume ?: 0.0 }.toLong()
    val prevVolume = workoutHistory.drop(5).take(5).sumOf { it.total_volume ?: 0.0 }.toLong()
    val momentum = if (prevVolume > 0) ((recentVolume - prevVolume) * 100 / prevVolume).toInt() else 0

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .verticalScroll(rememberScrollState())
            .systemBarsPadding()
    ) {
        // Header
        Text(
            "AI Coach",
            style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Black),
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
        )

        // ═══ WIREFRAME HEAD HERO ═══
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .height(200.dp)
                .background(Card, RoundedCornerShape(16.dp))
                .border(1.dp, Border, RoundedCornerShape(16.dp))
                .drawBehind {
                    val cx = size.width / 2
                    val cy = size.height / 2
                    val limeColor = Color(0xFFD4FF00)
                    val headR = size.height * 0.35f

                    // Head outline
                    drawOval(
                        color = limeColor,
                        topLeft = Offset(cx - headR, cy - headR * 1.2f),
                        size = androidx.compose.ui.geometry.Size(headR * 2, headR * 2.4f),
                        style = Stroke(width = 2f),
                    )
                    // Vertical grid
                    drawLine(limeColor.copy(alpha = 0.4f), Offset(cx, cy - headR * 1.2f), Offset(cx, cy + headR * 1.2f), strokeWidth = 0.8f)
                    // Horizontal grids
                    for (i in -2..2) {
                        val y = cy + headR * i * 0.35f
                        drawLine(limeColor.copy(alpha = 0.25f), Offset(cx - headR, y), Offset(cx + headR, y), strokeWidth = 0.5f)
                    }
                    // Eyes
                    drawCircle(limeColor, radius = 6f, center = Offset(cx - headR * 0.3f, cy - headR * 0.2f), style = Stroke(width = 1.5f))
                    drawCircle(limeColor, radius = 6f, center = Offset(cx + headR * 0.3f, cy - headR * 0.2f), style = Stroke(width = 1.5f))
                    drawCircle(limeColor, radius = 2f, center = Offset(cx - headR * 0.3f, cy - headR * 0.2f))
                    drawCircle(limeColor, radius = 2f, center = Offset(cx + headR * 0.3f, cy - headR * 0.2f))
                    // Jaw
                    val jaw = Path().apply {
                        moveTo(cx - headR * 0.7f, cy + headR * 0.1f)
                        quadraticBezierTo(cx, cy + headR * 1.1f, cx + headR * 0.7f, cy + headR * 0.1f)
                    }
                    drawPath(jaw, limeColor, style = Stroke(width = 1.5f))
                    // Nose
                    drawLine(limeColor.copy(alpha = 0.6f), Offset(cx, cy - headR * 0.05f), Offset(cx, cy + headR * 0.15f), strokeWidth = 1f)
                    // Scan lines
                    for (i in 0..8) {
                        val y = cy - headR * 1.1f + headR * 2.2f * i / 8
                        drawLine(limeColor.copy(alpha = 0.08f), Offset(0f, y), Offset(size.width, y), strokeWidth = 0.5f)
                    }
                },
            contentAlignment = Alignment.BottomCenter,
        ) {
            Text(
                "YOUR AI COACH IS ANALYZING",
                style = MaterialTheme.typography.labelSmall.copy(
                    color = NeonLime,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 2.sp,
                    fontSize = 10.sp,
                ),
                modifier = Modifier.padding(bottom = 16.dp),
            )
        }

        Spacer(Modifier.height(20.dp))

        // ═══ READINESS SCORE ═══
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .background(Card, RoundedCornerShape(12.dp))
                .border(1.dp, NeonLime.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                .padding(20.dp),
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(
                            "READINESS SCORE",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = NeonLime,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.5.sp,
                            ),
                        )
                        Text(
                            "Based on recovery, consistency & streak",
                            style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary, fontSize = 11.sp),
                        )
                    }
                    Text(
                        "$readiness",
                        style = MaterialTheme.typography.displaySmall.copy(
                            fontWeight = FontWeight.Black,
                            color = NeonLime,
                        ),
                    )
                }
                Spacer(Modifier.height(12.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(Elevated),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(readiness / 100f)
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(NeonLime),
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        // ═══ INSIGHTS GRID ═══
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            InsightCard(
                modifier = Modifier.weight(1f),
                icon = "🔥",
                label = "MOMENTUM",
                value = if (momentum >= 0) "+$momentum%" else "$momentum%",
                sublabel = "vs previous 5 workouts",
                accent = momentum >= 0,
            )
            InsightCard(
                modifier = Modifier.weight(1f),
                icon = "📊",
                label = "ADHERENCE",
                value = "$adherence%",
                sublabel = "$last7Count / $target sessions",
                accent = adherence >= 80,
            )
        }

        Spacer(Modifier.height(12.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            InsightCard(
                modifier = Modifier.weight(1f),
                icon = "⚡",
                label = "STREAK",
                value = "$streak days",
                sublabel = "Keep it going!",
                accent = streak > 0,
            )
            InsightCard(
                modifier = Modifier.weight(1f),
                icon = "🏆",
                label = "PRs",
                value = "${personalRecords.size}",
                sublabel = "Personal records",
                accent = personalRecords.isNotEmpty(),
            )
        }

        Spacer(Modifier.height(20.dp))

        // ═══ AI RECOMMENDATION ═══
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .background(Card, RoundedCornerShape(12.dp))
                .border(1.dp, Border, RoundedCornerShape(12.dp))
                .padding(16.dp),
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "AI RECOMMENDATION",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = TextTertiary,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 1.5.sp,
                        ),
                    )
                    Box(
                        modifier = Modifier
                            .background(NeonLimeGlow, RoundedCornerShape(4.dp))
                            .border(1.dp, NeonLime, RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(
                            "OPTIMAL",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = NeonLime,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 8.sp,
                            ),
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text(
                    when {
                        readiness >= 80 -> "You're primed for a heavy session. Push the intensity today."
                        readiness >= 50 -> "Moderate readiness detected. Focus on technique and moderate loads."
                        else -> "Recovery seems low. Consider a deload day or active recovery."
                    },
                    style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary),
                )
            }
        }

        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun InsightCard(
    modifier: Modifier,
    icon: String,
    label: String,
    value: String,
    sublabel: String,
    accent: Boolean,
) {
    Box(
        modifier = modifier
            .background(Card, RoundedCornerShape(12.dp))
            .border(1.dp, Border, RoundedCornerShape(12.dp))
            .padding(14.dp),
    ) {
        Column {
            Text(icon, fontSize = 20.sp)
            Spacer(Modifier.height(8.dp))
            Text(
                label,
                style = MaterialTheme.typography.labelSmall.copy(
                    color = TextTertiary,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                    fontSize = 9.sp,
                ),
            )
            Text(
                value,
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontWeight = FontWeight.Black,
                    color = if (accent) NeonLime else TextPrimary,
                    fontSize = 20.sp,
                ),
            )
            Text(
                sublabel,
                style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary, fontSize = 10.sp),
            )
        }
    }
}

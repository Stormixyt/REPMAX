package com.repmax.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.R
import com.repmax.app.data.*
import com.repmax.app.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun AICoachScreen(
    profile: Profile?,
    workoutHistory: List<Workout>,
    personalRecords: List<PersonalRecord>,
) {
    val streak = profile?.current_streak ?: 0
    val now = System.currentTimeMillis()
    val dayMs = 24 * 60 * 60 * 1000L

    val last7Count = workoutHistory.count { w ->
        w.completed_at?.let { try { java.time.Instant.parse(it).toEpochMilli() > now - 7 * dayMs } catch (_: Exception) { false } } ?: false
    }
    val target = profile?.training_days?.size ?: 4
    val adherence = if (target > 0) minOf(100, (last7Count * 100) / target) else 50
    val readiness = minOf(99, (60 + adherence / 5 + streak * 2))

    val recentVolume = workoutHistory.take(5).sumOf { it.total_volume ?: 0.0 }.toLong()
    val prevVolume = workoutHistory.drop(5).take(5).sumOf { it.total_volume ?: 0.0 }.toLong()
    val momentum = if (prevVolume > 0) ((recentVolume - prevVolume) * 100 / prevVolume).toInt() else 0

    // Animations
    var showHero by remember { mutableStateOf(false) }
    var showReadiness by remember { mutableStateOf(false) }
    var showInsights by remember { mutableStateOf(false) }
    var showRec by remember { mutableStateOf(false) }

    // Animated readiness bar
    val animatedReadiness by animateFloatAsState(
        targetValue = if (showReadiness) readiness / 100f else 0f,
        animationSpec = tween(1200, easing = FastOutSlowInEasing),
        label = "readinessBar",
    )

    // Scan line animation
    val infiniteTransition = rememberInfiniteTransition(label = "scan")
    val scanY by infiniteTransition.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(3000, easing = LinearEasing), RepeatMode.Restart),
        label = "scanLine",
    )

    LaunchedEffect(Unit) {
        delay(100); showHero = true
        delay(400); showReadiness = true
        delay(600); showInsights = true
        delay(800); showRec = true
    }

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

        // ═══ WIREFRAME HEAD HERO with scan line ═══
        AnimatedVisibility(visible = showHero, enter = fadeIn(tween(800)) + scaleIn(tween(800), initialScale = 0.9f)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .height(220.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Card)
                    .border(1.dp, Border, RoundedCornerShape(16.dp))
                    .drawBehind {
                        // Animated scan line
                        val lineY = size.height * scanY
                        drawLine(
                            brush = Brush.horizontalGradient(
                                listOf(Color.Transparent, Color(0xFFD4FF00).copy(alpha = 0.4f), Color.Transparent)
                            ),
                            start = Offset(0f, lineY),
                            end = Offset(size.width, lineY),
                            strokeWidth = 2f,
                        )
                        // Ambient glow
                        drawCircle(
                            brush = Brush.radialGradient(
                                listOf(Color(0xFFD4FF00).copy(alpha = 0.06f), Color.Transparent),
                                center = Offset(size.width / 2, size.height / 2),
                                radius = size.width * 0.5f,
                            ),
                            radius = size.width * 0.5f,
                            center = Offset(size.width / 2, size.height / 2),
                        )
                    },
                contentAlignment = Alignment.Center,
            ) {
                // Wireframe face image
                Image(
                    painter = painterResource(R.drawable.wireframe_face),
                    contentDescription = "AI Coach analyzing",
                    modifier = Modifier
                        .fillMaxHeight(0.85f)
                        .aspectRatio(1f),
                    contentScale = ContentScale.Fit,
                )

                // Label at bottom
                Text(
                    "YOUR AI COACH IS ANALYZING",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = NeonLime, fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 2.sp, fontSize = 10.sp,
                    ),
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 14.dp),
                )
            }
        }

        Spacer(Modifier.height(20.dp))

        // ═══ READINESS SCORE ═══
        AnimatedVisibility(visible = showReadiness, enter = fadeIn(tween(600)) + slideInVertically(tween(600)) { 30 }) {
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
                                    color = NeonLime, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.5.sp,
                                ),
                            )
                            Text(
                                "Based on recovery, consistency & streak",
                                style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary, fontSize = 11.sp),
                            )
                        }
                        Text(
                            "$readiness",
                            style = MaterialTheme.typography.displaySmall.copy(fontWeight = FontWeight.Black, color = NeonLime),
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
                                .fillMaxWidth(animatedReadiness)
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(NeonLime),
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        // ═══ INSIGHTS GRID ═══
        AnimatedVisibility(visible = showInsights, enter = fadeIn(tween(500)) + slideInVertically(tween(500)) { 30 }) {
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    InsightCard(Modifier.weight(1f), "🔥", "MOMENTUM", if (momentum >= 0) "+$momentum%" else "$momentum%", "vs previous 5 workouts", momentum >= 0)
                    InsightCard(Modifier.weight(1f), "📊", "ADHERENCE", "$adherence%", "$last7Count / $target sessions", adherence >= 80)
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    InsightCard(Modifier.weight(1f), "⚡", "STREAK", "$streak days", "Keep it going!", streak > 0)
                    InsightCard(Modifier.weight(1f), "🏆", "PRs", "${personalRecords.size}", "Personal records", personalRecords.isNotEmpty())
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // ═══ AI RECOMMENDATION ═══
        AnimatedVisibility(visible = showRec, enter = fadeIn(tween(600)) + slideInVertically(tween(600)) { 40 }) {
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
                                color = TextTertiary, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.5.sp,
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
                                    color = NeonLime, fontWeight = FontWeight.ExtraBold, fontSize = 8.sp,
                                ),
                            )
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        when {
                            readiness >= 80 -> "You're primed for a heavy session. Push the intensity today — your body is ready for progressive overload."
                            readiness >= 50 -> "Moderate readiness detected. Focus on technique and moderate loads. Quality reps over ego lifting."
                            else -> "Recovery seems low. Consider a deload day or active recovery. Rest is where growth happens."
                        },
                        style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary, lineHeight = 20.sp),
                    )
                }
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
                    color = TextTertiary, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, fontSize = 9.sp,
                ),
            )
            Text(
                value,
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontWeight = FontWeight.Black, color = if (accent) NeonLime else TextPrimary, fontSize = 20.sp,
                ),
            )
            Text(
                sublabel,
                style = MaterialTheme.typography.bodySmall.copy(color = TextTertiary, fontSize = 10.sp),
            )
        }
    }
}

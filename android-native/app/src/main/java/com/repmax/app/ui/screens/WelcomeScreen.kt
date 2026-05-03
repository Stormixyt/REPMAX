package com.repmax.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun WelcomeScreen(
    onGetStarted: () -> Unit,
    onLogin: () -> Unit,
) {
    // Staggered animation states
    var showLogo by remember { mutableStateOf(false) }
    var showHeadline by remember { mutableStateOf(false) }
    var showBadges by remember { mutableStateOf(false) }
    var showButtons by remember { mutableStateOf(false) }
    var showFooter by remember { mutableStateOf(false) }

    // Animated glow pulse
    val infiniteTransition = rememberInfiniteTransition(label = "glow")
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.06f,
        targetValue = 0.14f,
        animationSpec = infiniteRepeatable(
            animation = tween(3000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "glowPulse",
    )

    LaunchedEffect(Unit) {
        delay(100); showLogo = true
        delay(300); showHeadline = true
        delay(400); showBadges = true
        delay(500); showButtons = true
        delay(600); showFooter = true
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .drawBehind {
                // Animated radial lime glow at top-right
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color(0xFFD4FF00).copy(alpha = glowAlpha), Color.Transparent),
                        center = Offset(size.width * 0.85f, size.height * 0.08f),
                        radius = size.width * 0.7f,
                    ),
                    radius = size.width * 0.7f,
                    center = Offset(size.width * 0.85f, size.height * 0.08f),
                )
                // Secondary glow bottom-left
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color(0xFFD4FF00).copy(alpha = glowAlpha * 0.3f), Color.Transparent),
                        center = Offset(size.width * 0.1f, size.height * 0.85f),
                        radius = size.width * 0.5f,
                    ),
                    radius = size.width * 0.5f,
                    center = Offset(size.width * 0.1f, size.height * 0.85f),
                )
            }
            .systemBarsPadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 28.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Spacer(modifier = Modifier.height(40.dp))

            // ═══ LOGO + HERO ═══
            Column {
                // "repmax." logo — slides in from left + fades
                AnimatedVisibility(
                    visible = showLogo,
                    enter = fadeIn(tween(600)) + slideInHorizontally(tween(600)) { -80 },
                ) {
                    Text(
                        text = "repmax.",
                        style = MaterialTheme.typography.displayMedium.copy(
                            color = NeonLime,
                            fontStyle = FontStyle.Italic,
                            fontWeight = FontWeight.Black,
                            fontSize = 38.sp,
                        ),
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                // "DISCIPLINE BEATS TALENT." — each word cascades in
                AnimatedVisibility(
                    visible = showHeadline,
                    enter = fadeIn(tween(800)) + slideInVertically(tween(800)) { 60 },
                ) {
                    Text(
                        text = "DISCIPLINE\nBEATS\nTALENT.",
                        style = MaterialTheme.typography.displayLarge.copy(
                            fontWeight = FontWeight.Black,
                            fontSize = 48.sp,
                            lineHeight = 50.sp,
                            color = TextPrimary,
                        ),
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Train Smarter / Get Stronger badges
                AnimatedVisibility(
                    visible = showBadges,
                    enter = fadeIn(tween(600)),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Column(horizontalAlignment = Alignment.Start) {
                            Text("┌─", color = TextTertiary, fontSize = 12.sp)
                            Text(
                                "TRAIN",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.ExtraBold, letterSpacing = 1.5.sp, color = TextSecondary,
                                ),
                            )
                            Text(
                                "SMARTER.",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.ExtraBold, letterSpacing = 1.5.sp, color = NeonLime,
                                ),
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("─┐", color = TextTertiary, fontSize = 12.sp, textAlign = TextAlign.End)
                            Text(
                                "GET",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.ExtraBold, letterSpacing = 1.5.sp, color = TextSecondary,
                                ),
                            )
                            Text(
                                "STRONGER.",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.ExtraBold, letterSpacing = 1.5.sp, color = NeonLime,
                                ),
                            )
                        }
                    }
                }
            }

            // ═══ CTAs + FOOTER ═══
            Column(
                modifier = Modifier.padding(bottom = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                AnimatedVisibility(
                    visible = showButtons,
                    enter = fadeIn(tween(600)) + slideInVertically(tween(600)) { 40 },
                ) {
                    Column {
                        Button(
                            onClick = onGetStarted,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp),
                            shape = RoundedCornerShape(6.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = NeonLime, contentColor = TextOnAccent),
                        ) {
                            Text(
                                "LET'S GET TO WORK",
                                style = MaterialTheme.typography.labelLarge.copy(
                                    fontWeight = FontWeight.Black, fontSize = 15.sp, letterSpacing = 1.sp, color = TextOnAccent,
                                ),
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedButton(
                            onClick = onLogin,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp),
                            shape = RoundedCornerShape(6.dp),
                            border = BorderStroke(1.dp, Border),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary),
                        ) {
                            Text(
                                "LOG IN",
                                style = MaterialTheme.typography.labelLarge.copy(
                                    fontWeight = FontWeight.Bold, fontSize = 15.sp, letterSpacing = 1.sp, color = TextPrimary,
                                ),
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                AnimatedVisibility(
                    visible = showFooter,
                    enter = fadeIn(tween(800)),
                ) {
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "BUILT DIFFERENT.",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold, letterSpacing = 2.sp, color = TextTertiary,
                            ),
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            "MADE TO WIN.",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold, letterSpacing = 2.sp, color = TextTertiary,
                            ),
                        )
                    }
                }
            }
        }
    }
}

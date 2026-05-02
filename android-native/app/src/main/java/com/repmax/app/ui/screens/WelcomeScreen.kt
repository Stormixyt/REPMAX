package com.repmax.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.ui.theme.*

@Composable
fun WelcomeScreen(
    onGetStarted: () -> Unit,
    onLogin: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Black)
            .drawBehind {
                // Subtle radial lime glow at top-right
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color(0x12D4FF00), Color.Transparent),
                        center = Offset(size.width * 0.85f, size.height * 0.08f),
                        radius = size.width * 0.6f
                    ),
                    radius = size.width * 0.6f,
                    center = Offset(size.width * 0.85f, size.height * 0.08f)
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

            // Logo + Tagline section
            Column {
                // "repmax." logo
                Text(
                    text = "repmax.",
                    style = MaterialTheme.typography.displayMedium.copy(
                        color = NeonLime,
                        fontStyle = FontStyle.Italic,
                        fontWeight = FontWeight.Black,
                        fontSize = 38.sp,
                    ),
                )

                Spacer(modifier = Modifier.height(32.dp))

                // "DISCIPLINE BEATS TALENT."
                Text(
                    text = "DISCIPLINE\nBEATS\nTALENT.",
                    style = MaterialTheme.typography.displayLarge.copy(
                        fontWeight = FontWeight.Black,
                        fontSize = 48.sp,
                        lineHeight = 50.sp,
                        color = TextPrimary,
                    ),
                )

                Spacer(modifier = Modifier.height(32.dp))

                // Train Smarter / Get Stronger badges
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column(horizontalAlignment = Alignment.Start) {
                        Text(
                            text = "┌─",
                            color = TextTertiary,
                            fontSize = 12.sp,
                        )
                        Text(
                            text = "TRAIN",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.5.sp,
                                color = TextSecondary,
                            ),
                        )
                        Text(
                            text = "SMARTER.",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.5.sp,
                                color = NeonLime,
                            ),
                        )
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "─┐",
                            color = TextTertiary,
                            fontSize = 12.sp,
                            textAlign = TextAlign.End,
                        )
                        Text(
                            text = "GET",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.5.sp,
                                color = TextSecondary,
                            ),
                        )
                        Text(
                            text = "STRONGER.",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.5.sp,
                                color = NeonLime,
                            ),
                        )
                    }
                }
            }

            // Bottom section: CTAs + footer
            Column(
                modifier = Modifier.padding(bottom = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // "LET'S GET TO WORK" button
                Button(
                    onClick = onGetStarted,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(6.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NeonLime,
                        contentColor = TextOnAccent,
                    ),
                ) {
                    Text(
                        text = "LET'S GET TO WORK",
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontWeight = FontWeight.Black,
                            fontSize = 15.sp,
                            letterSpacing = 1.sp,
                            color = TextOnAccent,
                        ),
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // "LOG IN" outlined button
                OutlinedButton(
                    onClick = onLogin,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(6.dp),
                    border = ButtonDefaults.outlinedButtonBorder(true),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = TextPrimary,
                    ),
                ) {
                    Text(
                        text = "LOG IN",
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            letterSpacing = 1.sp,
                            color = TextPrimary,
                        ),
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Footer
                Row(
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = "BUILT DIFFERENT.",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 2.sp,
                            color = TextTertiary,
                        ),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "MADE TO WIN.",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 2.sp,
                            color = TextTertiary,
                        ),
                    )
                }
            }
        }
    }
}

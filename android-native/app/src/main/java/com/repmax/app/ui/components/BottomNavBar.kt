package com.repmax.app.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.ui.theme.*

data class NavItem(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val activeIcon: ImageVector,
)

val bottomNavItems = listOf(
    NavItem("home", "HOME", Icons.Outlined.Home, Icons.Filled.Home),
    NavItem("workouts", "WORKOUTS", Icons.Outlined.FitnessCenter, Icons.Filled.FitnessCenter),
    NavItem("progress", "PROGRESS", Icons.Outlined.BarChart, Icons.Filled.BarChart),
    NavItem("ai", "AI COACH", Icons.Outlined.Psychology, Icons.Filled.Psychology),
    NavItem("profile", "PROFILE", Icons.Outlined.Person, Icons.Filled.Person),
)

@Composable
fun RepMaxBottomBar(
    currentRoute: String,
    onNavigate: (String) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Black)
            .border(width = 1.dp, color = Border)
            .padding(vertical = 6.dp)
            .navigationBarsPadding(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        bottomNavItems.forEach { item ->
            val isActive = currentRoute == item.route
            val icon = if (isActive) item.activeIcon else item.icon

            // Tap animation
            val scale by animateFloatAsState(
                targetValue = if (isActive) 1.1f else 1f,
                animationSpec = spring(dampingRatio = 0.5f, stiffness = 400f),
                label = "navScale_${item.route}",
            )

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .weight(1f)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { onNavigate(item.route) }
                    .padding(vertical = 4.dp),
            ) {
                // Active indicator dot
                Box(
                    modifier = Modifier
                        .width(if (isActive) 16.dp else 0.dp)
                        .height(3.dp)
                        .background(
                            if (isActive) NeonLime else androidx.compose.ui.graphics.Color.Transparent,
                            RoundedCornerShape(1.5.dp),
                        ),
                )
                Spacer(Modifier.height(4.dp))

                Icon(
                    imageVector = icon,
                    contentDescription = item.label,
                    tint = if (isActive) NeonLime else TextTertiary,
                    modifier = Modifier
                        .size(22.dp)
                        .scale(scale),
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = item.label,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 9.sp,
                        fontWeight = if (isActive) FontWeight.ExtraBold else FontWeight.Medium,
                        letterSpacing = 0.5.sp,
                        color = if (isActive) NeonLime else TextTertiary,
                    ),
                )
            }
        }
    }
}

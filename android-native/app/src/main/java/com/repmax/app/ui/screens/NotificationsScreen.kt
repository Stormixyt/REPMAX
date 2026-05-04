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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.data.Notification
import com.repmax.app.data.SupabaseClient
import com.repmax.app.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private fun getNotifIcon(type: String?): ImageVector = when (type) {
    "friend_request", "friend_accepted" -> Icons.Filled.Favorite
    "nudge" -> Icons.Filled.Bolt
    "invite", "invite_accepted", "invite_declined" -> Icons.Filled.SportsKabaddi
    "incoming_call" -> Icons.Filled.Phone
    "daily_reminder", "session_reminder" -> Icons.Filled.CalendarToday
    "streak_warning" -> Icons.Filled.LocalFireDepartment
    "new_pr", "weekly_progress" -> Icons.Filled.EmojiEvents
    else -> Icons.Filled.Notifications
}

private fun getNotifColor(type: String?): Color = when (type) {
    "friend_request", "friend_accepted" -> Color(0xFFFF6B9D)
    "nudge", "streak_warning" -> Color(0xFFFBBF24)
    "invite", "invite_accepted" -> NeonLime
    "incoming_call" -> Color(0xFF38BDF8)
    "new_pr", "weekly_progress" -> Color(0xFFA78BFA)
    else -> TextTertiary
}

private fun timeAgo(dateStr: String?): String {
    if (dateStr == null) return ""
    return try {
        val date = java.time.Instant.parse(dateStr)
        val mins = java.time.Duration.between(date, java.time.Instant.now()).toMinutes()
        when {
            mins < 1 -> "just now"
            mins < 60 -> "${mins}m ago"
            mins < 1440 -> "${mins / 60}h ago"
            mins < 10080 -> "${mins / 1440}d ago"
            else -> {
                val ld = date.atZone(java.time.ZoneId.systemDefault()).toLocalDate()
                "${ld.month.name.take(3)} ${ld.dayOfMonth}"
            }
        }
    } catch (_: Exception) { "" }
}

@Composable
fun NotificationsScreen(supabase: SupabaseClient, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var notifications by remember { mutableStateOf<List<Notification>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            supabase.getNotifications().onSuccess {
                withContext(Dispatchers.Main) { notifications = it }
            }
        }
        loading = false
    }

    val unreadCount = notifications.count { !it.read }

    Box(modifier = Modifier.fillMaxSize().background(Black)) {
        Column(
            modifier = Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()
        ) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable { onBack() },
                ) {
                    Icon(Icons.Default.ArrowBack, "Back", tint = TextSecondary, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Back", color = TextSecondary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "NOTIFICATIONS",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.Black, letterSpacing = 2.sp, color = TextPrimary,
                    ),
                )
                if (unreadCount > 0) {
                    TextButton(
                        onClick = {
                            scope.launch(Dispatchers.IO) {
                                supabase.markAllNotificationsRead()
                                withContext(Dispatchers.Main) {
                                    notifications = notifications.map { it.copy(read = true) }
                                }
                            }
                        },
                        colors = ButtonDefaults.textButtonColors(contentColor = NeonLime),
                    ) {
                        Icon(Icons.Default.DoneAll, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Mark all", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            when {
                loading -> Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                    repeat(4) {
                        Box(
                            modifier = Modifier.fillMaxWidth().height(72.dp)
                                .padding(vertical = 4.dp)
                                .background(Surface, RoundedCornerShape(12.dp)),
                        )
                    }
                }
                notifications.isEmpty() -> Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth().padding(top = 80.dp),
                ) {
                    Icon(Icons.Filled.NotificationsOff, null, tint = TextTertiary.copy(alpha = 0.4f), modifier = Modifier.size(56.dp))
                    Spacer(Modifier.height(16.dp))
                    Text("No notifications yet", fontWeight = FontWeight.Bold, color = TextSecondary, fontSize = 16.sp)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "You'll see friend requests, training\ninvites, and reminders here.",
                        color = TextTertiary, fontSize = 13.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center, lineHeight = 20.sp,
                    )
                }
                else -> Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 20.dp),
                ) {
                    notifications.forEach { notif ->
                        val icon = getNotifIcon(notif.type)
                        val color = getNotifColor(notif.type)
                        Row(
                            verticalAlignment = Alignment.Top,
                            modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)
                                .background(
                                    if (!notif.read) NeonLime.copy(alpha = 0.03f) else Color.Transparent,
                                    RoundedCornerShape(14.dp),
                                )
                                .border(1.dp, if (!notif.read) NeonLime.copy(alpha = 0.12f) else Border, RoundedCornerShape(14.dp))
                                .clickable {
                                    if (!notif.read) {
                                        scope.launch(Dispatchers.IO) {
                                            supabase.markNotificationRead(notif.id)
                                            withContext(Dispatchers.Main) {
                                                notifications = notifications.map { if (it.id == notif.id) it.copy(read = true) else it }
                                            }
                                        }
                                    }
                                }
                                .padding(14.dp),
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier.size(38.dp)
                                    .background(color.copy(alpha = 0.12f), RoundedCornerShape(10.dp))
                                    .border(1.dp, color.copy(alpha = 0.2f), RoundedCornerShape(10.dp)),
                            ) { Icon(icon, null, tint = color, modifier = Modifier.size(18.dp)) }
                            Spacer(Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(notif.title ?: "Notification", fontWeight = if (!notif.read) FontWeight.Bold else FontWeight.SemiBold, fontSize = 14.sp, color = TextPrimary)
                                if (!notif.body.isNullOrEmpty()) Text(notif.body!!, fontSize = 12.sp, color = TextSecondary, maxLines = 2, lineHeight = 16.sp)
                                Text(timeAgo(notif.created_at), fontSize = 11.sp, color = TextTertiary, modifier = Modifier.padding(top = 2.dp))
                            }
                            if (!notif.read) Box(modifier = Modifier.padding(start = 8.dp, top = 4.dp).size(8.dp).background(NeonLime, CircleShape))
                        }
                    }
                    Spacer(Modifier.height(20.dp))
                }
            }
        }
    }
}

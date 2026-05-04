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
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.repmax.app.data.*
import com.repmax.app.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun NutritionScreen(
    supabase: SupabaseClient,
    profile: Profile?,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var nutProfile by remember { mutableStateOf<NutritionProfile?>(null) }
    var foodLogs by remember { mutableStateOf<List<FoodLog>>(emptyList()) }
    var waterGlasses by remember { mutableStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var toast by remember { mutableStateOf<String?>(null) }
    var showAddFood by remember { mutableStateOf(false) }
    var addFoodName by remember { mutableStateOf("") }
    var addCalories by remember { mutableStateOf("") }
    var addProtein by remember { mutableStateOf("") }
    var addCarbs by remember { mutableStateOf("") }
    var addFat by remember { mutableStateOf("") }

    val today = java.time.LocalDate.now().toString()

    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            val npRes = supabase.getNutritionProfile()
            val logsRes = supabase.getFoodLogs(today)
            val waterRes = supabase.getWaterLog(today)
            withContext(Dispatchers.Main) {
                npRes.onSuccess { nutProfile = it }
                logsRes.onSuccess { foodLogs = it }
                waterRes.onSuccess { waterGlasses = it?.glasses ?: 0 }
                loading = false
            }
        }
    }

    LaunchedEffect(toast) { if (toast != null) { kotlinx.coroutines.delay(3000); toast = null } }

    fun reload() {
        scope.launch(Dispatchers.IO) {
            val logsRes = supabase.getFoodLogs(today)
            val waterRes = supabase.getWaterLog(today)
            withContext(Dispatchers.Main) {
                logsRes.onSuccess { foodLogs = it }
                waterRes.onSuccess { waterGlasses = it?.glasses ?: 0 }
            }
        }
    }

    val totals = foodLogs.fold(intArrayOf(0, 0, 0, 0)) { acc, log ->
        acc[0] += log.calories; acc[1] += log.protein; acc[2] += log.carbs; acc[3] += log.fat; acc
    }
    val calTarget = nutProfile?.target_calories ?: 2200
    val protTarget = nutProfile?.target_protein ?: 150
    val carbTarget = nutProfile?.target_carbs ?: 250
    val fatTarget = nutProfile?.target_fat ?: 70
    val calProgress = minOf(totals[0].toFloat() / maxOf(calTarget, 1), 1f)
    val remaining = calTarget - totals[0]

    Box(modifier = Modifier.fillMaxSize().background(Black)) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .statusBarsPadding().navigationBarsPadding().padding(horizontal = 20.dp),
        ) {
            Spacer(Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { onBack() }) {
                Icon(Icons.Default.ArrowBack, "Back", tint = TextSecondary, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Back", color = TextSecondary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(16.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Eco, null, tint = NeonLime, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(8.dp))
                Text("SMART EATING", style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Black, letterSpacing = 2.sp, color = TextPrimary,
                ))
            }

            Spacer(Modifier.height(20.dp))

            if (loading) {
                repeat(3) {
                    Box(modifier = Modifier.fillMaxWidth().height(100.dp).padding(vertical = 4.dp)
                        .background(Surface, RoundedCornerShape(16.dp)))
                }
            } else {
                // Calorie ring card
                Box(
                    modifier = Modifier.fillMaxWidth()
                        .background(Card, RoundedCornerShape(20.dp))
                        .border(1.dp, Border, RoundedCornerShape(20.dp))
                        .padding(24.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Ring
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier.size(100.dp).drawBehind {
                                val stroke = Stroke(width = 8.dp.toPx(), cap = StrokeCap.Round)
                                drawArc(Border, 0f, 360f, false, style = stroke, size = Size(size.width, size.height))
                                drawArc(NeonLime, -90f, calProgress * 360f, false, style = stroke, size = Size(size.width, size.height))
                            },
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("${totals[0]}", fontSize = 22.sp, fontWeight = FontWeight.Black, color = NeonLime)
                                Text("/ $calTarget", fontSize = 10.sp, color = TextTertiary, fontWeight = FontWeight.Bold)
                            }
                        }
                        Spacer(Modifier.width(20.dp))
                        Column {
                            Text(
                                if (remaining > 0) "$remaining kcal left" else "${-remaining} kcal over",
                                fontWeight = FontWeight.Bold, fontSize = 15.sp,
                                color = if (remaining >= 0) NeonLime else Color(0xFFEF4444),
                            )
                            Spacer(Modifier.height(8.dp))
                            MacroRow("Protein", totals[1], protTarget, Color(0xFF38BDF8))
                            MacroRow("Carbs", totals[2], carbTarget, Color(0xFFFBBF24))
                            MacroRow("Fat", totals[3], fatTarget, Color(0xFFFB923C))
                        }
                    }
                }

                Spacer(Modifier.height(14.dp))

                // Water tracker
                Box(
                    modifier = Modifier.fillMaxWidth()
                        .background(Card, RoundedCornerShape(16.dp))
                        .border(1.dp, Border, RoundedCornerShape(16.dp))
                        .padding(16.dp),
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.WaterDrop, null, tint = Color(0xFF38BDF8), modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("WATER", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = Color(0xFF38BDF8).copy(alpha = 0.7f))
                        }
                        Spacer(Modifier.height(10.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            // Water dots
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.weight(1f)) {
                                repeat(8) { i ->
                                    Box(
                                        modifier = Modifier.size(if (i < waterGlasses) 28.dp else 24.dp)
                                            .background(
                                                if (i < waterGlasses) Color(0xFF38BDF8).copy(alpha = 0.3f) else Surface,
                                                CircleShape,
                                            )
                                            .border(
                                                1.dp,
                                                if (i < waterGlasses) Color(0xFF38BDF8) else Border,
                                                CircleShape,
                                            ),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        if (i < waterGlasses) {
                                            Icon(Icons.Filled.WaterDrop, null, tint = Color(0xFF38BDF8), modifier = Modifier.size(14.dp))
                                        }
                                    }
                                }
                            }
                            Spacer(Modifier.width(8.dp))
                            Text("$waterGlasses/8", fontWeight = FontWeight.Bold, color = Color(0xFF38BDF8), fontSize = 14.sp)
                        }
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = {
                                    if (waterGlasses > 0) {
                                        waterGlasses--
                                        scope.launch(Dispatchers.IO) { supabase.upsertWaterLog(today, waterGlasses) }
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Surface, contentColor = TextPrimary),
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, Border),
                                modifier = Modifier.weight(1f).height(38.dp),
                                contentPadding = PaddingValues(0.dp),
                            ) {
                                Icon(Icons.Default.Remove, null, modifier = Modifier.size(18.dp))
                            }
                            Button(
                                onClick = {
                                    waterGlasses++
                                    scope.launch(Dispatchers.IO) { supabase.upsertWaterLog(today, waterGlasses) }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = NeonLime.copy(alpha = 0.15f), contentColor = NeonLime),
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, NeonLime.copy(alpha = 0.3f)),
                                modifier = Modifier.weight(1f).height(38.dp),
                                contentPadding = PaddingValues(0.dp),
                            ) {
                                Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Glass", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                        }
                    }
                }

                Spacer(Modifier.height(14.dp))

                // Food log
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("TODAY'S LOG", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.5.sp, color = NeonLime.copy(alpha = 0.6f))
                    TextButton(onClick = { showAddFood = true }) {
                        Icon(Icons.Default.Add, null, tint = NeonLime, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Add Food", color = NeonLime, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                if (foodLogs.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxWidth()
                            .background(Card, RoundedCornerShape(16.dp))
                            .border(1.dp, Border, RoundedCornerShape(16.dp))
                            .padding(32.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.Restaurant, null, tint = TextTertiary.copy(alpha = 0.3f), modifier = Modifier.size(40.dp))
                            Spacer(Modifier.height(10.dp))
                            Text("No meals logged today", fontWeight = FontWeight.Bold, color = TextSecondary, fontSize = 14.sp)
                            Text("Tap + to add your first meal", color = TextTertiary, fontSize = 12.sp)
                        }
                    }
                } else {
                    foodLogs.forEach { log ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)
                                .background(Card, RoundedCornerShape(14.dp))
                                .border(1.dp, Border, RoundedCornerShape(14.dp))
                                .padding(14.dp),
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(log.food_name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                Text(
                                    "${log.calories} kcal · ${log.protein}P · ${log.carbs}C · ${log.fat}F",
                                    fontSize = 11.sp, color = TextTertiary,
                                )
                            }
                            IconButton(
                                onClick = {
                                    log.id?.let { id ->
                                        scope.launch(Dispatchers.IO) {
                                            supabase.deleteFoodLog(id)
                                            withContext(Dispatchers.Main) { reload(); toast = "Removed" }
                                        }
                                    }
                                },
                                modifier = Modifier.size(32.dp),
                            ) {
                                Icon(Icons.Default.Delete, null, tint = Color(0xFFEF4444).copy(alpha = 0.6f), modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }

                Spacer(Modifier.height(40.dp))
            }
        }

        // Toast
        if (toast != null) {
            Box(
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 100.dp)
                    .background(NeonLime.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
                    .border(1.dp, NeonLime.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 20.dp, vertical = 12.dp),
            ) { Text(toast!!, color = NeonLime, fontWeight = FontWeight.Bold, fontSize = 13.sp) }
        }

        // Add food dialog
        if (showAddFood) {
            Box(
                modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.7f))
                    .clickable { showAddFood = false },
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    modifier = Modifier.padding(32.dp).fillMaxWidth()
                        .background(Card, RoundedCornerShape(20.dp))
                        .border(1.dp, Border, RoundedCornerShape(20.dp))
                        .clickable(enabled = false) {}
                        .padding(24.dp),
                ) {
                    Text("Add Food", fontWeight = FontWeight.Black, fontSize = 18.sp, color = TextPrimary)
                    Spacer(Modifier.height(12.dp))

                    val fields = listOf(
                        "Food Name" to addFoodName,
                        "Calories" to addCalories,
                        "Protein (g)" to addProtein,
                        "Carbs (g)" to addCarbs,
                        "Fat (g)" to addFat,
                    )
                    val setters = listOf<(String) -> Unit>(
                        { addFoodName = it }, { addCalories = it },
                        { addProtein = it }, { addCarbs = it }, { addFat = it },
                    )
                    fields.forEachIndexed { i, (label, value) ->
                        OutlinedTextField(
                            value = value, onValueChange = setters[i],
                            label = { Text(label, fontSize = 12.sp) },
                            modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = NeonLime, unfocusedBorderColor = Border,
                                cursorColor = NeonLime, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
                                focusedLabelColor = NeonLime, unfocusedLabelColor = TextTertiary,
                            ),
                            shape = RoundedCornerShape(10.dp), singleLine = true,
                        )
                    }

                    Spacer(Modifier.height(14.dp))
                    Button(
                        onClick = {
                            if (addFoodName.isNotBlank()) {
                                scope.launch(Dispatchers.IO) {
                                    val userId = supabase.getUserId() ?: ""
                                    supabase.addFoodLog(FoodLog(
                                        user_id = userId, food_name = addFoodName,
                                        calories = addCalories.toIntOrNull() ?: 0,
                                        protein = addProtein.toIntOrNull() ?: 0,
                                        carbs = addCarbs.toIntOrNull() ?: 0,
                                        fat = addFat.toIntOrNull() ?: 0,
                                        logged_at = today,
                                    ))
                                    withContext(Dispatchers.Main) {
                                        showAddFood = false; reload()
                                        addFoodName = ""; addCalories = ""; addProtein = ""; addCarbs = ""; addFat = ""
                                        toast = "Added $addFoodName"
                                    }
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(46.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = NeonLime, contentColor = Black),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Add to Log", fontWeight = FontWeight.Black)
                    }
                }
            }
        }
    }
}

@Composable
private fun MacroRow(label: String, current: Int, target: Int, color: Color) {
    val progress = minOf(current.toFloat() / maxOf(target, 1), 1f)
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 2.dp)) {
        Text(label, fontSize = 11.sp, color = TextTertiary, fontWeight = FontWeight.Medium,
            modifier = Modifier.width(50.dp))
        Box(
            modifier = Modifier.weight(1f).height(6.dp)
                .background(Border, RoundedCornerShape(3.dp)),
        ) {
            Box(
                modifier = Modifier.fillMaxHeight()
                    .fillMaxWidth(progress)
                    .background(color, RoundedCornerShape(3.dp)),
            )
        }
        Spacer(Modifier.width(6.dp))
        Text("$current/$target", fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Bold)
    }
}

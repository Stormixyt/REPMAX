package com.repmax.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.repmax.app.data.*
import com.repmax.app.ui.components.RepMaxBottomBar
import com.repmax.app.ui.screens.*
import com.repmax.app.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            RepMaxTheme {
                RepMaxApp()
            }
        }
    }
}

sealed class Screen {
    object Welcome : Screen()
    object Login : Screen()
    object Dashboard : Screen()
    data class WorkoutPlan(val day: ProgramDay? = null, val weekNumber: Int = 1) : Screen()
    data class ExerciseDetail(val exercise: ProgramExercise? = null) : Screen()
}

@Composable
fun RepMaxApp() {
    val context = LocalContext.current
    val supabase = remember { SupabaseClient(context) }
    val scope = rememberCoroutineScope()

    // Navigation state
    var currentScreen by remember { mutableStateOf<Screen>(Screen.Welcome) }
    var currentTab by remember { mutableStateOf("home") }

    // Auth state
    var isLoggedIn by remember { mutableStateOf(false) }
    var authLoading by remember { mutableStateOf(true) }
    var loginError by remember { mutableStateOf<String?>(null) }
    var loginLoading by remember { mutableStateOf(false) }

    // Data state
    var profile by remember { mutableStateOf<Profile?>(null) }
    var program by remember { mutableStateOf<Program?>(null) }
    var workoutHistory by remember { mutableStateOf<List<Workout>>(emptyList()) }
    var personalRecords by remember { mutableStateOf<List<PersonalRecord>>(emptyList()) }
    var dataLoading by remember { mutableStateOf(false) }

    // Check session on launch
    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            val loggedIn = supabase.isLoggedIn()
            if (loggedIn) {
                isLoggedIn = true
                currentScreen = Screen.Dashboard
                loadDashboardData(supabase) { p, prog, wh, pr ->
                    profile = p
                    program = prog
                    workoutHistory = wh
                    personalRecords = pr
                }
            }
            authLoading = false
        }
    }

    // Loading screen
    if (authLoading) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Black),
            contentAlignment = Alignment.Center,
        ) {
            CircularProgressIndicator(color = NeonLime, modifier = Modifier.size(32.dp))
        }
        return
    }

    // Main content
    Box(modifier = Modifier.fillMaxSize()) {
        when (currentScreen) {
            is Screen.Welcome -> {
                WelcomeScreen(
                    onGetStarted = { currentScreen = Screen.Login },
                    onLogin = { currentScreen = Screen.Login },
                )
            }

            is Screen.Login -> {
                LoginScreen(
                    onBack = { currentScreen = Screen.Welcome },
                    onLogin = { email, password ->
                        loginLoading = true
                        loginError = null
                        scope.launch(Dispatchers.IO) {
                            val result = supabase.signIn(email, password)
                            withContext(Dispatchers.Main) {
                                result.onSuccess {
                                    isLoggedIn = true
                                    currentScreen = Screen.Dashboard
                                    loginLoading = false
                                    scope.launch(Dispatchers.IO) {
                                        loadDashboardData(supabase) { p, prog, wh, pr ->
                                            profile = p
                                            program = prog
                                            workoutHistory = wh
                                            personalRecords = pr
                                        }
                                    }
                                }.onFailure { e ->
                                    loginError = e.message ?: "Login failed"
                                    loginLoading = false
                                }
                            }
                        }
                    },
                    onSignUp = { email, password, name ->
                        loginLoading = true
                        loginError = null
                        scope.launch(Dispatchers.IO) {
                            val result = supabase.signUp(email, password, name)
                            withContext(Dispatchers.Main) {
                                result.onSuccess {
                                    isLoggedIn = true
                                    currentScreen = Screen.Dashboard
                                    loginLoading = false
                                    scope.launch(Dispatchers.IO) {
                                        loadDashboardData(supabase) { p, prog, wh, pr ->
                                            profile = p
                                            program = prog
                                            workoutHistory = wh
                                            personalRecords = pr
                                        }
                                    }
                                }.onFailure { e ->
                                    loginError = e.message ?: "Sign up failed"
                                    loginLoading = false
                                }
                            }
                        }
                    },
                    isLoading = loginLoading,
                    errorMessage = loginError,
                )
            }

            is Screen.Dashboard -> {
                Column {
                    Box(modifier = Modifier.weight(1f)) {
                        DashboardScreen(
                            profile = profile,
                            program = program,
                            workoutHistory = workoutHistory,
                            personalRecords = personalRecords,
                            onStartWorkout = { day ->
                                currentScreen = Screen.WorkoutPlan(day)
                            },
                            onViewPlan = {
                                val trainingDays = profile?.training_days ?: emptyList()
                                val today = java.time.LocalDate.now()
                                val dayAbbrevs = mapOf(
                                    java.time.DayOfWeek.MONDAY to "Mon", java.time.DayOfWeek.TUESDAY to "Tue",
                                    java.time.DayOfWeek.WEDNESDAY to "Wed", java.time.DayOfWeek.THURSDAY to "Thu",
                                    java.time.DayOfWeek.FRIDAY to "Fri", java.time.DayOfWeek.SATURDAY to "Sat",
                                    java.time.DayOfWeek.SUNDAY to "Sun"
                                )
                                val shortDay = dayAbbrevs[today.dayOfWeek] ?: ""
                                val dayIndex = trainingDays.indexOf(shortDay)
                                val currentWeek = program?.program_data?.weeks?.getOrNull((program?.current_week ?: 1) - 1)
                                val todayDay = if (dayIndex >= 0) currentWeek?.days?.getOrNull(dayIndex) else currentWeek?.days?.firstOrNull()
                                currentScreen = Screen.WorkoutPlan(todayDay, program?.current_week ?: 1)
                            },
                            onNavigate = { route -> currentTab = route },
                        )
                    }
                    RepMaxBottomBar(
                        currentRoute = currentTab,
                        onNavigate = { route -> currentTab = route },
                    )
                }
            }

            is Screen.WorkoutPlan -> {
                val wp = currentScreen as Screen.WorkoutPlan
                WorkoutPlanScreen(
                    day = wp.day,
                    weekNumber = wp.weekNumber,
                    onBack = { currentScreen = Screen.Dashboard },
                    onExerciseClick = { exercise, _ ->
                        currentScreen = Screen.ExerciseDetail(exercise)
                    },
                    onStartWorkout = {
                        // Start first exercise
                        val firstExercise = wp.day?.exercises?.firstOrNull()
                        if (firstExercise != null) {
                            currentScreen = Screen.ExerciseDetail(firstExercise)
                        }
                    },
                )
            }

            is Screen.ExerciseDetail -> {
                val ed = currentScreen as Screen.ExerciseDetail
                ExerciseDetailScreen(
                    exercise = ed.exercise,
                    onBack = {
                        // Navigate back to workout plan
                        val wpScreen = Screen.WorkoutPlan(
                            day = program?.program_data?.weeks?.getOrNull((program?.current_week ?: 1) - 1)?.days?.firstOrNull(),
                            weekNumber = program?.current_week ?: 1,
                        )
                        currentScreen = wpScreen
                    },
                    onComplete = { completedSets ->
                        // Navigate back to workout plan
                        val wpScreen = Screen.WorkoutPlan(
                            day = program?.program_data?.weeks?.getOrNull((program?.current_week ?: 1) - 1)?.days?.firstOrNull(),
                            weekNumber = program?.current_week ?: 1,
                        )
                        currentScreen = wpScreen
                    },
                )
            }
        }
    }
}

private suspend fun loadDashboardData(
    supabase: SupabaseClient,
    onLoaded: (Profile?, Program?, List<Workout>, List<PersonalRecord>) -> Unit,
) {
    val profileResult = supabase.getProfile()
    val programResult = supabase.getActiveProgram()
    val workoutsResult = supabase.getWorkoutHistory()
    val prsResult = supabase.getPersonalRecords()

    withContext(Dispatchers.Main) {
        onLoaded(
            profileResult.getOrNull(),
            programResult.getOrNull(),
            workoutsResult.getOrNull() ?: emptyList(),
            prsResult.getOrNull() ?: emptyList(),
        )
    }
}

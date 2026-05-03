package com.repmax.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
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
    object Main : Screen()
    data class WorkoutPlan(val day: ProgramDay? = null, val weekNumber: Int = 1) : Screen()
    data class ExerciseDetail(
        val exercise: ProgramExercise? = null,
        val workoutId: String? = null,
        val exerciseIndex: Int = 0,
        val allExercises: List<ProgramExercise> = emptyList(),
        val currentDay: ProgramDay? = null,
    ) : Screen()
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
    var activeWorkoutId by remember { mutableStateOf<String?>(null) }
    var completedExercises by remember { mutableStateOf<Set<Int>>(emptySet()) }

    // Check session on launch
    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            val loggedIn = supabase.isLoggedIn()
            if (loggedIn) {
                isLoggedIn = true
                currentScreen = Screen.Main
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

    // Reusable login handler
    fun handleAuthSuccess() {
        isLoggedIn = true
        currentScreen = Screen.Main
        loginLoading = false
        scope.launch(Dispatchers.IO) {
            loadDashboardData(supabase) { p, prog, wh, pr ->
                profile = p
                program = prog
                workoutHistory = wh
                personalRecords = pr
            }
        }
    }

    // Helper to find today's workout day
    fun getTodayDay(): ProgramDay? {
        val trainingDays = profile?.training_days ?: emptyList()
        val dayAbbrevs = mapOf(
            java.time.DayOfWeek.MONDAY to "Mon", java.time.DayOfWeek.TUESDAY to "Tue",
            java.time.DayOfWeek.WEDNESDAY to "Wed", java.time.DayOfWeek.THURSDAY to "Thu",
            java.time.DayOfWeek.FRIDAY to "Fri", java.time.DayOfWeek.SATURDAY to "Sat",
            java.time.DayOfWeek.SUNDAY to "Sun"
        )
        val shortDay = dayAbbrevs[java.time.LocalDate.now().dayOfWeek] ?: ""
        val dayIndex = trainingDays.indexOf(shortDay)
        val currentWeek = program?.program_data?.weeks?.getOrNull((program?.current_week ?: 1) - 1)
        return if (dayIndex >= 0) currentWeek?.days?.getOrNull(dayIndex) else currentWeek?.days?.firstOrNull()
    }

    // Loading screen
    if (authLoading) {
        Box(
            modifier = Modifier.fillMaxSize().background(Black),
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
                            supabase.signIn(email, password)
                                .onSuccess { withContext(Dispatchers.Main) { handleAuthSuccess() } }
                                .onFailure { e -> withContext(Dispatchers.Main) {
                                    loginError = e.message ?: "Login failed"
                                    loginLoading = false
                                }}
                        }
                    },
                    onSignUp = { email, password, name ->
                        loginLoading = true
                        loginError = null
                        scope.launch(Dispatchers.IO) {
                            supabase.signUp(email, password, name)
                                .onSuccess { withContext(Dispatchers.Main) { handleAuthSuccess() } }
                                .onFailure { e -> withContext(Dispatchers.Main) {
                                    loginError = e.message ?: "Sign up failed"
                                    loginLoading = false
                                }}
                        }
                    },
                    isLoading = loginLoading,
                    errorMessage = loginError,
                )
            }

            is Screen.Main -> {
                Column(modifier = Modifier.fillMaxSize()) {
                    Box(modifier = Modifier.weight(1f)) {
                        when (currentTab) {
                            "home" -> DashboardScreen(
                                profile = profile,
                                program = program,
                                workoutHistory = workoutHistory,
                                personalRecords = personalRecords,
                                onStartWorkout = { day ->
                                    completedExercises = emptySet()
                                    // Create workout in Supabase
                                    scope.launch(Dispatchers.IO) {
                                        val result = supabase.createWorkout(
                                            programId = program?.id,
                                            dayName = day?.day_name ?: "Workout",
                                            weekNumber = program?.current_week,
                                        )
                                        result.onSuccess { workout ->
                                            withContext(Dispatchers.Main) {
                                                activeWorkoutId = workout.id
                                                currentScreen = Screen.WorkoutPlan(day)
                                            }
                                        }
                                        result.onFailure {
                                            withContext(Dispatchers.Main) {
                                                currentScreen = Screen.WorkoutPlan(day)
                                            }
                                        }
                                    }
                                },
                                onViewPlan = {
                                    currentScreen = Screen.WorkoutPlan(getTodayDay(), program?.current_week ?: 1)
                                },
                                onNavigate = { route -> currentTab = route },
                            )

                            "workouts" -> {
                                // Workouts tab — shows workout plan for today
                                val todayDay = getTodayDay()
                                WorkoutPlanScreen(
                                    day = todayDay,
                                    weekNumber = program?.current_week ?: 1,
                                    onBack = { currentTab = "home" },
                                    onExerciseClick = { exercise, idx ->
                                        currentScreen = Screen.ExerciseDetail(
                                            exercise = exercise,
                                            workoutId = activeWorkoutId,
                                            exerciseIndex = idx,
                                            allExercises = todayDay?.exercises ?: emptyList(),
                                            currentDay = todayDay,
                                        )
                                    },
                                    onStartWorkout = {
                                        val firstExercise = todayDay?.exercises?.firstOrNull()
                                        if (firstExercise != null) {
                                            completedExercises = emptySet()
                                            scope.launch(Dispatchers.IO) {
                                                val result = supabase.createWorkout(
                                                    programId = program?.id,
                                                    dayName = todayDay.day_name,
                                                    weekNumber = program?.current_week,
                                                )
                                                result.onSuccess { workout ->
                                                    withContext(Dispatchers.Main) {
                                                        activeWorkoutId = workout.id
                                                        currentScreen = Screen.ExerciseDetail(
                                                            exercise = firstExercise,
                                                            workoutId = workout.id,
                                                            exerciseIndex = 0,
                                                            allExercises = todayDay.exercises ?: emptyList(),
                                                            currentDay = todayDay,
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    },
                                )
                            }

                            "progress" -> ProgressScreen(
                                workoutHistory = workoutHistory,
                                personalRecords = personalRecords,
                                profile = profile,
                            )

                            "ai" -> AICoachScreen(
                                profile = profile,
                                workoutHistory = workoutHistory,
                                personalRecords = personalRecords,
                            )

                            "profile" -> ProfileScreen(
                                profile = profile,
                                workoutHistory = workoutHistory,
                                personalRecords = personalRecords,
                                onLogout = {
                                    scope.launch(Dispatchers.IO) {
                                        supabase.signOut()
                                        withContext(Dispatchers.Main) {
                                            isLoggedIn = false
                                            currentScreen = Screen.Welcome
                                            profile = null
                                            program = null
                                            workoutHistory = emptyList()
                                            personalRecords = emptyList()
                                            currentTab = "home"
                                        }
                                    }
                                },
                            )
                        }
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
                    onBack = { currentScreen = Screen.Main; currentTab = "home" },
                    onExerciseClick = { exercise, idx ->
                        currentScreen = Screen.ExerciseDetail(
                            exercise = exercise,
                            workoutId = activeWorkoutId,
                            exerciseIndex = idx,
                            allExercises = wp.day?.exercises ?: emptyList(),
                            currentDay = wp.day,
                        )
                    },
                    onStartWorkout = {
                        val firstExercise = wp.day?.exercises?.firstOrNull()
                        if (firstExercise != null) {
                            scope.launch(Dispatchers.IO) {
                                val result = supabase.createWorkout(
                                    programId = program?.id,
                                    dayName = wp.day?.day_name ?: "Workout",
                                    weekNumber = wp.weekNumber,
                                )
                                result.onSuccess { workout ->
                                    withContext(Dispatchers.Main) {
                                        activeWorkoutId = workout.id
                                        completedExercises = emptySet()
                                        currentScreen = Screen.ExerciseDetail(
                                            exercise = firstExercise,
                                            workoutId = workout.id,
                                            exerciseIndex = 0,
                                            allExercises = wp.day?.exercises ?: emptyList(),
                                            currentDay = wp.day,
                                        )
                                    }
                                }
                                result.onFailure {
                                    withContext(Dispatchers.Main) {
                                        currentScreen = Screen.ExerciseDetail(
                                            exercise = firstExercise,
                                            exerciseIndex = 0,
                                            allExercises = wp.day?.exercises ?: emptyList(),
                                            currentDay = wp.day,
                                        )
                                    }
                                }
                            }
                        }
                    },
                )
            }

            is Screen.ExerciseDetail -> {
                val ed = currentScreen as Screen.ExerciseDetail
                ExerciseDetailScreen(
                    exercise = ed.exercise,
                    onBack = {
                        currentScreen = Screen.WorkoutPlan(ed.currentDay, program?.current_week ?: 1)
                    },
                    onComplete = { completedSets ->
                        // Save sets to Supabase
                        val wId = ed.workoutId ?: activeWorkoutId
                        if (wId != null) {
                            scope.launch(Dispatchers.IO) {
                                completedSets.forEachIndexed { i, set ->
                                    supabase.saveWorkoutSet(
                                        workoutId = wId,
                                        exerciseName = ed.exercise?.name ?: "",
                                        setNumber = i + 1,
                                        weight = set.first,
                                        reps = set.second,
                                    )
                                }
                            }
                        }

                        // Mark exercise as completed
                        completedExercises = completedExercises + ed.exerciseIndex

                        // Move to next exercise or back to plan
                        val nextIdx = ed.exerciseIndex + 1
                        if (nextIdx < ed.allExercises.size) {
                            currentScreen = Screen.ExerciseDetail(
                                exercise = ed.allExercises[nextIdx],
                                workoutId = ed.workoutId,
                                exerciseIndex = nextIdx,
                                allExercises = ed.allExercises,
                                currentDay = ed.currentDay,
                            )
                        } else {
                            // All exercises done — complete the workout
                            val wId2 = ed.workoutId ?: activeWorkoutId
                            if (wId2 != null) {
                                scope.launch(Dispatchers.IO) {
                                    val totalVolume = completedSets.sumOf { it.first * it.second }
                                    supabase.completeWorkout(wId2, totalVolume)
                                    // Reload data
                                    loadDashboardData(supabase) { p, prog, wh, pr ->
                                        profile = p
                                        program = prog
                                        workoutHistory = wh
                                        personalRecords = pr
                                    }
                                }
                            }
                            activeWorkoutId = null
                            completedExercises = emptySet()
                            currentScreen = Screen.Main
                            currentTab = "home"
                        }
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

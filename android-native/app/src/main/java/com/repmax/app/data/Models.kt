package com.repmax.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonPrimitive

@Serializable
data class Profile(
    val id: String = "",
    val username: String? = null,
    val display_name: String? = null,
    val email: String? = null,
    val image_url: String? = null,
    val avatar_seed: String? = null,
    val goal: String? = null,
    val fitness_goal: String? = null,
    val experience: String? = null,
    val experience_level: String? = null,
    val training_days: List<String>? = null,
    val unit_preference: String? = "kg",
    val current_streak: Int = 0,
    val longest_streak: Int = 0,
    val onboarded: Boolean = false,
    val subscription_tier: String? = "free",
    val theme_color: String? = "green",
)

@Serializable
data class Program(
    val id: String = "",
    val user_id: String = "",
    val active: Boolean = true,
    val current_week: Int = 1,
    val program_data: ProgramData? = null,
    val created_at: String? = null,
)

@Serializable
data class ProgramData(
    val weeks: List<ProgramWeek>? = null,
)

@Serializable
data class ProgramWeek(
    val days: List<ProgramDay>? = null,
)

@Serializable
data class ProgramDay(
    val day_name: String = "",
    val target_muscles: List<String>? = null,
    val exercises: List<ProgramExercise>? = null,
)

@Serializable
data class ProgramExercise(
    val name: String = "",
    val sets: JsonPrimitive? = null,
    val reps: JsonPrimitive? = null,
    val weight: JsonPrimitive? = null,
    val rest: String? = null,
    val notes: String? = null,
) {
    val setsInt: Int
        get() = try { sets?.content?.toIntOrNull() ?: 4 } catch (_: Exception) { 4 }

    val repsDisplay: String
        get() = try { reps?.content ?: "8" } catch (_: Exception) { "8" }

    val weightDouble: Double
        get() = try { weight?.content?.toDoubleOrNull() ?: 0.0 } catch (_: Exception) { 0.0 }
}

@Serializable
data class Workout(
    val id: String = "",
    val user_id: String = "",
    val program_id: String? = null,
    val day_name: String? = null,
    val week_number: Int? = null,
    val started_at: String? = null,
    val completed_at: String? = null,
    val total_volume: Double? = null,
)

@Serializable
data class WorkoutSet(
    val id: String? = null,
    val workout_id: String = "",
    val exercise_name: String = "",
    val set_number: Int = 1,
    val target_reps: Int = 8,
    val target_weight: Double = 0.0,
    val actual_reps: Int? = null,
    val actual_weight: Double? = null,
    val completed: Boolean = false,
)

@Serializable
data class PersonalRecord(
    val id: String = "",
    val user_id: String = "",
    val exercise_name: String = "",
    val weight: Double = 0.0,
    val reps: Int = 0,
    val achieved_at: String? = null,
)

@Serializable
data class AuthResponse(
    val access_token: String = "",
    val refresh_token: String = "",
    val user: AuthUser? = null,
)

@Serializable
data class AuthUser(
    val id: String = "",
    val email: String? = null,
)

@Serializable
data class SignInRequest(
    val email: String,
    val password: String,
)

package com.repmax.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.repmax.app.BuildConfig
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "repmax_session")

class SupabaseClient(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; isLenient = true }
    private val baseUrl = BuildConfig.SUPABASE_URL
    private val anonKey = BuildConfig.SUPABASE_ANON_KEY
    private val jsonMediaType = "application/json".toMediaType()

    private val ACCESS_TOKEN_KEY = stringPreferencesKey("access_token")
    private val REFRESH_TOKEN_KEY = stringPreferencesKey("refresh_token")
    private val USER_ID_KEY = stringPreferencesKey("user_id")

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val original = chain.request()
            val builder = original.newBuilder()
                .header("apikey", anonKey)
                .header("Content-Type", "application/json")
                .header("x-client-info", "repmax-android/1.0")
            chain.proceed(builder.build())
        }
        .build()

    private suspend fun getAccessToken(): String? =
        context.dataStore.data.map { it[ACCESS_TOKEN_KEY] }.first()

    suspend fun getUserId(): String? =
        context.dataStore.data.map { it[USER_ID_KEY] }.first()

    private suspend fun authClient(): OkHttpClient {
        val token = getAccessToken() ?: return client
        return client.newBuilder()
            .addInterceptor { chain ->
                chain.proceed(
                    chain.request().newBuilder()
                        .header("Authorization", "Bearer $token")
                        .build()
                )
            }
            .build()
    }

    suspend fun signIn(email: String, password: String): Result<AuthUser> {
        return try {
            val body = json.encodeToString(SignInRequest.serializer(), SignInRequest(email, password))
            val request = Request.Builder()
                .url("$baseUrl/auth/v1/token?grant_type=password")
                .post(body.toRequestBody(jsonMediaType))
                .header("apikey", anonKey)
                .header("Content-Type", "application/json")
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                val errorMsg = try {
                    json.parseToJsonElement(responseBody).jsonObject["error_description"]?.toString()?.trim('"')
                        ?: json.parseToJsonElement(responseBody).jsonObject["msg"]?.toString()?.trim('"')
                        ?: "Login failed"
                } catch (_: Exception) { "Login failed (${response.code})" }
                return Result.failure(Exception(errorMsg))
            }

            val authResponse = json.decodeFromString(AuthResponse.serializer(), responseBody)
            context.dataStore.edit {
                it[ACCESS_TOKEN_KEY] = authResponse.access_token
                it[REFRESH_TOKEN_KEY] = authResponse.refresh_token
                it[USER_ID_KEY] = authResponse.user?.id ?: ""
            }
            Result.success(authResponse.user ?: AuthUser())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signUp(email: String, password: String, displayName: String): Result<AuthUser> {
        return try {
            val body = buildJsonObject {
                put("email", email)
                put("password", password)
                put("data", buildJsonObject { put("display_name", displayName) })
            }.toString()

            val request = Request.Builder()
                .url("$baseUrl/auth/v1/signup")
                .post(body.toRequestBody(jsonMediaType))
                .header("apikey", anonKey)
                .header("Content-Type", "application/json")
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                val errorMsg = try {
                    json.parseToJsonElement(responseBody).jsonObject["msg"]?.toString()?.trim('"') ?: "Sign up failed"
                } catch (_: Exception) { "Sign up failed (${response.code})" }
                return Result.failure(Exception(errorMsg))
            }

            val authResponse = json.decodeFromString(AuthResponse.serializer(), responseBody)
            if (authResponse.access_token.isNotEmpty()) {
                context.dataStore.edit {
                    it[ACCESS_TOKEN_KEY] = authResponse.access_token
                    it[REFRESH_TOKEN_KEY] = authResponse.refresh_token
                    it[USER_ID_KEY] = authResponse.user?.id ?: ""
                }
            }
            Result.success(authResponse.user ?: AuthUser())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signOut() {
        try {
            val token = getAccessToken()
            if (token != null) {
                val request = Request.Builder()
                    .url("$baseUrl/auth/v1/logout")
                    .post("".toRequestBody(jsonMediaType))
                    .header("apikey", anonKey)
                    .header("Authorization", "Bearer $token")
                    .build()
                client.newCall(request).execute()
            }
        } catch (_: Exception) {}
        context.dataStore.edit { it.clear() }
    }

    suspend fun isLoggedIn(): Boolean = getAccessToken() != null

    suspend fun getProfile(): Result<Profile> {
        val userId = getUserId() ?: return Result.failure(Exception("Not logged in"))
        return try {
            val http = authClient()
            val request = Request.Builder()
                .url("$baseUrl/rest/v1/profiles?id=eq.$userId&select=*")
                .header("apikey", anonKey)
                .header("Accept", "application/json")
                .build()
            val response = http.newCall(request).execute()
            val body = response.body?.string() ?: "[]"
            val profiles = json.decodeFromString<List<Profile>>(body)
            if (profiles.isNotEmpty()) Result.success(profiles[0])
            else Result.failure(Exception("Profile not found"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getActiveProgram(): Result<Program> {
        val userId = getUserId() ?: return Result.failure(Exception("Not logged in"))
        return try {
            val http = authClient()
            val request = Request.Builder()
                .url("$baseUrl/rest/v1/programs?user_id=eq.$userId&active=eq.true&order=created_at.desc&limit=1&select=*")
                .header("apikey", anonKey)
                .header("Accept", "application/json")
                .build()
            val response = http.newCall(request).execute()
            val body = response.body?.string() ?: "[]"
            val programs = json.decodeFromString<List<Program>>(body)
            if (programs.isNotEmpty()) Result.success(programs[0])
            else Result.failure(Exception("No active program"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getWorkoutHistory(): Result<List<Workout>> {
        val userId = getUserId() ?: return Result.failure(Exception("Not logged in"))
        return try {
            val http = authClient()
            val request = Request.Builder()
                .url("$baseUrl/rest/v1/workouts?user_id=eq.$userId&completed_at=not.is.null&order=completed_at.desc&select=*")
                .header("apikey", anonKey)
                .header("Accept", "application/json")
                .build()
            val response = http.newCall(request).execute()
            val body = response.body?.string() ?: "[]"
            Result.success(json.decodeFromString<List<Workout>>(body))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPersonalRecords(): Result<List<PersonalRecord>> {
        val userId = getUserId() ?: return Result.failure(Exception("Not logged in"))
        return try {
            val http = authClient()
            val request = Request.Builder()
                .url("$baseUrl/rest/v1/personal_records?user_id=eq.$userId&order=achieved_at.desc&limit=18&select=*")
                .header("apikey", anonKey)
                .header("Accept", "application/json")
                .build()
            val response = http.newCall(request).execute()
            val body = response.body?.string() ?: "[]"
            Result.success(json.decodeFromString<List<PersonalRecord>>(body))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createWorkout(programId: String?, dayName: String, weekNumber: Int?): Result<Workout> {
        val userId = getUserId() ?: return Result.failure(Exception("Not logged in"))
        return try {
            val http = authClient()
            val body = buildJsonObject {
                put("user_id", userId)
                if (programId != null) put("program_id", programId)
                put("day_name", dayName)
                if (weekNumber != null) put("week_number", weekNumber)
                put("started_at", java.time.Instant.now().toString())
            }.toString()

            val request = Request.Builder()
                .url("$baseUrl/rest/v1/workouts?select=*")
                .post(body.toRequestBody(jsonMediaType))
                .header("apikey", anonKey)
                .header("Prefer", "return=representation")
                .build()
            val response = http.newCall(request).execute()
            val responseBody = response.body?.string() ?: "[]"
            val workouts = json.decodeFromString<List<Workout>>(responseBody)
            if (workouts.isNotEmpty()) Result.success(workouts[0])
            else Result.failure(Exception("Failed to create workout"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

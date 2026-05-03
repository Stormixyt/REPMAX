package com.repmax.app.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val RepMaxColorScheme = darkColorScheme(
    primary = NeonLime,
    onPrimary = TextOnAccent,
    primaryContainer = NeonLimeGlow,
    onPrimaryContainer = NeonLime,
    secondary = NeonLimeDim,
    onSecondary = TextOnAccent,
    background = Black,
    onBackground = TextPrimary,
    surface = Surface,
    onSurface = TextPrimary,
    surfaceVariant = Card,
    onSurfaceVariant = TextSecondary,
    outline = Border,
    outlineVariant = BorderHover,
    error = Danger,
    onError = TextPrimary,
    tertiary = NeonLime,
    onTertiary = TextOnAccent,
)

@Composable
fun RepMaxTheme(content: @Composable () -> Unit) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Black.toArgb()
            window.navigationBarColor = Black.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = false
                isAppearanceLightNavigationBars = false
            }
        }
    }

    MaterialTheme(
        colorScheme = RepMaxColorScheme,
        typography = RepMaxTypography,
        content = content
    )
}

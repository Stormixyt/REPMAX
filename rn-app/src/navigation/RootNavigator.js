import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import AuthScreen from '../screens/auth/AuthScreen'
import OnboardingScreen from '../screens/app/OnboardingScreen'
import AppNavigator from './AppNavigator'

const Stack = createNativeStackNavigator()

function LoadingScreen() {
  const { theme } = useTheme()
  return (
    <View style={[styles.loading, { backgroundColor: theme.bg.primary }]}>
      <Text style={[styles.loadingLogo, { color: theme.text.primary }]}>
        REPMAX<Text style={{ color: theme.accent }}>.</Text>
      </Text>
      <ActivityIndicator color={theme.accent} size="small" style={{ marginTop: 20 }} />
    </View>
  )
}

export default function RootNavigator() {
  const { user, profile, loading, isOnboarded } = useAuth()
  const { theme } = useTheme()

  if (loading) return <LoadingScreen />

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: theme.accent,
          background: theme.bg.primary,
          card: theme.bg.secondary,
          text: theme.text.primary,
          border: theme.border,
          notification: theme.accent,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : !isOnboarded ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <Stack.Screen name="App" component={AppNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
})

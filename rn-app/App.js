import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/context/AuthContext'
import { LanguageProvider } from './src/context/LanguageContext'
import { CallProvider } from './src/context/CallContext'
import { ThemeProvider } from './src/theme/ThemeContext'
import RootNavigator from './src/navigation/RootNavigator'

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <CallProvider>
                <StatusBar style="light" backgroundColor="#070707" />
                <RootNavigator />
              </CallProvider>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../../theme/ThemeContext'

export default function AICoachScreen() {
  const { theme } = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: theme.bg.primary }]}>
      <Text style={[styles.title, { color: theme.text.primary }]}>AICoachScreen</Text>
      <Text style={[styles.subtitle, { color: theme.text.tertiary }]}>Building...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 14, marginTop: 8 },
})

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import * as Haptics from 'expo-haptics'
import GlassTabBar from '../components/GlassTabBar'

import DashboardScreen from '../screens/app/DashboardScreen'
import WorkoutScreen from '../screens/standalone/WorkoutScreen'
import ProgressScreen from '../screens/app/ProgressScreen'
import NutritionScreen from '../screens/app/NutritionScreen'
import SocialScreen from '../screens/app/SocialScreen'
import CommunitiesScreen from '../screens/app/CommunitiesScreen'
import AICoachScreen from '../screens/app/AICoachScreen'
import ProfileScreen from '../screens/app/ProfileScreen'
import RunTrackerScreen from '../screens/standalone/RunTrackerScreen'
import SettingsScreen from '../screens/standalone/SettingsScreen'
import SubscriptionScreen from '../screens/standalone/SubscriptionScreen'
import ChatRoomScreen from '../screens/standalone/ChatRoomScreen'
import UltraLabScreen from '../screens/standalone/UltraLabScreen'
import RecoveryScreen from '../screens/standalone/RecoveryScreen'
import HomeExercisesScreen from '../screens/standalone/HomeExercisesScreen'
import NotificationsScreen from '../screens/standalone/NotificationsScreen'
import AdminScreen from '../screens/standalone/AdminScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

const TAB_ICONS = {
  Dashboard: { active: 'home', inactive: 'home-outline' },
  Progress: { active: 'bar-chart', inactive: 'bar-chart-outline' },
  Nutrition: { active: 'leaf', inactive: 'leaf-outline' },
  Social: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Communities: { active: 'people', inactive: 'people-outline' },
  Coach: { active: 'sparkles', inactive: 'sparkles-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
}

function MainTabs() {
  const { theme } = useTheme()
  const { t } = useLanguage()

  return (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} iconMap={TAB_ICONS} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: t('nav_home') }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ tabBarLabel: t('nav_progress') }} />
      <Tab.Screen name="Nutrition" component={NutritionScreen} options={{ tabBarLabel: t('nav_diet') }} />
      <Tab.Screen name="Social" component={SocialScreen} options={{ tabBarLabel: t('nav_chat') }} />
      <Tab.Screen name="Communities" component={CommunitiesScreen} options={{ tabBarLabel: 'Crews' }} />
      <Tab.Screen name="Coach" component={AICoachScreen} options={{ tabBarLabel: t('nav_coach') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('nav_profile') }} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const { theme } = useTheme()

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Workout" component={WorkoutScreen} />
      <Stack.Screen name="RunTracker" component={RunTrackerScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <Stack.Screen name="UltraLab" component={UltraLabScreen} />
      <Stack.Screen name="Recovery" component={RecoveryScreen} />
      <Stack.Screen name="HomeExercises" component={HomeExercisesScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Admin" component={AdminScreen} />
    </Stack.Navigator>
  )
}

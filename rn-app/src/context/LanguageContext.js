import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { I18nManager } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'repmax-language'

const LANGUAGE_OPTIONS = [
  { value: 'english', label: 'English', nativeLabel: 'English' },
  { value: 'dutch', label: 'Dutch', nativeLabel: 'Nederlands' },
  { value: 'arabic', label: 'Arabic', nativeLabel: 'العربية' },
  { value: 'bruh', label: 'Gymbro', nativeLabel: 'YES BRUH!!' },
]

const RTL_LANGUAGES = new Set(['arabic'])

const translations = {
  english: {
    nav_home: 'Home', nav_progress: 'Progress', nav_diet: 'Diet', nav_chat: 'Chat', nav_coach: 'Coach', nav_profile: 'Profile',
    dashboard_notif_title: 'Enable Notifications', dashboard_notif_body: 'Get phone alerts for chats, calls, and gym invites',
    dashboard_today_workout: "Today's Workout", dashboard_start_workout: 'Start Workout', dashboard_rest_day: 'Rest Day',
    dashboard_recovery_hub: 'Recovery Hub', dashboard_current_program: 'Current Program', dashboard_recent_prs: 'Recent PRs',
    dashboard_workouts: 'Workouts', dashboard_day_streak: 'Day Streak',
    dashboard_run_beta: 'Run & Steps Beta', dashboard_run_beta_desc: 'Track your outdoor run, pace, and estimated steps live.',
    dashboard_run_cta: 'Open Run Tracker', dashboard_discord_title: 'Live Crew Energy',
    dashboard_discord_body: 'Jump into the REPMAX Discord for drops, gym check-ins, and product feedback that actually ships.',
    dashboard_discord_cta: 'Join Discord',
    social_title: 'Social', social_tab_chats: 'Chats', social_tab_friends: 'Friends', social_tab_add: 'Add',
    social_upcoming_sessions: 'Upcoming Sessions', social_planned: '{{count}} planned',
    social_no_messages: 'No Messages Yet', social_no_messages_desc: 'Start a chat from your Friends tab.',
    social_no_friends: 'No Friends Yet', social_no_friends_desc: 'Go to the Add tab to connect with friends using their username.',
    social_find_user: 'Find User', social_pending: 'Pending', social_your_username: 'Your Username',
    social_crew_title: 'Crew Hub', social_crew_body: 'Plan sessions, keep your circle active, and pull the most locked-in people into the Discord.',
    social_crew_primary: 'Join Discord', social_crew_secondary: 'Open Run Tracker',
    social_series_label: 'PRO Lock-In Series', social_series_desc: 'Turn one invite into a 4-week recurring gym plan.',
    social_single_session: 'One session', social_lockin_series: '4-week series',
    social_plan_workout: 'Plan a Workout', social_send_invite: 'Send Invite', social_create_group: 'Create New Group Chat',
    settings_title: 'Settings', settings_language: 'Language',
    settings_language_saved: 'Language set to {{language}}', settings_language_local_only: 'Language saved on this device',
    settings_push_test: 'Send Test Notification', settings_push_test_desc: 'Fire a test alert to this phone', settings_push_sent: 'Test notification sent',
    run_title: 'Run Tracker', run_subtitle: 'Outdoor beta with live pace, distance, and estimated steps.',
    run_start: 'Start Run', run_finish: 'Finish Run', run_pause: 'Pause', run_resume: 'Resume',
    run_duration: 'Duration', run_distance: 'Distance', run_pace: 'Pace', run_steps: 'Est. Steps', run_history: 'Recent Runs',
    run_beta_note: 'Apple Health direct sync is not available yet, so this beta tracks from location in real time.',
  },
  dutch: {
    nav_home: 'Home', nav_progress: 'Progressie', nav_diet: 'Voeding', nav_chat: 'Chat', nav_coach: 'Coach', nav_profile: 'Profiel',
    dashboard_notif_title: 'Zet meldingen aan', dashboard_notif_body: 'Krijg telefoonmeldingen voor chats, calls en gym invites',
    dashboard_today_workout: 'Workout van vandaag', dashboard_start_workout: 'Start workout', dashboard_rest_day: 'Rustdag',
    dashboard_recovery_hub: 'Recovery Hub', dashboard_current_program: 'Huidig programma', dashboard_recent_prs: 'Recente PRs',
    dashboard_workouts: 'Workouts', dashboard_day_streak: 'Dagen streak',
    dashboard_run_beta: 'Run & Stappen Beta', dashboard_run_beta_desc: 'Track je run buiten met live tempo, afstand en geschatte stappen.',
    dashboard_run_cta: 'Open Run Tracker', dashboard_discord_title: 'Live crew energy',
    dashboard_discord_body: 'Ga de REPMAX Discord in voor drops, gym check-ins en feedback die echt shipped.',
    dashboard_discord_cta: 'Join Discord',
    social_title: 'Sociaal', social_tab_chats: 'Chats', social_tab_friends: 'Vrienden', social_tab_add: 'Toevoegen',
    social_upcoming_sessions: 'Geplande sessies', social_planned: '{{count}} gepland',
    social_no_messages: 'Nog geen berichten', social_no_messages_desc: 'Start een chat via je Vrienden-tab.',
    social_no_friends: 'Nog geen vrienden', social_no_friends_desc: 'Ga naar Toevoegen om te connecten met gebruikersnamen.',
    social_find_user: 'Zoek gebruiker', social_pending: 'Openstaand', social_your_username: 'Jouw gebruikersnaam',
    social_crew_title: 'Crew Hub', social_crew_body: 'Plan sessies, houd je circle actief en trek de meest locked-in mensen de Discord in.',
    social_crew_primary: 'Join Discord', social_crew_secondary: 'Open Run Tracker',
    social_series_label: 'PRO Lock-In Serie', social_series_desc: 'Maak van één invite een terugkerend 4-weeks gymschema.',
    social_single_session: 'Eén sessie', social_lockin_series: '4-weekse serie',
    social_plan_workout: 'Plan een workout', social_send_invite: 'Stuur invite', social_create_group: 'Maak groepschat',
    settings_title: 'Instellingen', settings_language: 'Taal',
    settings_language_saved: 'Taal ingesteld op {{language}}', settings_language_local_only: 'Taal opgeslagen op dit apparaat',
    settings_push_test: 'Stuur testmelding', settings_push_test_desc: 'Stuur een testmelding naar deze telefoon', settings_push_sent: 'Testmelding verzonden',
    run_title: 'Run Tracker', run_subtitle: 'Outdoor beta met live tempo, afstand en geschatte stappen.',
    run_start: 'Start run', run_finish: 'Beëindig run', run_pause: 'Pauze', run_resume: 'Verder',
    run_duration: 'Duur', run_distance: 'Afstand', run_pace: 'Tempo', run_steps: 'Geschatte stappen', run_history: 'Recente runs',
    run_beta_note: 'Directe Apple Health-sync is nog niet beschikbaar, dus deze beta trackt live via locatie.',
  },
  arabic: {
    nav_home: 'الرئيسية', nav_progress: 'التقدم', nav_diet: 'التغذية', nav_chat: 'الدردشة', nav_coach: 'المدرب', nav_profile: 'الملف',
    dashboard_notif_title: 'فعّل الإشعارات', dashboard_notif_body: 'احصل على تنبيهات للهاتف للرسائل والمكالمات ودعوات الجيم',
    dashboard_today_workout: 'تمرين اليوم', dashboard_start_workout: 'ابدأ التمرين', dashboard_rest_day: 'يوم راحة',
    dashboard_recovery_hub: 'مركز التعافي', dashboard_current_program: 'البرنامج الحالي', dashboard_recent_prs: 'أحدث الأرقام',
    dashboard_workouts: 'التمارين', dashboard_day_streak: 'سلسلة الأيام',
    dashboard_run_beta: 'بيتا الجري والخطوات', dashboard_run_beta_desc: 'تتبّع الجري الخارجي والسرعة والمسافة والخطوات التقديرية مباشرة.',
    dashboard_run_cta: 'افتح متتبع الجري', dashboard_discord_title: 'طاقتك مع الكرو',
    dashboard_discord_body: 'ادخل ديسكورد REPMAX للدروب الجديدة وتنسيق الجيم والاقتراحات التي يتم تنفيذها.',
    dashboard_discord_cta: 'انضم إلى ديسكورد',
    social_title: 'اجتماعي', social_tab_chats: 'الدردشات', social_tab_friends: 'الأصدقاء', social_tab_add: 'إضافة',
    social_upcoming_sessions: 'الجلسات القادمة', social_planned: '{{count}} مخطط لها',
    social_no_messages: 'لا توجد رسائل بعد', social_no_messages_desc: 'ابدأ محادثة من تبويب الأصدقاء.',
    social_no_friends: 'لا يوجد أصدقاء بعد', social_no_friends_desc: 'اذهب إلى تبويب الإضافة للعثور على أصدقائك باسم المستخدم.',
    social_find_user: 'ابحث عن مستخدم', social_pending: 'قيد الانتظار', social_your_username: 'اسم المستخدم الخاص بك',
    social_crew_title: 'مركز الطاقم', social_crew_body: 'نظّم الجلسات، وحافظ على نشاط مجموعتك، واسحب الأكثر التزامًا إلى الديسكورد.',
    social_crew_primary: 'انضم إلى ديسكورد', social_crew_secondary: 'افتح متتبع الجري',
    social_series_label: 'سلسلة PRO', social_series_desc: 'حوّل دعوة واحدة إلى خطة جيم متكررة لأربعة أسابيع.',
    social_single_session: 'جلسة واحدة', social_lockin_series: 'سلسلة 4 أسابيع',
    social_plan_workout: 'خطط لتمرين', social_send_invite: 'أرسل دعوة', social_create_group: 'أنشئ مجموعة',
    settings_title: 'الإعدادات', settings_language: 'اللغة',
    settings_language_saved: 'تم ضبط اللغة إلى {{language}}', settings_language_local_only: 'تم حفظ اللغة على هذا الجهاز',
    settings_push_test: 'أرسل إشعارًا تجريبيًا', settings_push_test_desc: 'أرسل تنبيهًا تجريبيًا لهذا الهاتف', settings_push_sent: 'تم إرسال الإشعار التجريبي',
    run_title: 'متتبع الجري', run_subtitle: 'نسخة تجريبية للجري الخارجي مع السرعة والمسافة والخطوات التقديرية.',
    run_start: 'ابدأ الجري', run_finish: 'إنهاء الجري', run_pause: 'إيقاف مؤقت', run_resume: 'استئناف',
    run_duration: 'المدة', run_distance: 'المسافة', run_pace: 'السرعة', run_steps: 'الخطوات التقديرية', run_history: 'آخر الجريات',
    run_beta_note: 'المزامنة المباشرة مع Apple Health غير متاحة حاليًا، لذلك تتبع هذه النسخة التجريبية الجري عبر الموقع مباشرة.',
  },
  bruh: {
    nav_home: 'Base', nav_progress: 'Gains', nav_diet: 'Fuel', nav_chat: 'Crew', nav_coach: 'Coach', nav_profile: 'Aura',
    dashboard_notif_title: 'Turn on notifications', dashboard_notif_body: 'get pinged for chats, calls, and gym links',
    dashboard_today_workout: "today's work", dashboard_start_workout: 'lock in', dashboard_rest_day: 'rest day',
    dashboard_recovery_hub: 'recover up', dashboard_current_program: 'current split', dashboard_recent_prs: 'recent damage',
    dashboard_workouts: 'sessions', dashboard_day_streak: 'streak',
    dashboard_run_beta: 'run mode beta', dashboard_run_beta_desc: 'track the run, pace, and steps live bro.',
    dashboard_run_cta: 'open tracker', dashboard_discord_title: 'crew stays active',
    dashboard_discord_body: 'discord is where the drops land first and the locked-in people stay active.',
    dashboard_discord_cta: 'join up',
    social_title: 'crew', social_tab_chats: 'texts', social_tab_friends: 'bros', social_tab_add: 'add',
    social_upcoming_sessions: 'lock-ins', social_planned: '{{count}} lined up',
    social_no_messages: 'no chats yet', social_no_messages_desc: 'go text the bros.',
    social_no_friends: 'no bros yet', social_no_friends_desc: 'hit add and find your people.',
    social_find_user: 'find bro', social_pending: 'pending', social_your_username: 'your @',
    social_crew_title: 'crew hub', social_crew_body: 'plan sessions, stay active, and drag the real ones into the discord.',
    social_crew_primary: 'join discord', social_crew_secondary: 'open tracker',
    social_series_label: 'pro lock-in series', social_series_desc: 'one invite turns into a 4-week grind streak.',
    social_single_session: 'one session', social_lockin_series: '4-week lock-in',
    social_plan_workout: 'plan a lock-in', social_send_invite: 'send it', social_create_group: 'make gc',
    settings_title: 'settings', settings_language: 'language',
    settings_language_saved: '{{language}} mode on', settings_language_local_only: 'saved on this phone',
    settings_push_test: 'send test ping', settings_push_test_desc: 'hit this phone with a test', settings_push_sent: 'test ping sent',
    run_title: 'run tracker', run_subtitle: 'outdoor beta. pace, distance, steps. simple.',
    run_start: 'start run', run_finish: 'finish run', run_pause: 'pause', run_resume: 'resume',
    run_duration: 'time', run_distance: 'distance', run_pace: 'pace', run_steps: 'steps', run_history: 'recent runs',
    run_beta_note: 'apple health sync is not there yet so this one tracks from location.',
  },
}

function normalizeLanguageValue(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return 'english'
  if (normalized === 'yes bruh!!' || normalized === 'gymbro') return 'bruh'
  if (['english', 'dutch', 'arabic', 'bruh'].includes(normalized)) return normalized
  return 'english'
}

function interpolate(message, vars = {}) {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    message
  )
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const { profile } = useAuth()
  const [language, setLanguageState] = useState('english')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (stored) setLanguageState(normalizeLanguageValue(stored))
      else if (profile?.language) setLanguageState(normalizeLanguageValue(profile.language))
    }).catch(() => {})
  }, [profile?.language])

  useEffect(() => {
    const isRtl = RTL_LANGUAGES.has(language)
    if (I18nManager.isRTL !== isRtl) {
      I18nManager.forceRTL(isRtl)
    }
  }, [language])

  function setLanguage(nextLanguage) {
    const normalized = normalizeLanguageValue(nextLanguage)
    setLanguageState(normalized)
    AsyncStorage.setItem(STORAGE_KEY, normalized).catch(() => {})
    return normalized
  }

  function t(key, vars) {
    const english = translations.english[key] || key
    const localized = translations[language]?.[key] || english
    return interpolate(localized, vars)
  }

  const value = useMemo(() => ({
    language, setLanguage, t,
    languageOptions: LANGUAGE_OPTIONS,
    isRtl: RTL_LANGUAGES.has(language),
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}

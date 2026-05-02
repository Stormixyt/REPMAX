import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.repmax.app',
  appName: 'REPMAX',
  webDir: 'dist',
  
  // Use bundled web assets (not a remote server)
  // This ensures the app works offline and loads instantly
  server: {
    // During development, uncomment this to live reload:
    // url: 'http://YOUR_LOCAL_IP:5173',
    // cleartext: true,
    
    androidScheme: 'https',
    iosScheme: 'capacitor',
    // Allow all connections to Supabase, Vercel API, etc.
    allowNavigation: [
      'hqwnyzmipumhhqmvdzus.supabase.co',
      '*.supabase.co',
      '*.vercel.app',
      '*.googleapis.com',
      '*.firebaseapp.com',
      '*.livekit.cloud',
    ]
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#000000',
      showSpinner: false,
      launchFadeOutDuration: 300,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'body' as any,
      style: 'DARK' as any,
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Camera: {},
  },

  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: '#000000',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: false,
  },

  android: {
    backgroundColor: '#000000',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;

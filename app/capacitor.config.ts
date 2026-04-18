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
      launchShowDuration: 2000,
      launchAutoHide: false, // We'll hide it manually after auth check
      backgroundColor: '#070707',
      showSpinner: false,
      launchFadeOutDuration: 300,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',           // Light text on dark background
      backgroundColor: '#070707',
      overlaysWebView: true,   // Content goes under the status bar (we handle safe area in CSS)
    },
    Keyboard: {
      resize: 'body' as any,
      style: 'DARK' as any,
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Camera: {
      // No special config needed — permissions in Info.plist
    },
  },

  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: '#070707',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;

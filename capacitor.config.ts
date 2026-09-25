import type { CapacitorConfig } from '@capacitor/cli';

const isLocalDev = process.env.CAPACITOR_LOCAL === 'true';

const config: CapacitorConfig = {
  appId: 'com.fixtray.app',
  appName: 'FixTray Pro',
  // webDir is unused while server.url is set. The logo intro is a native
  // overlay (android res/raw and the iOS bundle), not a page on the website.
  webDir: 'capacitor-fallback',
  server: isLocalDev
    ? {
        // For local dev: point to your dev machine's IP
        // Run: CAPACITOR_LOCAL=true npx cap copy android
        url: 'http://10.0.2.2:3000/auth/login?from=intro',
        cleartext: true,
      }
    : {
        // Production stays on fixtray.app so Capacitor plugins keep working.
        // from=intro lets a valid session continue to that role's dashboard.
        url: 'https://fixtray.app/auth/login?from=intro',
        cleartext: false,
      },
  android: {
    allowMixedContent: false,
    overrideUserAgent: 'FixTray-Android-App-Pro',
    webContentsDebuggingEnabled: false,
    backgroundColor: '#020608',
  },
  ios: {
    contentInset: 'automatic',
    overrideUserAgent: 'FixTray-iOS-App-Pro',
    allowsLinkPreview: false,
    scheme: 'fixtray',
    backgroundColor: '#020608',
  },
  plugins: {
    // Camera for photo capture and barcode scanning
    Camera: {
      allowEditing: true,
      saveToGallery: false,
      quality: 85,
      width: 1920,
      height: 1440,
      preserveAspectRatio: true,
    },
    // Geolocation for technician location tracking
    Geolocation: {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    },
    // Push notifications
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // Local notifications
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#E5332A',
      sound: 'default',
    },
    // File system for offline storage
    Filesystem: {
      // Default configuration
    },
    // Network status detection
    Network: {
      // Default configuration
    },
    // Device information
    Device: {
      // Default configuration
    },
    // Status bar styling
    StatusBar: {
      style: 'dark',
      backgroundColor: '#020608',
      overlaysWebView: false,
    },
    // Splash screen
    SplashScreen: {
      launchAutoHide: true,
      // Brief F+T splash. The activity then holds the same white mark
      // and plays the bundled intro on top of the WebView.
      launchShowDuration: 400,
      backgroundColor: '#FFFFFF',
      showSpinner: false,
      spinnerColor: '#E5332A',
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
    },
    // Barcode scanner
    BarcodeScanner: {
      formats: ['QR_CODE', 'CODE_128', 'CODE_39', 'EAN_8', 'EAN_13', 'UPC_A', 'UPC_E', 'ITF', 'CODABAR'],
    },
    // Haptics for tactile feedback
    Haptics: {
      // Default configuration
    },
    // Motion sensors
    Motion: {
      // Default configuration
    },
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV !== 'production';

const config: CapacitorConfig = {
  appId: 'com.sponti.app',
  appName: 'Sponti',
  webDir: 'out',
  // In dev, point to the Next.js dev server for live reload
  server: isDev ? {
    url: '192.168.178.185',
    cleartext: true,
  } : undefined,
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    StatusBar: {
      style: 'default',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;

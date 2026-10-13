import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tracer.executive',
  appName: 'Tracer',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#090A0D',
    },
  },
  android: {
    backgroundColor: '#090A0D',
    allowMixedContent: true,
  },
};

export default config;

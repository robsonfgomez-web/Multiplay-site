import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.multiplay.entretenimento',
  appName: 'MultiPlay',
  webDir: 'www',
  server: {
    url: 'https://multiplay-site.onrender.com',
    cleartext: false
  }
};

export default config;

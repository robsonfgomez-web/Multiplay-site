import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.multiplay.entretenimento',
  appName: 'Multiplay',
  webDir: 'www',
  server: {
    url: 'https://multiplay-site.onrender.com/login.html',
    cleartext: false
  }
};

export default config;
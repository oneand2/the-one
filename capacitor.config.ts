import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.theone.er',
  appName: '二',
  webDir: 'out',
  server: {
    url: 'https://www.the-one-and-the-two.com',
    androidScheme: 'https',
    cleartext: true
  }
};

export default config;

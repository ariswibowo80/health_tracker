// services/firebaseConfig.ts
// Inisialisasi Firebase yang aman untuk Expo (Android & Web / React Native Web).
// Menggunakan modular SDK v9+ agar tree-shaking optimal di bundle web.

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  browserLocalPersistence,
  Auth,
} from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Simpan kredensial di file .env / app.config.js (expo-constants),
// JANGAN hardcode di source control.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth: persistence berbeda antara native (AsyncStorage) dan web (localStorage)
let authInstance: Auth;
if (Platform.OS === 'web') {
  authInstance = getAuth(app);
  authInstance.setPersistence(browserLocalPersistence);
} else {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
}
export const auth = authInstance;

// Firestore: aktifkan cache long-polling agar stabil di WebView/emulator Android
export const db: Firestore =
  Platform.OS === 'web'
    ? getFirestore(app)
    : initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });

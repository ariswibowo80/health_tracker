// services/authService.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { auth } from './firebaseConfig';

export async function registerFamilyAccount(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginFamilyAccount(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Login Google khusus platform Web — memakai popup bawaan Firebase Auth.
 * Untuk Android/iOS, gunakan `loginWithGoogleIdToken()` bersama hook
 * `Google.useIdTokenAuthRequest()` dari expo-auth-session (lihat app/login.tsx).
 */
export async function loginWithGoogleWeb() {
  if (Platform.OS !== 'web') {
    throw new Error('loginWithGoogleWeb() hanya untuk platform web.');
  }
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

/**
 * Login Google untuk Android/iOS — menerima id_token hasil dari
 * expo-auth-session, lalu menukarnya menjadi sesi Firebase Auth.
 */
export async function loginWithGoogleIdToken(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken);
  const cred = await signInWithCredential(auth, credential);
  return cred.user;
}

export async function logoutFamilyAccount() {
  await signOut(auth);
}

export function listenAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// app/login.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import {
  loginFamilyAccount,
  registerFamilyAccount,
  loginWithGoogleWeb,
  loginWithGoogleIdToken,
} from '../services/authService';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Konfigurasi OAuth Google. PENTING: key untuk platform web WAJIB bernama
  // `webClientId` (bukan `clientId`) — kalau bernilai undefined, hook ini
  // akan MELEMPAR ERROR SAAT KOMPONEN DIMUAT dan meng-crash seluruh app.
  // Karena itu kita selalu kirim string non-kosong (placeholder kalau env
  // var belum diisi), dan baru mengecek konfigurasi asli saat tombol diklik.
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  // Di Web, signInWithPopup(GoogleAuthProvider) memakai konfigurasi OAuth
  // bawaan Firebase — TIDAK butuh Client ID manual. Env var di atas hanya
  // relevan untuk Android/iOS (expo-auth-session), jadi pengecekan
  // "belum dikonfigurasi" juga hanya berlaku untuk native.
  const googleConfigured = Platform.OS === 'web' ? true : !!googleAndroidClientId;

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleWebClientId || 'not-configured.apps.googleusercontent.com',
    androidClientId: googleAndroidClientId || 'not-configured.apps.googleusercontent.com',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'not-configured.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success' && response.params.id_token) {
      setGoogleLoading(true);
      loginWithGoogleIdToken(response.params.id_token)
        .catch(() => setError('Login Google gagal. Silakan coba lagi.'))
        .finally(() => setGoogleLoading(false));
    } else if (response?.type === 'error') {
      setError('Login Google dibatalkan atau gagal.');
    }
  }, [response]);

  async function handleGoogleLogin() {
    setError(null);
    if (!googleConfigured) {
      setError('Login Google belum diaktifkan oleh admin aplikasi ini.');
      return;
    }
    if (Platform.OS === 'web') {
      setGoogleLoading(true);
      try {
        await loginWithGoogleWeb();
      } catch (e) {
        setError('Login Google gagal. Silakan coba lagi.');
      } finally {
        setGoogleLoading(false);
      }
    } else {
      await promptAsync();
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!email || !password) {
      setError('Email dan kata sandi wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await loginFamilyAccount(email, password);
      } else {
        await registerFamilyAccount(email, password);
      }
      // Navigasi ditangani otomatis oleh listener auth di app/_layout.tsx
    } catch (e: any) {
      setError(mapAuthError(e?.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-slate-50 items-center justify-center px-6"
    >
      <View className="w-full max-w-[400px] bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <Text className="text-2xl font-bold text-slate-900 mb-1">Health Tracker</Text>
        <Text className="text-slate-500 text-sm mb-6">
          {mode === 'login' ? 'Masuk ke akun keluarga Anda' : 'Buat akun keluarga baru'}
        </Text>

        <Text className="text-slate-700 text-xs font-medium mb-1">Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="nama@email.com"
          className="border border-slate-200 rounded-xl px-3 py-2.5 mb-4 text-slate-900"
        />

        <Text className="text-slate-700 text-xs font-medium mb-1">Kata Sandi</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Minimal 6 karakter"
          className="border border-slate-200 rounded-xl px-3 py-2.5 mb-2 text-slate-900"
        />

        {error && <Text className="text-red-600 text-xs mb-3">{error}</Text>}

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className="bg-teal-700 rounded-xl py-3 items-center mt-2 disabled:opacity-60"
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white font-semibold text-sm">
              {mode === 'login' ? 'Masuk' : 'Daftar'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleGoogleLogin}
          disabled={googleLoading || (Platform.OS !== 'web' && !request)}
          className="border border-slate-200 rounded-xl py-3 items-center mt-3 flex-row justify-center gap-2 disabled:opacity-60"
        >
          {googleLoading ? (
            <ActivityIndicator color="#0F766E" size="small" />
          ) : (
            <>
              <Text className="text-base">🔵</Text>
              <Text className="text-slate-700 font-medium text-sm">Masuk dengan Google</Text>
            </>
          )}
        </Pressable>
        {!googleConfigured && (
          <Text className="text-slate-400 text-[10px] text-center mt-1">
            (Login Google belum aktif — gunakan email di atas)
          </Text>
        )}

        <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} className="mt-4">
          <Text className="text-teal-700 text-xs text-center">
            {mode === 'login' ? 'Belum punya akun? Daftar di sini' : 'Sudah punya akun? Masuk di sini'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function mapAuthError(code?: string) {
  switch (code) {
    case 'auth/unauthorized-domain':
      return 'Domain ini belum diizinkan di Firebase Console (Authentication > Settings > Authorized domains).';
    case 'auth/popup-closed-by-user':
      return 'Jendela login Google ditutup sebelum selesai.';
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/email-already-in-use':
      return 'Email sudah terdaftar. Silakan masuk.';
    case 'auth/weak-password':
      return 'Kata sandi minimal 6 karakter.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau kata sandi salah.';
    default:
      return 'Terjadi kesalahan. Silakan coba lagi.';
  }
}

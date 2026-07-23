// app/login.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { loginFamilyAccount, registerFamilyAccount } from '../services/authService';

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

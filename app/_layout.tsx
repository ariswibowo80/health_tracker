// app/_layout.tsx
import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { User } from 'firebase/auth';
import { listenAuthState } from '../services/authService';

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = belum diketahui
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = listenAuthState(setUser);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user === undefined) return; // masih menunggu status auth pertama kali

    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, segments]);

  if (user === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="members/new" options={{ headerShown: true, title: 'Tambah Profil' }} />
      <Stack.Screen name="members/[id]/index" options={{ headerShown: true, title: 'Detail Profil' }} />
      <Stack.Screen name="members/[id]/sickness" options={{ headerShown: true, title: 'Catatan Sakit' }} />
      <Stack.Screen name="members/[id]/lab" options={{ headerShown: true, title: 'Lab & MCU' }} />
      <Stack.Screen name="members/[id]/lifestyle" options={{ headerShown: true, title: 'Harian & Obat Rutin' }} />
    </Stack>
  );
}

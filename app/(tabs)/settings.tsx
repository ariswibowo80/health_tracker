// app/(tabs)/settings.tsx
import { View, Text, Pressable, Alert } from 'react-native';
import { auth } from '../../services/firebaseConfig';
import { logoutFamilyAccount } from '../../services/authService';

export default function SettingsScreen() {
  const email = auth.currentUser?.email ?? '-';

  function handleLogout() {
    Alert.alert('Keluar Akun', 'Anda yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => logoutFamilyAccount() },
    ]);
  }

  return (
    <View className="flex-1 bg-slate-50 p-4 md:p-8">
      <Text className="text-2xl font-bold text-slate-900 mb-6">Pengaturan</Text>

      <View className="bg-white rounded-2xl p-4 border border-slate-100 mb-4 max-w-[480px]">
        <Text className="text-slate-500 text-xs mb-1">Akun masuk sebagai</Text>
        <Text className="text-slate-900 font-medium">{email}</Text>
      </View>

      <Pressable
        onPress={handleLogout}
        className="bg-red-50 rounded-xl py-3 items-center max-w-[480px]"
      >
        <Text className="text-red-600 font-semibold text-sm">Keluar Akun</Text>
      </Pressable>

      <Text className="text-slate-400 text-xs mt-8">
        Nilai referensi lab pada aplikasi ini adalah acuan umum, bukan pengganti
        interpretasi dokter. Selalu konsultasikan hasil kesehatan dengan tenaga
        medis profesional.
      </Text>
    </View>
  );
}

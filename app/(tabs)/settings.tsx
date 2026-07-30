// app/(tabs)/settings.tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, Platform, TextInput, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { auth } from '../../services/firebaseConfig';
import { logoutFamilyAccount } from '../../services/authService';
import {
  ensureHouseholdAndGetActiveOwner,
  getHousehold,
  inviteByEmail,
  claimInvitation,
} from '../../services/householdService';

export default function SettingsScreen() {
  const email = auth.currentUser?.email ?? '-';
  const [memberEmails, setMemberEmails] = useState<string[]>([]);
  const [isOwnerHere, setIsOwnerHere] = useState(true);
  const [loadingHousehold, setLoadingHousehold] = useState(true);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const loadHousehold = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoadingHousehold(true);
    try {
      const ownerUid = await ensureHouseholdAndGetActiveOwner(user.uid, user.email);
      setIsOwnerHere(ownerUid === user.uid);
      const household = await getHousehold(ownerUid);
      setMemberEmails(household?.memberEmails ?? []);
    } finally {
      setLoadingHousehold(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHousehold();
    }, [loadHousehold])
  );

  async function handleInvite() {
    setInviteMsg(null);
    const user = auth.currentUser;
    if (!user || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const ownerUid = await ensureHouseholdAndGetActiveOwner(user.uid, user.email);
      await inviteByEmail(ownerUid, inviteEmail.trim());
      setInviteEmail('');
      setInviteMsg('Undangan tersimpan. Minta pasangan login/daftar dengan email itu, lalu tekan "Terima Undangan" di Pengaturan mereka.');
      await loadHousehold();
    } catch {
      setInviteMsg('Gagal menyimpan undangan. Coba lagi.');
    } finally {
      setInviting(false);
    }
  }

  async function handleClaimInvitation() {
    setClaimMsg(null);
    const user = auth.currentUser;
    if (!user || !user.email) return;
    setClaiming(true);
    try {
      const joined = await claimInvitation(user.uid, user.email);
      if (joined) {
        setClaimMsg('Berhasil bergabung! Data keluarga sekarang bisa Anda lihat & edit bersama.');
        await loadHousehold();
      } else {
        setClaimMsg('Belum ada undangan yang cocok untuk email ini. Pastikan pasangan Anda sudah mengundang email ini terlebih dahulu.');
      }
    } catch {
      setClaimMsg('Gagal memproses undangan. Coba lagi.');
    } finally {
      setClaiming(false);
    }
  }

  function handleLogout() {
    // Alert.alert bawaan React Native tidak menampilkan dialog konfirmasi
    // yang berfungsi penuh di platform Web (react-native-web), jadi di web
    // kita pakai window.confirm bawaan browser sebagai gantinya.
    if (Platform.OS === 'web') {
      if (window.confirm('Anda yakin ingin keluar?')) {
        logoutFamilyAccount();
      }
      return;
    }

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

      {/* Berbagi akses keluarga */}
      <View className="bg-white rounded-2xl p-4 border border-slate-100 mb-4 max-w-[480px]">
        <Text className="text-slate-900 font-semibold text-sm mb-1">Berbagi Akses Keluarga</Text>
        <Text className="text-slate-500 text-xs mb-3">
          Undang pasangan supaya bisa melihat & mengedit data profil keluarga yang sama.
        </Text>

        {loadingHousehold ? (
          <ActivityIndicator color="#0F766E" size="small" />
        ) : (
          <>
            {memberEmails.length > 0 && (
              <View className="mb-3">
                <Text className="text-slate-400 text-[10px] mb-1">Anggota dengan akses:</Text>
                {memberEmails.map((e) => (
                  <Text key={e} className="text-slate-700 text-xs">• {e}</Text>
                ))}
              </View>
            )}

            {isOwnerHere ? (
              <>
                <Text className="text-slate-700 text-xs font-medium mb-1">Undang lewat email</Text>
                <View className="flex-row gap-2 mb-1">
                  <TextInput
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="email pasangan@contoh.com"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <Pressable
                    onPress={handleInvite}
                    disabled={inviting}
                    className="bg-teal-700 rounded-lg px-4 py-2 items-center justify-center disabled:opacity-60"
                  >
                    {inviting ? <ActivityIndicator color="#fff" size="small" /> : (
                      <Text className="text-white text-xs font-medium">Undang</Text>
                    )}
                  </Pressable>
                </View>
                {inviteMsg && <Text className="text-slate-500 text-[11px] mt-1">{inviteMsg}</Text>}
              </>
            ) : (
              <Text className="text-emerald-700 text-xs">
                Anda sudah bergabung dengan household keluarga ini.
              </Text>
            )}

            <View className="border-t border-slate-100 mt-3 pt-3">
              <Text className="text-slate-700 text-xs font-medium mb-1">Sudah diundang? Terima di sini</Text>
              <Pressable
                onPress={handleClaimInvitation}
                disabled={claiming}
                className="border border-teal-700 rounded-lg py-2 items-center disabled:opacity-60"
              >
                {claiming ? <ActivityIndicator color="#0F766E" size="small" /> : (
                  <Text className="text-teal-700 text-xs font-medium">Terima Undangan</Text>
                )}
              </Pressable>
              {claimMsg && <Text className="text-slate-500 text-[11px] mt-1">{claimMsg}</Text>}
            </View>
          </>
        )}
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

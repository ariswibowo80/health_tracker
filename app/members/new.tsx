import type { ReactNode } from 'react';
// app/members/new.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { auth } from '../../services/firebaseConfig';
import { ensureHouseholdAndGetActiveOwner } from '../../services/householdService';
import { createFamilyMember } from '../../services/firestoreService';
import { MemberRole } from '../../types/health';
import ScreenHeader from '../../components/ScreenHeader';

const AVATAR_COLORS = ['#0F766E', '#2563EB', '#D97706', '#DB2777', '#7C3AED', '#059669'];

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'anak', label: 'Anak' },
  { value: 'dewasa', label: 'Dewasa' },
  { value: 'lansia', label: 'Lansia' },
];

export default function NewMemberScreen() {
  const [name, setName] = useState('');
  const [role, setRole] = useState<MemberRole>('dewasa');
  const [birthDate, setBirthDate] = useState(''); // format YYYY-MM-DD
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [colorIndex, setColorIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const user = auth.currentUser;
    if (!user) return;

    if (!name.trim()) {
      setError('Nama wajib diisi.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      setError('Tanggal lahir harus format YYYY-MM-DD, mis. 2019-05-12.');
      return;
    }

    setSaving(true);
    try {
      const ownerUid = await ensureHouseholdAndGetActiveOwner(user.uid, user.email);
      const id = await createFamilyMember({
        ownerUid,
        name: name.trim(),
        role,
        birthDate,
        gender,
        avatarColor: AVATAR_COLORS[colorIndex],
      });
      router.replace(`/members/${id}`);
    } catch (e) {
      setError('Gagal menyimpan profil. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-slate-50">
      <ScreenHeader title="Tambah Profil" fallbackHref="/(tabs)/members" />
      <ScrollView className="flex-1" contentContainerClassName="p-4 md:p-8">
      <View className="bg-white rounded-2xl p-5 border border-slate-100 max-w-[480px] w-full">
        <Text className="text-lg font-bold text-slate-900 mb-4">Profil Anggota Keluarga Baru</Text>

        <Field label="Nama Lengkap">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="mis. Gendis"
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900"
          />
        </Field>

        <Field label="Tanggal Lahir (YYYY-MM-DD)">
          <TextInput
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="2019-05-12"
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900"
          />
        </Field>

        <Field label="Kategori">
          <View className="flex-row gap-2">
            {ROLE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setRole(opt.value)}
                className={`px-3 py-2 rounded-lg border ${
                  role === opt.value ? 'bg-teal-700 border-teal-700' : 'border-slate-200'
                }`}
              >
                <Text className={role === opt.value ? 'text-white text-xs' : 'text-slate-700 text-xs'}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Jenis Kelamin">
          <View className="flex-row gap-2">
            {(['L', 'P'] as const).map((g) => (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                className={`px-4 py-2 rounded-lg border ${
                  gender === g ? 'bg-teal-700 border-teal-700' : 'border-slate-200'
                }`}
              >
                <Text className={gender === g ? 'text-white text-xs' : 'text-slate-700 text-xs'}>
                  {g === 'L' ? 'Laki-laki' : 'Perempuan'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Warna Profil">
          <View className="flex-row gap-2">
            {AVATAR_COLORS.map((c, i) => (
              <Pressable
                key={c}
                onPress={() => setColorIndex(i)}
                style={{ backgroundColor: c }}
                className={`w-8 h-8 rounded-full ${colorIndex === i ? 'border-2 border-slate-900' : ''}`}
              />
            ))}
          </View>
        </Field>

        {error && <Text className="text-red-600 text-xs mb-3">{error}</Text>}

        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="bg-teal-700 rounded-xl py-3 items-center mt-2 disabled:opacity-60"
        >
          {saving ? <ActivityIndicator color="#fff" size="small" /> : (
            <Text className="text-white font-semibold text-sm">Simpan Profil</Text>
          )}
        </Pressable>
      </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-slate-700 text-xs font-medium mb-1">{label}</Text>
      {children}
    </View>
  );
}

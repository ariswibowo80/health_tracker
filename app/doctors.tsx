// app/doctors/index.tsx
import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { auth } from '../services/firebaseConfig';
import { ensureHouseholdAndGetActiveOwner } from '../services/householdService';
import { DoctorService } from '../services/firestoreService';
import { Doctor, WeeklySchedule } from '../types/health';
import ScreenHeader from '../components/ScreenHeader';
import { WeeklyScheduleEditor, WeeklyScheduleView, isScheduleValid } from '../components/WeeklySchedule';

type WithId<T> = T & { id: string };

export default function DoctorsScreen() {
  const [householdOwnerUid, setHouseholdOwnerUid] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<WithId<Doctor>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<WithId<Doctor> | null>(null);

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      const ownerUid = await ensureHouseholdAndGetActiveOwner(user.uid, user.email);
      setHouseholdOwnerUid(ownerUid);
      setDoctors(await DoctorService.list(ownerUid));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleDelete(doctor: WithId<Doctor>) {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Hapus profil dokter "${doctor.name}"? Riwayat kunjungan lama yang sudah tercatat tidak akan terhapus, hanya profilnya saja.`)
        : true; // di native, konfirmasi ditangani lewat Alert di pemanggil tombol (disederhanakan di sini)
    if (!confirmed) return;
    await DoctorService.delete(doctor.id);
    await load();
  }

  return (
    <View className="flex-1 bg-slate-50">
      <ScreenHeader title="Daftar Dokter" fallbackHref="/(tabs)/settings" />
      <ScrollView className="flex-1" contentContainerClassName="p-4 md:p-8">
        <Text className="text-xs text-slate-400 mb-4">
          Profil dokter ini dibagikan ke seluruh anggota keluarga yang punya akses (termasuk pasangan
          kalau sudah diundang), dan bisa dipilih ulang saat mencatat kunjungan dokter di modul Catatan Sakit.
        </Text>

        <Pressable
          onPress={() => { setEditingDoctor(null); setShowNewForm(!showNewForm); }}
          className="bg-teal-700 rounded-xl py-3 items-center mb-4 max-w-[220px]"
        >
          <Text className="text-white font-medium text-sm">
            {showNewForm ? 'Tutup Form' : '+ Tambah Dokter Baru'}
          </Text>
        </Pressable>

        {(showNewForm || editingDoctor) && householdOwnerUid && (
          <DoctorForm
            householdOwnerUid={householdOwnerUid}
            existing={editingDoctor ?? undefined}
            onCancel={() => { setShowNewForm(false); setEditingDoctor(null); }}
            onSaved={async () => {
              setShowNewForm(false);
              setEditingDoctor(null);
              await load();
            }}
          />
        )}

        {loading ? (
          <ActivityIndicator color="#0F766E" />
        ) : doctors.length === 0 ? (
          <Text className="text-slate-400 text-sm">Belum ada profil dokter tersimpan.</Text>
        ) : (
          <View className="gap-2">
            {doctors.map((d) => (
              <View key={d.id} className="bg-white rounded-xl p-3 border border-slate-100">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-slate-900 font-medium text-sm">{d.name}</Text>
                    {d.specialization && (
                      <Text className="text-slate-500 text-xs mt-0.5">{d.specialization}</Text>
                    )}
                    {d.practiceLocation && (
                      <Text className="text-slate-500 text-xs">📍 {d.practiceLocation}</Text>
                    )}
                    {d.phone && <Text className="text-slate-500 text-xs">📞 {d.phone}</Text>}
                  </View>
                  <View className="flex-row gap-3 ml-2">
                    <Pressable onPress={() => { setEditingDoctor(d); setShowNewForm(false); }}>
                      <Text className="text-teal-700 text-xs font-medium">Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => handleDelete(d)}>
                      <Text className="text-red-600 text-xs font-medium">Hapus</Text>
                    </Pressable>
                  </View>
                </View>
                <WeeklyScheduleView schedule={d.weeklySchedule ?? d.practiceSchedule} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function DoctorForm({
  householdOwnerUid,
  existing,
  onSaved,
  onCancel,
}: {
  householdOwnerUid: string;
  existing?: WithId<Doctor>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [specialization, setSpecialization] = useState(existing?.specialization ?? '');
  const [practiceLocation, setPracticeLocation] = useState(existing?.practiceLocation ?? '');
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(existing?.weeklySchedule ?? {});
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    if (!isScheduleValid(weeklySchedule)) {
      setError('Format jam ada yang salah. Gunakan format HH:MM, mis. 09:00.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        ownerUid: householdOwnerUid,
        name: name.trim(),
        specialization: specialization || undefined,
        practiceLocation: practiceLocation || undefined,
        weeklySchedule: Object.keys(weeklySchedule).length > 0 ? weeklySchedule : undefined,
        phone: phone || undefined,
      };
      if (existing) {
        await DoctorService.update(existing.id, payload);
      } else {
        await DoctorService.create(payload);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="bg-white rounded-2xl p-4 border border-slate-100 mb-5 gap-2">
      <Text className="text-slate-900 font-semibold text-sm mb-1">
        {existing ? 'Edit Profil Dokter' : 'Profil Dokter Baru'}
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Nama dokter, mis. dr. Cynthia Utami"
        className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
      />
      <TextInput
        value={specialization}
        onChangeText={setSpecialization}
        placeholder="Spesialisasi, mis. Sp.A (Dokter Anak)"
        className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
      />
      <TextInput
        value={practiceLocation}
        onChangeText={setPracticeLocation}
        placeholder="Tempat praktik, mis. RS Grha Kedoya"
        className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
      />
      <WeeklyScheduleEditor value={weeklySchedule} onChange={setWeeklySchedule} />
      <TextInput
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="No. telepon (opsional)"
        className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
      />
      {error && <Text className="text-red-600 text-xs">{error}</Text>}
      <View className="flex-row gap-2 mt-1">
        <Pressable onPress={onCancel} className="flex-1 border border-slate-200 rounded-xl py-3 items-center">
          <Text className="text-slate-600 text-sm">Batal</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="flex-1 bg-teal-700 rounded-xl py-3 items-center disabled:opacity-60"
        >
          <Text className="text-white font-semibold text-sm">
            {saving ? 'Menyimpan...' : existing ? 'Simpan Perubahan' : 'Simpan Dokter'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

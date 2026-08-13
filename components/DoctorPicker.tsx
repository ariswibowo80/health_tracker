// components/DoctorPicker.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Doctor, WeeklySchedule } from '../types/health';
import { WeeklyScheduleEditor, WeeklyScheduleView, isScheduleValid } from './WeeklySchedule';

type WithId<T> = T & { id: string };

interface Props {
  doctors: WithId<Doctor>[];
  /** Nama dokter yang sedang terisi di form (bisa hasil ketik bebas atau hasil pilih). */
  value: string;
  onChangeText: (text: string) => void;
  /** Dipanggil saat user memilih dokter dari daftar — form pemanggil biasanya
   * langsung mengisi juga field fasilitas/telp dari data dokter ini. */
  onSelectDoctor: (doctor: WithId<Doctor>) => void;
  /** Dipanggil setelah profil dokter baru berhasil dibuat lewat form inline. */
  onCreateDoctor: (data: Omit<Doctor, 'createdAt'>) => Promise<WithId<Doctor>>;
  householdOwnerUid: string;
}

export default function DoctorPicker({
  doctors,
  value,
  onChangeText,
  onSelectDoctor,
  onCreateDoctor,
  householdOwnerUid,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form tambah dokter baru
  const [newSpecialization, setNewSpecialization] = useState('');
  const [newPractice, setNewPractice] = useState('');
  const [newSchedule, setNewSchedule] = useState<WeeklySchedule>({});
  const [newPhone, setNewPhone] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const query = value.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!query) return doctors.slice(0, 6);
    return doctors.filter((d) => d.name.toLowerCase().includes(query)).slice(0, 6);
  }, [doctors, query]);

  const exactMatch = doctors.some((d) => d.name.toLowerCase() === query);
  const showDropdown = focused && !showNewForm;

  function handlePick(doctor: WithId<Doctor>) {
    onChangeText(doctor.name);
    onSelectDoctor(doctor);
    setFocused(false);
  }

  function handleStartNewDoctor() {
    setNewSpecialization('');
    setNewPractice('');
    setNewSchedule({});
    setNewPhone('');
    setScheduleError(null);
    setShowNewForm(true);
  }

  async function handleSaveNewDoctor() {
    if (!value.trim()) return;
    if (!isScheduleValid(newSchedule)) {
      setScheduleError('Format jam ada yang salah. Gunakan format HH:MM, mis. 09:00.');
      return;
    }
    setScheduleError(null);
    setSaving(true);
    try {
      const payload: Omit<Doctor, 'createdAt'> = {
        ownerUid: householdOwnerUid,
        name: value.trim(),
        specialization: newSpecialization || undefined,
        practiceLocation: newPractice || undefined,
        weeklySchedule: Object.keys(newSchedule).length > 0 ? newSchedule : undefined,
        phone: newPhone || undefined,
      };
      const created = await onCreateDoctor(payload);
      onChangeText(created.name);
      onSelectDoctor(created);
      setShowNewForm(false);
      setFocused(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="relative z-10">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Ketik nama dokter, mis. dr. Cynthia Utami"
        className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
      />

      {showDropdown && (
        <View className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 shadow-sm max-h-56 overflow-hidden">
          <ScrollView keyboardShouldPersistTaps="handled">
            {matches.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => handlePick(d)}
                className="px-3 py-2 border-b border-slate-50 web:hover:bg-slate-50"
              >
                <Text className="text-slate-900 text-xs font-medium">{d.name}</Text>
                <Text className="text-slate-400 text-[10px]">
                  {[d.specialization, d.practiceLocation].filter(Boolean).join(' · ') || 'Tanpa detail'}
                </Text>
              </Pressable>
            ))}
            {!exactMatch && value.trim().length > 0 && (
              <Pressable
                onPress={handleStartNewDoctor}
                className="px-3 py-2 bg-teal-50 web:hover:bg-teal-100"
              >
                <Text className="text-teal-700 text-xs font-medium">
                  + Tambah dokter baru: "{value.trim()}"
                </Text>
              </Pressable>
            )}
            {matches.length === 0 && exactMatch && (
              <View className="px-3 py-2">
                <Text className="text-slate-400 text-[10px]">Dokter sudah ada di daftar.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {showNewForm && (
        <View className="bg-teal-50/60 border border-teal-100 rounded-lg p-3 mt-2 gap-2">
          <Text className="text-teal-800 text-xs font-semibold">
            Profil dokter baru: {value.trim()}
          </Text>
          <TextInput
            value={newSpecialization}
            onChangeText={setNewSpecialization}
            placeholder="Spesialisasi, mis. Sp.A (Dokter Anak)"
            className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
          />
          <TextInput
            value={newPractice}
            onChangeText={setNewPractice}
            placeholder="Tempat praktik, mis. RS Grha Kedoya"
            className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
          />
          <WeeklyScheduleEditor value={newSchedule} onChange={setNewSchedule} />
          {scheduleError && <Text className="text-red-600 text-[11px]">{scheduleError}</Text>}
          <TextInput
            value={newPhone}
            onChangeText={setNewPhone}
            keyboardType="phone-pad"
            placeholder="No. telepon (opsional)"
            className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setShowNewForm(false)}
              className="flex-1 border border-slate-200 rounded-lg py-2 items-center"
            >
              <Text className="text-slate-600 text-xs">Batal</Text>
            </Pressable>
            <Pressable
              onPress={handleSaveNewDoctor}
              disabled={saving}
              className="flex-1 bg-teal-700 rounded-lg py-2 items-center disabled:opacity-60"
            >
              <Text className="text-white text-xs font-medium">
                {saving ? 'Menyimpan...' : 'Simpan Profil Dokter'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

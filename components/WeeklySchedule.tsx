// components/WeeklySchedule.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { WeeklySchedule, DayOfWeek, ScheduleSlot, DAY_ORDER, DAY_LABELS } from '../types/health';

/* ------------------------------------------------------------------ */
/* TAMPILAN (read-only) — tabel mirip contoh: header hijau, tiap hari  */
/* jadi kolom, sesi yang lebih dari satu ditumpuk di kolom yang sama.  */
/* ------------------------------------------------------------------ */

export function WeeklyScheduleView({ schedule }: { schedule: WeeklySchedule | string | undefined }) {
  if (!schedule) return null;

  // Data lama (sebelum jadwal terstruktur ada) masih berupa teks bebas.
  if (typeof schedule === 'string') {
    return <Text className="text-slate-500 text-xs">🕒 {schedule}</Text>;
  }

  const activeDays = DAY_ORDER.filter((d) => (schedule[d]?.length ?? 0) > 0);
  if (activeDays.length === 0) return null;

  return (
    <View>
      {/* PENTING: rounding/border/overflow-hidden HARUS di View pembungkus
          ini (statis), BUKAN di ScrollView-nya sendiri — kalau overflow-hidden
          ditaruh langsung di ScrollView, itu bentrok dengan mekanisme scroll
          bawaan React Native Web dan bikin konten kepotong tanpa bisa
          di-scroll (bug yang sempat terjadi). */}
      <View className="rounded-lg border border-slate-100 overflow-hidden">
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            <View className="flex-row bg-teal-700">
              {DAY_ORDER.map((d) => (
                <View key={d} className="w-24 px-2 py-2 border-r border-teal-600 last:border-r-0">
                  <Text className="text-white text-[11px] font-semibold text-center">{DAY_LABELS[d]}</Text>
                </View>
              ))}
            </View>
            <View className="flex-row bg-white">
              {DAY_ORDER.map((d) => (
                <View key={d} className="w-24 px-2 py-2 border-r border-slate-100 last:border-r-0 gap-1">
                  {(schedule[d] ?? []).map((slot, i) => (
                    <Text key={i} className="text-slate-700 text-[11px] text-center">
                      {slot.start} - {slot.end}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      <Text className="text-slate-400 text-[10px] mt-1">← Geser tabel untuk lihat hari lainnya →</Text>
    </View>
  );
}

/** Ringkasan 1 baris untuk kartu list (mis. "Senin, Rabu, Jumat") */
export function summarizeSchedule(schedule: WeeklySchedule | string | undefined): string | null {
  if (!schedule) return null;
  if (typeof schedule === 'string') return schedule;
  const activeDays = DAY_ORDER.filter((d) => (schedule[d]?.length ?? 0) > 0);
  if (activeDays.length === 0) return null;
  return activeDays.map((d) => DAY_LABELS[d]).join(', ');
}

/* ------------------------------------------------------------------ */
/* EDITOR — dipakai di form Tambah/Edit Dokter                        */
/* ------------------------------------------------------------------ */

function isValidTime(t: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export function WeeklyScheduleEditor({
  value,
  onChange,
}: {
  value: WeeklySchedule;
  onChange: (next: WeeklySchedule) => void;
}) {
  function addSlot(day: DayOfWeek) {
    const current = value[day] ?? [];
    onChange({ ...value, [day]: [...current, { start: '09:00', end: '12:00' }] });
  }

  function updateSlot(day: DayOfWeek, index: number, patch: Partial<ScheduleSlot>) {
    const current = [...(value[day] ?? [])];
    current[index] = { ...current[index], ...patch };
    onChange({ ...value, [day]: current });
  }

  function removeSlot(day: DayOfWeek, index: number) {
    const current = (value[day] ?? []).filter((_, i) => i !== index);
    onChange({ ...value, [day]: current });
  }

  return (
    <View className="gap-2">
      <Text className="text-slate-700 text-xs font-medium">Jadwal Praktik</Text>
      {DAY_ORDER.map((day) => {
        const slots = value[day] ?? [];
        return (
          <View key={day} className="bg-slate-50 rounded-lg p-2">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-slate-700 text-xs font-medium">{DAY_LABELS[day]}</Text>
              <Pressable onPress={() => addSlot(day)}>
                <Text className="text-teal-700 text-[11px] font-medium">+ Tambah Sesi</Text>
              </Pressable>
            </View>
            {slots.length === 0 ? (
              <Text className="text-slate-400 text-[11px]">Tidak praktik</Text>
            ) : (
              <View className="gap-1.5">
                {slots.map((slot, i) => {
                  const startInvalid = slot.start.length === 5 && !isValidTime(slot.start);
                  const endInvalid = slot.end.length === 5 && !isValidTime(slot.end);
                  return (
                    <View key={i} className="flex-row items-center gap-1.5">
                      <TextInput
                        value={slot.start}
                        onChangeText={(t) => updateSlot(day, i, { start: t })}
                        placeholder="09:00"
                        maxLength={5}
                        className={`bg-white border rounded-md px-2 py-1 text-xs w-16 text-center ${startInvalid ? 'border-red-300' : 'border-slate-200'}`}
                      />
                      <Text className="text-slate-400 text-xs">–</Text>
                      <TextInput
                        value={slot.end}
                        onChangeText={(t) => updateSlot(day, i, { end: t })}
                        placeholder="12:00"
                        maxLength={5}
                        className={`bg-white border rounded-md px-2 py-1 text-xs w-16 text-center ${endInvalid ? 'border-red-300' : 'border-slate-200'}`}
                      />
                      <Pressable onPress={() => removeSlot(day, i)} hitSlop={8} className="ml-1">
                        <Text className="text-red-500 text-xs">✕</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
      <Text className="text-slate-400 text-[10px]">Format jam: HH:MM (24 jam), mis. 09:00 atau 18:30.</Text>
    </View>
  );
}

/** Validasi ringan sebelum disimpan — pastikan semua sesi yang terisi punya format jam benar. */
export function isScheduleValid(schedule: WeeklySchedule): boolean {
  return DAY_ORDER.every((day) =>
    (schedule[day] ?? []).every((slot) => isValidTime(slot.start) && isValidTime(slot.end))
  );
}

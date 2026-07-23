// app/members/[id]/lifestyle.tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LifestyleService } from '../../../services/firestoreService';
import { DailyLog, MaintenanceMedication } from '../../../types/health';

type WithId<T> = T & { id: string };

export default function LifestyleScreen() {
  const { id: memberId } = useLocalSearchParams<{ id: string }>();
  const [logs, setLogs] = useState<WithId<DailyLog>[]>([]);
  const [meds, setMeds] = useState<WithId<MaintenanceMedication>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);

  // Form log harian
  const [date, setDate] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [menu, setMenu] = useState('');
  const [exerciseType, setExerciseType] = useState('');
  const [exerciseDuration, setExerciseDuration] = useState('');

  // Form obat rutin
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medFreq, setMedFreq] = useState('1');
  const [medStock, setMedStock] = useState('');

  const load = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const [l, m] = await Promise.all([
        LifestyleService.listDailyLogs(memberId),
        LifestyleService.listMaintenanceMedications(memberId),
      ]);
      setLogs(l); setMeds(m);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveLog() {
    if (!memberId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    await LifestyleService.addDailyLog(memberId, {
      memberId,
      date,
      weightKg: weightKg ? Number(weightKg) : undefined,
      meals: menu ? [{ time: 'siang', menu }] : [],
      exercise: exerciseType
        ? [{ type: exerciseType, durationMinutes: Number(exerciseDuration) || 0 }]
        : [],
    });
    setDate(''); setWeightKg(''); setMenu(''); setExerciseType(''); setExerciseDuration('');
    setShowLogForm(false);
    await load();
  }

  async function handleSaveMed() {
    if (!memberId || !medName || !medDose) return;
    await LifestyleService.addMaintenanceMedication(memberId, {
      memberId,
      name: medName,
      dose: medDose,
      frequencyPerDay: Number(medFreq) || 1,
      timeOfDay: [],
      stockCount: medStock ? Number(medStock) : undefined,
      stockUnit: 'tablet',
      lowStockThreshold: 5,
      active: true,
      startDate: new Date().toISOString().slice(0, 10),
    });
    setMedName(''); setMedDose(''); setMedFreq('1'); setMedStock('');
    setShowMedForm(false);
    await load();
  }

  async function handleTakeMed(med: WithId<MaintenanceMedication>) {
    if (med.stockCount === undefined) return;
    await LifestyleService.decrementStock(memberId!, med.id, med.stockCount);
    await load();
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="p-4 md:p-8">
      {/* --- OBAT RUTIN --- */}
      <Text className="text-slate-900 font-semibold mb-2">Obat Rutin Jangka Panjang</Text>
      {loading ? <ActivityIndicator color="#0F766E" /> : (
        <View className="gap-2 mb-3">
          {meds.map((m) => {
            const low = m.stockCount !== undefined && m.stockCount <= (m.lowStockThreshold ?? 3);
            return (
              <View key={m.id} className="bg-white rounded-xl p-3 border border-slate-100 flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-slate-900 text-sm font-medium">{m.name}</Text>
                  <Text className="text-slate-500 text-xs">{m.dose} · {m.frequencyPerDay}x/hari</Text>
                  {m.stockCount !== undefined && (
                    <Text className={`text-xs mt-0.5 ${low ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                      Stok: {m.stockCount} {m.stockUnit} {low ? '⚠ Menipis' : ''}
                    </Text>
                  )}
                </View>
                {m.stockCount !== undefined && (
                  <Pressable onPress={() => handleTakeMed(m)} className="bg-teal-50 px-3 py-1.5 rounded-lg">
                    <Text className="text-teal-700 text-xs font-medium">Sudah Minum</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
      <Pressable onPress={() => setShowMedForm(!showMedForm)} className="mb-5">
        <Text className="text-teal-700 text-xs">{showMedForm ? 'Batal' : '+ Tambah Obat Rutin'}</Text>
      </Pressable>
      {showMedForm && (
        <View className="bg-white rounded-2xl p-4 border border-slate-100 mb-5 gap-2">
          <TextInput value={medName} onChangeText={setMedName} placeholder="Nama obat, mis. Metformin (Glucophage)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <TextInput value={medDose} onChangeText={setMedDose} placeholder="Dosis, mis. 500 mg" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <TextInput value={medFreq} onChangeText={setMedFreq} keyboardType="number-pad" placeholder="Frekuensi per hari" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <TextInput value={medStock} onChangeText={setMedStock} keyboardType="number-pad" placeholder="Stok saat ini (jumlah tablet)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <Pressable onPress={handleSaveMed} className="bg-teal-700 rounded-lg py-2.5 items-center mt-1">
            <Text className="text-white text-xs font-medium">Simpan Obat Rutin</Text>
          </Pressable>
        </View>
      )}

      {/* --- LOG HARIAN --- */}
      <Text className="text-slate-900 font-semibold mb-2">Catatan Harian</Text>
      <Pressable onPress={() => setShowLogForm(!showLogForm)} className="mb-3">
        <Text className="text-teal-700 text-xs">{showLogForm ? 'Batal' : '+ Tambah Catatan Hari Ini'}</Text>
      </Pressable>
      {showLogForm && (
        <View className="bg-white rounded-2xl p-4 border border-slate-100 mb-4 gap-2">
          <TextInput value={date} onChangeText={setDate} placeholder="Tanggal (YYYY-MM-DD)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <TextInput value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" placeholder="Berat badan (kg)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <TextInput value={menu} onChangeText={setMenu} placeholder="Menu makan hari ini" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <TextInput value={exerciseType} onChangeText={setExerciseType} placeholder="Jenis olahraga (opsional)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <TextInput value={exerciseDuration} onChangeText={setExerciseDuration} keyboardType="number-pad" placeholder="Durasi olahraga (menit)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <Pressable onPress={handleSaveLog} className="bg-teal-700 rounded-lg py-2.5 items-center mt-1">
            <Text className="text-white text-xs font-medium">Simpan Catatan</Text>
          </Pressable>
        </View>
      )}

      <View className="gap-2">
        {logs.map((l) => (
          <View key={l.id} className="bg-white rounded-xl p-3 border border-slate-100">
            <Text className="text-slate-900 text-sm font-medium">{l.date}{l.weightKg ? ` · ${l.weightKg} kg` : ''}</Text>
            {l.meals && l.meals.length > 0 && (
              <Text className="text-slate-500 text-xs mt-0.5">Makan: {l.meals.map((m) => m.menu).join(', ')}</Text>
            )}
            {l.exercise && l.exercise.length > 0 && (
              <Text className="text-slate-500 text-xs mt-0.5">
                Olahraga: {l.exercise.map((e) => `${e.type} (${e.durationMinutes} mnt)`).join(', ')}
              </Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

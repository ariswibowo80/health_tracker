import type { ReactNode } from 'react';
// app/members/[id]/lab.tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Platform, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LabService } from '../../../services/firestoreService';
import { LabRecord, LabParameterKey } from '../../../types/health';
import { REFERENCE_RANGES, getLabStatus, STATUS_COLOR_MAP } from '../../../constants/referenceRanges';
import TrendChart from '../../../components/TrendChart';
import ScreenHeader from '../../../components/ScreenHeader';

type WithId<T> = T & { id: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const PARAM_ORDER: LabParameterKey[] = [
  'glukosaPuasa', 'glukosa2JamPP', 'glukosaSewaktu', 'hba1c',
  'trigliserida', 'kolesterolTotal', 'hdl', 'ldl',
  'asamUrat', 'ureum', 'kreatinin', 'egfr', 'sgot', 'sgpt', 'vitaminD',
];

export default function LabScreen() {
  const { id: memberId } = useLocalSearchParams<{ id: string }>();
  const [records, setRecords] = useState<WithId<LabRecord>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trendParam, setTrendParam] = useState<LabParameterKey>('glukosaPuasa');

  const [date, setDate] = useState(todayISO());
  const [source, setSource] = useState<LabRecord['source']>('MCU');
  const [facility, setFacility] = useState('');
  const [values, setValues] = useState<Partial<Record<LabParameterKey, string>>>({});
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      setRecords(await LabService.listLabRecords(memberId));
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setDate(todayISO());
    setSource('MCU');
    setFacility('');
    setValues({});
    setNotes('');
  }

  function startCreate() {
    setEditingId(null);
    resetForm();
    setShowForm(!showForm);
  }

  function startEdit(record: WithId<LabRecord>) {
    setShowForm(false);
    setEditingId(record.id);
    setDate(record.date);
    setSource(record.source);
    setFacility(record.facility ?? '');
    const stringValues: Partial<Record<LabParameterKey, string>> = {};
    for (const key of PARAM_ORDER) {
      const v = record.values[key];
      if (v !== undefined) stringValues[key] = String(v);
    }
    setValues(stringValues);
    setNotes(record.notes ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    resetForm();
  }

  async function handleSubmit() {
    if (!memberId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setSaving(true);
    try {
      const numericValues: Partial<Record<LabParameterKey, number>> = {};
      for (const key of PARAM_ORDER) {
        const raw = values[key];
        if (raw && !isNaN(Number(raw))) numericValues[key] = Number(raw);
      }
      const payload = {
        memberId,
        date,
        source,
        facility: facility || undefined,
        values: numericValues,
        notes: notes || undefined,
      };

      if (editingId) {
        await LabService.updateLabRecord(memberId, editingId, payload);
        setEditingId(null);
      } else {
        await LabService.addLabRecord(memberId, payload);
        setShowForm(false);
      }
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record: WithId<LabRecord>) {
    const doDelete = async () => {
      await LabService.deleteLabRecord(memberId!, record.id);
      if (editingId === record.id) cancelEdit();
      await load();
    };

    const warning = `Hapus data lab tanggal ${record.date} (${record.source})? Tindakan ini tidak bisa dibatalkan.`;

    if (Platform.OS === 'web') {
      if (window.confirm(warning)) await doDelete();
      return;
    }
    Alert.alert('Hapus Data Lab', warning, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: doDelete },
    ]);
  }

  // Data grafik tren untuk parameter yang dipilih, urut lama -> baru
  const trendData = [...records]
    .filter((r) => r.values[trendParam] !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: shortDate(r.date), value: r.values[trendParam] as number }));

  const trendRef = REFERENCE_RANGES[trendParam];
  const isFormOpen = showForm || editingId !== null;

  return (
    <View className="flex-1 bg-slate-50">
      <ScreenHeader title="Lab & MCU" fallbackHref={`/members/${memberId}`} />
      <ScrollView className="flex-1" contentContainerClassName="p-4 md:p-8">
      <Text className="text-xs text-slate-400 mb-4">
        Nilai referensi adalah acuan umum laboratorium, bukan pengganti interpretasi dokter.
      </Text>

      {/* Grafik tren */}
      <View className="mb-5">
        <View className="flex-row flex-wrap gap-2 mb-3">
          {PARAM_ORDER.map((key) => (
            <Pressable
              key={key}
              onPress={() => setTrendParam(key)}
              className={`px-2.5 py-1.5 rounded-lg border ${
                trendParam === key ? 'bg-teal-700 border-teal-700' : 'border-slate-200'
              }`}
            >
              <Text className={`text-[11px] ${trendParam === key ? 'text-white' : 'text-slate-600'}`}>
                {REFERENCE_RANGES[key].label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TrendChart
          title={`Tren ${trendRef.label}`}
          unit={trendRef.unit}
          points={trendData}
          normalMin={trendRef.min}
          normalMax={trendRef.max}
        />
      </View>

      {/* Tombol tambah */}
      {!editingId && (
        <Pressable
          onPress={startCreate}
          className="bg-teal-700 rounded-xl py-3 items-center mb-4 max-w-[220px]"
        >
          <Text className="text-white font-medium text-sm">
            {showForm ? 'Tutup Form' : '+ Tambah Hasil Lab'}
          </Text>
        </Pressable>
      )}

      {/* Form input / edit */}
      {isFormOpen && (
        <View className="bg-white rounded-2xl p-4 border border-slate-100 mb-5">
          <Text className="text-slate-900 font-semibold text-sm mb-3">
            {editingId ? 'Edit Hasil Lab' : 'Hasil Lab Baru'}
          </Text>

          <Field label="Tanggal (YYYY-MM-DD)">
            <TextInput value={date} onChangeText={setDate} placeholder="2026-07-20"
              className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900" />
          </Field>

          <Field label="Sumber">
            <View className="flex-row gap-2">
              {(['MCU', 'Tes Mandiri', 'Lab Klinik'] as const).map((s) => (
                <Pressable key={s} onPress={() => setSource(s)}
                  className={`px-3 py-2 rounded-lg border ${source === s ? 'bg-teal-700 border-teal-700' : 'border-slate-200'}`}>
                  <Text className={`text-xs ${source === s ? 'text-white' : 'text-slate-700'}`}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Fasilitas (opsional)">
            <TextInput value={facility} onChangeText={setFacility} placeholder="mis. RS Grha Kedoya"
              className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900" />
          </Field>

          <Text className="text-slate-700 text-xs font-medium mb-2 mt-1">Nilai Parameter</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {PARAM_ORDER.map((key) => (
              <View key={key} className="w-[47%]">
                <Text className="text-slate-500 text-[10px] mb-1">
                  {REFERENCE_RANGES[key].label} ({REFERENCE_RANGES[key].unit})
                </Text>
                <TextInput
                  value={values[key] ?? ''}
                  onChangeText={(t) => setValues((v) => ({ ...v, [key]: t }))}
                  keyboardType="decimal-pad"
                  placeholder="-"
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 text-sm"
                />
              </View>
            ))}
          </View>

          <Field label="Catatan (opsional)">
            <TextInput value={notes} onChangeText={setNotes} placeholder="Catatan tambahan"
              className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900" />
          </Field>

          <View className="flex-row gap-2 mt-2">
            {editingId && (
              <Pressable onPress={cancelEdit} className="flex-1 border border-slate-200 rounded-xl py-3 items-center">
                <Text className="text-slate-600 text-sm">Batal</Text>
              </Pressable>
            )}
            <Pressable onPress={handleSubmit} disabled={saving}
              className="flex-1 bg-teal-700 rounded-xl py-3 items-center disabled:opacity-60">
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text className="text-white font-semibold text-sm">
                  {editingId ? 'Simpan Perubahan' : 'Simpan Hasil Lab'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Riwayat */}
      <Text className="text-slate-900 font-semibold mb-2">Riwayat Lab & MCU</Text>
      {loading ? <ActivityIndicator color="#0F766E" /> : records.length === 0 ? (
        <Text className="text-slate-400 text-sm">Belum ada data.</Text>
      ) : (
        <View className="gap-2">
          {records.map((r) => (
            <View key={r.id} className="bg-white rounded-xl p-3 border border-slate-100">
              <View className="flex-row justify-between items-start mb-2">
                <View>
                  <Text className="text-slate-900 font-medium text-sm">{r.date} · {r.source}</Text>
                  {r.facility && <Text className="text-slate-400 text-xs">{r.facility}</Text>}
                </View>
                <View className="flex-row gap-3">
                  <Pressable onPress={() => startEdit(r)}>
                    <Text className="text-teal-700 text-xs font-medium">Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(r)}>
                    <Text className="text-red-600 text-xs font-medium">Hapus</Text>
                  </Pressable>
                </View>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {Object.entries(r.values).map(([key, val]) => {
                  const k = key as LabParameterKey;
                  const status = getLabStatus(k, val as number);
                  const colors = STATUS_COLOR_MAP[status];
                  return (
                    <View key={key} className={`px-2 py-1 rounded-md ${colors.bg}`}>
                      <Text className={`text-[10px] ${colors.text}`}>
                        {REFERENCE_RANGES[k].label}: {val} {REFERENCE_RANGES[k].unit}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {r.notes && <Text className="text-slate-400 text-[11px] mt-2">Catatan: {r.notes}</Text>}
            </View>
          ))}
        </View>
      )}
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="text-slate-700 text-xs font-medium mb-1">{label}</Text>
      {children}
    </View>
  );
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

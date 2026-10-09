// app/(tabs)/index.tsx
// Dashboard utama: ringkasan status kesehatan seluruh anggota keluarga.
// Layout otomatis menyesuaikan platform:
//  - Mobile: daftar kartu 1 kolom, compact.
//  - Web (lebar >= 768px): grid multi-kolom seperti dashboard admin.

import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, useWindowDimensions, ActivityIndicator, Pressable, Modal } from 'react-native';
import { router } from 'expo-router';

import { auth } from '../../services/firebaseConfig';
import { ensureHouseholdAndGetActiveOwner } from '../../services/householdService';
import {
  getFamilyMembers,
  getMemberHealthSummary,
  MemberHealthSummary,
  SicknessService,
  LabService,
  LifestyleService,
} from '../../services/firestoreService';
import HealthStatusCard from '../../components/HealthStatusCard';
import { exportFamilyReportToExcel, ExportBundle } from '../../utils/excelExport';
import { todayISO } from '../../utils/datetime';

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 768; // breakpoint web/tablet

  const [summaries, setSummaries] = useState<MemberHealthSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Pop up catat berat badan terakhir
  const [weightTarget, setWeightTarget] = useState<MemberHealthSummary | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [weightDate, setWeightDate] = useState(todayISO());
  const [savingWeight, setSavingWeight] = useState(false);

  function openWeightModal(s: MemberHealthSummary) {
    setWeightTarget(s);
    setWeightInput(s.latestWeight ? String(s.latestWeight) : '');
    setWeightDate(todayISO());
  }

  async function handleSaveWeight() {
    const kg = Number(weightInput.replace(',', '.'));
    if (!weightTarget || !isFinite(kg) || kg <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(weightDate)) return;
    setSavingWeight(true);
    try {
      await LifestyleService.saveWeight(weightTarget.member.id, weightDate, kg);
      setWeightTarget(null);
      await loadDashboard();
    } finally {
      setSavingWeight(false);
    }
  }

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const ownerUid = await ensureHouseholdAndGetActiveOwner(user.uid, user.email);
      const members = await getFamilyMembers(ownerUid);
      const results = await Promise.all(members.map((m) => getMemberHealthSummary(m)));
      // Yang sedang sakit di atas (episode mulai paling baru dulu), sisanya urut nama
      results.sort((a, b) => {
        const sa = a.activeSickness;
        const sb = b.activeSickness;
        if (sa && sb) return sb.startDate.localeCompare(sa.startDate);
        if (sa) return -1;
        if (sb) return 1;
        return a.member.name.localeCompare(b.member.name);
      });
      setSummaries(results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const activeSicknessCount = summaries.filter((s) => s.activeSickness).length;

  async function handleExportAll() {
    setExporting(true);
    try {
      const bundles: ExportBundle[] = await Promise.all(
        summaries.map(async (s) => {
          const [episodes, doctorVisits, acuteMedications, hospitalizations, labRecords, dailyLogs] =
            await Promise.all([
              SicknessService.listEpisodes(s.member.id),
              SicknessService.listDoctorVisits(s.member.id),
              SicknessService.listAcuteMedications(s.member.id),
              SicknessService.listHospitalizations(s.member.id),
              LabService.listLabRecords(s.member.id),
              LifestyleService.listDailyLogs(s.member.id),
            ]);
          return {
            member: s.member,
            episodes,
            doctorVisits,
            acuteMedications,
            hospitalizations,
            labRecords,
            dailyLogs,
          };
        })
      );
      await exportFamilyReportToExcel(bundles);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0F766E" />
        <Text className="text-slate-400 mt-2 text-sm">Memuat ringkasan kesehatan…</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="p-4 md:p-8">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <Text className="text-2xl md:text-3xl font-bold text-slate-900">
            Dashboard Kesehatan Keluarga
          </Text>
          <Text className="text-slate-500 text-sm mt-1">
            {summaries.length} profil terpantau
          </Text>
        </View>

        <Pressable
          onPress={handleExportAll}
          disabled={exporting || summaries.length === 0}
          className="bg-teal-700 web:hover:bg-teal-800 px-4 py-2.5 rounded-xl flex-row items-center disabled:opacity-50"
        >
          {exporting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white font-medium text-sm">📊 Ekspor Excel</Text>
          )}
        </Pressable>
      </View>

      {/* Ringkasan cepat / alert bar */}
      <View className="flex-row flex-wrap gap-3 mb-6">
        <SummaryPill
          label="Sedang Sakit"
          value={activeSicknessCount}
          tone={activeSicknessCount > 0 ? 'danger' : 'ok'}
        />
        <SummaryPill label="Total Profil" value={summaries.length} tone="neutral" />
      </View>

      {/* Grid kartu anggota keluarga */}
      {summaries.length === 0 ? (
        <View className="bg-white rounded-2xl p-8 items-center border border-dashed border-slate-200">
          <Text className="text-slate-500 text-center mb-3">
            Belum ada profil keluarga. Tambahkan profil pertama untuk mulai mencatat kesehatan.
          </Text>
          <Pressable
            onPress={() => router.push('/members/new')}
            className="bg-teal-700 px-4 py-2 rounded-xl"
          >
            <Text className="text-white font-medium text-sm">+ Tambah Profil</Text>
          </Pressable>
        </View>
      ) : (
        <View
          className={isWideScreen ? 'flex-row flex-wrap gap-4' : 'flex-col gap-3'}
        >
          {summaries.map((s) => (
            <HealthStatusCard
              key={s.member.id}
              summary={s}
              onPress={() => router.push(`/members/${s.member.id}`)}
              onAddWeight={() => openWeightModal(s)}
            />
          ))}
        </View>
      )}

      <Modal visible={!!weightTarget} transparent animationType="fade" onRequestClose={() => setWeightTarget(null)}>
        <View className="flex-1 bg-black/40 items-center justify-center p-4">
          <View className="bg-white rounded-2xl w-full max-w-[400px] p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-slate-900 font-semibold text-sm">
                Berat Badan Terakhir — {weightTarget?.member.name}
              </Text>
              <Pressable onPress={() => setWeightTarget(null)} hitSlop={8}>
                <Text className="text-slate-500 text-base">✕</Text>
              </Pressable>
            </View>
            <Text className="text-slate-500 text-[10px] mb-1">Berat Badan (kg)</Text>
            <TextInput
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="mis. 23.5"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
            />
            <Text className="text-slate-500 text-[10px] mb-1">Tanggal</Text>
            <TextInput
              value={weightDate}
              onChangeText={setWeightDate}
              placeholder="YYYY-MM-DD"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4"
            />
            <View className="flex-row gap-2">
              <Pressable onPress={() => setWeightTarget(null)} className="flex-1 border border-slate-200 rounded-xl py-2.5 items-center">
                <Text className="text-slate-600 text-sm">Batal</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveWeight}
                disabled={savingWeight}
                className="flex-1 bg-teal-700 rounded-xl py-2.5 items-center disabled:opacity-60"
              >
                <Text className="text-white text-sm font-medium">{savingWeight ? 'Menyimpan...' : 'Simpan'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'warning' | 'danger' | 'neutral';
}) {
  const toneMap = {
    ok: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    neutral: 'bg-slate-100 text-slate-700',
  };
  const [bg, text] = toneMap[tone].split(' ');
  return (
    <View className={`px-4 py-3 rounded-xl ${bg} min-w-[140px]`}>
      <Text className={`text-2xl font-bold ${text}`}>{value}</Text>
      <Text className={`text-xs mt-0.5 ${text}`}>{label}</Text>
    </View>
  );
}

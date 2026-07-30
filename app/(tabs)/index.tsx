// app/(tabs)/index.tsx
// Dashboard utama: ringkasan status kesehatan seluruh anggota keluarga.
// Layout otomatis menyesuaikan platform:
//  - Mobile: daftar kartu 1 kolom, compact.
//  - Web (lebar >= 768px): grid multi-kolom seperti dashboard admin.

import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, useWindowDimensions, ActivityIndicator, Pressable } from 'react-native';
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

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 768; // breakpoint web/tablet

  const [summaries, setSummaries] = useState<MemberHealthSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const ownerUid = await ensureHouseholdAndGetActiveOwner(user.uid, user.email);
      const members = await getFamilyMembers(ownerUid);
      const results = await Promise.all(members.map((m) => getMemberHealthSummary(m)));
      setSummaries(results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const activeSicknessCount = summaries.filter((s) => s.activeSickness).length;
  const lowStockCount = summaries.reduce((sum, s) => sum + s.lowStockMeds.length, 0);

  async function handleExportAll() {
    setExporting(true);
    try {
      const bundles: ExportBundle[] = await Promise.all(
        summaries.map(async (s) => {
          const [episodes, doctorVisits, acuteMedications, labRecords, dailyLogs] =
            await Promise.all([
              SicknessService.listEpisodes(s.member.id),
              SicknessService.listDoctorVisits(s.member.id),
              SicknessService.listAcuteMedications(s.member.id),
              LabService.listLabRecords(s.member.id),
              LifestyleService.listDailyLogs(s.member.id),
            ]);
          return {
            member: s.member,
            episodes,
            doctorVisits,
            acuteMedications,
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
        <SummaryPill
          label="Stok Obat Menipis"
          value={lowStockCount}
          tone={lowStockCount > 0 ? 'warning' : 'ok'}
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
            />
          ))}
        </View>
      )}
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

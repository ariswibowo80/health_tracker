// app/members/[id]/index.tsx
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  getMemberHealthSummary,
  MemberHealthSummary,
  SicknessService,
  LabService,
  LifestyleService,
} from '../../../services/firestoreService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebaseConfig';
import { FamilyMember } from '../../../types/health';
import { exportHealthReportToExcel, ExportBundle } from '../../../utils/excelExport';
import ScreenHeader from '../../../components/ScreenHeader';

type WithId<T> = T & { id: string };

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [summary, setSummary] = useState<MemberHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'familyMembers', id));
      if (!snap.exists()) return;
      const member = { id: snap.id, ...(snap.data() as FamilyMember) } as WithId<FamilyMember>;
      setSummary(await getMemberHealthSummary(member));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExport() {
    if (!summary) return;
    setExporting(true);
    try {
      const [episodes, doctorVisits, acuteMedications, hospitalizations, labRecords, dailyLogs] = await Promise.all([
        SicknessService.listEpisodes(summary.member.id),
        SicknessService.listDoctorVisits(summary.member.id),
        SicknessService.listAcuteMedications(summary.member.id),
        SicknessService.listHospitalizations(summary.member.id),
        LabService.listLabRecords(summary.member.id),
        LifestyleService.listDailyLogs(summary.member.id),
      ]);
      const bundle: ExportBundle = {
        member: summary.member,
        episodes,
        doctorVisits,
        acuteMedications,
        hospitalizations,
        labRecords,
        dailyLogs,
      };
      await exportHealthReportToExcel(bundle);
    } finally {
      setExporting(false);
    }
  }

  if (loading || !summary) {
    return (
      <View className="flex-1 bg-slate-50">
        <ScreenHeader title="Detail Profil" fallbackHref="/(tabs)/members" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0F766E" size="large" />
        </View>
      </View>
    );
  }

  const { member, activeSickness, latestWeight, lowStockMeds } = summary;

  return (
    <View className="flex-1 bg-slate-50">
      <ScreenHeader title={member.name} fallbackHref="/(tabs)/members" />
      <ScrollView className="flex-1" contentContainerClassName="p-4 md:p-8">
      {/* Header profil */}
      <View className="bg-white rounded-2xl p-5 border border-slate-100 mb-4 flex-row items-center">
        <View
          style={{ backgroundColor: member.avatarColor }}
          className="w-14 h-14 rounded-full items-center justify-center mr-4"
        >
          <Text className="text-white font-bold text-xl">{member.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text className="text-xl font-bold text-slate-900">{member.name}</Text>
          <Text className="text-slate-500 text-xs capitalize">{member.role} · {member.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</Text>
          {member.chronicConditions && member.chronicConditions.length > 0 && (
            <Text className="text-amber-600 text-xs mt-1">
              Kondisi kronis: {member.chronicConditions.join(', ')}
            </Text>
          )}
        </View>
      </View>

      {/* Status ringkas */}
      <View className="flex-row flex-wrap gap-3 mb-5">
        {activeSickness && (
          <InfoPill label="Status" value={activeSickness.title} tone="danger" />
        )}
        <InfoPill label="Berat Terakhir" value={latestWeight ? `${latestWeight} kg` : '-'} tone="neutral" />
        <InfoPill label="Stok Obat Menipis" value={String(lowStockMeds.length)} tone={lowStockMeds.length ? 'warning' : 'ok'} />
      </View>

      {/* Menu modul */}
      <View className="gap-3 md:flex-row md:flex-wrap">
        <ModuleCard
          icon="🌡️"
          title="Catatan Sakit & Obat"
          desc="Gejala akut, kunjungan dokter, hasil lab penunjang, obat sirup/tablet/antibiotik"
          onPress={() => router.push(`/members/${member.id}/sickness`)}
        />
        <ModuleCard
          icon="🧪"
          title="Lab & MCU"
          desc="Glukosa, lipid, asam urat, fungsi ginjal/hati, tren & status normal otomatis"
          onPress={() => router.push(`/members/${member.id}/lab`)}
        />
        <ModuleCard
          icon="🍽️"
          title="Harian & Obat Rutin"
          desc="Menu makan, olahraga, berat badan, obat kronis & stok"
          onPress={() => router.push(`/members/${member.id}/lifestyle`)}
        />
      </View>

      <Pressable
        onPress={handleExport}
        disabled={exporting}
        className="bg-teal-700 rounded-xl py-3 items-center mt-6 max-w-[280px] disabled:opacity-60"
      >
        {exporting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className="text-white font-medium text-sm">📊 Ekspor Laporan {member.name}</Text>
        )}
      </Pressable>
      </ScrollView>
    </View>
  );
}

function InfoPill({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warning' | 'danger' | 'neutral' }) {
  const toneMap = {
    ok: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    neutral: 'bg-slate-100 text-slate-700',
  };
  const [bg, text] = toneMap[tone].split(' ');
  return (
    <View className={`px-3 py-2 rounded-xl ${bg}`}>
      <Text className={`text-[10px] ${text}`}>{label}</Text>
      <Text className={`text-sm font-semibold ${text}`}>{value}</Text>
    </View>
  );
}

function ModuleCard({ icon, title, desc, onPress }: { icon: string; title: string; desc: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl p-4 border border-slate-100 w-full md:w-[300px] web:hover:shadow-md web:transition-shadow"
    >
      <Text className="text-2xl mb-2">{icon}</Text>
      <Text className="text-slate-900 font-semibold mb-1">{title}</Text>
      <Text className="text-slate-500 text-xs">{desc}</Text>
    </Pressable>
  );
}

// app/members/[id]/index.tsx
import type { ReactNode } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  getMemberHealthSummary,
  MemberHealthSummary,
  SicknessService,
  LabService,
  LifestyleService,
  updateFamilyMember,
} from '../../../services/firestoreService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebaseConfig';
import { FamilyMember, MemberRole } from '../../../types/health';
import { exportHealthReportToExcel, ExportBundle } from '../../../utils/excelExport';
import { formatAge } from '../../../utils/age';
import ScreenHeader from '../../../components/ScreenHeader';

const AVATAR_COLORS = ['#0F766E', '#2563EB', '#D97706', '#DB2777', '#7C3AED', '#059669'];
const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'anak', label: 'Anak' },
  { value: 'dewasa', label: 'Dewasa' },
  { value: 'lansia', label: 'Lansia' },
];

type WithId<T> = T & { id: string };

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [summary, setSummary] = useState<MemberHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

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
        <View className="flex-1">
          <Text className="text-xl font-bold text-slate-900">{member.name}</Text>
          <Text className="text-slate-500 text-xs capitalize">{member.role} · {member.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</Text>
          <Text className="text-slate-500 text-xs mt-0.5">
            Lahir {member.birthDate} · {formatAge(member.birthDate)}
          </Text>
          {member.chronicConditions && member.chronicConditions.length > 0 && (
            <Text className="text-amber-600 text-xs mt-1">
              Kondisi kronis: {member.chronicConditions.join(', ')}
            </Text>
          )}
        </View>
        <Pressable onPress={() => setShowEditForm(!showEditForm)} className="px-3 py-1.5">
          <Text className="text-teal-700 text-xs font-medium">{showEditForm ? 'Tutup' : 'Edit'}</Text>
        </Pressable>
      </View>

      {showEditForm && (
        <EditMemberForm
          member={member}
          onCancel={() => setShowEditForm(false)}
          onSaved={async () => {
            setShowEditForm(false);
            await load();
          }}
        />
      )}

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

function EditMemberForm({
  member,
  onSaved,
  onCancel,
}: {
  member: WithId<FamilyMember>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [birthDate, setBirthDate] = useState(member.birthDate);
  const [role, setRole] = useState<MemberRole>(member.role);
  const [gender, setGender] = useState<'L' | 'P'>(member.gender);
  const [colorIndex, setColorIndex] = useState(
    Math.max(0, AVATAR_COLORS.indexOf(member.avatarColor))
  );
  const [bloodType, setBloodType] = useState(member.bloodType ?? '');
  const [allergies, setAllergies] = useState((member.allergies ?? []).join(', '));
  const [chronicConditions, setChronicConditions] = useState((member.chronicConditions ?? []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
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
      await updateFamilyMember(member.id, {
        name: name.trim(),
        birthDate,
        role,
        gender,
        avatarColor: AVATAR_COLORS[colorIndex],
        bloodType: bloodType.trim() || undefined,
        allergies: allergies.split(',').map((a) => a.trim()).filter(Boolean),
        chronicConditions: chronicConditions.split(',').map((c) => c.trim()).filter(Boolean),
      });
      onSaved();
    } catch {
      setError('Gagal menyimpan perubahan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="bg-white rounded-2xl p-5 border border-slate-100 mb-4">
      <Text className="text-slate-900 font-semibold text-sm mb-3">Edit Profil</Text>

      <FormField label="Nama Lengkap">
        <TextInput value={name} onChangeText={setName}
          className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900" />
      </FormField>

      <FormField label="Tanggal Lahir (YYYY-MM-DD)">
        <TextInput value={birthDate} onChangeText={setBirthDate} placeholder="2019-05-12"
          className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900" />
      </FormField>
      <Text className="text-slate-400 text-[11px] -mt-2 mb-3">Usia saat ini: {formatAge(birthDate)}</Text>

      <FormField label="Kategori">
        <View className="flex-row gap-2">
          {ROLE_OPTIONS.map((opt) => (
            <Pressable key={opt.value} onPress={() => setRole(opt.value)}
              className={`px-3 py-2 rounded-lg border ${role === opt.value ? 'bg-teal-700 border-teal-700' : 'border-slate-200'}`}>
              <Text className={role === opt.value ? 'text-white text-xs' : 'text-slate-700 text-xs'}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      </FormField>

      <FormField label="Jenis Kelamin">
        <View className="flex-row gap-2">
          {(['L', 'P'] as const).map((g) => (
            <Pressable key={g} onPress={() => setGender(g)}
              className={`px-4 py-2 rounded-lg border ${gender === g ? 'bg-teal-700 border-teal-700' : 'border-slate-200'}`}>
              <Text className={gender === g ? 'text-white text-xs' : 'text-slate-700 text-xs'}>
                {g === 'L' ? 'Laki-laki' : 'Perempuan'}
              </Text>
            </Pressable>
          ))}
        </View>
      </FormField>

      <FormField label="Warna Profil">
        <View className="flex-row gap-2">
          {AVATAR_COLORS.map((c, i) => (
            <Pressable key={c} onPress={() => setColorIndex(i)} style={{ backgroundColor: c }}
              className={`w-8 h-8 rounded-full ${colorIndex === i ? 'border-2 border-slate-900' : ''}`} />
          ))}
        </View>
      </FormField>

      <FormField label="Golongan Darah (opsional)">
        <TextInput value={bloodType} onChangeText={setBloodType} placeholder="mis. O, A, B, AB"
          className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900" />
      </FormField>

      <FormField label="Alergi (pisahkan koma, opsional)">
        <TextInput value={allergies} onChangeText={setAllergies} placeholder="mis. udang, kacang"
          className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900" />
      </FormField>

      <FormField label="Kondisi Kronis (pisahkan koma, opsional)">
        <TextInput value={chronicConditions} onChangeText={setChronicConditions} placeholder="mis. Diabetes Tipe 2, Hipertensi"
          className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900" />
      </FormField>

      {error && <Text className="text-red-600 text-xs mb-3">{error}</Text>}

      <View className="flex-row gap-2 mt-1">
        <Pressable onPress={onCancel} className="flex-1 border border-slate-200 rounded-xl py-3 items-center">
          <Text className="text-slate-600 text-sm">Batal</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={saving} className="flex-1 bg-teal-700 rounded-xl py-3 items-center disabled:opacity-60">
          {saving ? <ActivityIndicator color="#fff" size="small" /> : (
            <Text className="text-white font-semibold text-sm">Simpan Perubahan</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="text-slate-700 text-xs font-medium mb-1">{label}</Text>
      {children}
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

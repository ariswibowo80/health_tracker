import type { ReactNode } from 'react';
// app/members/[id]/sickness.tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Platform, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { auth } from '../../../services/firebaseConfig';
import { ensureHouseholdAndGetActiveOwner } from '../../../services/householdService';
import { SicknessService, DoctorService } from '../../../services/firestoreService';
import {
  SicknessEpisode, DoctorVisit, AcuteMedication, MedicationForm, Doctor, Hospitalization, TreatingDoctor, SymptomLog,
} from '../../../types/health';
import ScreenHeader from '../../../components/ScreenHeader';
import DoctorPicker from '../../../components/DoctorPicker';

type WithId<T> = T & { id: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Format epoch ms jadi "YYYY-MM-DD" dan "HH:MM" terpisah, untuk mengisi form edit. */
function dateFromTimestamp(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}
function timeFromTimestamp(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** Gabungkan tanggal (YYYY-MM-DD) + jam (HH:MM) jadi epoch ms lokal. */
function combineDateTime(date: string, time: string): number {
  const t = /^\d{2}:\d{2}$/.test(time) ? time : '00:00';
  return new Date(`${date}T${t}:00`).getTime();
}

const MED_FORMS: MedicationForm[] = ['sirup', 'tablet', 'puyer', 'tetes', 'semprot', 'nebulizer', 'suntik', 'lainnya'];

export default function SicknessScreen() {
  const { id: memberId } = useLocalSearchParams<{ id: string }>();
  const [householdOwnerUid, setHouseholdOwnerUid] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<WithId<Doctor>[]>([]);
  const [episodes, setEpisodes] = useState<WithId<SicknessEpisode>[]>([]);
  const [visits, setVisits] = useState<WithId<DoctorVisit>[]>([]);
  const [meds, setMeds] = useState<WithId<AcuteMedication>[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<WithId<SymptomLog>[]>([]);
  const [hospitalizations, setHospitalizations] = useState<WithId<Hospitalization>[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewEpisode, setShowNewEpisode] = useState(false);
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);

  // Form episode baru / edit
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [complaints, setComplaints] = useState('');

  const loadDoctors = useCallback(async (uid: string) => {
    setDoctors(await DoctorService.list(uid));
  }, []);

  const load = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const user = auth.currentUser;
      const ownerUid = user ? await ensureHouseholdAndGetActiveOwner(user.uid, user.email) : null;
      setHouseholdOwnerUid(ownerUid);

      const [ep, vs, md, hs, sl] = await Promise.all([
        SicknessService.listEpisodes(memberId),
        SicknessService.listDoctorVisits(memberId),
        SicknessService.listAcuteMedications(memberId),
        SicknessService.listHospitalizations(memberId),
        SicknessService.listSymptomLogs(memberId),
        ownerUid ? loadDoctors(ownerUid) : Promise.resolve(),
      ]);
      setEpisodes(ep); setVisits(vs); setMeds(md); setHospitalizations(hs); setSymptomLogs(sl);
    } finally {
      setLoading(false);
    }
  }, [memberId, loadDoctors]);

  useEffect(() => { load(); }, [load]);

  function resetEpisodeForm() {
    setTitle(''); setStartDate(todayISO()); setComplaints('');
  }

  async function handleCreateEpisode() {
    if (!memberId || !title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return;
    await SicknessService.createEpisode(memberId, {
      memberId,
      title: title.trim(),
      startDate,
      status: 'aktif',
      mainComplaints: complaints.split(',').map((c) => c.trim()).filter(Boolean),
    });
    resetEpisodeForm();
    setShowNewEpisode(false);
    await load();
  }

  function startEditEpisode(ep: WithId<SicknessEpisode>) {
    setEditingEpisodeId(ep.id);
    setTitle(ep.title);
    setStartDate(ep.startDate);
    setComplaints(ep.mainComplaints.join(', '));
    setShowNewEpisode(false);
  }

  async function handleSaveEditEpisode() {
    if (!memberId || !editingEpisodeId || !title.trim()) return;
    await SicknessService.updateEpisode(memberId, editingEpisodeId, {
      title: title.trim(),
      startDate,
      mainComplaints: complaints.split(',').map((c) => c.trim()).filter(Boolean),
    });
    setEditingEpisodeId(null);
    resetEpisodeForm();
    await load();
  }

  async function handleMarkRecovered(ep: WithId<SicknessEpisode>) {
    await SicknessService.updateEpisode(memberId!, ep.id, {
      status: 'sembuh',
      endDate: todayISO(),
    });
    await load();
  }

  async function handleDeleteEpisode(ep: WithId<SicknessEpisode>) {
    const doDelete = async () => {
      const relatedVisits = visits.filter((v) => v.episodeId === ep.id);
      const relatedMeds = meds.filter((m) => m.episodeId === ep.id);
      const relatedHospitalizations = hospitalizations.filter((h) => h.episodeId === ep.id);
      const relatedSymptomLogs = symptomLogs.filter((s) => s.episodeId === ep.id);
      await Promise.all([
        ...relatedVisits.map((v) => SicknessService.deleteDoctorVisit(memberId!, v.id)),
        ...relatedMeds.map((m) => SicknessService.deleteAcuteMedication(memberId!, m.id)),
        ...relatedHospitalizations.map((h) => SicknessService.deleteHospitalization(memberId!, h.id)),
        ...relatedSymptomLogs.map((s) => SicknessService.deleteSymptomLog(memberId!, s.id)),
      ]);
      await SicknessService.deleteEpisode(memberId!, ep.id);
      if (editingEpisodeId === ep.id) { setEditingEpisodeId(null); resetEpisodeForm(); }
      await load();
    };

    const warning = `Hapus episode "${ep.title}"? Seluruh kunjungan dokter, obat, dan data rawat inap yang tercatat di dalam episode ini akan ikut terhapus permanen.`;

    if (Platform.OS === 'web') {
      if (window.confirm(warning)) {
        await doDelete();
      }
      return;
    }
    Alert.alert('Hapus Episode', warning, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: doDelete },
    ]);
  }

  return (
    <View className="flex-1 bg-slate-50">
      <ScreenHeader title="Catatan Sakit" fallbackHref={`/members/${memberId}`} />
      <ScrollView className="flex-1" contentContainerClassName="p-4 md:p-8">
      <Pressable
        onPress={() => { setEditingEpisodeId(null); resetEpisodeForm(); setShowNewEpisode(!showNewEpisode); }}
        className="bg-teal-700 rounded-xl py-3 items-center mb-4 max-w-[220px]"
      >
        <Text className="text-white font-medium text-sm">
          {showNewEpisode ? 'Tutup Form' : '+ Catat Episode Sakit Baru'}
        </Text>
      </Pressable>

      {(showNewEpisode || editingEpisodeId) && (
        <View className="bg-white rounded-2xl p-4 border border-slate-100 mb-5">
          <Text className="text-slate-900 font-semibold text-sm mb-3">
            {editingEpisodeId ? 'Edit Episode Sakit' : 'Episode Sakit Baru'}
          </Text>
          <Field label="Judul Episode">
            <TextInput value={title} onChangeText={setTitle} placeholder="mis. Demam Gendis - Juli 2026"
              className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900" />
          </Field>
          <Field label="Tanggal Mulai (YYYY-MM-DD)">
            <TextInput value={startDate} onChangeText={setStartDate} placeholder="2026-07-20"
              className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900" />
          </Field>
          <Field label="Keluhan Utama (pisahkan koma)">
            <TextInput value={complaints} onChangeText={setComplaints} placeholder="demam, batuk, pilek"
              className="border border-slate-200 rounded-xl px-3 py-2 text-slate-900" />
          </Field>
          <View className="flex-row gap-2 mt-1">
            {editingEpisodeId && (
              <Pressable
                onPress={() => { setEditingEpisodeId(null); resetEpisodeForm(); }}
                className="flex-1 border border-slate-200 rounded-xl py-3 items-center"
              >
                <Text className="text-slate-600 text-sm">Batal</Text>
              </Pressable>
            )}
            <Pressable
              onPress={editingEpisodeId ? handleSaveEditEpisode : handleCreateEpisode}
              className="flex-1 bg-teal-700 rounded-xl py-3 items-center"
            >
              <Text className="text-white font-semibold text-sm">
                {editingEpisodeId ? 'Simpan Perubahan' : 'Simpan Episode'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {loading ? <ActivityIndicator color="#0F766E" /> : episodes.length === 0 ? (
        <Text className="text-slate-400 text-sm">Belum ada catatan sakit.</Text>
      ) : (
        <View className="gap-3">
          {episodes.map((ep) => (
            <EpisodeCard
              key={ep.id}
              episode={ep}
              memberId={memberId!}
              doctors={doctors}
              householdOwnerUid={householdOwnerUid}
              visits={visits.filter((v) => v.episodeId === ep.id)}
              meds={meds.filter((m) => m.episodeId === ep.id)}
              symptomLogs={symptomLogs.filter((s) => s.episodeId === ep.id)}
              hospitalizations={hospitalizations.filter((h) => h.episodeId === ep.id)}
              expanded={expandedId === ep.id}
              onToggle={() => setExpandedId(expandedId === ep.id ? null : ep.id)}
              onMarkRecovered={() => handleMarkRecovered(ep)}
              onEditEpisode={() => startEditEpisode(ep)}
              onDeleteEpisode={() => handleDeleteEpisode(ep)}
              onDataChanged={load}
              onDoctorCreated={() => householdOwnerUid && loadDoctors(householdOwnerUid)}
            />
          ))}
        </View>
      )}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */

function EpisodeCard({
  episode, memberId, doctors, householdOwnerUid, visits, meds, symptomLogs, hospitalizations, expanded,
  onToggle, onMarkRecovered, onEditEpisode, onDeleteEpisode, onDataChanged, onDoctorCreated,
}: {
  episode: WithId<SicknessEpisode>;
  memberId: string;
  doctors: WithId<Doctor>[];
  householdOwnerUid: string | null;
  visits: WithId<DoctorVisit>[];
  meds: WithId<AcuteMedication>[];
  symptomLogs: WithId<SymptomLog>[];
  hospitalizations: WithId<Hospitalization>[];
  expanded: boolean;
  onToggle: () => void;
  onMarkRecovered: () => void;
  onEditEpisode: () => void;
  onDeleteEpisode: () => void;
  onDataChanged: () => void;
  onDoctorCreated: () => void;
}) {
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [editingVisit, setEditingVisit] = useState<WithId<DoctorVisit> | null>(null);
  const [showMedForm, setShowMedForm] = useState(false);
  const [editingMed, setEditingMed] = useState<WithId<AcuteMedication> | null>(null);
  const [editingSymptomLog, setEditingSymptomLog] = useState<WithId<SymptomLog> | null>(null);
  const [showHospitalForm, setShowHospitalForm] = useState(false);
  const [editingHospital, setEditingHospital] = useState<WithId<Hospitalization> | null>(null);

  // Gabungkan Kunjungan Dokter + Obat + Cek Suhu jadi satu timeline,
  // dikelompokkan per hari (hari terbaru di atas, urutan dalam hari pagi->malam).
  type TimelineItem =
    | { kind: 'kunjungan'; key: string; sortKey: number; data: WithId<DoctorVisit> }
    | { kind: 'obat'; key: string; sortKey: number; data: WithId<AcuteMedication> }
    | { kind: 'suhu'; key: string; sortKey: number; data: WithId<SymptomLog> };

  const timeline: TimelineItem[] = [
    ...visits.map((v) => ({
      kind: 'kunjungan' as const,
      key: `visit-${v.id}`,
      sortKey: combineDateTime(v.date, '00:00'), // kunjungan tidak punya jam spesifik -> ditaruh di awal hari
      data: v,
    })),
    ...meds.map((m) => ({
      kind: 'obat' as const,
      key: `med-${m.id}`,
      sortKey: combineDateTime(m.startDate, m.administeredTime ?? '00:00'),
      data: m,
    })),
    ...symptomLogs.map((s) => ({
      kind: 'suhu' as const,
      key: `suhu-${s.id}`,
      sortKey: s.timestamp,
      data: s,
    })),
  ].sort((a, b) => a.sortKey - b.sortKey); // ascending dulu, untuk dikelompokkan per hari

  // Kelompokkan per hari (YYYY-MM-DD), lalu urutkan grup hari dari terbaru ke terlama
  const timelineByDay = new Map<string, TimelineItem[]>();
  for (const item of timeline) {
    const dayKey = dateFromTimestamp(item.sortKey);
    const group = timelineByDay.get(dayKey) ?? [];
    group.push(item);
    timelineByDay.set(dayKey, group);
  }
  const dayGroups = Array.from(timelineByDay.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  function formatDayHeader(dayKey: string) {
    const d = new Date(`${dayKey}T00:00:00`);
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function handleDeleteMed(m: WithId<AcuteMedication>) {
    const doDelete = async () => {
      await SicknessService.deleteAcuteMedication(memberId, m.id);
      if (editingMed?.id === m.id) setEditingMed(null);
      onDataChanged();
    };
    const warning = `Hapus catatan obat "${m.name}"? Tindakan ini tidak bisa dibatalkan.`;
    if (Platform.OS === 'web') {
      if (window.confirm(warning)) await doDelete();
      return;
    }
    Alert.alert('Hapus Obat', warning, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: doDelete },
    ]);
  }

  async function handleDeleteSymptomLog(s: WithId<SymptomLog>) {
    const doDelete = async () => {
      await SicknessService.deleteSymptomLog(memberId, s.id);
      if (editingSymptomLog?.id === s.id) setEditingSymptomLog(null);
      onDataChanged();
    };
    const warning = 'Hapus catatan cek suhu ini? Tindakan ini tidak bisa dibatalkan.';
    if (Platform.OS === 'web') {
      if (window.confirm(warning)) await doDelete();
      return;
    }
    Alert.alert('Hapus Cek Suhu', warning, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: doDelete },
    ]);
  }

  return (
    <View className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <Pressable onPress={onToggle} className="p-4 flex-row justify-between items-center">
        <View className="flex-1">
          <Text className="text-slate-900 font-semibold">{episode.title}</Text>
          <Text className="text-slate-500 text-xs mt-0.5">
            {episode.startDate} {episode.endDate ? `– ${episode.endDate}` : ''} · {episode.mainComplaints.join(', ')}
          </Text>
        </View>
        <View className={`px-2 py-1 rounded-full ${episode.status === 'aktif' ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <Text className={`text-[11px] ${episode.status === 'aktif' ? 'text-red-600' : 'text-emerald-700'}`}>
            {episode.status === 'aktif' ? 'Aktif' : 'Sembuh'}
          </Text>
        </View>
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4 border-t border-slate-100 pt-3">
          <View className="flex-row gap-2 mb-3">
            {episode.status === 'aktif' && (
              <Pressable onPress={onMarkRecovered} className="flex-1 bg-emerald-50 rounded-lg py-2 items-center">
                <Text className="text-emerald-700 text-xs font-medium">✓ Tandai Sembuh</Text>
              </Pressable>
            )}
            <Pressable onPress={onEditEpisode} className="flex-1 bg-slate-50 rounded-lg py-2 items-center">
              <Text className="text-slate-600 text-xs font-medium">✏️ Edit Episode</Text>
            </Pressable>
            <Pressable onPress={onDeleteEpisode} className="flex-1 bg-red-50 rounded-lg py-2 items-center">
              <Text className="text-red-600 text-xs font-medium">🗑️ Hapus Episode</Text>
            </Pressable>
          </View>

          {/* Kunjungan Dokter — daftar tampil di Timeline Perawatan di bawah,
              form tambah/edit tetap di sini karena butuh DoctorPicker khusus */}
          {editingVisit && (
            <DoctorVisitForm
              memberId={memberId}
              episodeId={episode.id}
              doctors={doctors}
              householdOwnerUid={householdOwnerUid}
              existing={editingVisit}
              onSaved={() => { setEditingVisit(null); onDataChanged(); }}
              onCancel={() => setEditingVisit(null)}
              onDoctorCreated={onDoctorCreated}
            />
          )}
          <Pressable onPress={() => { setShowVisitForm(!showVisitForm); setEditingVisit(null); }} className="mb-3">
            <Text className="text-teal-700 text-xs">{showVisitForm ? 'Batal' : '+ Tambah Kunjungan Dokter'}</Text>
          </Pressable>
          {showVisitForm && (
            <DoctorVisitForm
              memberId={memberId}
              episodeId={episode.id}
              doctors={doctors}
              householdOwnerUid={householdOwnerUid}
              onSaved={() => { setShowVisitForm(false); onDataChanged(); }}
              onDoctorCreated={onDoctorCreated}
            />
          )}


          {/* Rawat Inap */}
          <Text className="text-slate-700 text-xs font-semibold mb-2 mt-2">Rawat Inap</Text>
          {hospitalizations.map((h) => {
            const totalBiayaKamar = h.roomCostPerDay * h.lengthOfStayDays;
            return (
              <View key={h.id} className="bg-slate-50 rounded-lg p-2.5 mb-2">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-slate-900 text-xs font-medium">
                      {h.hospitalName} · {h.roomClass}
                    </Text>
                    <Text className="text-slate-500 text-[11px]">
                      Masuk {h.admissionDate} · {h.lengthOfStayDays} hari
                      {h.dischargeDate ? ` (keluar ${h.dischargeDate})` : ' (masih dirawat)'}
                    </Text>
                    <Text className="text-slate-500 text-[11px]">
                      Rp{h.roomCostPerDay.toLocaleString('id-ID')}/hari · Total kamar Rp{totalBiayaKamar.toLocaleString('id-ID')}
                    </Text>
                    {h.treatingDoctors.length > 0 && (
                      <Text className="text-slate-500 text-[11px] mt-0.5">
                        Dokter: {h.treatingDoctors.map((d) => d.name).join(', ')}
                      </Text>
                    )}
                  </View>
                  <Pressable onPress={() => { setEditingHospital(h); setShowHospitalForm(false); }} className="ml-2 px-2 py-1">
                    <Text className="text-teal-700 text-[11px]">Edit</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {editingHospital && (
            <HospitalizationForm
              memberId={memberId}
              episodeId={episode.id}
              doctors={doctors}
              householdOwnerUid={householdOwnerUid}
              existing={editingHospital}
              onSaved={() => { setEditingHospital(null); onDataChanged(); }}
              onCancel={() => setEditingHospital(null)}
              onDoctorCreated={onDoctorCreated}
            />
          )}
          <Pressable onPress={() => { setShowHospitalForm(!showHospitalForm); setEditingHospital(null); }} className="mb-3">
            <Text className="text-teal-700 text-xs">{showHospitalForm ? 'Batal' : '+ Tambah Data Rawat Inap'}</Text>
          </Pressable>
          {showHospitalForm && (
            <HospitalizationForm
              memberId={memberId}
              episodeId={episode.id}
              doctors={doctors}
              householdOwnerUid={householdOwnerUid}
              onSaved={() => { setShowHospitalForm(false); onDataChanged(); }}
              onDoctorCreated={onDoctorCreated}
            />
          )}

          {/* Timeline Perawatan: Kunjungan Dokter + Obat + Cek Suhu, dikelompokkan per hari */}
          <Text className="text-slate-700 text-xs font-semibold mb-2 mt-2">Timeline Perawatan</Text>
          {dayGroups.length === 0 ? (
            <Text className="text-slate-400 text-xs mb-2">Belum ada catatan.</Text>
          ) : (
            dayGroups.map(([dayKey, items]) => (
              <View key={dayKey} className="mb-3">
                <Text className="text-slate-500 text-[11px] font-semibold mb-1.5 uppercase">
                  {formatDayHeader(dayKey)}
                </Text>
                <View className="pl-2 border-l-2 border-slate-100 gap-2">
                  {items.map((item) => {
                    if (item.kind === 'kunjungan') {
                      const v = item.data;
                      return (
                        <View key={item.key} className="bg-emerald-50 rounded-lg p-2.5">
                          <View className="flex-row justify-between items-start">
                            <View className="flex-1">
                              <Text className="text-slate-900 text-xs font-medium">🩺 {v.doctorName}</Text>
                              <Text className="text-slate-500 text-[11px]">{v.facility} — {v.diagnosis}</Text>
                              {v.labTests && v.labTests.length > 0 && (
                                <Text className="text-slate-500 text-[11px] mt-0.5">
                                  Lab: {v.labTests.map((t) => `${t.testName}: ${t.result}`).join('; ')}
                                </Text>
                              )}
                            </View>
                            <Pressable
                              onPress={() => { setEditingVisit(v); setShowVisitForm(false); }}
                              className="ml-2 px-2 py-1"
                            >
                              <Text className="text-teal-700 text-[11px]">Edit</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    }
                    if (item.kind === 'obat') {
                      const m = item.data;
                      return (
                        <View key={item.key} className="bg-slate-50 rounded-lg p-2.5">
                          <View className="flex-row justify-between items-start">
                            <View className="flex-1">
                              <Text className="text-slate-900 text-xs font-medium">
                                💊 {m.name} ({m.form}) — {m.dose}, {m.frequencyPerDay}x/hari
                              </Text>
                              {(m.administeredTime || m.temperatureC !== undefined) && (
                                <Text className="text-slate-500 text-[11px] mt-0.5">
                                  {m.administeredTime ? `Jam ${m.administeredTime}` : ''}
                                  {m.administeredTime && m.temperatureC !== undefined ? ' · ' : ''}
                                  {m.temperatureC !== undefined ? `Suhu ${m.temperatureC}°C` : ''}
                                </Text>
                              )}
                              {m.specialNotes && <Text className="text-slate-500 text-[11px]">{m.specialNotes}</Text>}
                            </View>
                            <View className="flex-row gap-2 ml-2">
                              <Pressable onPress={() => { setEditingMed(m); setEditingSymptomLog(null); setShowMedForm(false); }}>
                                <Text className="text-teal-700 text-[11px]">Edit</Text>
                              </Pressable>
                              <Pressable onPress={() => handleDeleteMed(m)}>
                                <Text className="text-red-600 text-[11px]">Hapus</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    }
                    const s = item.data;
                    return (
                      <View key={item.key} className="bg-blue-50 rounded-lg p-2.5">
                        <View className="flex-row justify-between items-start">
                          <View className="flex-1">
                            <Text className="text-slate-900 text-xs font-medium">
                              🌡️ Cek Suhu — {s.temperatureC !== undefined ? `${s.temperatureC}°C` : '-'}
                            </Text>
                            <Text className="text-slate-500 text-[11px] mt-0.5">Jam {timeFromTimestamp(s.timestamp)}</Text>
                          </View>
                          <View className="flex-row gap-2 ml-2">
                            <Pressable onPress={() => { setEditingSymptomLog(s); setEditingMed(null); setShowMedForm(false); }}>
                              <Text className="text-teal-700 text-[11px]">Edit</Text>
                            </Pressable>
                            <Pressable onPress={() => handleDeleteSymptomLog(s)}>
                              <Text className="text-red-600 text-[11px]">Hapus</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
          {(editingMed || editingSymptomLog) && (
            <MedicationEntryForm
              memberId={memberId}
              episodeId={episode.id}
              existing={editingMed ?? undefined}
              existingSymptomLog={editingSymptomLog ?? undefined}
              onSaved={() => { setEditingMed(null); setEditingSymptomLog(null); onDataChanged(); }}
              onCancel={() => { setEditingMed(null); setEditingSymptomLog(null); }}
            />
          )}
          <Pressable
            onPress={() => { setShowMedForm(!showMedForm); setEditingMed(null); setEditingSymptomLog(null); }}
          >
            <Text className="text-teal-700 text-xs">{showMedForm ? 'Batal' : '+ Tambah Obat / Cek Suhu'}</Text>
          </Pressable>
          {showMedForm && (
            <MedicationEntryForm
              memberId={memberId}
              episodeId={episode.id}
              onSaved={() => { setShowMedForm(false); onDataChanged(); }}
            />
          )}
        </View>
      )}
    </View>
  );
}

function DoctorVisitForm({
  memberId, episodeId, doctors, householdOwnerUid, existing, onSaved, onCancel, onDoctorCreated,
}: {
  memberId: string;
  episodeId: string;
  doctors: WithId<Doctor>[];
  householdOwnerUid: string | null;
  existing?: WithId<DoctorVisit>;
  onSaved: () => void;
  onCancel?: () => void;
  onDoctorCreated?: () => void;
}) {
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [doctorId, setDoctorId] = useState<string | undefined>(existing?.doctorId);
  const [doctorName, setDoctorName] = useState(existing?.doctorName ?? '');
  const [facility, setFacility] = useState(existing?.facility ?? '');
  const [diagnosis, setDiagnosis] = useState(existing?.diagnosis ?? '');
  const [labTestName, setLabTestName] = useState(existing?.labTests?.[0]?.testName ?? '');
  const [labResult, setLabResult] = useState(existing?.labTests?.[0]?.result ?? '');
  const [saving, setSaving] = useState(false);

  function handleSelectDoctor(doctor: WithId<Doctor>) {
    setDoctorId(doctor.id);
    setDoctorName(doctor.name);
    if (doctor.practiceLocation) setFacility(doctor.practiceLocation);
  }

  async function handleCreateDoctor(data: Omit<Doctor, 'createdAt'>) {
    const id = await DoctorService.create(data);
    onDoctorCreated?.();
    const created: WithId<Doctor> = { id, ...data, createdAt: Date.now() };
    setDoctorId(created.id);
    return created;
  }

  async function handleSave() {
    if (!date || !doctorName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        memberId, episodeId, date, doctorId, doctorName: doctorName.trim(), facility, diagnosis,
        labTests: labTestName
          ? [{ id: existing?.labTests?.[0]?.id ?? String(Date.now()), testName: labTestName, result: labResult }]
          : [],
      };
      if (existing) {
        await SicknessService.updateDoctorVisit(memberId, existing.id, payload);
      } else {
        await SicknessService.addDoctorVisit(memberId, payload);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="bg-slate-50 rounded-lg p-3 mb-3 gap-2">
      <TextInput value={date} onChangeText={setDate} placeholder="Tanggal (YYYY-MM-DD)" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />

      {householdOwnerUid ? (
        <DoctorPicker
          doctors={doctors}
          value={doctorName}
          onChangeText={(t) => { setDoctorName(t); setDoctorId(undefined); }}
          onSelectDoctor={handleSelectDoctor}
          onCreateDoctor={handleCreateDoctor}
          householdOwnerUid={householdOwnerUid}
        />
      ) : (
        <TextInput value={doctorName} onChangeText={setDoctorName} placeholder="Nama dokter" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      )}

      <TextInput value={facility} onChangeText={setFacility} placeholder="Fasilitas, mis. RS Grha Kedoya" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      <TextInput value={diagnosis} onChangeText={setDiagnosis} placeholder="Diagnosis" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      <TextInput value={labTestName} onChangeText={setLabTestName} placeholder="Tes penunjang (opsional), mis. Swab Antigen" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      <TextInput value={labResult} onChangeText={setLabResult} placeholder="Hasil, mis. Positif Influenza A" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      <View className="flex-row gap-2">
        {onCancel && (
          <Pressable onPress={onCancel} className="flex-1 border border-slate-200 rounded-lg py-2 items-center">
            <Text className="text-slate-600 text-xs">Batal</Text>
          </Pressable>
        )}
        <Pressable onPress={handleSave} disabled={saving} className="flex-1 bg-teal-700 rounded-lg py-2 items-center disabled:opacity-60">
          <Text className="text-white text-xs font-medium">{saving ? 'Menyimpan...' : existing ? 'Simpan Perubahan' : 'Simpan Kunjungan'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const ROOM_CLASS_OPTIONS = ['VIP', 'Kelas 1', 'Kelas 2', 'Kelas 3', 'ICU', 'NICU', 'HCU'];

function HospitalizationForm({
  memberId, episodeId, doctors, householdOwnerUid, existing, onSaved, onCancel, onDoctorCreated,
}: {
  memberId: string;
  episodeId: string;
  doctors: WithId<Doctor>[];
  householdOwnerUid: string | null;
  existing?: WithId<Hospitalization>;
  onSaved: () => void;
  onCancel?: () => void;
  onDoctorCreated?: () => void;
}) {
  const [hospitalName, setHospitalName] = useState(existing?.hospitalName ?? '');
  const [roomClass, setRoomClass] = useState(existing?.roomClass ?? '');
  const [roomCostPerDay, setRoomCostPerDay] = useState(String(existing?.roomCostPerDay ?? ''));
  const [admissionDate, setAdmissionDate] = useState(existing?.admissionDate ?? todayISO());
  const [dischargeDate, setDischargeDate] = useState(existing?.dischargeDate ?? '');
  const [lengthOfStayDays, setLengthOfStayDays] = useState(String(existing?.lengthOfStayDays ?? '1'));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const [treatingDoctors, setTreatingDoctors] = useState<TreatingDoctor[]>(existing?.treatingDoctors ?? []);
  const [doctorInput, setDoctorInput] = useState('');
  const [pendingDoctorId, setPendingDoctorId] = useState<string | undefined>(undefined);

  function handleSelectDoctor(doctor: WithId<Doctor>) {
    setPendingDoctorId(doctor.id);
    setDoctorInput(doctor.name);
  }

  async function handleCreateDoctor(data: Omit<Doctor, 'createdAt'>) {
    const id = await DoctorService.create(data);
    onDoctorCreated?.();
    const created: WithId<Doctor> = { id, ...data, createdAt: Date.now() };
    setPendingDoctorId(created.id);
    return created;
  }

  function handleAddTreatingDoctor() {
    const name = doctorInput.trim();
    if (!name) return;
    if (treatingDoctors.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      setDoctorInput('');
      setPendingDoctorId(undefined);
      return;
    }
    setTreatingDoctors((prev) => [...prev, { doctorId: pendingDoctorId, name }]);
    setDoctorInput('');
    setPendingDoctorId(undefined);
  }

  function handleRemoveTreatingDoctor(name: string) {
    setTreatingDoctors((prev) => prev.filter((d) => d.name !== name));
  }

  // Auto-hitung lama dirawat dari selisih tanggal masuk & keluar (kalau tanggal keluar diisi)
  function handleDischargeDateChange(text: string) {
    setDischargeDate(text);
    if (/^\d{4}-\d{2}-\d{2}$/.test(admissionDate) && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const days = Math.max(
        1,
        Math.round((new Date(text).getTime() - new Date(admissionDate).getTime()) / 86400000)
      );
      setLengthOfStayDays(String(days));
    }
  }

  async function handleSave() {
    if (!hospitalName.trim() || !roomClass.trim() || !admissionDate) return;
    setSaving(true);
    try {
      const payload = {
        memberId,
        episodeId,
        hospitalName: hospitalName.trim(),
        roomClass: roomClass.trim(),
        roomCostPerDay: Number(roomCostPerDay) || 0,
        admissionDate,
        dischargeDate: dischargeDate || undefined,
        lengthOfStayDays: Number(lengthOfStayDays) || 1,
        treatingDoctors,
        notes: notes || undefined,
      };
      if (existing) {
        await SicknessService.updateHospitalization(memberId, existing.id, payload);
      } else {
        await SicknessService.addHospitalization(memberId, payload);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="bg-slate-50 rounded-lg p-3 mb-3 gap-2">
      <TextInput value={hospitalName} onChangeText={setHospitalName} placeholder="Nama rumah sakit, mis. RS Grha Kedoya" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />

      <Text className="text-slate-500 text-[10px]">Kelas Kamar</Text>
      <View className="flex-row flex-wrap gap-1.5">
        {ROOM_CLASS_OPTIONS.map((c) => (
          <Pressable key={c} onPress={() => setRoomClass(c)} className={`px-2 py-1 rounded-md border ${roomClass === c ? 'bg-teal-700 border-teal-700' : 'border-slate-200'}`}>
            <Text className={`text-[10px] ${roomClass === c ? 'text-white' : 'text-slate-600'}`}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={roomClass} onChangeText={setRoomClass} placeholder="Atau ketik kelas kamar lainnya" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />

      <TextInput value={roomCostPerDay} onChangeText={setRoomCostPerDay} keyboardType="number-pad" placeholder="Biaya kamar per hari (Rp)" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Text className="text-slate-500 text-[10px] mb-1">Tanggal Masuk</Text>
          <TextInput value={admissionDate} onChangeText={setAdmissionDate} placeholder="YYYY-MM-DD" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
        </View>
        <View className="flex-1">
          <Text className="text-slate-500 text-[10px] mb-1">Tanggal Keluar (opsional)</Text>
          <TextInput value={dischargeDate} onChangeText={handleDischargeDateChange} placeholder="Kosongkan jika masih dirawat" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
        </View>
      </View>
      <View>
        <Text className="text-slate-500 text-[10px] mb-1">Lama Dirawat (hari)</Text>
        <TextInput value={lengthOfStayDays} onChangeText={setLengthOfStayDays} keyboardType="number-pad" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-24" />
      </View>

      <Text className="text-slate-500 text-[10px] mt-1">Dokter yang Menangani (bisa lebih dari satu)</Text>
      {treatingDoctors.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mb-1">
          {treatingDoctors.map((d) => (
            <View key={d.name} className="flex-row items-center bg-teal-50 rounded-full pl-2.5 pr-1.5 py-1">
              <Text className="text-teal-700 text-[11px] mr-1">{d.name}</Text>
              <Pressable onPress={() => handleRemoveTreatingDoctor(d.name)} hitSlop={6}>
                <Text className="text-teal-700 text-[11px] font-bold">✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View className="flex-row gap-2 items-start">
        <View className="flex-1">
          {householdOwnerUid ? (
            <DoctorPicker
              doctors={doctors}
              value={doctorInput}
              onChangeText={(t) => { setDoctorInput(t); setPendingDoctorId(undefined); }}
              onSelectDoctor={handleSelectDoctor}
              onCreateDoctor={handleCreateDoctor}
              householdOwnerUid={householdOwnerUid}
            />
          ) : (
            <TextInput value={doctorInput} onChangeText={setDoctorInput} placeholder="Nama dokter" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
          )}
        </View>
        <Pressable onPress={handleAddTreatingDoctor} className="bg-slate-700 rounded-lg px-3 py-1.5">
          <Text className="text-white text-xs">+ Tambah</Text>
        </Pressable>
      </View>

      <TextInput value={notes} onChangeText={setNotes} placeholder="Catatan tambahan (opsional)" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs mt-1" />

      <View className="flex-row gap-2 mt-1">
        {onCancel && (
          <Pressable onPress={onCancel} className="flex-1 border border-slate-200 rounded-lg py-2 items-center">
            <Text className="text-slate-600 text-xs">Batal</Text>
          </Pressable>
        )}
        <Pressable onPress={handleSave} disabled={saving} className="flex-1 bg-teal-700 rounded-lg py-2 items-center disabled:opacity-60">
          <Text className="text-white text-xs font-medium">{saving ? 'Menyimpan...' : existing ? 'Simpan Perubahan' : 'Simpan Rawat Inap'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MedicationEntryForm({
  memberId, episodeId, existing, existingSymptomLog, onSaved, onCancel,
}: {
  memberId: string;
  episodeId: string;
  existing?: WithId<AcuteMedication>;
  existingSymptomLog?: WithId<SymptomLog>;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<'obat' | 'suhu'>(existingSymptomLog ? 'suhu' : 'obat');
  const isEditing = !!existing || !!existingSymptomLog;

  // Field khusus obat
  const [name, setName] = useState(existing?.name ?? '');
  const [form, setForm] = useState<MedicationForm>(existing?.form ?? 'sirup');
  const [dose, setDose] = useState(existing?.dose ?? '');
  const [frequencyPerDay, setFrequencyPerDay] = useState(String(existing?.frequencyPerDay ?? 2));
  const [specialNotes, setSpecialNotes] = useState(existing?.specialNotes ?? '');

  // Field bersama: tanggal, jam, suhu (dipakai baik mode obat maupun cek suhu saja)
  const [date, setDate] = useState(
    existing?.startDate ?? (existingSymptomLog ? dateFromTimestamp(existingSymptomLog.timestamp) : todayISO())
  );
  const [time, setTime] = useState(
    existing?.administeredTime ?? (existingSymptomLog ? timeFromTimestamp(existingSymptomLog.timestamp) : nowHHMM())
  );
  const [temperatureC, setTemperatureC] = useState(() => {
    const t = existing?.temperatureC ?? existingSymptomLog?.temperatureC;
    return t !== undefined ? String(t) : '';
  });

  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!date) return;
    setSaving(true);
    try {
      if (mode === 'suhu') {
        const payload = {
          episodeId,
          memberId,
          timestamp: combineDateTime(date, time),
          temperatureC: temperatureC ? Number(temperatureC) : undefined,
          complaints: [] as string[],
        };
        if (existingSymptomLog) {
          await SicknessService.updateSymptomLog(memberId, existingSymptomLog.id, payload);
        } else {
          await SicknessService.addSymptomLog(memberId, payload);
        }
      } else {
        if (!name || !dose) return;
        const payload = {
          memberId, episodeId, name, form, dose,
          frequencyPerDay: Number(frequencyPerDay) || 1,
          isAntibiotic: /amoxicillin|cefixime|antibiotik/i.test(name),
          isAntiviral: /tamiflu|temulvir|oseltamivir/i.test(name),
          specialNotes: specialNotes || undefined,
          startDate: date,
          administeredTime: time || undefined,
          temperatureC: temperatureC ? Number(temperatureC) : undefined,
        };
        if (existing) {
          await SicknessService.updateAcuteMedication(memberId, existing.id, payload);
        } else {
          await SicknessService.addAcuteMedication(memberId, payload);
        }
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="bg-slate-50 rounded-lg p-3 mb-3 gap-2">
      {/* Toggle mode hanya muncul saat menambah baru — saat edit, mode ikut jenis data aslinya */}
      {!isEditing && (
        <View className="flex-row gap-2 mb-1">
          <Pressable
            onPress={() => setMode('obat')}
            className={`flex-1 px-2 py-1.5 rounded-md border items-center ${mode === 'obat' ? 'bg-teal-700 border-teal-700' : 'border-slate-200'}`}
          >
            <Text className={`text-xs font-medium ${mode === 'obat' ? 'text-white' : 'text-slate-600'}`}>💊 Obat</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('suhu')}
            className={`flex-1 px-2 py-1.5 rounded-md border items-center ${mode === 'suhu' ? 'bg-teal-700 border-teal-700' : 'border-slate-200'}`}
          >
            <Text className={`text-xs font-medium ${mode === 'suhu' ? 'text-white' : 'text-slate-600'}`}>🌡️ Cek Suhu Saja</Text>
          </Pressable>
        </View>
      )}

      {mode === 'obat' && (
        <>
          <TextInput value={name} onChangeText={setName} placeholder="Nama obat, mis. Tamiflu / Sanmol / Nasonex" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
          <View className="flex-row flex-wrap gap-1.5">
            {MED_FORMS.map((f) => (
              <Pressable key={f} onPress={() => setForm(f)} className={`px-2 py-1 rounded-md border ${form === f ? 'bg-teal-700 border-teal-700' : 'border-slate-200'}`}>
                <Text className={`text-[10px] capitalize ${form === f ? 'text-white' : 'text-slate-600'}`}>{f}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={dose} onChangeText={setDose} placeholder="Dosis, mis. 5 ml / 1/2 tablet" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
          <TextInput value={frequencyPerDay} onChangeText={setFrequencyPerDay} keyboardType="number-pad" placeholder="Frekuensi per hari" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
        </>
      )}

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Text className="text-slate-500 text-[10px] mb-1">Tanggal</Text>
          <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
        </View>
        <View className="flex-1">
          <Text className="text-slate-500 text-[10px] mb-1">Jam</Text>
          <TextInput value={time} onChangeText={setTime} placeholder="HH:MM" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
        </View>
      </View>
      <View>
        <Text className="text-slate-500 text-[10px] mb-1">Suhu Badan (°C{mode === 'obat' ? ', opsional' : ''})</Text>
        <TextInput value={temperatureC} onChangeText={setTemperatureC} keyboardType="decimal-pad" placeholder="mis. 38.5" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      </View>

      {mode === 'obat' && (
        <TextInput value={specialNotes} onChangeText={setSpecialNotes} placeholder="Catatan, mis. dihabiskan / sesudah makan" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      )}

      <View className="flex-row gap-2">
        {onCancel && (
          <Pressable onPress={onCancel} className="flex-1 border border-slate-200 rounded-lg py-2 items-center">
            <Text className="text-slate-600 text-xs">Batal</Text>
          </Pressable>
        )}
        <Pressable onPress={handleSave} disabled={saving} className="flex-1 bg-teal-700 rounded-lg py-2 items-center disabled:opacity-60">
          <Text className="text-white text-xs font-medium">
            {saving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : mode === 'suhu' ? 'Simpan Cek Suhu' : 'Simpan Obat'}
          </Text>
        </Pressable>
      </View>
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

import type { ReactNode } from 'react';
// app/members/[id]/sickness.tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { auth } from '../../../services/firebaseConfig';
import { ensureHouseholdAndGetActiveOwner } from '../../../services/householdService';
import { SicknessService, DoctorService } from '../../../services/firestoreService';
import {
  SicknessEpisode, DoctorVisit, AcuteMedication, MedicationForm, Doctor,
} from '../../../types/health';
import ScreenHeader from '../../../components/ScreenHeader';
import DoctorPicker from '../../../components/DoctorPicker';

type WithId<T> = T & { id: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const MED_FORMS: MedicationForm[] = ['sirup', 'tablet', 'puyer', 'tetes', 'semprot', 'nebulizer', 'suntik', 'lainnya'];

export default function SicknessScreen() {
  const { id: memberId } = useLocalSearchParams<{ id: string }>();
  const [householdOwnerUid, setHouseholdOwnerUid] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<WithId<Doctor>[]>([]);
  const [episodes, setEpisodes] = useState<WithId<SicknessEpisode>[]>([]);
  const [visits, setVisits] = useState<WithId<DoctorVisit>[]>([]);
  const [meds, setMeds] = useState<WithId<AcuteMedication>[]>([]);
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

      const [ep, vs, md] = await Promise.all([
        SicknessService.listEpisodes(memberId),
        SicknessService.listDoctorVisits(memberId),
        SicknessService.listAcuteMedications(memberId),
        ownerUid ? loadDoctors(ownerUid) : Promise.resolve(),
      ]);
      setEpisodes(ep); setVisits(vs); setMeds(md);
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
              expanded={expandedId === ep.id}
              onToggle={() => setExpandedId(expandedId === ep.id ? null : ep.id)}
              onMarkRecovered={() => handleMarkRecovered(ep)}
              onEditEpisode={() => startEditEpisode(ep)}
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
  episode, memberId, doctors, householdOwnerUid, visits, meds, expanded,
  onToggle, onMarkRecovered, onEditEpisode, onDataChanged, onDoctorCreated,
}: {
  episode: WithId<SicknessEpisode>;
  memberId: string;
  doctors: WithId<Doctor>[];
  householdOwnerUid: string | null;
  visits: WithId<DoctorVisit>[];
  meds: WithId<AcuteMedication>[];
  expanded: boolean;
  onToggle: () => void;
  onMarkRecovered: () => void;
  onEditEpisode: () => void;
  onDataChanged: () => void;
  onDoctorCreated: () => void;
}) {
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [editingVisit, setEditingVisit] = useState<WithId<DoctorVisit> | null>(null);
  const [showMedForm, setShowMedForm] = useState(false);
  const [editingMed, setEditingMed] = useState<WithId<AcuteMedication> | null>(null);

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
          </View>

          {/* Kunjungan Dokter */}
          <Text className="text-slate-700 text-xs font-semibold mb-2">Kunjungan Dokter</Text>
          {visits.map((v) => (
            <View key={v.id} className="bg-slate-50 rounded-lg p-2.5 mb-2">
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-slate-900 text-xs font-medium">{v.date} · {v.doctorName}</Text>
                  <Text className="text-slate-500 text-[11px]">{v.facility} — {v.diagnosis}</Text>
                  {v.labTests && v.labTests.length > 0 && (
                    <Text className="text-slate-500 text-[11px] mt-0.5">
                      Lab: {v.labTests.map((t) => `${t.testName}: ${t.result}`).join('; ')}
                    </Text>
                  )}
                </View>
                <Pressable onPress={() => { setEditingVisit(v); setShowVisitForm(false); }} className="ml-2 px-2 py-1">
                  <Text className="text-teal-700 text-[11px]">Edit</Text>
                </Pressable>
              </View>
            </View>
          ))}
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

          {/* Obat */}
          <Text className="text-slate-700 text-xs font-semibold mb-2 mt-2">Obat Diberikan</Text>
          {meds.map((m) => (
            <View key={m.id} className="bg-slate-50 rounded-lg p-2.5 mb-2">
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-slate-900 text-xs font-medium">
                    {m.name} ({m.form}) — {m.dose}, {m.frequencyPerDay}x/hari
                  </Text>
                  {m.specialNotes && <Text className="text-slate-500 text-[11px]">{m.specialNotes}</Text>}
                </View>
                <Pressable onPress={() => { setEditingMed(m); setShowMedForm(false); }} className="ml-2 px-2 py-1">
                  <Text className="text-teal-700 text-[11px]">Edit</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {editingMed && (
            <MedicationEntryForm
              memberId={memberId}
              episodeId={episode.id}
              existing={editingMed}
              onSaved={() => { setEditingMed(null); onDataChanged(); }}
              onCancel={() => setEditingMed(null)}
            />
          )}
          <Pressable onPress={() => { setShowMedForm(!showMedForm); setEditingMed(null); }}>
            <Text className="text-teal-700 text-xs">{showMedForm ? 'Batal' : '+ Tambah Obat'}</Text>
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

function MedicationEntryForm({
  memberId, episodeId, existing, onSaved, onCancel,
}: {
  memberId: string;
  episodeId: string;
  existing?: WithId<AcuteMedication>;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [form, setForm] = useState<MedicationForm>(existing?.form ?? 'sirup');
  const [dose, setDose] = useState(existing?.dose ?? '');
  const [frequencyPerDay, setFrequencyPerDay] = useState(String(existing?.frequencyPerDay ?? 2));
  const [specialNotes, setSpecialNotes] = useState(existing?.specialNotes ?? '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? todayISO());
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name || !dose || !startDate) return;
    setSaving(true);
    try {
      const payload = {
        memberId, episodeId, name, form, dose,
        frequencyPerDay: Number(frequencyPerDay) || 1,
        isAntibiotic: /amoxicillin|cefixime|antibiotik/i.test(name),
        isAntiviral: /tamiflu|temulvir|oseltamivir/i.test(name),
        specialNotes: specialNotes || undefined,
        startDate,
      };
      if (existing) {
        await SicknessService.updateAcuteMedication(memberId, existing.id, payload);
      } else {
        await SicknessService.addAcuteMedication(memberId, payload);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="bg-slate-50 rounded-lg p-3 mb-3 gap-2">
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
      <TextInput value={startDate} onChangeText={setStartDate} placeholder="Tanggal mulai (YYYY-MM-DD)" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      <TextInput value={specialNotes} onChangeText={setSpecialNotes} placeholder="Catatan, mis. dihabiskan / sesudah makan" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      <View className="flex-row gap-2">
        {onCancel && (
          <Pressable onPress={onCancel} className="flex-1 border border-slate-200 rounded-lg py-2 items-center">
            <Text className="text-slate-600 text-xs">Batal</Text>
          </Pressable>
        )}
        <Pressable onPress={handleSave} disabled={saving} className="flex-1 bg-teal-700 rounded-lg py-2 items-center disabled:opacity-60">
          <Text className="text-white text-xs font-medium">{saving ? 'Menyimpan...' : existing ? 'Simpan Perubahan' : 'Simpan Obat'}</Text>
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

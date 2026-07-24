import type { ReactNode } from 'react';
// app/members/[id]/sickness.tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SicknessService } from '../../../services/firestoreService';
import {
  SicknessEpisode, DoctorVisit, AcuteMedication, MedicationForm,
} from '../../../types/health';

type WithId<T> = T & { id: string };

const MED_FORMS: MedicationForm[] = ['sirup', 'tablet', 'puyer', 'tetes', 'semprot', 'nebulizer', 'suntik', 'lainnya'];

export default function SicknessScreen() {
  const { id: memberId } = useLocalSearchParams<{ id: string }>();
  const [episodes, setEpisodes] = useState<WithId<SicknessEpisode>[]>([]);
  const [visits, setVisits] = useState<WithId<DoctorVisit>[]>([]);
  const [meds, setMeds] = useState<WithId<AcuteMedication>[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewEpisode, setShowNewEpisode] = useState(false);

  // Form episode baru
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [complaints, setComplaints] = useState('');

  const load = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const [ep, vs, md] = await Promise.all([
        SicknessService.listEpisodes(memberId),
        SicknessService.listDoctorVisits(memberId),
        SicknessService.listAcuteMedications(memberId),
      ]);
      setEpisodes(ep); setVisits(vs); setMeds(md);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreateEpisode() {
    if (!memberId || !title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return;
    await SicknessService.createEpisode(memberId, {
      memberId,
      title: title.trim(),
      startDate,
      status: 'aktif',
      mainComplaints: complaints.split(',').map((c) => c.trim()).filter(Boolean),
    });
    setTitle(''); setStartDate(''); setComplaints(''); setShowNewEpisode(false);
    await load();
  }

  async function handleMarkRecovered(ep: WithId<SicknessEpisode>) {
    await SicknessService.updateEpisode(memberId!, ep.id, {
      status: 'sembuh',
      endDate: new Date().toISOString().slice(0, 10),
    });
    await load();
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="p-4 md:p-8">
      <Pressable
        onPress={() => setShowNewEpisode(!showNewEpisode)}
        className="bg-teal-700 rounded-xl py-3 items-center mb-4 max-w-[220px]"
      >
        <Text className="text-white font-medium text-sm">
          {showNewEpisode ? 'Tutup Form' : '+ Catat Episode Sakit Baru'}
        </Text>
      </Pressable>

      {showNewEpisode && (
        <View className="bg-white rounded-2xl p-4 border border-slate-100 mb-5">
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
          <Pressable onPress={handleCreateEpisode} className="bg-teal-700 rounded-xl py-3 items-center mt-1">
            <Text className="text-white font-semibold text-sm">Simpan Episode</Text>
          </Pressable>
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
              visits={visits.filter((v) => v.episodeId === ep.id)}
              meds={meds.filter((m) => m.episodeId === ep.id)}
              expanded={expandedId === ep.id}
              onToggle={() => setExpandedId(expandedId === ep.id ? null : ep.id)}
              onMarkRecovered={() => handleMarkRecovered(ep)}
              onDataChanged={load}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */

function EpisodeCard({
  episode, memberId, visits, meds, expanded, onToggle, onMarkRecovered, onDataChanged,
}: {
  episode: WithId<SicknessEpisode>;
  memberId: string;
  visits: WithId<DoctorVisit>[];
  meds: WithId<AcuteMedication>[];
  expanded: boolean;
  onToggle: () => void;
  onMarkRecovered: () => void;
  onDataChanged: () => void;
}) {
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);

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
          {episode.status === 'aktif' && (
            <Pressable onPress={onMarkRecovered} className="bg-emerald-50 rounded-lg py-2 items-center mb-3">
              <Text className="text-emerald-700 text-xs font-medium">✓ Tandai Sembuh</Text>
            </Pressable>
          )}

          {/* Kunjungan Dokter */}
          <Text className="text-slate-700 text-xs font-semibold mb-2">Kunjungan Dokter</Text>
          {visits.map((v) => (
            <View key={v.id} className="bg-slate-50 rounded-lg p-2.5 mb-2">
              <Text className="text-slate-900 text-xs font-medium">{v.date} · {v.doctorName}</Text>
              <Text className="text-slate-500 text-[11px]">{v.facility} — {v.diagnosis}</Text>
              {v.labTests && v.labTests.length > 0 && (
                <Text className="text-slate-500 text-[11px] mt-0.5">
                  Lab: {v.labTests.map((t) => `${t.testName}: ${t.result}`).join('; ')}
                </Text>
              )}
            </View>
          ))}
          <Pressable onPress={() => setShowVisitForm(!showVisitForm)} className="mb-3">
            <Text className="text-teal-700 text-xs">{showVisitForm ? 'Batal' : '+ Tambah Kunjungan Dokter'}</Text>
          </Pressable>
          {showVisitForm && (
            <DoctorVisitForm
              memberId={memberId}
              episodeId={episode.id}
              onSaved={() => { setShowVisitForm(false); onDataChanged(); }}
            />
          )}

          {/* Obat */}
          <Text className="text-slate-700 text-xs font-semibold mb-2 mt-2">Obat Diberikan</Text>
          {meds.map((m) => (
            <View key={m.id} className="bg-slate-50 rounded-lg p-2.5 mb-2">
              <Text className="text-slate-900 text-xs font-medium">
                {m.name} ({m.form}) — {m.dose}, {m.frequencyPerDay}x/hari
              </Text>
              {m.specialNotes && <Text className="text-slate-500 text-[11px]">{m.specialNotes}</Text>}
            </View>
          ))}
          <Pressable onPress={() => setShowMedForm(!showMedForm)}>
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

function DoctorVisitForm({ memberId, episodeId, onSaved }: { memberId: string; episodeId: string; onSaved: () => void }) {
  const [date, setDate] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [facility, setFacility] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [labTestName, setLabTestName] = useState('');
  const [labResult, setLabResult] = useState('');

  async function handleSave() {
    if (!date || !doctorName) return;
    await SicknessService.addDoctorVisit(memberId, {
      memberId, episodeId, date, doctorName, facility, diagnosis,
      labTests: labTestName ? [{ id: String(Date.now()), testName: labTestName, result: labResult }] : [],
    });
    onSaved();
  }

  return (
    <View className="bg-slate-50 rounded-lg p-3 mb-3 gap-2">
      <TextInput value={date} onChangeText={setDate} placeholder="Tanggal (YYYY-MM-DD)" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      <TextInput value={doctorName} onChangeText={setDoctorName} placeholder="Nama dokter, mis. dr. Cynthia Utami, Sp.A" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      <TextInput value={facility} onChangeText={setFacility} placeholder="Fasilitas, mis. RS Grha Kedoya" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      <TextInput value={diagnosis} onChangeText={setDiagnosis} placeholder="Diagnosis" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      <TextInput value={labTestName} onChangeText={setLabTestName} placeholder="Tes penunjang (opsional), mis. Swab Antigen" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      <TextInput value={labResult} onChangeText={setLabResult} placeholder="Hasil, mis. Positif Influenza A" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      <Pressable onPress={handleSave} className="bg-teal-700 rounded-lg py-2 items-center">
        <Text className="text-white text-xs font-medium">Simpan Kunjungan</Text>
      </Pressable>
    </View>
  );
}

function MedicationEntryForm({ memberId, episodeId, onSaved }: { memberId: string; episodeId: string; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [form, setForm] = useState<MedicationForm>('sirup');
  const [dose, setDose] = useState('');
  const [frequencyPerDay, setFrequencyPerDay] = useState('2');
  const [specialNotes, setSpecialNotes] = useState('');
  const [startDate, setStartDate] = useState('');

  async function handleSave() {
    if (!name || !dose || !startDate) return;
    await SicknessService.addAcuteMedication(memberId, {
      memberId, episodeId, name, form, dose,
      frequencyPerDay: Number(frequencyPerDay) || 1,
      isAntibiotic: /amoxicillin|cefixime|antibiotik/i.test(name),
      isAntiviral: /tamiflu|temulvir|oseltamivir/i.test(name),
      specialNotes: specialNotes || undefined,
      startDate,
    });
    onSaved();
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
      <Pressable onPress={handleSave} className="bg-teal-700 rounded-lg py-2 items-center">
        <Text className="text-white text-xs font-medium">Simpan Obat</Text>
      </Pressable>
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

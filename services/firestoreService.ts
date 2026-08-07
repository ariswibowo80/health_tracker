// services/firestoreService.ts
//
// STRUKTUR DATA FIRESTORE (mendukung multi-profil keluarga):
//
// familyMembers/{memberId}
//   -> dokumen FamilyMember (profil anak, dewasa, lansia)
//
// healthRecords/{memberId}/sicknessEpisodes/{episodeId}
// healthRecords/{memberId}/symptomLogs/{logId}
// healthRecords/{memberId}/doctorVisits/{visitId}
// healthRecords/{memberId}/acuteMedications/{medId}
// healthRecords/{memberId}/labRecords/{labId}
// healthRecords/{memberId}/dailyLogs/{logId}
// healthRecords/{memberId}/maintenanceMedications/{medId}
//
// Setiap memberId berada di bawah satu akun keluarga (ownerUid) sehingga
// Firestore Security Rules cukup memvalidasi familyMembers.ownerUid == auth.uid
// lalu mengizinkan akses ke seluruh subcollection healthRecords/{memberId}/**.

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  FamilyMember,
  Doctor,
  SicknessEpisode,
  SymptomLog,
  DoctorVisit,
  AcuteMedication,
  Hospitalization,
  LabRecord,
  DailyLog,
  MaintenanceMedication,
} from '../types/health';

/* ------------------------------------------------------------------ */
/* Helper generik                                                     */
/* ------------------------------------------------------------------ */

type WithId<T> = T & { id: string };

function subcollection(memberId: string, name: string) {
  return collection(db, 'healthRecords', memberId, name);
}

async function createDoc<T extends object>(colRef: ReturnType<typeof collection>, data: T) {
  const ref = await addDoc(colRef, { ...data, createdAt: Timestamp.now() });
  return ref.id;
}

async function updateDocById(
  memberId: string,
  subName: string,
  docId: string,
  data: Partial<object>
) {
  const ref = doc(db, 'healthRecords', memberId, subName, docId);
  await updateDoc(ref, data as any);
}

async function deleteDocById(memberId: string, subName: string, docId: string) {
  const ref = doc(db, 'healthRecords', memberId, subName, docId);
  await deleteDoc(ref);
}

async function listDocs<T>(
  memberId: string,
  subName: string,
  orderByField = 'date',
  max = 200
): Promise<WithId<T>[]> {
  const q = query(subcollection(memberId, subName), orderBy(orderByField, 'desc'), fsLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
}

/* ------------------------------------------------------------------ */
/* DOCTORS (dibagikan di seluruh household, bukan per anggota keluarga) */
/* ------------------------------------------------------------------ */

export const DoctorService = {
  async list(householdOwnerUid: string): Promise<WithId<Doctor>[]> {
    const q = query(collection(db, 'doctors'), where('ownerUid', '==', householdOwnerUid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Doctor) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  create: (data: Omit<Doctor, 'createdAt'>) =>
    createDoc(collection(db, 'doctors'), data),

  update: (doctorId: string, data: Partial<Doctor>) =>
    updateDoc(doc(db, 'doctors', doctorId), data as any),

  delete: (doctorId: string) => deleteDoc(doc(db, 'doctors', doctorId)),
};

/* ------------------------------------------------------------------ */
/* FAMILY MEMBERS                                                      */
/* ------------------------------------------------------------------ */

export async function createFamilyMember(data: Omit<FamilyMember, 'id' | 'createdAt'>) {
  return createDoc(collection(db, 'familyMembers'), data);
}

export async function getFamilyMembers(ownerUid: string): Promise<WithId<FamilyMember>[]> {
  const q = query(collection(db, 'familyMembers'), where('ownerUid', '==', ownerUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as FamilyMember) }));
}

export function listenFamilyMembers(
  ownerUid: string,
  callback: (members: WithId<FamilyMember>[]) => void
): Unsubscribe {
  const q = query(collection(db, 'familyMembers'), where('ownerUid', '==', ownerUid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as FamilyMember) })));
  });
}

export async function updateFamilyMember(memberId: string, data: Partial<FamilyMember>) {
  await updateDoc(doc(db, 'familyMembers', memberId), data as any);
}

/* ------------------------------------------------------------------ */
/* MODUL 1: SICKNESS TRACKER                                           */
/* ------------------------------------------------------------------ */

export const SicknessService = {
  createEpisode: (memberId: string, data: Omit<SicknessEpisode, 'id'>) =>
    createDoc(subcollection(memberId, 'sicknessEpisodes'), data),

  updateEpisode: (memberId: string, id: string, data: Partial<SicknessEpisode>) =>
    updateDocById(memberId, 'sicknessEpisodes', id, data),

  listEpisodes: (memberId: string) =>
    listDocs<SicknessEpisode>(memberId, 'sicknessEpisodes', 'startDate'),

  addSymptomLog: (memberId: string, data: Omit<SymptomLog, 'id'>) =>
    createDoc(subcollection(memberId, 'symptomLogs'), data),

  listSymptomLogs: (memberId: string, episodeId?: string) =>
    listDocs<SymptomLog>(memberId, 'symptomLogs', 'timestamp').then((logs) =>
      episodeId ? logs.filter((l) => l.episodeId === episodeId) : logs
    ),

  addDoctorVisit: (memberId: string, data: Omit<DoctorVisit, 'id'>) =>
    createDoc(subcollection(memberId, 'doctorVisits'), data),

  updateDoctorVisit: (memberId: string, id: string, data: Partial<DoctorVisit>) =>
    updateDocById(memberId, 'doctorVisits', id, data),

  deleteDoctorVisit: (memberId: string, id: string) =>
    deleteDocById(memberId, 'doctorVisits', id),

  listDoctorVisits: (memberId: string) =>
    listDocs<DoctorVisit>(memberId, 'doctorVisits', 'date'),

  addAcuteMedication: (memberId: string, data: Omit<AcuteMedication, 'id'>) =>
    createDoc(subcollection(memberId, 'acuteMedications'), data),

  updateAcuteMedication: (memberId: string, id: string, data: Partial<AcuteMedication>) =>
    updateDocById(memberId, 'acuteMedications', id, data),

  deleteAcuteMedication: (memberId: string, id: string) =>
    deleteDocById(memberId, 'acuteMedications', id),

  listAcuteMedications: (memberId: string) =>
    listDocs<AcuteMedication>(memberId, 'acuteMedications', 'startDate'),

  addHospitalization: (memberId: string, data: Omit<Hospitalization, 'id'>) =>
    createDoc(subcollection(memberId, 'hospitalizations'), data),

  updateHospitalization: (memberId: string, id: string, data: Partial<Hospitalization>) =>
    updateDocById(memberId, 'hospitalizations', id, data),

  deleteHospitalization: (memberId: string, id: string) =>
    deleteDocById(memberId, 'hospitalizations', id),

  listHospitalizations: (memberId: string) =>
    listDocs<Hospitalization>(memberId, 'hospitalizations', 'admissionDate'),

  deleteEpisode: (memberId: string, id: string) =>
    deleteDocById(memberId, 'sicknessEpisodes', id),
};

/* ------------------------------------------------------------------ */
/* MODUL 2: LAB & MCU TRACKER                                          */
/* ------------------------------------------------------------------ */

export const LabService = {
  addLabRecord: (memberId: string, data: Omit<LabRecord, 'id'>) =>
    createDoc(subcollection(memberId, 'labRecords'), data),

  updateLabRecord: (memberId: string, id: string, data: Partial<LabRecord>) =>
    updateDocById(memberId, 'labRecords', id, data),

  listLabRecords: (memberId: string, max = 100) =>
    listDocs<LabRecord>(memberId, 'labRecords', 'date', max),

  deleteLabRecord: (memberId: string, id: string) => deleteDocById(memberId, 'labRecords', id),

  /** Ambil hasil lab TERBARU untuk ringkasan dashboard */
  async getLatestLabRecord(memberId: string): Promise<WithId<LabRecord> | null> {
    const records = await listDocs<LabRecord>(memberId, 'labRecords', 'date', 1);
    return records[0] ?? null;
  },
};

/* ------------------------------------------------------------------ */
/* MODUL 3: DAILY LIFESTYLE & MAINTENANCE MEDS                          */
/* ------------------------------------------------------------------ */

export const LifestyleService = {
  addDailyLog: (memberId: string, data: Omit<DailyLog, 'id'>) =>
    createDoc(subcollection(memberId, 'dailyLogs'), data),

  updateDailyLog: (memberId: string, id: string, data: Partial<DailyLog>) =>
    updateDocById(memberId, 'dailyLogs', id, data),

  listDailyLogs: (memberId: string, max = 90) =>
    listDocs<DailyLog>(memberId, 'dailyLogs', 'date', max),

  addMaintenanceMedication: (memberId: string, data: Omit<MaintenanceMedication, 'id'>) =>
    createDoc(subcollection(memberId, 'maintenanceMedications'), data),

  updateMaintenanceMedication: (
    memberId: string,
    id: string,
    data: Partial<MaintenanceMedication>
  ) => updateDocById(memberId, 'maintenanceMedications', id, data),

  listMaintenanceMedications: (memberId: string) =>
    listDocs<MaintenanceMedication>(memberId, 'maintenanceMedications', 'startDate'),

  /** Kurangi stok obat rutin setelah dikonsumsi (dipanggil dari tombol "Sudah minum") */
  async decrementStock(memberId: string, medId: string, currentStock: number) {
    await updateDocById(memberId, 'maintenanceMedications', medId, {
      stockCount: Math.max(currentStock - 1, 0),
    });
  },
};

/* ------------------------------------------------------------------ */
/* AGREGAT UNTUK DASHBOARD                                              */
/* ------------------------------------------------------------------ */

export interface MemberHealthSummary {
  member: WithId<FamilyMember>;
  activeSickness: WithId<SicknessEpisode> | null;
  latestLab: WithId<LabRecord> | null;
  lowStockMeds: WithId<MaintenanceMedication>[];
  latestWeight: number | null;
}

/**
 * Mengumpulkan ringkasan status kesehatan terkini seorang anggota keluarga.
 * Dipakai oleh Dashboard utama untuk menampilkan kartu status per profil.
 */
export async function getMemberHealthSummary(
  member: WithId<FamilyMember>
): Promise<MemberHealthSummary> {
  const [episodes, latestLab, meds, dailyLogs] = await Promise.all([
    SicknessService.listEpisodes(member.id),
    LabService.getLatestLabRecord(member.id),
    LifestyleService.listMaintenanceMedications(member.id),
    LifestyleService.listDailyLogs(member.id, 1),
  ]);

  const activeSickness = episodes.find((e) => e.status === 'aktif') ?? null;
  const lowStockMeds = meds.filter(
    (m) => m.active && m.stockCount !== undefined && m.stockCount <= (m.lowStockThreshold ?? 3)
  );

  return {
    member,
    activeSickness,
    latestLab,
    lowStockMeds,
    latestWeight: dailyLogs[0]?.weightKg ?? null,
  };
}

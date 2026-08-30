// types/health.ts
// Definisi tipe data inti untuk aplikasi Health Tracker Keluarga

export type MemberRole = 'anak' | 'dewasa' | 'lansia';

/**
 * "Household" adalah unit berbagi akses: satu akun pembuat (ownerUid) bisa
 * mengundang anggota lain (mis. suami/istri) lewat email supaya sama-sama
 * bisa melihat & mengedit profil keluarga yang sama. ID dokumen ini SAMA
 * PERSIS dengan ownerUid pembuat pertama — jadi data FamilyMember yang
 * SUDAH ADA (memakai field `ownerUid` lama) tetap kompatibel tanpa migrasi,
 * karena `ownerUid` itu sekaligus jadi kunci ke household ini.
 */
export interface Household {
  ownerUid: string;
  memberEmails: string[]; // email yang diundang (termasuk email pembuat sendiri)
  memberUids: string[];   // uid yang sudah benar-benar "klaim" akses (termasuk pembuat)
  createdAt: number;
}

/** Pointer kecil: uid mana sedang aktif di household siapa. */
export interface UserPointer {
  householdOwnerUid: string;
  email: string;
  updatedAt: number;
}

export interface FamilyMember {
  ownerUid: string;          // = ID household (lihat Household di atas)
  name: string;
  role: MemberRole;
  birthDate: string;         // ISO string, dipakai utk hitung usia & rentang normal anak
  gender: 'L' | 'P';
  avatarColor: string;       // warna badge profil di UI (mis. '#0F766E')
  bloodType?: string;
  allergies?: string[];
  chronicConditions?: string[]; // mis. ['Diabetes Tipe 2', 'Hipertensi']
  createdAt: number;
}

export type DayOfWeek = 'senin' | 'selasa' | 'rabu' | 'kamis' | 'jumat' | 'sabtu' | 'minggu';
export const DAY_ORDER: DayOfWeek[] = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
export const DAY_LABELS: Record<DayOfWeek, string> = {
  senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis',
  jumat: 'Jumat', sabtu: 'Sabtu', minggu: 'Minggu',
};

export interface ScheduleSlot {
  start: string; // format "HH:MM", mis. "09:00"
  end: string;   // format "HH:MM", mis. "12:00"
}

/** Jadwal praktik terstruktur per hari — tiap hari bisa punya lebih dari 1 sesi. */
export type WeeklySchedule = Partial<Record<DayOfWeek, ScheduleSlot[]>>;

/** Profil dokter, dibagikan di seluruh household (bukan per anggota keluarga). */
export interface Doctor {
  ownerUid: string; // = ID household, sama seperti FamilyMember.ownerUid
  name: string;
  specialization?: string;   // mis. "Sp.A (Dokter Anak)"
  practiceLocation?: string; // mis. "RS Grha Kedoya"
  weeklySchedule?: WeeklySchedule; // jadwal terstruktur per hari (fitur baru)
  practiceSchedule?: string; // LEGACY: teks bebas dari sebelum weeklySchedule ada.
                              // Dipertahankan sebagai fallback tampilan untuk data lama
                              // yang belum diisi ulang lewat weeklySchedule.
  phone?: string;
  createdAt: number;
}

/* ---------------------- MODUL 1: SICKNESS TRACKER ---------------------- */

export interface SicknessEpisode {
  memberId: string;
  title: string;             // mis. "Demam Gendis - Juli 2026"
  startDate: string;
  endDate?: string;          // kosong jika masih berlangsung
  status: 'aktif' | 'sembuh';
  mainComplaints: string[];  // ['demam', 'batuk', 'pilek', 'mual', 'muntah', 'diare']
  notes?: string;
}

export interface SymptomLog {
  episodeId: string;
  memberId: string;
  timestamp: number;
  temperatureC?: number;
  complaints: string[];
  notes?: string;
}

export interface DoctorVisit {
  episodeId: string;
  memberId: string;
  date: string;
  doctorId?: string;         // referensi ke Doctor.id kalau dipilih dari daftar
  doctorName: string;        // mis. "dr. Cynthia Utami, Sp.A"
  facility: string;           // mis. "RS Grha Kedoya"
  diagnosis: string;
  labTests?: LabTestResult[]; // tes penunjang: feses, swab antigen/PCR, dll
  followUpDate?: string;
  notes?: string;
}

export interface LabTestResult {
  id: string;
  testName: string;           // mis. "Swab Antigen", "Tes Feses", "PCR"
  result: string;             // mis. "Positif Influenza A", "Negatif"
  attachmentUrl?: string;     // link hasil scan (Firebase Storage), opsional
}

export interface TreatingDoctor {
  doctorId?: string;  // referensi ke Doctor.id kalau dipilih dari daftar
  name: string;
}

export interface Hospitalization {
  episodeId: string;
  memberId: string;
  hospitalName: string;         // mis. "RS Grha Kedoya"
  roomClass: string;             // mis. "VIP", "Kelas 1", "ICU"
  roomCostPerDay: number;        // biaya kamar per hari (Rupiah)
  admissionDate: string;         // tanggal masuk, YYYY-MM-DD
  dischargeDate?: string;        // tanggal keluar (kosongkan kalau masih dirawat)
  lengthOfStayDays: number;      // lama dirawat (hari)
  treatingDoctors: TreatingDoctor[]; // dokter yang menangani, bisa lebih dari satu
  notes?: string;
}

export type MedicationForm =
  | 'sirup'
  | 'tablet'
  | 'puyer'
  | 'tetes'
  | 'semprot'
  | 'nebulizer'
  | 'suntik'
  | 'lainnya';

export interface AcuteMedication {
  episodeId: string;
  memberId: string;
  name: string;                // mis. "Tamiflu", "Nasonex", "Sanmol"
  form: MedicationForm;
  isAntibiotic?: boolean;
  isAntiviral?: boolean;
  dose: string;                 // mis. "5 ml", "1/2 tablet", "1 puff"
  frequencyPerDay: number;
  durationDays?: number;
  specialNotes?: string;        // mis. "dihabiskan", "sesudah makan"
  startDate: string;
  endDate?: string;
  administeredTime?: string;    // jam pemberian, format "HH:MM" (default jam saat input)
  temperatureC?: number;        // suhu badan (°C) saat obat diberikan / saat cek suhu
  isTemperatureCheckOnly?: boolean; // true kalau entri ini cuma catatan cek suhu (tanpa obat)
}

/* ------------------------- MODUL 2: LAB & MCU TRACKER ------------------------- */

export type LabParameterKey =
  | 'glukosaPuasa'
  | 'glukosa2JamPP'
  | 'glukosaSewaktu'
  | 'hba1c'
  | 'trigliserida'
  | 'kolesterolTotal'
  | 'hdl'
  | 'ldl'
  | 'asamUrat'
  | 'ureum'
  | 'kreatinin'
  | 'egfr'
  | 'sgot'
  | 'sgpt'
  | 'vitaminD';

export interface LabRecord {
  memberId: string;
  date: string;
  source: 'MCU' | 'Tes Mandiri' | 'Lab Klinik';
  facility?: string;
  values: Partial<Record<LabParameterKey, number>>;
  notes?: string;
}

export interface ReferenceRange {
  key: LabParameterKey;
  label: string;
  unit: string;
  min?: number;
  max?: number;
  // Untuk parameter yang "semakin tinggi semakin baik" (mis. HDL, eGFR)
  higherIsBetter?: boolean;
}

/* ------------------------- MODUL 3: DAILY LIFESTYLE ------------------------- */

export interface DailyLog {
  memberId: string;
  date: string;
  weightKg?: number;
  meals?: {
    time: 'sarapan' | 'siang' | 'malam' | 'camilan';
    menu: string;
    notes?: string;
  }[];
  exercise?: {
    type: string;      // mis. "Jalan kaki", "Bersepeda"
    durationMinutes: number;
    intensity?: 'ringan' | 'sedang' | 'berat';
  }[];
  notes?: string;
}

export interface MaintenanceMedication {
  memberId: string;
  name: string;             // mis. "Metformin (Glucophage)", "Candesartan"
  dose: string;              // mis. "500 mg"
  frequencyPerDay: number;
  timeOfDay: string[];       // mis. ['pagi', 'malam']
  stockCount?: number;
  stockUnit?: string;        // 'tablet' | 'ml' | dll
  lowStockThreshold?: number;
  active: boolean;
  startDate: string;
  notes?: string;
}

// types/health.ts
// Definisi tipe data inti untuk aplikasi Health Tracker Keluarga

export type MemberRole = 'anak' | 'dewasa' | 'lansia';

export interface FamilyMember {
  id: string;
  ownerUid: string;          // uid akun Firebase Auth pemilik akun keluarga
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

/* ---------------------- MODUL 1: SICKNESS TRACKER ---------------------- */

export interface SicknessEpisode {
  id: string;
  memberId: string;
  title: string;             // mis. "Demam Gendis - Juli 2026"
  startDate: string;
  endDate?: string;          // kosong jika masih berlangsung
  status: 'aktif' | 'sembuh';
  mainComplaints: string[];  // ['demam', 'batuk', 'pilek', 'mual', 'muntah', 'diare']
  notes?: string;
}

export interface SymptomLog {
  id: string;
  episodeId: string;
  memberId: string;
  timestamp: number;
  temperatureC?: number;
  complaints: string[];
  notes?: string;
}

export interface DoctorVisit {
  id: string;
  episodeId: string;
  memberId: string;
  date: string;
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
  id: string;
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
  id: string;
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
  id: string;
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
  id: string;
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

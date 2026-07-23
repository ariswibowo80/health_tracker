// constants/referenceRanges.ts
// Acuan nilai normal (reference ranges) untuk parameter lab dewasa.
// PENTING: Nilai ini adalah acuan umum laboratorium klinik dan BUKAN pengganti
// interpretasi dokter. Selalu tampilkan disclaimer ini di UI.

import { LabParameterKey, ReferenceRange } from '../types/health';

export const REFERENCE_RANGES: Record<LabParameterKey, ReferenceRange> = {
  glukosaPuasa: { key: 'glukosaPuasa', label: 'Glukosa Puasa', unit: 'mg/dL', min: 70, max: 100 },
  glukosa2JamPP: { key: 'glukosa2JamPP', label: 'Glukosa 2 Jam PP', unit: 'mg/dL', min: 70, max: 140 },
  glukosaSewaktu: { key: 'glukosaSewaktu', label: 'Glukosa Sewaktu', unit: 'mg/dL', min: 70, max: 200 },
  hba1c: { key: 'hba1c', label: 'HbA1c', unit: '%', min: 4, max: 5.6 },
  trigliserida: { key: 'trigliserida', label: 'Trigliserida', unit: 'mg/dL', max: 150 },
  kolesterolTotal: { key: 'kolesterolTotal', label: 'Kolesterol Total', unit: 'mg/dL', max: 200 },
  hdl: { key: 'hdl', label: 'HDL', unit: 'mg/dL', min: 40, higherIsBetter: true },
  ldl: { key: 'ldl', label: 'LDL', unit: 'mg/dL', max: 100 },
  asamUrat: { key: 'asamUrat', label: 'Asam Urat', unit: 'mg/dL', min: 3.4, max: 7.0 },
  ureum: { key: 'ureum', label: 'Ureum', unit: 'mg/dL', min: 10, max: 50 },
  kreatinin: { key: 'kreatinin', label: 'Kreatinin', unit: 'mg/dL', min: 0.6, max: 1.3 },
  egfr: { key: 'egfr', label: 'eGFR', unit: 'mL/min/1.73m²', min: 90, higherIsBetter: true },
  sgot: { key: 'sgot', label: 'SGOT (AST)', unit: 'U/L', max: 40 },
  sgpt: { key: 'sgpt', label: 'SGPT (ALT)', unit: 'U/L', max: 41 },
  vitaminD: { key: 'vitaminD', label: 'Vitamin D (25-OH)', unit: 'ng/mL', min: 30, max: 100 },
};

export type StatusColor = 'normal' | 'waspada' | 'tinggi-risiko';

/**
 * Menentukan status warna (hijau/kuning/merah) dari sebuah nilai lab
 * dibandingkan reference range-nya.
 */
export function getLabStatus(key: LabParameterKey, value: number): StatusColor {
  const ref = REFERENCE_RANGES[key];
  if (!ref) return 'normal';

  const { min, max } = ref;

  if (min !== undefined && value < min) {
    // Di bawah batas bawah: untuk kebanyakan parameter ini "waspada" (kuning)
    return 'waspada';
  }
  if (max !== undefined && value > max) {
    // Di atas batas atas → seberapa jauh menentukan kuning vs merah
    const overshoot = (value - max) / max;
    return overshoot > 0.25 ? 'tinggi-risiko' : 'waspada';
  }
  return 'normal';
}

export const STATUS_COLOR_MAP: Record<StatusColor, { bg: string; text: string; dot: string }> = {
  normal: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  waspada: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'tinggi-risiko': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

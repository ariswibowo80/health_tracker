// utils/temperature.ts
// Klasifikasi suhu badan (°C) untuk indikator warna. Ambang umum untuk anak & dewasa;
// ini panduan visual, bukan diagnosis medis.

export type TemperatureLevel = 'rendah' | 'normal' | 'hangat' | 'demam' | 'tinggi';

export interface TemperatureStatus {
  level: TemperatureLevel;
  label: string;
  color: string; // warna solid (titik/garis grafik)
  bg: string;    // class Tailwind latar badge
  text: string;  // class Tailwind teks badge
}

const STATUS: Record<TemperatureLevel, Omit<TemperatureStatus, 'level'>> = {
  rendah: { label: 'Rendah', color: '#2563EB', bg: 'bg-blue-100', text: 'text-blue-700' },
  normal: { label: 'Normal', color: '#059669', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  hangat: { label: 'Hangat', color: '#CA8A04', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  demam: { label: 'Demam', color: '#EA580C', bg: 'bg-orange-100', text: 'text-orange-700' },
  tinggi: { label: 'Demam tinggi', color: '#DC2626', bg: 'bg-red-100', text: 'text-red-700' },
};

export function getTemperatureStatus(celsius: number): TemperatureStatus {
  let level: TemperatureLevel;
  if (celsius < 36) level = 'rendah';
  else if (celsius < 37.5) level = 'normal';
  else if (celsius < 38) level = 'hangat';
  else if (celsius < 39) level = 'demam';
  else level = 'tinggi';
  return { level, ...STATUS[level] };
}

/** Batas zona untuk latar grafik: [dari, sampai, level] */
export const TEMPERATURE_ZONES: { from: number; to: number; level: TemperatureLevel }[] = [
  { from: 0, to: 36, level: 'rendah' },
  { from: 36, to: 37.5, level: 'normal' },
  { from: 37.5, to: 38, level: 'hangat' },
  { from: 38, to: 39, level: 'demam' },
  { from: 39, to: 100, level: 'tinggi' },
];

export function getStatusByLevel(level: TemperatureLevel): TemperatureStatus {
  return { level, ...STATUS[level] };
}

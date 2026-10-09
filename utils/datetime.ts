// utils/datetime.ts
// Helper tanggal/jam lokal (bukan UTC) yang dipakai bersama oleh Catatan Sakit
// dan Dashboard, supaya tanggal & urutan item konsisten di semua layar.

export function isValidDateObj(d: Date): boolean {
  return !isNaN(d.getTime());
}

/** Format Date jadi "YYYY-MM-DD" berdasarkan zona waktu lokal (bukan UTC),
 * supaya konsisten dengan combineDateTime yang membaca jam lokal. */
export function localDateISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayISO() {
  return localDateISO(new Date());
}

export function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Format epoch ms jadi "YYYY-MM-DD", untuk mengisi form edit.
 * Kalau timestamp korup/tidak valid (mis. data lama sebelum fitur jam/suhu
 * ada), fallback ke hari ini alih-alih crash seluruh halaman. */
export function dateFromTimestamp(ts: number) {
  const d = new Date(ts);
  return isValidDateObj(d) ? localDateISO(d) : todayISO();
}

/** Format epoch ms jadi "HH:MM", dengan fallback aman yang sama seperti di atas. */
export function timeFromTimestamp(ts: number) {
  const d = new Date(ts);
  if (!isValidDateObj(d)) return '00:00';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Gabungkan tanggal (YYYY-MM-DD) + jam (HH:MM) jadi epoch ms lokal.
 * Tanggal/jam yang formatnya tidak valid (data lama, atau input kosong)
 * di-fallback ke hari ini / 00:00, supaya timeline tidak pernah crash. */
export function combineDateTime(date: string, time: string): number {
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
  const validTime = /^\d{2}:\d{2}$/.test(time) ? time : '00:00';
  const d = new Date(`${validDate}T${validTime}:00`);
  return isValidDateObj(d) ? d.getTime() : Date.now();
}

/** Label singkat untuk dashboard, mis. "9 Okt 08:20". */
export function formatShortDateTime(ts: number): string {
  const d = new Date(ts);
  if (!isValidDateObj(d)) return '';
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return `${date} ${timeFromTimestamp(ts)}`;
}

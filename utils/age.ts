// utils/age.ts

/**
 * Menghitung usia dari tanggal lahir (format YYYY-MM-DD) menjadi label yang
 * mudah dibaca, mis. "5 tahun 6 bulan", "8 bulan", atau "12 hari" untuk bayi
 * baru lahir. Cocok dipakai di mana pun profil anggota keluarga ditampilkan.
 */
export function formatAge(birthDateISO: string): string {
  if (!birthDateISO || !/^\d{4}-\d{2}-\d{2}$/.test(birthDateISO)) return '-';

  const birth = new Date(birthDateISO);
  const now = new Date();
  if (birth.getTime() > now.getTime()) return '-'; // tanggal lahir di masa depan, data tidak valid

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years === 0 && months === 0) {
    const days = Math.max(0, Math.floor((now.getTime() - birth.getTime()) / 86400000));
    return `${days} hari`;
  }
  if (years === 0) return `${months} bulan`;
  if (months === 0) return `${years} tahun`;
  return `${years} tahun ${months} bulan`;
}

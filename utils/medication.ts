// utils/medication.ts
// Deteksi otomatis jenis obat dari namanya. Hanya sebagai tebakan awal:
// pengguna bisa menimpa lewat tombol tag "Antibiotik" di form obat.

const ANTIBIOTIC_PATTERN = new RegExp(
  [
    'antibiotik', 'antibiotic',
    'amoxi?cill?in', 'amoxsan', 'ampicill?in', 'penicill?in',
    'cefixime', 'cefadroxil', 'cefuroxime', 'cefotaxime', 'ceftriaxone', 'cefpodoxime', 'cefaclor', 'cephalexin',
    'azithromycin', 'azithromisin', 'clarithromycin', 'erythromycin', 'eritromisin',
    'ciprofloxacin', 'levofloxacin', 'moxifloxacin',
    'clindamycin', 'metronidazole', 'cotrimoxazole', 'kotrimoksazol', 'doxycycline', 'gentamicin',
  ].join('|'),
  'i'
);

const ANTIVIRAL_PATTERN = /tamiflu|temulvir|oseltamivir|acyclovir|asiklovir/i;

export function looksLikeAntibiotic(name: string): boolean {
  return ANTIBIOTIC_PATTERN.test(name);
}

export function looksLikeAntiviral(name: string): boolean {
  return ANTIVIRAL_PATTERN.test(name);
}

// utils/excelExport.ts
//
// CATATAN PENTING SOAL LIBRARY:
// Paket 'xlsx' (SheetJS) versi komunitas TIDAK mendukung styling sel
// (warna header, border) secara native — hanya 'xlsx-js-style' (fork
// drop-in compatible) yang mendukungnya dengan API identik ('write',
// 'utils.book_new', dst). Modul ini memakai 'xlsx-js-style' agar
// requirement "header berwarna & border rapi" benar-benar terwujud.
//
//   npm install xlsx-js-style expo-file-system expo-sharing
//
import * as XLSX from 'xlsx-js-style';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import {
  FamilyMember,
  LabRecord,
  SicknessEpisode,
  DoctorVisit,
  AcuteMedication,
  Hospitalization,
  DailyLog,
} from '../types/health';
import { REFERENCE_RANGES, getLabStatus } from '../constants/referenceRanges';

type WithId<T> = T & { id: string };

export interface ExportBundle {
  member: WithId<FamilyMember>;
  labRecords: WithId<LabRecord>[];
  episodes: WithId<SicknessEpisode>[];
  doctorVisits: WithId<DoctorVisit>[];
  acuteMedications: WithId<AcuteMedication>[];
  hospitalizations: WithId<Hospitalization>[];
  dailyLogs: WithId<DailyLog>[];
}

/* ------------------------------------------------------------------ */
/* STYLE TOKENS                                                        */
/* ------------------------------------------------------------------ */

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: '0F766E' } }, // teal - warna identitas app
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: thinBorder(),
};

const SUBHEADER_STYLE = {
  font: { bold: true, color: { rgb: '0F172A' }, sz: 10 },
  fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: thinBorder(),
};

const CELL_STYLE = {
  font: { sz: 10 },
  border: thinBorder(),
  alignment: { vertical: 'center' },
};

const STATUS_FILL: Record<string, string> = {
  normal: 'D1FAE5',
  waspada: 'FEF3C7',
  'tinggi-risiko': 'FEE2E2',
};

function thinBorder() {
  const side = { style: 'thin', color: { rgb: 'CBD5E1' } };
  return { top: side, bottom: side, left: side, right: side };
}

function cellStyled(value: any, style: object = CELL_STYLE) {
  return { v: value ?? '-', s: style };
}

/** Menghitung lebar kolom otomatis (auto-fit) berdasarkan konten terpanjang */
function autoFitColumns(rows: any[][]): { wch: number }[] {
  const colCount = Math.max(...rows.map((r) => r.length));
  const widths: number[] = new Array(colCount).fill(8);
  rows.forEach((row) => {
    row.forEach((cell, i) => {
      const text = String(cell?.v ?? cell ?? '');
      widths[i] = Math.max(widths[i], Math.min(text.length + 3, 40));
    });
  });
  return widths.map((w) => ({ wch: w }));
}

function buildSheet(rows: any[][]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = autoFitColumns(rows);
  ws['!freeze'] = { xSplit: 0, ySplit: 2 }; // freeze judul + header
  return ws;
}

/* ------------------------------------------------------------------ */
/* SHEET 1: HEALTH METRICS & MCU                                       */
/* ------------------------------------------------------------------ */

function buildMetricsSheet(bundle: ExportBundle) {
  const labelRow = [cellStyled(`Riwayat Lab & MCU — ${bundle.member.name}`, {
    font: { bold: true, sz: 13 },
  })];

  const paramKeys = Object.keys(REFERENCE_RANGES) as (keyof typeof REFERENCE_RANGES)[];

  const header = [
    cellStyled('Tanggal', HEADER_STYLE),
    cellStyled('Sumber', HEADER_STYLE),
    cellStyled('Fasilitas', HEADER_STYLE),
    ...paramKeys.map((k) =>
      cellStyled(`${REFERENCE_RANGES[k].label} (${REFERENCE_RANGES[k].unit})`, HEADER_STYLE)
    ),
    cellStyled('Catatan', HEADER_STYLE),
  ];

  const dataRows = bundle.labRecords.map((rec) => [
    cellStyled(rec.date),
    cellStyled(rec.source),
    cellStyled(rec.facility ?? '-'),
    ...paramKeys.map((k) => {
      const val = rec.values[k];
      if (val === undefined) return cellStyled('-');
      const status = getLabStatus(k, val);
      return cellStyled(val, {
        ...CELL_STYLE,
        fill: { patternType: 'solid', fgColor: { rgb: STATUS_FILL[status] } },
      });
    }),
    cellStyled(rec.notes ?? ''),
  ]);

  const legend = [
    cellStyled('Keterangan warna:'),
    cellStyled('Hijau = Normal', { ...CELL_STYLE, fill: { patternType: 'solid', fgColor: { rgb: STATUS_FILL.normal } } }),
    cellStyled('Kuning = Waspada', { ...CELL_STYLE, fill: { patternType: 'solid', fgColor: { rgb: STATUS_FILL.waspada } } }),
    cellStyled('Merah = Risiko Tinggi', { ...CELL_STYLE, fill: { patternType: 'solid', fgColor: { rgb: STATUS_FILL['tinggi-risiko'] } } }),
  ];

  return buildSheet([labelRow, header, ...dataRows, [], legend]);
}

/* ------------------------------------------------------------------ */
/* SHEET 2: SICKNESS & MEDICATION LOG                                  */
/* ------------------------------------------------------------------ */

function buildSicknessSheet(bundle: ExportBundle) {
  const titleRow = [
    cellStyled(`Riwayat Sakit & Pengobatan — ${bundle.member.name}`, { font: { bold: true, sz: 13 } }),
  ];

  const episodeHeader = [
    cellStyled('Episode', HEADER_STYLE),
    cellStyled('Mulai', HEADER_STYLE),
    cellStyled('Selesai', HEADER_STYLE),
    cellStyled('Status', HEADER_STYLE),
    cellStyled('Keluhan Utama', HEADER_STYLE),
    cellStyled('Dokter', HEADER_STYLE),
    cellStyled('Fasilitas', HEADER_STYLE),
    cellStyled('Diagnosis', HEADER_STYLE),
    cellStyled('Hasil Lab Penunjang', HEADER_STYLE),
    cellStyled('Obat Diberikan', HEADER_STYLE),
    cellStyled('Catatan Obat', HEADER_STYLE),
    cellStyled('Rawat Inap - RS', HEADER_STYLE),
    cellStyled('Rawat Inap - Kelas Kamar', HEADER_STYLE),
    cellStyled('Rawat Inap - Tgl Masuk', HEADER_STYLE),
    cellStyled('Rawat Inap - Lama (hari)', HEADER_STYLE),
    cellStyled('Rawat Inap - Biaya Kamar/Hari', HEADER_STYLE),
    cellStyled('Rawat Inap - Total Biaya Kamar', HEADER_STYLE),
    cellStyled('Rawat Inap - Dokter Penanggung Jawab', HEADER_STYLE),
  ];

  const rows = bundle.episodes.map((ep) => {
    const visit = bundle.doctorVisits.find((v) => v.episodeId === ep.id);
    const meds = bundle.acuteMedications.filter((m) => m.episodeId === ep.id);
    const medsSummary = meds
      .map((m) => `${m.name} (${m.dose}, ${m.frequencyPerDay}x/hari${m.specialNotes ? ', ' + m.specialNotes : ''})`)
      .join('; ');
    const labSummary = (visit?.labTests ?? []).map((t) => `${t.testName}: ${t.result}`).join('; ');
    const hospitalization = bundle.hospitalizations.find((h) => h.episodeId === ep.id);
    const totalRoomCost = hospitalization
      ? hospitalization.roomCostPerDay * hospitalization.lengthOfStayDays
      : 0;

    return [
      cellStyled(ep.title),
      cellStyled(ep.startDate),
      cellStyled(ep.endDate ?? '-'),
      cellStyled(ep.status === 'aktif' ? 'Aktif' : 'Sembuh', {
        ...CELL_STYLE,
        fill: { patternType: 'solid', fgColor: { rgb: ep.status === 'aktif' ? 'FEE2E2' : 'D1FAE5' } },
      }),
      cellStyled(ep.mainComplaints.join(', ')),
      cellStyled(visit?.doctorName ?? '-'),
      cellStyled(visit?.facility ?? '-'),
      cellStyled(visit?.diagnosis ?? '-'),
      cellStyled(labSummary || '-'),
      cellStyled(medsSummary || '-'),
      cellStyled(meds.map((m) => m.specialNotes).filter(Boolean).join('; ') || '-'),
      cellStyled(hospitalization?.hospitalName ?? '-'),
      cellStyled(hospitalization?.roomClass ?? '-'),
      cellStyled(hospitalization?.admissionDate ?? '-'),
      cellStyled(hospitalization?.lengthOfStayDays ?? '-'),
      cellStyled(hospitalization ? `Rp${hospitalization.roomCostPerDay.toLocaleString('id-ID')}` : '-'),
      cellStyled(hospitalization ? `Rp${totalRoomCost.toLocaleString('id-ID')}` : '-'),
      cellStyled(hospitalization?.treatingDoctors.map((d) => d.name).join(', ') || '-'),
    ];
  });

  return buildSheet([titleRow, episodeHeader, ...rows]);
}

/* ------------------------------------------------------------------ */
/* SHEET 3: DAILY LIFESTYLE                                            */
/* ------------------------------------------------------------------ */

function buildLifestyleSheet(bundle: ExportBundle) {
  const titleRow = [
    cellStyled(`Catatan Harian (Makan, Olahraga, Berat Badan) — ${bundle.member.name}`, {
      font: { bold: true, sz: 13 },
    }),
  ];

  const header = [
    cellStyled('Tanggal', HEADER_STYLE),
    cellStyled('Berat Badan (kg)', HEADER_STYLE),
    cellStyled('Menu Makan', HEADER_STYLE),
    cellStyled('Olahraga', HEADER_STYLE),
    cellStyled('Catatan', HEADER_STYLE),
  ];

  const rows = bundle.dailyLogs.map((log) => [
    cellStyled(log.date),
    cellStyled(log.weightKg ?? '-'),
    cellStyled((log.meals ?? []).map((m) => `${m.time}: ${m.menu}`).join(' | ') || '-'),
    cellStyled(
      (log.exercise ?? [])
        .map((e) => `${e.type} ${e.durationMinutes}mnt${e.intensity ? ` (${e.intensity})` : ''}`)
        .join(' | ') || '-'
    ),
    cellStyled(log.notes ?? ''),
  ]);

  return buildSheet([titleRow, header, ...rows]);
}

/* ------------------------------------------------------------------ */
/* ENTRY POINT: EXPORT KE FILE .xlsx                                    */
/* ------------------------------------------------------------------ */

/**
 * Membuat workbook Excel 3-sheet dan menyimpan/membagikannya sesuai platform:
 * - Android/iOS: tulis ke cache dir lalu buka share sheet native.
 * - Web: trigger unduhan file langsung via Blob.
 */
export async function exportHealthReportToExcel(bundle: ExportBundle) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildMetricsSheet(bundle), 'Health Metrics & MCU');
  XLSX.utils.book_append_sheet(wb, buildSicknessSheet(bundle), 'Sickness & Medication Log');
  XLSX.utils.book_append_sheet(wb, buildLifestyleSheet(bundle), 'Daily Lifestyle');

  const fileName = `HealthReport_${bundle.member.name.replace(/\s+/g, '_')}_${todayStamp()}.xlsx`;

  if (Platform.OS === 'web') {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { platform: 'web', fileName };
  }

  // Android / iOS
  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Bagikan Laporan Kesehatan',
      UTI: 'com.microsoft.excel.xlsx',
    });
  }

  return { platform: Platform.OS, fileUri };
}

/**
 * Menggabungkan laporan MULTI-anggota keluarga menjadi satu file, dengan
 * sheet berpasangan per anggota (mis. "Metrics - Gendis", "Metrics - Ayah").
 * Berguna untuk laporan dibawa saat kontrol dokter keluarga.
 */
export async function exportFamilyReportToExcel(bundles: ExportBundle[]) {
  const wb = XLSX.utils.book_new();

  bundles.forEach((bundle) => {
    const shortName = bundle.member.name.slice(0, 12);
    XLSX.utils.book_append_sheet(wb, buildMetricsSheet(bundle), `MCU - ${shortName}`.slice(0, 31));
    XLSX.utils.book_append_sheet(
      wb,
      buildSicknessSheet(bundle),
      `Sakit - ${shortName}`.slice(0, 31)
    );
    XLSX.utils.book_append_sheet(
      wb,
      buildLifestyleSheet(bundle),
      `Harian - ${shortName}`.slice(0, 31)
    );
  });

  const fileName = `HealthReport_Keluarga_${todayStamp()}.xlsx`;

  if (Platform.OS === 'web') {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { platform: 'web', fileName };
  }

  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Bagikan Laporan Kesehatan Keluarga',
    });
  }

  return { platform: Platform.OS, fileUri };
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

# Health Tracker — Aplikasi Manajemen Kesehatan Keluarga

Cross-platform (Android + Web) dibangun dengan **Expo Router**, **Firebase**, dan **NativeWind**.

## 1. Struktur Proyek

```
health-tracker/
├── app/
│   └── (tabs)/
│       └── index.tsx          # Dashboard utama
├── components/
│   └── HealthStatusCard.tsx   # Kartu ringkasan per anggota keluarga
├── services/
│   ├── firebaseConfig.ts       # Init Firebase (Auth + Firestore), aware Android/Web
│   ├── authService.ts          # Login/register/logout
│   └── firestoreService.ts     # Seluruh CRUD data kesehatan
├── utils/
│   └── excelExport.ts          # Generator laporan .xlsx 3-sheet
├── constants/
│   └── referenceRanges.ts      # Nilai normal lab + fungsi status warna
├── types/
│   └── health.ts                # Semua tipe data domain kesehatan
├── tailwind.config.js
└── package.json
```

## 2. Model Data Firestore

```
familyMembers/{memberId}                     -> profil anak/dewasa/lansia
healthRecords/{memberId}/sicknessEpisodes/{id}
healthRecords/{memberId}/symptomLogs/{id}
healthRecords/{memberId}/doctorVisits/{id}
healthRecords/{memberId}/acuteMedications/{id}
healthRecords/{memberId}/labRecords/{id}
healthRecords/{memberId}/dailyLogs/{id}
healthRecords/{memberId}/maintenanceMedications/{id}
```

Setiap `familyMembers` dokumen memiliki `ownerUid` (uid akun Firebase Auth pemilik
akun keluarga). Struktur subcollection per `memberId` ini memungkinkan satu akun
keluarga memiliki banyak profil (anak, ayah, ibu, kakek/nenek) tanpa data tercampur,
sekaligus tetap mudah di-query dan diberi security rules per profil.

### Contoh Firestore Security Rules (ringkas)

```
match /familyMembers/{memberId} {
  allow read, write: if request.auth.uid == resource.data.ownerUid
                      || request.auth.uid == request.resource.data.ownerUid;
}
match /healthRecords/{memberId}/{document=**} {
  allow read, write: if request.auth.uid ==
    get(/databases/$(database)/documents/familyMembers/$(memberId)).data.ownerUid;
}
```

## 3. Alur Fitur Utama

- **Modul 1 — Clinical & Sickness Tracker**: `SicknessService` mencatat episode
  sakit (mis. "Demam Gendis"), log gejala harian bersuhu, kunjungan dokter beserta
  hasil lab penunjang, dan obat akut (sirup/tablet/antibiotik/antivirus/nebulizer).
- **Modul 2 — Lab & MCU Tracker**: `LabService` menyimpan time-series parameter
  lab lengkap; `getLabStatus()` di `referenceRanges.ts` memberi indikator
  hijau/kuning/merah otomatis berbasis acuan medis umum.
- **Modul 3 — Daily Lifestyle & Maintenance Meds**: `LifestyleService` mencatat
  menu makan, olahraga, berat badan harian, serta daftar obat rutin jangka
  panjang lengkap dengan pelacakan stok dan ambang batas "stok menipis".
- **Modul 4 — Ekspor Excel**: `exportHealthReportToExcel()` (1 anggota) dan
  `exportFamilyReportToExcel()` (semua anggota) menghasilkan file `.xlsx`
  dengan 3 sheet berwarna (header teal, border rapi, auto-fit kolom, sel lab
  berwarna sesuai status normal/waspada/risiko tinggi).

## 4. Struktur Routing (Expo Router)

```
app/
├── _layout.tsx                  # Root layout + auth guard (redirect ke /login)
├── login.tsx                    # Login & registrasi akun keluarga
├── (tabs)/
│   ├── _layout.tsx               # Tab bar: Dashboard · Profil Keluarga · Pengaturan
│   ├── index.tsx                  # Dashboard ringkasan seluruh anggota
│   ├── members.tsx                # Daftar semua profil keluarga
│   └── settings.tsx               # Info akun + logout
└── members/
    ├── new.tsx                   # Tambah profil anggota baru
    └── [id]/
        ├── index.tsx              # Hub detail profil + ekspor per anggota
        ├── sickness.tsx           # Modul 1: episode sakit, kunjungan dokter, obat akut
        ├── lab.tsx                # Modul 2: input hasil lab + grafik tren
        └── lifestyle.tsx          # Modul 3: log harian + obat rutin & stok
```

Alur auth: `app/_layout.tsx` memantau `onAuthStateChanged` — belum login akan
diarahkan ke `/login`, sudah login diarahkan ke Dashboard (`(tabs)/index`).

## 5. Setup Lokal

```bash
npm install
cp .env.example .env   # isi kredensial Firebase Anda
npm run typecheck       # pastikan tidak ada error TypeScript
npm run web             # jalankan versi Web
npm run android         # jalankan versi Android (butuh emulator/device + Expo Go atau dev build)
```

## 6. Deploy ke GitHub

```bash
git init
git add .
git commit -m "Initial commit: Health Tracker keluarga"
git branch -M main
git remote add origin https://github.com/<username>/health-tracker.git
git push -u origin main
```

`.gitignore` sudah menyertakan `node_modules/`, `.expo/`, `dist/`, dan `.env`
sehingga kredensial tidak ikut ter-commit.

**Menyiapkan GitHub Actions CI** (`.github/workflows/ci.yml` sudah disertakan):
tambahkan kredensial Firebase sebagai *Repository Secrets* di
`Settings → Secrets and variables → Actions` dengan nama yang sama seperti di
`.env.example` (mis. `EXPO_PUBLIC_FIREBASE_API_KEY`, dst). CI akan menjalankan
type-check dan build web (`expo export --platform web`) di setiap push/PR ke
`main`.

## 7. Deploy Versi Web (Firebase Hosting)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting        # pilih project, gunakan firebase.json yang sudah ada
npm run build:web            # menghasilkan folder dist/
firebase deploy --only hosting,firestore:rules
```

## 8. Build APK Android (EAS Build)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview   # menghasilkan link download .apk/.aab
```

Untuk rilis ke Google Play, gunakan profile `production` di `eas.json` (dibuat
otomatis oleh `eas build:configure`) dan submit lewat `eas submit --platform android`.

## 8b. Auto-Deploy Web ke Firebase Hosting (via GitHub Actions, tanpa CLI)

Workflow `.github/workflows/deploy-hosting.yml` sudah disertakan: setiap kali
ada push ke branch `main`, GitHub otomatis meng-build versi web dan
mempublikasikannya ke Firebase Hosting. Semua langkah di bawah ini bisa
dilakukan lewat browser saja (tidak perlu install apa pun di komputer).

**Langkah 1 — Aktifkan Hosting di Firebase Console**
1. Buka [console.firebase.google.com](https://console.firebase.google.com) → pilih project Anda.
2. Menu kiri → **Build → Hosting** → **Get started** → ikuti wizard (boleh lewati langkah CLI, cukup sampai hosting aktif).

**Langkah 2 — Buat Service Account key (untuk otorisasi GitHub Actions)**
1. Di Firebase Console → ikon gerigi → **Project settings**.
2. Tab **Service accounts** → klik **Generate new private key** → **Generate key**.
3. Sebuah file `.json` akan terunduh (JANGAN dibagikan/di-commit ke repo — ini kredensial rahasia).

**Langkah 3 — Simpan sebagai GitHub Secrets (via web)**
Di repo GitHub Anda: **Settings → Secrets and variables → Actions → New repository secret**, tambahkan satu per satu:

| Nama Secret | Isi |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Isi seluruh isi file `.json` dari Langkah 2 (buka file itu dengan Notepad/TextEdit, copy-paste semuanya) |
| `FIREBASE_PROJECT_ID` | Project ID Firebase Anda (terlihat di Project settings → General) |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Sama seperti isi `.env` |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Sama seperti isi `.env` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Sama seperti isi `.env` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Sama seperti isi `.env` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sama seperti isi `.env` |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Sama seperti isi `.env` |

**Langkah 4 — Jalankan**
Setelah semua secret tersimpan, buka tab **Actions** di repo GitHub Anda →
workflow "Deploy Web to Firebase Hosting" akan otomatis berjalan setiap push
ke `main` (atau klik **Run workflow** manual di tab Actions untuk memicu
langsung tanpa push baru). Setelah selesai (tanda centang hijau), aplikasi
web bisa diakses di `https://<project-id>.web.app`.

> Workflow ini juga otomatis men-deploy `firestore.rules` setiap kali hosting
> ter-deploy, jadi perubahan aturan keamanan ikut ter-update tanpa perlu CLI.

## 9. Setup Firebase Console (sekali di awal)

1. Buat project baru di [console.firebase.google.com](https://console.firebase.google.com).
2. Aktifkan **Authentication → Sign-in method → Email/Password**.
3. Aktifkan **Firestore Database** (mode production).
4. Deploy `firestore.rules` yang sudah disediakan (lihat bagian 6 di atas).
5. Salin konfigurasi SDK web ke file `.env` lokal & GitHub Secrets.

Variabel lingkungan yang dibutuhkan (`.env`, prefix wajib `EXPO_PUBLIC_` agar
terbaca oleh client Expo):

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

## 5. Catatan Teknis Penting

- Styling Excel (warna header, border) memerlukan **`xlsx-js-style`**, bukan
  `xlsx` versi komunitas biasa — API-nya identik (drop-in replacement), tetapi
  mendukung properti `s: { fill, font, border, alignment }` per sel.
- Di Web, unduhan file dilakukan lewat `Blob` + elemen `<a download>`; di
  Android/iOS memakai `expo-file-system` (tulis ke cache) + `expo-sharing`
  (native share sheet) — sudah ditangani otomatis lewat pengecekan
  `Platform.OS` di `excelExport.ts`.
- Reference range lab di `constants/referenceRanges.ts` adalah **acuan umum**,
  bukan pengganti interpretasi dokter — tampilkan disclaimer ini di layar
  detail lab.
- Layout dashboard beralih dari daftar 1-kolom (mobile) ke grid multi-kolom
  (`isWideScreen = width >= 768`) memakai `useWindowDimensions`, dipadukan
  dengan varian kelas NativeWind `md:` untuk konsistensi breakpoint.

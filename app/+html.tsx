// app/+html.tsx
// File khusus Expo Router: mengatur <head>/<html> untuk versi web (dirender
// sekali saat build statis, tidak berjalan di Android/iOS native).
// Ini WAJIB ada supaya manifest PWA ter-link — Expo Router TIDAK otomatis
// membuat konfigurasi PWA (beda dari @expo/webpack-config versi lama).
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="theme-color" content="#0F766E" />
        <meta
          name="description"
          content="Aplikasi manajemen kesehatan keluarga - catat riwayat sakit, hasil lab/MCU, dan obat rutin seluruh anggota keluarga."
        />

        {/* Manifest PWA - inti dari fitur "Install app" di menu Chrome Android */}
        <link rel="manifest" href="/manifest.json" />

        {/* Favicon & ikon berbagai ukuran/platform */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Reset default scroll bawaan browser supaya ScrollView RN Web
            berperilaku konsisten dengan versi native. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

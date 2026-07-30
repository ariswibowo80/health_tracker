// services/householdService.ts
//
// KONSEP: Household = unit berbagi akses. ID dokumennya SAMA dengan uid
// pembuat pertama (ownerUid) — jadi kompatibel dengan data FamilyMember
// yang sudah ada tanpa perlu migrasi apa pun.
//
// Alur berbagi akses (mis. suami mengundang istri):
// 1. Suami buka Pengaturan → masukkan email istri → email masuk ke
//    `memberEmails` household milik suami.
// 2. Istri login dengan akun Google/emailnya sendiri (uid BEDA dari suami).
//    Household default-nya sendiri otomatis dibuat (households/{uidIstri}).
// 3. Istri buka Pengaturan → "Klaim undangan" → app mencari household lain
//    yang memuat email istri di `memberEmails` (bukan household miliknya
//    sendiri) → kalau ketemu, uid istri ditambahkan ke `memberUids`
//    household suami, dan pointer `users/{uidIstri}` diarahkan ke situ.
// 4. Sejak itu, seluruh query data keluarga oleh istri memakai
//    `householdOwnerUid` (uid suami) sebagai kunci, bukan uid-nya sendiri.

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Household, UserPointer } from '../types/health';

type WithId<T> = T & { id: string };

/**
 * Memastikan household & pointer user tersedia untuk uid ini. Aman dipanggil
 * berkali-kali (idempotent) — dipanggil sekali setiap kali app dibuka.
 * Mengembalikan householdOwnerUid yang SEDANG AKTIF untuk uid ini (bisa jadi
 * uid orang lain, kalau user ini sudah bergabung ke household yang lain).
 */
export async function ensureHouseholdAndGetActiveOwner(
  uid: string,
  email: string | null
): Promise<string> {
  const pointerRef = doc(db, 'users', uid);
  const pointerSnap = await getDoc(pointerRef);

  if (pointerSnap.exists()) {
    return (pointerSnap.data() as UserPointer).householdOwnerUid;
  }

  // Belum ada pointer sama sekali -> buat household milik sendiri + pointer.
  const householdRef = doc(db, 'households', uid);
  const householdSnap = await getDoc(householdRef);
  if (!householdSnap.exists()) {
    const data: Household = {
      ownerUid: uid,
      memberEmails: email ? [email] : [],
      memberUids: [uid],
      createdAt: Date.now(),
    };
    await setDoc(householdRef, data);
  }

  const pointerData: UserPointer = {
    householdOwnerUid: uid,
    email: email ?? '',
    updatedAt: Date.now(),
  };
  await setDoc(pointerRef, pointerData);
  return uid;
}

export async function getHousehold(householdOwnerUid: string): Promise<WithId<Household> | null> {
  const snap = await getDoc(doc(db, 'households', householdOwnerUid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Household) };
}

/** Owner mengundang anggota keluarga lain lewat email. */
export async function inviteByEmail(householdOwnerUid: string, email: string) {
  await updateDoc(doc(db, 'households', householdOwnerUid), {
    memberEmails: arrayUnion(email.trim().toLowerCase()),
  });
}

/**
 * Dipanggil oleh user yang MENERIMA undangan. Mencari household lain (bukan
 * miliknya sendiri) yang memuat emailnya di `memberEmails`, lalu bergabung.
 * Mengembalikan householdOwnerUid baru kalau berhasil, atau null kalau tidak
 * ada undangan yang cocok ditemukan.
 */
export async function claimInvitation(uid: string, email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const q = query(collection(db, 'households'), where('memberEmails', 'array-contains', normalizedEmail));
  const snap = await getDocs(q);

  const match = snap.docs.find((d) => d.id !== uid && !(d.data() as Household).memberUids.includes(uid));
  if (!match) return null;

  const targetOwnerUid = match.id;
  await updateDoc(doc(db, 'households', targetOwnerUid), {
    memberUids: arrayUnion(uid),
  });
  await setDoc(doc(db, 'users', uid), {
    householdOwnerUid: targetOwnerUid,
    email: normalizedEmail,
    updatedAt: Date.now(),
  } as UserPointer);

  return targetOwnerUid;
}

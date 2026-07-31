// contexts/HouseholdContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { ensureHouseholdAndGetActiveOwner } from '../services/householdService';

interface HouseholdContextValue {
  /** uid household yang sedang aktif — dipakai sebagai `ownerUid` di semua
   * query FamilyMember/Doctor. Bisa jadi BUKAN uid sendiri, kalau user ini
   * sudah bergabung ke household orang lain (mis. istri gabung ke suami). */
  householdOwnerUid: string | null;
  loading: boolean;
  /** Dipanggil setelah klaim undangan berhasil, supaya seluruh app langsung
   * pindah menampilkan data household yang baru tanpa perlu reload. */
  refreshHouseholdOwner: (newOwnerUid: string) => void;
}

const HouseholdContext = createContext<HouseholdContextValue>({
  householdOwnerUid: null,
  loading: true,
  refreshHouseholdOwner: () => {},
});

export function HouseholdProvider({ user, children }: { user: User | null; children: ReactNode }) {
  const [householdOwnerUid, setHouseholdOwnerUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHouseholdOwnerUid(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    ensureHouseholdAndGetActiveOwner(user.uid, user.email)
      .then(setHouseholdOwnerUid)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <HouseholdContext.Provider
      value={{ householdOwnerUid, loading, refreshHouseholdOwner: setHouseholdOwnerUid }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  return useContext(HouseholdContext);
}

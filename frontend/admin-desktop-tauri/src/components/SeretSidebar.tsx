import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useTheme } from '@/theme';
import { useLebarSidebar, type LebarSidebar } from '@/components/useLebarSidebar';

/** Aksi seret — identitasnya stabil selama seretan berjalan, jadi elemen yang
 *  hanya menggenggam seret (kenop lipat di topBar) tak dirender ulang tiap
 *  mousemove. */
type AksiSeret = Pick<LebarSidebar, 'mulaiSeret' | 'onKeyDown' | 'resetLebar'>;

/** Status seret — berubah tiap mousemove; hanya untuk pemakai yang memang ikut
 *  bergerak: lebar panel dan matinya animasi di Sidebar. */
type StatusSeret = Pick<LebarSidebar, 'seret' | 'seretSembunyi' | 'lebarTampil'>;

const CtxAksi = createContext<AksiSeret | null>(null);
const CtxStatus = createContext<StatusSeret | null>(null);

/**
 * Satu instans seret-lebar navigasi untuk seluruh shell.
 *
 * Gagang di tepi sidebar dan kenop lipat di topBar adalah dua pintu ke operasi
 * yang sama. Kalau masing-masing memanggil `useLebarSidebar` sendiri, status
 * `seret` keduanya terpisah: saat kenop yang diseret, Sidebar tak tahu ada
 * seretan sehingga lebarnya tetap beranimasi `duration-200` dan tertinggal di
 * belakang pointer. Karena itu status seret diangkat ke provider ini, dipasang
 * di Layout — di atas Sidebar DAN TopBar.
 *
 * Nilainya sengaja dipecah dua konteks: TopBar itu berat (ribbon, filter,
 * dialog) dan cuma butuh aksinya, sedangkan status berubah puluhan kali per
 * detik selama seretan.
 */
export function SeretSidebarProvider({ children }: { children: ReactNode }) {
  const { sidebarLebar, setSidebarLebar, setCollapsed } = useTheme();
  const { seret, seretSembunyi, lebarTampil, mulaiSeret, onKeyDown, resetLebar } = useLebarSidebar({
    lebar: sidebarLebar,
    setLebar: setSidebarLebar,
    setCollapsed,
  });

  const aksi = useMemo(() => ({ mulaiSeret, onKeyDown, resetLebar }), [mulaiSeret, onKeyDown, resetLebar]);
  const status = useMemo(() => ({ seret, seretSembunyi, lebarTampil }), [seret, seretSembunyi, lebarTampil]);

  return (
    <CtxAksi.Provider value={aksi}>
      <CtxStatus.Provider value={status}>{children}</CtxStatus.Provider>
    </CtxAksi.Provider>
  );
}

/** Aksi seret (mousedown gagang/kenop, keyboard, reset lebar). */
export function useAksiSeretSidebar(): AksiSeret {
  const v = useContext(CtxAksi);
  if (!v) throw new Error('useAksiSeretSidebar harus dipakai di dalam SeretSidebarProvider');
  return v;
}

/** Status seret (sedang diseret? lebar yang harus dirender?). */
export function useStatusSeretSidebar(): StatusSeret {
  const v = useContext(CtxStatus);
  if (!v) throw new Error('useStatusSeretSidebar harus dipakai di dalam SeretSidebarProvider');
  return v;
}

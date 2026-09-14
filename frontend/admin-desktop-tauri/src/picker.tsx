import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PARTS, type PartId } from '@/parts';

/** Mode "pilih komponen": klik elemen mana pun di aplikasi → buka bagian itu.
 *  Global (mounted sekali di App) agar tetap aktif saat berpindah halaman. */
interface PickerState {
  aktif: boolean;
  /** Bagian yang baru dipilih (dikonsumsi oleh editor Tampilan). */
  hasil: PartId | null;
  mulai: () => void;
  batal: () => void;
  konsumsi: () => void;
}

const Ctx = createContext<PickerState | null>(null);

const HALAMAN_TAMPILAN = '/pengaturan/tampilan';

/** Bagian paling spesifik untuk sebuah elemen (menelusuri ke atas). */
function cariBagian(el: Element): PartId | null {
  for (let node: Element | null = el; node; node = node.parentElement) {
    let kandidat = PARTS.filter((p) => {
      try {
        return node!.matches(p.sel);
      } catch {
        return false;
      }
    });
    if (kandidat.length === 0) continue;
    // Utamakan sub-komponen, lalu selektor berbasis data-slot/data-part.
    const skor = (p: (typeof PARTS)[number]) =>
      (p.induk ? 2 : 0) + (/\[data-(slot|part)=/.test(p.sel) ? 1 : 0);
    kandidat = [...kandidat].sort((a, b) => skor(b) - skor(a));
    return kandidat[0].id;
  }
  return null;
}

export function PickerProvider({ children }: { children: ReactNode }) {
  const [aktif, setAktif] = useState(false);
  const [hasil, setHasil] = useState<PartId | null>(null);
  const nav = useNavigate();
  const { pathname } = useLocation();

  const mulai = useCallback(() => {
    setHasil(null);
    setAktif(true);
  }, []);
  const batal = useCallback(() => setAktif(false), []);
  const konsumsi = useCallback(() => setHasil(null), []);

  // Kembali ke halaman Tampilan begitu bagian terpilih.
  useEffect(() => {
    if (hasil && pathname !== HALAMAN_TAMPILAN) nav(HALAMAN_TAMPILAN);
  }, [hasil, pathname, nav]);

  // Saat aktif: klik elemen mana pun → tentukan bagiannya. Ditangkap pada
  // pointerdown (capture) agar kontrol seperti Select/menu tidak sempat terbuka.
  useEffect(() => {
    if (!aktif) return;
    document.documentElement.classList.add('simpes-picker');
    let dipilih = false;
    const ambil = (target: Element | null) => {
      const id = target ? cariBagian(target) : null;
      setAktif(false);
      if (id) setHasil(id);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || target.closest('[data-picker-abaikan]')) return;
      e.preventDefault();
      e.stopPropagation();
      dipilih = true;
      ambil(target);
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || target.closest('[data-picker-abaikan]')) return;
      e.preventDefault();
      e.stopPropagation();
      // Klik lanjutan setelah pointerdown yang sudah memilih → cukup ditelan.
      if (dipilih) {
        dipilih = false;
        return;
      }
      ambil(target);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAktif(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.documentElement.classList.remove('simpes-picker');
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [aktif]);

  const value = useMemo<PickerState>(
    () => ({ aktif, hasil, mulai, batal, konsumsi }),
    [aktif, hasil, mulai, batal, konsumsi],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePicker() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePicker di luar PickerProvider');
  return ctx;
}

import { useEffect, useRef, useState } from 'react';
import { cariGlobal, type GrupPencarianGlobal } from '@/api/pencarianGlobal';
import { errorMessage } from '@/api/client';

/** Popup hasil pencarian global halaman non-Board. */
export default function PopupCariGlobal({
  kueri,
  onPilih,
  onTutup,
}: {
  kueri: string;
  /** `kueri` = kata kunci spesifik hasil ini (NIS/NIP/nama) untuk menyaring
   *  tabel halaman tujuan. */
  onPilih: (target: string, kueri: string) => void;
  onTutup: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [grup, setGrup] = useState<GrupPencarianGlobal[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    const q = kueri.trim();
    if (q.length < 2) {
      setGrup([]);
      setGalat('');
      setMemuat(false);

      return;
    }

    let hidup = true;
    setMemuat(true);
    const timer = window.setTimeout(() => {
      cariGlobal(q)
        .then((res) => {
          if (!hidup) return;
          setGrup(res.hasil);
          setGalat('');
        })
        .catch((e) => {
          if (!hidup) return;
          setGrup([]);
          setGalat(errorMessage(e));
        })
        .finally(() => {
          if (hidup) setMemuat(false);
        });
    }, 250);

    return () => {
      hidup = false;
      window.clearTimeout(timer);
    };
  }, [kueri]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (ref.current?.contains(target)) return;
      if (target?.closest?.('form[role="search"]')) return;
      // Tombol toggle jangkauan ada di luar form; jangan tutup popup saat
      // pengguna baru mengaktifkan/mematikan pencarian global.
      if (target?.closest?.('#btn_toggle_cari_global')) return;
      onTutup();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onTutup();
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onTutup]);

  const q = kueri.trim();

  return (
    <div
      ref={ref}
      id="popup_cari_global"
      role="region"
      aria-label="Hasil pencarian global"
      className="absolute top-full left-0 z-50 mt-1 max-h-[min(70vh,480px)] w-[min(90vw,420px)] overflow-y-auto border bg-background shadow-lg"
      style={{ borderColor: 'var(--divider)' }}
    >
      <div
        className="sticky top-0 z-10 border-b bg-background px-2 py-1.5 text-[11px] font-semibold"
        style={{ borderColor: 'var(--divider)' }}
      >
        Hasil pencarian
      </div>

      {q.length < 2 ? (
        <p className="px-3 py-5 text-center text-xs text-muted-foreground">
          Ketik minimal 2 karakter.
        </p>
      ) : memuat ? (
        <p className="px-3 py-5 text-center text-xs text-muted-foreground">Mencari…</p>
      ) : galat !== '' ? (
        <p className="px-3 py-5 text-center text-xs text-destructive">{galat}</p>
      ) : grup.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-muted-foreground">
          Tidak ada hasil di halaman yang diaktifkan.
        </p>
      ) : (
        <div className="flex flex-col">
          {grup.map((item) => (
            <section key={item.halaman} aria-label={item.label}>
              <h3 className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {item.label}
              </h3>
              {item.hasil.map((hasil) => (
                <button
                  key={`${item.halaman}-${hasil.id}`}
                  id={`cari_global_${item.halaman}_${hasil.id}`}
                  type="button"
                  onClick={() => onPilih(hasil.target, hasil.kueri)}
                  className="block w-full border-t px-2 py-1.5 text-left hover:bg-[var(--surface-2)]"
                  style={{ borderColor: 'var(--divider)' }}
                >
                  <span className="block truncate text-[12px] leading-snug">{hasil.judul}</span>
                  {hasil.keterangan ? (
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                      {hasil.keterangan}
                    </span>
                  ) : null}
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

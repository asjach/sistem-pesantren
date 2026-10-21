import { useEffect, useMemo, useRef } from 'react';
import type { AplikasiPapan } from '@/api/papan';
import { JUDUL_KOLOM } from '@/api/papan';
import { cariPapan, type HasilCariPapan } from '@/lib/papan';
import { Lencana, WARNA_STATUS as WARNA_KOLOM } from './PapanKolom';

/** Popup hasil pencarian global Board, dipasang tepat di bawah input TopBar. */
export default function PopupCariPapan({
  aplikasi,
  kueri,
  onPilih,
  onTutup,
}: {
  aplikasi: AplikasiPapan[];
  kueri: string;
  onPilih: (hasil: HasilCariPapan) => void;
  onTutup: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hasil = useMemo(() => cariPapan(aplikasi, kueri), [aplikasi, kueri]);
  const grup = useMemo(() => {
    const apps = new Map<string, {
      kode: string;
      nama: string;
      modul: Map<string, { kode: string; nama: string; hasil: HasilCariPapan[] }>;
    }>();

    for (const item of hasil) {
      let app = apps.get(item.aplikasiKode);
      if (!app) {
        app = { kode: item.aplikasiKode, nama: item.aplikasiNama, modul: new Map() };
        apps.set(app.kode, app);
      }

      let modul = app.modul.get(item.modulKode);
      if (!modul) {
        modul = { kode: item.modulKode, nama: item.modulNama, hasil: [] };
        app.modul.set(modul.kode, modul);
      }

      modul.hasil.push(item);
    }

    return [...apps.values()].map((app) => ({ ...app, modul: [...app.modul.values()] }));
  }, [hasil]);
  const jumlahModul = useMemo(
    () => new Set(hasil.map((item) => `${item.aplikasiKode}:${item.modulKode}`)).size,
    [hasil],
  );

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (ref.current?.contains(target)) return;
      // Klik input/clear search tidak menutup popup; fokus input akan membukanya lagi.
      if (target?.closest?.('form[role="search"]')) return;
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

  return (
    <div
      ref={ref}
      id="popup_cari_papan"
      role="region"
      aria-label="Hasil pencarian Board"
      className="absolute top-full left-0 z-50 mt-1 max-h-[min(70vh,480px)] w-[min(90vw,420px)] overflow-y-auto border bg-background shadow-lg"
      style={{ borderColor: 'var(--divider)' }}
    >
      <div
        className="sticky top-0 z-10 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b bg-background px-2 py-1.5"
        style={{ borderColor: 'var(--divider)' }}
      >
        <span className="text-[11px] font-semibold">Hasil pencarian</span>
        <span className="text-[10px] text-muted-foreground">
          {hasil.length} poin · {grup.length} aplikasi · {jumlahModul} modul
        </span>
      </div>

      {hasil.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          Tidak ada hasil untuk “{kueri.trim()}”.
        </p>
      ) : (
        <div className="flex flex-col">
          {grup.map((app) => (
            <section key={app.kode} aria-label={`Hasil di ${app.nama}`}>
              <h3 className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {app.nama}
              </h3>
              {app.modul.map((modul) => (
                <div key={modul.kode}>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-muted-foreground">
                    <span className="font-mono">{modul.kode}</span>
                    <span className="truncate">{modul.nama}</span>
                    <span className="ml-auto font-mono">{modul.hasil.length}</span>
                  </div>
                  {modul.hasil.map((item) => (
                    <button
                      key={item.poin.id}
                      id={`hasil_cari_${item.poin.id}`}
                      type="button"
                      onClick={() => onPilih(item)}
                      title={item.poin.keterangan ?? item.poin.deskripsi}
                      className="flex w-full items-start gap-2 border-t px-2 py-1.5 text-left hover:bg-[var(--surface-2)]"
                      style={{ borderColor: 'var(--divider)' }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span className="font-mono text-[10px] text-muted-foreground">{item.poin.subKode}</span>
                          <span className="text-[10px] text-muted-foreground">{item.poin.subNama}</span>
                          <Lencana label={JUDUL_KOLOM[item.poin.status]} warna={WARNA_KOLOM[item.poin.status]} />
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] leading-snug">
                          {item.poin.deskripsi}
                        </span>
                        {item.poin.keterangan ? (
                          <span className="mt-0.5 block truncate text-[10px] leading-snug text-muted-foreground">
                            Requirement: {item.poin.keterangan}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

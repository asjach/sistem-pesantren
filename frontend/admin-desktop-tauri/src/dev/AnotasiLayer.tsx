import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ClipboardList, RefreshCw, SquareMousePointer, Trash2, X } from '@/icons';
import {
  bacaKonteks,
  buatId,
  hapusAnotasi,
  muatAnotasi,
  simpanAnotasi,
  type Anotasi,
} from './anotasi';

const LEBAR_POPOVER = 340;
const TINGGI_POPOVER = 200;
const PEMILIH_INTERAKTIF = 'button, a, input, select, textarea, label, [role="button"], [role="tab"], [role="menuitem"]';

/** Abaikan lapisan anotasi; klik ikon di dalam tombol tetap menandai tombolnya. */
function sasaranTerpilih(el: Element): Element | null {
  if (el.closest('[data-anotasi-abaikan]')) return null;
  return el.closest(PEMILIH_INTERAKTIF) ?? el;
}

function posisiPopover(rect: DOMRect) {
  const lebar = Math.min(LEBAR_POPOVER, window.innerWidth - 16);
  const kiri = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - lebar - 8));
  const bawah = rect.bottom + 8;
  const atas = bawah + TINGGI_POPOVER > window.innerHeight - 8
    ? Math.max(8, rect.top - TINGGI_POPOVER - 8)
    : bawah;

  return { left: kiri, top: atas, width: lebar };
}

/**
 * Lapisan anotasi UI mode dev. Aktifkan mode tandai, klik elemen, lalu tulis
 * instruksi; hasilnya ditulis ke `.dev/anotasi.json` untuk dibaca agen.
 */
export default function AnotasiLayer() {
  const [aktif, setAktif] = useState(false);
  const [panel, setPanel] = useState(false);
  const [daftar, setDaftar] = useState<Anotasi[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [sorot, setSorot] = useState<DOMRect | null>(null);
  const [target, setTarget] = useState<Element | null>(null);
  const [instruksi, setInstruksi] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const refTextarea = useRef<HTMLTextAreaElement>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setDaftar(await muatAnotasi());
      setGalat(null);
    } catch {
      setGalat('Tidak dapat memuat anotasi. Pastikan dev server berjalan.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const pilih = useCallback((el: Element) => {
    setTarget(el);
    setSorot(el.getBoundingClientRect());
    setInstruksi('');
    setAktif(false);
  }, []);

  const batal = useCallback(() => {
    setTarget(null);
    setSorot(null);
    setInstruksi('');
  }, []);

  useEffect(() => {
    if (!aktif) return;

    const akar = document.documentElement;
    const kursorLama = akar.style.cursor;
    akar.style.cursor = 'crosshair';

    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const sasaran = el instanceof Element && el !== document.documentElement ? sasaranTerpilih(el) : null;
      setSorot(sasaran ? sasaran.getBoundingClientRect() : null);
    };

    const onClick = (e: MouseEvent) => {
      const asal = e.target;
      if (asal instanceof Element && asal.closest('[data-anotasi-abaikan]')) return;

      e.preventDefault();
      e.stopPropagation();

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const sasaran = el instanceof Element && el !== document.documentElement ? sasaranTerpilih(el) : null;
      if (sasaran) pilih(sasaran);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAktif(false);
      setSorot(null);
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey);
      akar.style.cursor = kursorLama;
    };
  }, [aktif, pilih]);

  useEffect(() => {
    if (!target) return;

    const perbarui = () => {
      if (!target.isConnected) {
        setTarget(null);
        setSorot(null);
        return;
      }
      setSorot(target.getBoundingClientRect());
    };

    perbarui();
    window.addEventListener('scroll', perbarui, true);
    window.addEventListener('resize', perbarui);

    return () => {
      window.removeEventListener('scroll', perbarui, true);
      window.removeEventListener('resize', perbarui);
    };
  }, [target]);

  useEffect(() => {
    if (target) refTextarea.current?.focus();
  }, [target]);

  useEffect(() => {
    if (!target) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') batal();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, batal]);

  async function simpan() {
    if (!target || !instruksi.trim() || menyimpan) return;

    setMenyimpan(true);
    try {
      const baru: Anotasi = {
        id: buatId(),
        dibuat: new Date().toISOString(),
        rute: `${window.location.pathname}${window.location.search}`,
        ...bacaKonteks(target),
        instruksi: instruksi.trim(),
      };
      const tersimpan = await simpanAnotasi(baru);
      setDaftar((lama) => [...lama, tersimpan]);
      batal();
      toast.success('Anotasi tersimpan');
    } catch {
      toast.error('Gagal menyimpan anotasi. Pastikan dev server berjalan.');
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus(id: string) {
    try {
      await hapusAnotasi(id);
      setDaftar((lama) => lama.filter((a) => a.id !== id));
      toast.success('Anotasi dihapus');
    } catch {
      toast.error('Gagal menghapus anotasi.');
    }
  }

  const posisi = target && sorot ? posisiPopover(sorot) : null;
  const konteks = useMemo(() => (target ? bacaKonteks(target) : null), [target]);

  return (
    <div
      data-anotasi-abaikan
      data-slot="anotasi-dev"
      className="pointer-events-none fixed inset-0 z-[9999]"
    >
      {sorot && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed border-2 border-primary bg-primary/10"
          style={{ left: sorot.left, top: sorot.top, width: sorot.width, height: sorot.height }}
        />
      )}

      {aktif && (
        <div className="pointer-events-none fixed top-2 left-1/2 -translate-x-1/2 border border-primary bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-lg">
          Klik elemen untuk diberi instruksi · Esc batal
        </div>
      )}

      {target && posisi && konteks && (
        <div
          className="pointer-events-auto fixed z-20 border border-border bg-popover p-2 text-popover-foreground shadow-lg"
          style={{ left: posisi.left, top: posisi.top, width: posisi.width }}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Instruksi untuk agent
            </span>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {konteks.sumber ?? (konteks.komponen.join(' > ') || konteks.tag)}
            </span>
          </div>

          <textarea
            ref={refTextarea}
            id="input_instruksi_anotasi"
            aria-label="Instruksi untuk agent"
            rows={3}
            className="w-full resize-none border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Contoh: samakan font NIS dengan kolom lain"
            value={instruksi}
            onChange={(e) => setInstruksi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void simpan();
              }
            }}
          />

          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-[10px] text-muted-foreground" title={konteks.selector}>
              {konteks.selector}
            </span>
            <span className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={batal}>
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!instruksi.trim() || menyimpan}
                onClick={() => void simpan()}
              >
                {menyimpan ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </span>
          </div>
        </div>
      )}

      {panel && (
        <section
          aria-label="Daftar anotasi UI"
          className="pointer-events-auto fixed right-3 bottom-14 z-10 flex max-h-[60vh] w-[380px] max-w-[calc(100vw-24px)] flex-col border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
            <span className="text-[11px] font-semibold tracking-wide uppercase">Anotasi UI</span>
            <span className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Muat ulang anotasi"
                onClick={() => void muat()}
              >
                <RefreshCw />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Tutup daftar anotasi"
                onClick={() => setPanel(false)}
              >
                <X />
              </Button>
            </span>
          </div>

          <p className="border-b border-border px-2 py-1 text-[10px] text-muted-foreground">
            Tersimpan di <span className="font-mono">.dev/anotasi.json</span> untuk dibaca agent.
          </p>

          {galat && (
            <p className="m-2 border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
              {galat}
            </p>
          )}

          <div className="min-h-0 overflow-y-auto">
            {memuat && !daftar.length ? (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">Memuat anotasi…</p>
            ) : daftar.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">
                Belum ada anotasi. Aktifkan mode tandai lalu klik elemen.
              </p>
            ) : (
              [...daftar].reverse().map((a) => (
                <div key={a.id} className="flex items-start gap-2 border-b border-border px-2 py-2 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="truncate font-mono">{a.rute || '/'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate font-mono">{a.sumber ?? a.selector}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug">{a.instruksi}</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {a.komponen.join(' > ') || a.tag}
                      {a.teks ? ` · "${a.teks}"` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Hapus anotasi: ${a.instruksi.slice(0, 60)}`}
                    onClick={() => void hapus(a.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      <div className="pointer-events-auto fixed right-3 bottom-3 z-10 flex items-center gap-1">
        <Button
          id="btn_buka_anotasi"
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label={`Buka daftar anotasi (${daftar.length})`}
          title="Daftar anotasi UI (mode dev)"
          onClick={() => setPanel((buka) => !buka)}
          className="relative"
        >
          <ClipboardList />
          {daftar.length > 0 && (
            <span className="pointer-events-none absolute -top-1 -right-1 min-w-[14px] bg-primary px-1 text-center text-[9px] leading-[14px] text-primary-foreground">
              {daftar.length}
            </span>
          )}
        </Button>

        <Button
          id="btn_tandai_elemen"
          type="button"
          variant={aktif ? 'default' : 'outline'}
          size="icon-lg"
          aria-label={aktif ? 'Matikan mode tandai elemen' : 'Tandai elemen untuk agent'}
          aria-pressed={aktif}
          title="Tandai elemen untuk agent (mode dev)"
          onClick={() => {
            batal();
            setAktif((nyala) => !nyala);
          }}
        >
          <SquareMousePointer />
        </Button>
      </div>
    </div>
  );
}

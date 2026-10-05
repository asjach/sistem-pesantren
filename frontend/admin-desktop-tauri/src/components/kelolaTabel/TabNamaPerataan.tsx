import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { errorMessage } from '../../api/client';
import {
  muatToolbarPreset,
  simpanToolbarPreset,
  type AlignKolomApi,
} from '../../api/toolbarPreset';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { labelKolom } from '@/lib/labelKolom';
import { useBagian } from '@/components/kelolaHalaman/kotor';
import { useLembagaAktif } from '@/lembagaAktif';
import { cn } from '@/lib/utils';
import { Check, Pencil, X, AlignCenter, AlignLeft, AlignRight } from '@/icons';
import { bacaAlign, kabariToolbar, type AlignKolom } from './jenis';
import { toast } from 'sonner';
import type { ExcelField } from '../excel/types';

/** Bandingkan peta align tanpa peduli urutan kunci. */
function kanonAlign(o: Partial<Record<string, AlignKolom>>): string {
  return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
}

/** Section Nama & Perataan dialog Kelola Tabel: tulis-ulang nama header tiap
 *  kolom + perataan tiap kolom (satu nilai per kolom, bukan per preset),
 *  dikelola super_admin. Nama header tersimpan di preset (ikut section Kolom
 *  saat tombol Simpan); perataan tersimpan di toolbar_preset (merge). */
export default function TabNamaPerataan({
  tableKey,
  fields,
  fieldKeys,
  label,
  setLabel,
}: {
  tableKey: string;
  fields: ExcelField[];
  fieldKeys: Set<string>;
  /** Nama header kustom (milik induk; dipakai section Kolom saat simpan preset). */
  label: Record<string, string>;
  setLabel: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  /** Nama & perataan = pengaturan global super_admin EFEKTIF (mati saat
   *  bertindak; lapis pertahanan kedua karena dialog pun hanya untuk
   *  super_admin). */
  const { efektifSuper: bolehUbah } = useLembagaAktif();
  /** Perataan kolom tabel (satu nilai per kolom, bukan per preset). */
  const [align, setAlign] = useState<Partial<Record<string, AlignKolom>>>({});
  /** Acuan align tersimpan (kanonik) untuk deteksi kotor. */
  const alignAwalRef = useRef<string>(kanonAlign({}));
  /** Baris yang sedang diedit namanya (null = tidak ada). */
  const [editLabelKey, setEditLabelKey] = useState<string | null>(null);
  const [drafLabel, setDrafLabel] = useState('');
  const [cari, setCari] = useState('');
  const laporKotor = useBagian('tampilan', () => simpanAlign());
  const kotorAlign = useCallback(
    () => kanonAlign(align) !== alignAwalRef.current,
    [align],
  );
  useEffect(() => {
    laporKotor(kotorAlign());
  }, [kotorAlign, laporKotor]);

  const labelOf = useCallback(
    (f: ExcelField) => labelKolom(f.label) || labelKolom(f.key),
    [],
  );
  /** Pencarian mencocokkan teks tampil, nama kustom, maupun key kolom aslinya. */
  const cocok = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(
      (f) =>
        labelOf(f).toLowerCase().includes(q) ||
        (label[f.key] ?? '').toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q),
    );
  }, [fields, cari, labelOf, label]);

  const muatAlign = useCallback(async () => {
    try {
      const res = await muatToolbarPreset(tableKey);
      const bersih = bacaAlign(res.data.align);
      setAlign(bersih);
      alignAwalRef.current = kanonAlign(bersih);
    } catch {
      setAlign({});
      alignAwalRef.current = kanonAlign({});
    }
  }, [tableKey]);

  useEffect(() => {
    void muatAlign();
  }, [muatAlign]);

  /** Siklus perataan satu kolom: tengah → kiri → kanan → tengah (absen).
   *  Nilai tengah tidak disimpan (ikut bawaan tengah global). */
  function sikulAlign(key: string) {
    setAlign((prev) => {
      const cur = prev[key] ?? 'center';
      const next: AlignKolom | undefined = cur === 'center' ? 'left' : cur === 'left' ? 'right' : undefined;
      const hasil = { ...prev };
      if (next === undefined) delete hasil[key];
      else hasil[key] = next;
      return hasil;
    });
  }

  /** Simpan draf nama header satu baris (kosong = kembali ke bawaan). */
  function simpanLabelBaris(key: string) {
    const t = drafLabel.trim().slice(0, 60);
    setLabel((prev) => {
      if (t === '') {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key] === t) return prev;
      return { ...prev, [key]: t };
    });
    setEditLabelKey(null);
  }

  /** Simpan perataan kolom (merge: hanya kunci `align` yang dikirim). */
  /** Simpan perataan kolom (cangkang menutup dialog bila semua sukses). */
  async function simpanAlign(): Promise<boolean> {
    if (!kotorAlign()) return true;
    const bersih: AlignKolomApi = {};
    for (const [k, v] of Object.entries(align)) {
      if (v !== undefined && fieldKeys.has(k)) bersih[k] = v;
    }
    try {
      await simpanToolbarPreset(tableKey, undefined, undefined, undefined, bersih);
      alignAwalRef.current = kanonAlign(bersih);
      kabariToolbar(tableKey);
      laporKotor(false);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
  }

  if (!bolehUbah) {
    return (
      <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
        Hanya super_admin yang dapat mengubah nama & perataan kolom.
      </p>
    );
  }

  const hitungNama = Object.keys(label).length;
  const hitungAlign = Object.keys(align).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1 sm:max-w-56">
          <Input
            id={`input_cari_tampilan_${tableKey}`}
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            onKeyDown={(e) => {
              // Enter di pencarian tidak boleh men-submit form induk.
              if (e.key === 'Enter') e.preventDefault();
            }}
            placeholder="Cari kolom…"
            aria-label="Cari kolom"
            className="h-8 w-full pr-7"
          />
          {cari !== '' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  id={`btn_hapus_cari_tampilan_${tableKey}`}
                  aria-label="Bersihkan pencarian"
                  onClick={() => setCari('')}
                  className="absolute top-1/2 right-1 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bersihkan pencarian</p>
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {hitungNama} nama kustom · {hitungAlign} perataan kustom
        </span>
      </div>

      <div className="rounded-md border">
        {cocok.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">Tidak ada kolom cocok.</p>
        ) : cocok.map((f) => {
          const teks = labelOf(f);
          const kustom = label[f.key] !== undefined;
          const a = align[f.key] ?? 'center';
          const IkonAlign = a === 'left' ? AlignLeft : a === 'right' ? AlignRight : AlignCenter;
          const labelAlign = a === 'left' ? 'kiri' : a === 'right' ? 'kanan' : 'tengah';
          return (
            <div
              key={f.key}
              className="flex items-center gap-1.5 border-b px-1.5 py-0.5 last:border-0"
            >
              {editLabelKey === f.key ? (
                <span className="flex min-w-0 flex-1 items-center gap-1">
                  <Input
                    id={`input_nama_tampilan_${tableKey}_${f.key}`}
                    autoFocus
                    value={drafLabel}
                    onChange={(e) => setDrafLabel(e.target.value)}
                    maxLength={60}
                    placeholder={teks}
                    aria-label={`Nama header ${teks} (kosongkan untuk bawaan)`}
                    className="h-6 min-w-0 flex-1 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); simpanLabelBaris(f.key); }
                      if (e.key === 'Escape') setEditLabelKey(null);
                    }}
                  />
                  <button
                    type="button"
                    id={`btn_simpan_nama_tampilan_${tableKey}_${f.key}`}
                    aria-label={`Simpan nama header ${teks}`}
                    title="Simpan (kosong = kembali ke bawaan)"
                    onClick={() => simpanLabelBaris(f.key)}
                    className="grid size-5 shrink-0 place-items-center rounded text-foreground hover:bg-accent"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    id={`btn_batal_nama_tampilan_${tableKey}_${f.key}`}
                    aria-label={`Batal ubah nama header ${teks}`}
                    title="Batal"
                    onClick={() => setEditLabelKey(null)}
                    className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : (
                <>
                  <span
                    className={cn('min-w-0 flex-1 truncate text-xs', kustom && 'font-medium text-foreground')}
                    title={kustom ? `${teks} → ${label[f.key]}` : `${teks} — klik pensil untuk tulis ulang`}
                  >
                    {label[f.key] ?? teks}
                  </span>
                  <button
                    type="button"
                    id={`btn_nama_tampilan_${tableKey}_${f.key}`}
                    aria-label={kustom ? `Ubah nama header ${teks} (kini: ${label[f.key]})` : `Ubah nama header ${teks}`}
                    title={kustom ? `Nama kustom: ${label[f.key]} — klik untuk ubah` : 'Tulis ulang nama header'}
                    onClick={() => { setEditLabelKey(f.key); setDrafLabel(label[f.key] ?? ''); }}
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded hover:bg-accent hover:text-foreground',
                      kustom ? 'text-foreground' : 'text-muted-foreground/60',
                    )}
                  >
                    <Pencil size={12} />
                  </button>
                </>
              )}
              <button
                type="button"
                id={`btn_align_tampilan_${tableKey}_${f.key}`}
                aria-label={`Perataan ${teks}: ${labelAlign} — klik untuk ganti`}
                title={`Perataan: ${labelAlign} — klik untuk ganti (tengah = ikut preferensi pengguna)`}
                onClick={() => sikulAlign(f.key)}
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded hover:bg-accent hover:text-foreground',
                  a === 'center' ? 'text-muted-foreground/60' : 'text-foreground',
                )}
              >
                <IkonAlign size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

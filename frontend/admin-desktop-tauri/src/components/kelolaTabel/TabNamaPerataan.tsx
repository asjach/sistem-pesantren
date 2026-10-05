import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { errorMessage } from '../../api/client';
import {
  muatToolbarPreset,
  simpanToolbarPreset,
  type AlignKolomApi,
} from '../../api/toolbarPreset';
import { Input } from '@/components/ui/input';
import { labelKolom } from '@/lib/labelKolom';
import { useBagian } from '@/components/kelolaHalaman/kotor';
import { useLembagaAktif } from '@/lembagaAktif';
import { cn } from '@/lib/utils';
import { AlignCenter, AlignLeft, AlignRight } from '@/icons';
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

  /** Ubah nama header satu baris langsung dari kolom EDIT (tanpa tombol
   *  edit terpisah). Nilai mentah ikut tersimpan supaya mengetik spasi di
   *  tengah tidak terpotong; pemangkasan + kosong = kembali ke bawaan
   *  dilakukan saat blur (Enter atau klik kolom lain). */
  function ubahLabelBaris(key: string, nilai: string) {
    const t = nilai.slice(0, 60);
    setLabel((prev) => (prev[key] === t ? prev : { ...prev, [key]: t }));
  }

  /** Rapikan nilai saat keluar dari kolom: trim, kosong = bawaan. */
  function rapiLabelBaris(key: string, nilai: string) {
    const t = nilai.trim().slice(0, 60);
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

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border">
        {/* Kepala kolom: nama bawaan, kolom edit langsung, perataan. */}
        <div className="flex items-center gap-1.5 border-b bg-muted/30 px-1.5 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <span className="min-w-0 flex-1">Nama</span>
          <span className="min-w-0 flex-[2]">Edit</span>
          {/* Kolom perataan selebar tombol ikon (w-5), jadi judulnya ditulis
              vertikal (bawah→atas) supaya tidak meluber ke kolom sebelah.
              Tingginya ikut konten, bukan tinggi tetap. */}
          <span className="flex w-5 shrink-0 items-center justify-center self-stretch" title="Perataan">
            <span className="text-[10px] leading-none tracking-normal [writing-mode:vertical-rl] rotate-180">
              Perataan
            </span>
          </span>
        </div>
        {fields.map((f) => {
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
              {/* Kolom 1: nama bawaan (tidak bisa diubah di sini). */}
              <span
                className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                title={`Nama bawaan: ${teks}`}
              >
                {teks}
              </span>
              {/* Kolom 2: nama kustom — ketik langsung, tanpa tombol edit. */}
              <Input
                id={`input_nama_tampilan_${tableKey}_${f.key}`}
                value={label[f.key] ?? ''}
                onChange={(e) => ubahLabelBaris(f.key, e.target.value)}
                onBlur={(e) => rapiLabelBaris(f.key, e.target.value)}
                maxLength={60}
                placeholder="—"
                aria-label={`Edit nama header ${teks} (kosongkan untuk bawaan)`}
                className={cn('h-6 min-w-0 flex-[2] text-xs', !kustom && 'text-muted-foreground')}
              />
              {/* Kolom 3: perataan. */}
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

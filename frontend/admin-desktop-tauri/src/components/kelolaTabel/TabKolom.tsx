import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../../api/client';
import {
  createPresetTabel,
  deletePresetTabel,
  setPresetBawaan,
  updatePresetTabel,
  type PresetTabel,
} from '../../api/preset';
import { Button } from '@/components/ui/button';
import TombolIkon from '@/components/TombolIkon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { labelKolom } from '@/lib/labelKolom';
import { useBagian } from '@/components/kelolaHalaman/kotor';
import { DialogFooter } from '@/components/ui/dialog';
import ConfirmDelete from '@/components/ConfirmDelete';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { GripVertical, X } from '@/icons';
import { toast } from 'sonner';
import type { ExcelField } from '../excel/types';

/** Nilai khusus di dropdown preset: bukan id preset, tapi mode semua kolom. */
const PRESET_LENGKAP = '__lengkap';
/** Nilai khusus: susunan "Lengkap kustom" yang tersimpan (bukan preset). */
const PRESET_KUSTOM = '__kustom';

export interface TabKolomProps {
  tableKey: string;
  fields: ExcelField[];
  fieldKeys: Set<string>;
  presets: PresetTabel[];
  banyakKolom: boolean;
  /** Susunan "Lengkap kustom" tersimpan (null = semua kolom). */
  kolomAwal?: string[] | null;
  /** Preset yang dibuka untuk diedit (null = preset baru). Induk me-remount
   *  tab setiap kali preset awal berubah lewat `key`. */
  presetAwal: PresetTabel | null;
  /** Buka dengan semua kolom terpilih (entri "Lengkap") agar bisa
   *  dimodifikasi lalu disimpan sebagai preset baru. */
  mulaiLengkap: boolean;
  /** Minta induk membuka entri "Lengkap" (remount + reset state). */
  onPilihLengkap: () => void;
  /** Id preset bawaan tabel (null = Lengkap); diubah via checkbox form,
   *  tersimpan bersama tombol Simpan (boleh tanpa bawaan). */
  bawaanId: number | null;
  /** Minta induk membuka preset lain / preset baru (remount + reset state). */
  onPilihPreset: (preset: PresetTabel | null) => void;
  /** Preset tersimpan → induk menyegarkan daftar + menetapkannya aktif. */
  onTersimpan: (presetId: number) => Promise<void>;
  /** Mode Lengkap tanpa nama → terapkan langsung ke tabel (tanpa menyimpan). */
  onPakaiLengkap: (kolom: string[], label: Record<string, string>) => void;
  /** Preset dihapus → induk menyegarkan daftar + mengosongkan preset aktif. */
  onDihapus: () => Promise<void>;
  /** Tutup dialog. */
}

/** Tab Kolom dialog Kelola Halaman: preset kolom GLOBAL (satu definisi untuk
 *  semua lembaga), dikelola super_admin. Pilih/atur kolom tampil + nama
 *  header kustom. */
export default function TabKolom({
  tableKey,
  fields,
  fieldKeys,
  presets,
  banyakKolom,
  kolomAwal = null,
  presetAwal,
  mulaiLengkap,
  onPilihLengkap,
  bawaanId,
  onPilihPreset,
  onTersimpan,
  onPakaiLengkap,
  onDihapus,
}: TabKolomProps) {
  const [editId, setEditId] = useState<number | null>(presetAwal?.id ?? null);
  const [nama, setNama] = useState(presetAwal?.nama ?? '');
  /** Status bawaan = bagian form (tersimpan via Simpan, boleh dikosongkan). */
  const [bawaan, setBawaan] = useState(presetAwal ? presetAwal.id === bawaanId : false);
  const awalBawaan = useRef(presetAwal ? presetAwal.id === bawaanId : false);
  /** Kolom terpilih BERURUTAN: urutan array = urutan tampil kolom (disimpan
   *  ke `preset_tabel.kolom`). Preset berbeda boleh punya urutan berbeda. */
  const [kolom, setKolom] = useState<string[]>(() => {
    if (presetAwal) return presetAwal.kolom.filter((k) => fieldKeys.has(k));
    // Lengkap kustom dari server: pakai susunannya, bukan semua kolom.
    if (kolomAwal && kolomAwal.length > 0) return kolomAwal.filter((k) => fieldKeys.has(k));
    return mulaiLengkap ? [...fieldKeys] : [];
  });
  /** Susunan yang dimuat memang "Lengkap kustom" (bukan semua kolom). */
  const kustomAwal = editId === null && !!kolomAwal && kolomAwal.length > 0;
  const [cariKolom, setCariKolom] = useState('');
  const [busy, setBusy] = useState(false);
  const laporKotor = useBagian('kolom', () => void simpanPreset());
  /** Acuan "tersimpan" untuk mendeteksi perubahan belum disimpan. */
  const awalNamaRef = useRef(presetAwal?.nama ?? '');
  const awalKolomRef = useRef(kolom);
  useEffect(() => {
    const berubah =
      nama !== awalNamaRef.current ||
      bawaan !== awalBawaan.current ||
      kolom.length !== awalKolomRef.current.length ||
      kolom.some((k, i) => k !== awalKolomRef.current[i]);
    laporKotor(berubah);
  }, [nama, bawaan, kolom, laporKotor]);
  /** Mode Lengkap: bukan hasil edit preset (tanpa id) — perubahan disimpan
   *  sebagai preset baru sehingga nama wajib diisi saat submit. */
  const modeLengkap = mulaiLengkap && editId === null;

  /** Label tampilan kolom: label di kode bisa berupa nama kolom mentah
   *  (`nama_lengkap`), jadi dilewatkan humanizer agar sama dengan header
   *  tabel. `fieldKeys` dipakai bila label kosong. */
  const labelOf = useCallback(
    (f: ExcelField) => labelKolom(f.label) || labelKolom(f.key),
    [],
  );
  /** Pencarian mencocokkan teks yang tampil maupun nama kolom aslinya, jadi
   *  mengetik `nama_lengkap` tetap menemukan kolom "Nama Lengkap". */
  const kolomTampil = useMemo(() => {
    const q = cariKolom.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(
      (f) => labelOf(f).toLowerCase().includes(q) || f.key.toLowerCase().includes(q),
    );
  }, [fields, cariKolom, labelOf]);
  const semuaTampilTerpilih = kolomTampil.length > 0 && kolomTampil.every((f) => kolom.includes(f.key));
  /** Atribut field per key (untuk daftar kolom berurutan). */
  const fieldByKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  /** Baris daftar gabungan: kolom tampil (urutan `kolom`) lebih dulu, lalu
   *  kolom tersembunyi. `indeks` = posisi asli di `kolom`, jadi pengurutan
   *  lewat panah tetap benar walau daftar sedang tersaring pencarian. */
  const barisKolom = useMemo(() => {
    const q = cariKolom.trim().toLowerCase();
    const cocok = (f: ExcelField) => (
      q === '' || labelOf(f).toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
    );
    const tampil = kolom
      .map((k, i) => ({ f: fieldByKey.get(k), i }))
      .filter((x): x is { f: ExcelField; i: number } => !!x.f && cocok(x.f))
      .map(({ f, i }) => ({ f, tampil: true as const, indeks: i as number | null }));
    const sembunyi = fields
      .filter((f) => !kolom.includes(f.key) && cocok(f))
      .map((f) => ({ f, tampil: false as const, indeks: null as number | null }));
    return [...tampil, ...sembunyi];
  }, [kolom, fields, fieldByKey, cariKolom, labelOf]);

  function togolKolom(key: string, aktif: boolean) {
    setKolom((prev) => {
      if (aktif) return prev.includes(key) ? prev : [...prev, key];
      return prev.filter((k) => k !== key);
    });
  }

  function aturSemuaTampil(aktif: boolean) {
    setKolom((prev) => {
      if (aktif) {
        const ada = new Set(prev);
        return [...prev, ...kolomTampil.filter((f) => !ada.has(f.key)).map((f) => f.key)];
      }
      const buang = new Set(kolomTampil.map((f) => f.key));
      return prev.filter((k) => !buang.has(k));
    });
  }

  /** Geser satu item kolom terpilih ke atas/bawah (tombol panah/WASD). */
  function geserTerpilih(dari: number, arah: -1 | 1) {
    setKolom((prev) => {
      const j = dari + arah;
      if (dari < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[dari], next[j]] = [next[j], next[dari]];
      return next;
    });
  }

  /** Seret-untuk-mengatur urutan kolom terpilih. */
  const seretRef = useRef<string | null>(null);
  const [tujuanSeret, setTujuanSeret] = useState<string | null>(null);
  function jatuhSeret(ke: string, sesudah: boolean) {
    const dari = seretRef.current;
    seretRef.current = null;
    setTujuanSeret(null);
    if (dari === null || dari === ke) return;
    setKolom((prev) => {
      const next = prev.filter((k) => k !== dari);
      let idx = next.indexOf(ke);
      if (idx < 0) return prev;
      if (sesudah) idx += 1;
      next.splice(idx, 0, dari);
      return next;
    });
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    await simpanPreset();
  }

  /** Simpan bagian ini (dipanggil form maupun tombol Simpan terpadu). */
  async function simpanPreset() {
    if (kolom.length === 0) return;
    if (!nama.trim()) {
      // Mode Lengkap tanpa nama: terapkan langsung ke tabel, tanpa membuat preset.
      if (modeLengkap) {
        onPakaiLengkap(kolom, {});
        // Sudah diterapkan: bagian ini kembali bersih (dialog tetap terbuka).
        laporKotor(false);
      }
      return;
    }
    setBusy(true);
    try {
      // Nama header tunggal dari label field di kode; label preset tak dikelola
      // lagi (null = bersihkan sisa lama bila ada).
      let saved: PresetTabel | undefined;
      let pesan = 'Preset kolom disimpan.';
      if (editId) {
        const res = await updatePresetTabel(editId, { nama: nama.trim(), kolom, label: null });
        saved = res.data[0];
        pesan = res.pesan;
      } else {
        const res = await createPresetTabel({
          table_key: tableKey,
          nama: nama.trim(),
          kolom,
        });
        saved = res.data[0];
        pesan = res.pesan;
      }
      if (!saved) {
        throw new Error('Preset gagal disimpan.');
      }
      // Status bawaan ikut tersimpan (boleh dikosongkan = tanpa bawaan).
      if (bawaan !== awalBawaan.current) {
        await setPresetBawaan(saved.id, bawaan);
        awalBawaan.current = bawaan;
      }
      toast.success(pesan);
      setEditId(saved.id);
      await onTersimpan(saved.id);
      laporKotor(false);
    } catch (e2) {
      toast.error(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function hapus() {
    if (!editId) return;
    try {
      await deletePresetTabel(editId);
      toast.success('Preset kolom dihapus.');
      setEditId(null);
      setNama('');
      setKolom([]);
      await onDihapus();
    } catch (e2) {
      toast.error(errorMessage(e2));
    }
  }

  return (
    <form
      id={`form_preset_kolom_${tableKey}`}
      onSubmit={simpan}
      className={cn('flex h-full min-h-0 flex-col gap-2')}
    >
      {/* Baris atas: identitas preset, pemilih preset, dan preset baru. */}
      <div className="flex flex-wrap items-end gap-3">
        <Field className="sm:max-w-xs">
          <FieldLabel htmlFor={`input_nama_preset_${tableKey}`}>Nama preset</FieldLabel>
          <Input
            id={`input_nama_preset_${tableKey}`}
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            maxLength={50}
            placeholder="mis. default"
          />
        </Field>
        <label
          className="flex shrink-0 cursor-pointer items-center gap-1.5 pb-2 text-xs whitespace-nowrap"
          title="Preset ini dipakai otomatis bila user belum memilih preset"
        >
          <Checkbox
            id={`check_preset_bawaan_${tableKey}`}
            checked={bawaan}
            onCheckedChange={(c) => setBawaan(!!c)}
            aria-label="Jadikan preset bawaan"
          />
          Bawaan
        </label>
        <Field className="sm:max-w-56">
          <FieldLabel htmlFor={`select_preset_${tableKey}`}>Preset aktif</FieldLabel>
          <Select
            value={editId === null ? (kustomAwal ? PRESET_KUSTOM : PRESET_LENGKAP) : String(editId)}
            onValueChange={(v) => {
              if (v === PRESET_LENGKAP) {
                onPilihLengkap();
                return;
              }
              if (v === PRESET_KUSTOM) return;
              const p = presets.find((x) => x.id === Number(v));
              if (p) onPilihPreset(p);
            }}
          >
            <SelectTrigger id={`select_preset_${tableKey}`} size="sm" className="w-full">
              <SelectValue placeholder="Pilih preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PRESET_LENGKAP}>Lengkap (semua kolom)</SelectItem>
              {kustomAwal ? <SelectItem value={PRESET_KUSTOM}>Lengkap (kustom)</SelectItem> : null}
              {presets.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.id === bawaanId ? `${p.nama} (bawaan)` : p.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          id={`btn_preset_baru_${tableKey}`}
          type="button"
          variant="outline"
          className="mb-0.5 shrink-0"
          onClick={() => onPilihPreset(null)}
        >
          + Preset baru
        </Button>
      </div>

      {/* Satu daftar kolom: centang = tampil, seret gagang = urutan.
          Kolom tersembunyi ikut tampil di bawah (latar redup) agar tidak perlu
          berpindah panel untuk menambahkannya kembali. */}
      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>
            Kolom — {kolom.length} tampil dari {fields.length} (seret untuk mengurutkan)
          </FieldLabel>
          <span className="flex shrink-0 items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  id={`btn_pilih_semua_kolom_${tableKey}`}
                  type="button"
                  disabled={kolomTampil.length === 0 || semuaTampilTerpilih}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => aturSemuaTampil(true)}
                >
                  Pilih semua
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{cariKolom.trim() ? 'Pilih semua kolom hasil pencarian' : 'Pilih semua kolom'}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  id={`btn_kosongkan_kolom_${tableKey}`}
                  type="button"
                  disabled={kolomTampil.length === 0 || kolomTampil.every((f) => !kolom.includes(f.key))}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => aturSemuaTampil(false)}
                >
                  Kosongkan
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{cariKolom.trim() ? 'Batalkan pilihan kolom hasil pencarian' : 'Batalkan semua pilihan kolom'}</p>
              </TooltipContent>
            </Tooltip>
          </span>
        </div>
        <Input
          id={`input_cari_kolom_${tableKey}`}
          value={cariKolom}
          onChange={(e) => setCariKolom(e.target.value)}
          placeholder="Cari kolom…"
          aria-label="Cari kolom"
        />
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-auto rounded-md border',
            banyakKolom ? 'max-h-[45vh] lg:max-h-none' : 'max-h-[55vh] lg:max-h-none',
          )}
        >
          {barisKolom.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">Tidak ada kolom cocok.</p>
          ) : barisKolom.map(({ f, tampil, indeks }) => {
            const teks = labelOf(f);
            return (
              <div
                key={f.key}
                onDragOver={tampil ? (e) => { e.preventDefault(); setTujuanSeret(f.key); } : undefined}
                onDrop={tampil ? () => jatuhSeret(f.key, false) : undefined}
                onDragEnd={() => {
                  seretRef.current = null;
                  setTujuanSeret(null);
                }}
                className={cn(
                  'flex items-center gap-2 border-b px-2 py-1 last:border-0 transition-colors',
                  tampil ? 'hover:bg-accent/30' : 'bg-muted/40 text-muted-foreground',
                  tujuanSeret === f.key && seretRef.current !== f.key && 'bg-accent/30 ring-1 ring-inset ring-accent',
                )}
              >
                {tampil && indeks !== null ? (
                  <>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Seret untuk memindah ${teks}`}
                      title="Seret untuk memindah posisi kolom"
                      draggable
                      onDragStart={(e) => {
                        seretRef.current = f.key;
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                        e.preventDefault();
                        geserTerpilih(indeks, e.key === 'ArrowUp' ? -1 : 1);
                      }}
                      className="grid size-6 shrink-0 cursor-grab place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
                    >
                      <GripVertical size={14} />
                    </span>
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {indeks + 1}.
                    </span>
                  </>
                ) : (
                  // Ruang gagang hanya dikosongkan agar nama kolom tetap sejajar.
                  <span aria-hidden className="w-6 shrink-0" />
                )}
                <Checkbox
                  id={`chk_kolom_${tableKey}_${f.key}`}
                  checked={tampil}
                  onCheckedChange={(c) => togolKolom(f.key, !!c)}
                  aria-label={`Tampilkan ${teks}`}
                />
                <span className="min-w-0 flex-1 truncate text-xs" title={teks}>
                  {teks}
                </span>
                {tampil ? (
                  <TombolIkon
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    id={`btn_kolom_hapus_${tableKey}_${f.key}`}
                    tip="Sembunyikan kolom ini"
                    onClick={() => togolKolom(f.key, false)}
                  >
                    <X size={12} />
                  </TombolIkon>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <DialogFooter className="mt-auto">
        {editId ? (
          <ConfirmDelete
            title="Hapus preset?"
            description={`Preset "${nama}" akan dihapus untuk tabel ini.`}
            onConfirm={() => void hapus()}
          >
            <Button id={`btn_hapus_preset_${tableKey}`} type="button" variant="outline" className="mr-auto text-destructive">
              Hapus
            </Button>
          </ConfirmDelete>
        ) : null}
      </DialogFooter>
    </form>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../../api/client';
import {
  createPresetTabel,
  deletePresetTabel,
  setPresetBawaan,
  updatePresetTabel,
  type PresetTabel,
} from '../../api/preset';
import {
  muatToolbarPreset,
  simpanToolbarPreset,
  type AlignKolomApi,
} from '../../api/toolbarPreset';
import { EVENT_TOOLBAR_BERUBAH, bacaAlign, type AlignKolom } from './jenis';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { labelKolom } from '@/lib/labelKolom';
import { useBagian } from '@/components/kelolaHalaman/kotor';
import { useLembagaAktif } from '@/lembagaAktif';
import ConfirmDelete from '@/components/ConfirmDelete';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Check, GripVertical, Pencil, Pin, Plus, Trash2, X, AlignCenter, AlignLeft, AlignRight } from '@/icons';
import { toast } from 'sonner';
import type { ExcelField } from '../excel/types';

/** Nilai khusus di dropdown preset: bukan id preset, tapi mode semua kolom. */
const PRESET_LENGKAP = '__lengkap';
/** Nilai khusus: susunan "Lengkap kustom" yang tersimpan (bukan preset). */
const PRESET_KUSTOM = '__kustom';
/** Nilai khusus: preset baru yang belum disimpan. */
const PRESET_BARU = '__baru';

/** Bersihkan peta label: hanya kolom yang ada + teks tak kosong. */
function bersihLabel(
  mentah: Record<string, string> | null | undefined,
  fieldKeys: Set<string>,
): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const [k, v] of Object.entries(mentah ?? {})) {
    const t = v.trim().slice(0, 60);
    if (fieldKeys.has(k) && t !== '') hasil[k] = t;
  }
  return hasil;
}

/** Bandingkan peta label tanpa peduli urutan kunci. */
function kanonLabel(o: Record<string, string>): string {
  return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
}

/** Bandingkan peta align tanpa peduli urutan kunci. */
function kanonAlign(o: Partial<Record<string, AlignKolom>>): string {
  return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
}

/** Kabari grid tabel terkait agar memuat ulang preset toolbar-nya
 *  (termasuk perataan kolom). */
function kabariToolbar(tableKey: string) {
  window.dispatchEvent(new CustomEvent(EVENT_TOOLBAR_BERUBAH, { detail: { tableKey } }));
}

export interface TabKolomProps {
  tableKey: string;
  fields: ExcelField[];
  fieldKeys: Set<string>;
  presets: PresetTabel[];
  /** Susunan "Lengkap kustom" tersimpan (null = semua kolom). */
  kolomAwal?: string[] | null;
  /** Nama header kustom "Lengkap kustom" (null = tanpa kustom). */
  labelAwal?: Record<string, string> | null;
  /** Preset yang dibuka untuk diedit (null = preset baru). Induk me-remount
   *  tab setiap kali preset awal berubah lewat `key`. */
  presetAwal: PresetTabel | null;
  /** Buka dengan semua kolom terpilih (entri "Lengkap") agar bisa
   *  dimodifikasi lalu disimpan sebagai preset baru. */
  mulaiLengkap: boolean;
  /** Minta induk membuka entri "Lengkap" (remount + reset state). */
  onPilihLengkap: () => void;
  /** Id preset bawaan tabel (null = Lengkap); diubah via tombol pin,
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
}

/** Section Kolom dialog Kelola Tabel: preset kolom GLOBAL (satu definisi untuk
 *  semua lembaga), dikelola super_admin. Bar preset di atas (pilih/klaim
 *  bawaan/tambah/ubah nama/hapus), body dua grup: kolom tampil (berurut,
 *  seret untuk menggeser) dan kolom tersembunyi (klik untuk menampilkan). */
export default function TabKolom({
  tableKey,
  fields,
  fieldKeys,
  presets,
  kolomAwal = null,
  labelAwal = null,
  presetAwal,
  mulaiLengkap,
  onPilihLengkap,
  bawaanId,
  onPilihPreset,
  onTersimpan,
  onPakaiLengkap,
  onDihapus,
}: TabKolomProps) {
  /** Preset kolom = pengaturan global super_admin EFEKTIF (mati saat
   *  bertindak; lapis pertahanan kedua karena dialog pun hanya untuk
   *  super_admin). */
  const { efektifSuper: bolehUbah } = useLembagaAktif();
  const [editId, setEditId] = useState<number | null>(presetAwal?.id ?? null);
  const [nama, setNama] = useState(presetAwal?.nama ?? '');
  /** Status bawaan = bagian form (tersimpan via Simpan, boleh dikosongkan). */
  const [bawaan, setBawaan] = useState(presetAwal ? presetAwal.id === bawaanId : false);
  const awalBawaan = useRef(presetAwal ? presetAwal.id === bawaanId : false);
  /** Input nama preset terlihat: untuk preset baru, atau saat mode ubah nama. */
  const [ubahNama, setUbahNama] = useState(false);
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
  const [, setBusy] = useState(false);
  /** Perataan kolom tabel (satu nilai per kolom, bukan per preset). */
  const [align, setAlign] = useState<Partial<Record<string, AlignKolom>>>({});
  /** Acuan align tersimpan (kanonik) untuk deteksi kotor. */
  const alignAwalRef = useRef<string>(kanonAlign({}));
  /** Nama header kustom per kolom (kosong = label bawaan). */
  const [label, setLabel] = useState<Record<string, string>>(() =>
    bersihLabel(presetAwal?.label ?? labelAwal, fieldKeys),
  );
  /** Acuan label tersimpan (kanonik) untuk deteksi kotor. */
  const awalLabelRef = useRef<string>(kanonLabel(bersihLabel(presetAwal?.label ?? labelAwal, fieldKeys)));
  /** Baris yang sedang diedit namanya (null = tidak ada). */
  const [editLabelKey, setEditLabelKey] = useState<string | null>(null);
  const [drafLabel, setDrafLabel] = useState('');
  const laporKotor = useBagian('kolom', () => void simpanBagian());
  /** Acuan "tersimpan" untuk mendeteksi perubahan belum disimpan. */
  const awalNamaRef = useRef(presetAwal?.nama ?? '');
  const awalKolomRef = useRef(kolom);
  const kotorPreset = useCallback(() => (
    nama !== awalNamaRef.current ||
    bawaan !== awalBawaan.current ||
    kolom.length !== awalKolomRef.current.length ||
    kolom.some((k, i) => k !== awalKolomRef.current[i])
  ), [nama, bawaan, kolom]);
  const kotorAlign = useCallback(
    () => kanonAlign(align) !== alignAwalRef.current,
    [align],
  );
  const kotorLabel = useCallback(
    () => kanonLabel(label) !== awalLabelRef.current,
    [label],
  );
  useEffect(() => {
    laporKotor(kotorPreset() || kotorAlign() || kotorLabel());
  }, [kotorPreset, kotorAlign, kotorLabel, laporKotor]);
  /** Mode Lengkap (tanpa preset): perubahan disimpan sebagai "Lengkap kustom". */
  const modeLengkap = mulaiLengkap && editId === null;
  /** Mode preset baru: belum punya id, nama wajib diisi saat Simpan. */
  const modeBaru = editId === null && !mulaiLengkap;
  const tampilNama = ubahNama || modeBaru;

  /** Label tampilan kolom: label di kode bisa berupa nama kolom mentah
   *  (`nama_lengkap`), jadi dilewatkan humanizer agar sama dengan header
   *  tabel. `fieldKeys` dipakai bila label kosong. */
  const labelOf = useCallback(
    (f: ExcelField) => labelKolom(f.label) || labelKolom(f.key),
    [],
  );
  /** Pencarian mencocokkan teks yang tampil maupun nama kolom aslinya, jadi
   *  mengetik `nama_lengkap` tetap menemukan kolom "Nama Lengkap". */
  const kolomCocok = useMemo(() => {
    const q = cariKolom.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(
      (f) => labelOf(f).toLowerCase().includes(q) || f.key.toLowerCase().includes(q),
    );
  }, [fields, cariKolom, labelOf]);
  const semuaTampilTerpilih = kolomCocok.length > 0 && kolomCocok.every((f) => kolom.includes(f.key));
  /** Atribut field per key (untuk daftar kolom berurutan). */
  const fieldByKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  /** Dua grup kolom: tampil (urutan `kolom`) dan tersembunyi, keduanya
   *  tersaring pencarian. `indeks` = posisi asli di `kolom`, jadi pengurutan
   *  lewat panah tetap benar walau daftar sedang tersaring. */
  const barisKolom = useMemo(() => {
    const cocok = (f: ExcelField) => kolomCocok.includes(f);
    const tampil = kolom
      .map((k, i) => ({ f: fieldByKey.get(k), i }))
      .filter((x): x is { f: ExcelField; i: number } => !!x.f && cocok(x.f))
      .map(({ f, i }) => ({ f, indeks: i }));
    const sembunyi = kolomCocok.filter((f) => !kolom.includes(f.key));
    return { tampil, sembunyi };
  }, [kolom, kolomCocok, fieldByKey]);

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
        return [...prev, ...kolomCocok.filter((f) => !ada.has(f.key)).map((f) => f.key)];
      }
      const buang = new Set(kolomCocok.map((f) => f.key));
      return prev.filter((k) => !buang.has(k));
    });
  }

  /** Siklus perataan satu kolom: tengah → kiri → kanan → tengah (absen).
   *  Nilai tengah tidak disimpan (ikut preferensi pribadi pengguna). */
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
    await simpanBagian();
  }

  /** Simpan section ini: perataan + nama header dulu, lalu preset
   *  (ketiganya independen). */
  async function simpanBagian() {
    await simpanAlign();
    await simpanPreset();
  }

  /** Simpan perataan kolom (merge: hanya kunci `align` yang dikirim). */
  async function simpanAlign() {
    if (!kotorAlign()) return;
    const bersih: AlignKolomApi = {};
    for (const [k, v] of Object.entries(align)) {
      if (v !== undefined && fieldKeys.has(k)) bersih[k] = v;
    }
    try {
      await simpanToolbarPreset(tableKey, undefined, undefined, undefined, bersih);
      alignAwalRef.current = kanonAlign(bersih);
      kabariToolbar(tableKey);
      laporKotor(kotorPreset());
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  /** Simpan bagian ini (dipanggil form maupun tombol Simpan terpadu). */
  async function simpanPreset() {
    if (kolom.length === 0) {
      toast.error('Pilih minimal satu kolom.');
      return;
    }
    // Nama header kustom yang ikut tersimpan (null = tanpa kustom).
    const labelSimpan = bersihLabel(label, fieldKeys);
    const labelKirim = Object.keys(labelSimpan).length > 0 ? labelSimpan : null;
    if (!nama.trim()) {
      // Mode Lengkap tanpa nama: terapkan langsung ke tabel, tanpa membuat preset.
      if (modeLengkap) {
        onPakaiLengkap(kolom, labelSimpan);
        // Sudah diterapkan: preset + label kembali bersih.
        awalLabelRef.current = kanonLabel(labelSimpan);
        laporKotor(kotorAlign());
        return;
      }
      toast.error('Nama preset wajib diisi.');
      return;
    }
    setBusy(true);
    try {
      let saved: PresetTabel | undefined;
      let pesan = 'Preset kolom disimpan.';
      if (editId) {
        const res = await updatePresetTabel(editId, { nama: nama.trim(), kolom, label: labelKirim });
        saved = res.data[0];
        pesan = res.pesan;
      } else {
        const res = await createPresetTabel({
          table_key: tableKey,
          nama: nama.trim(),
          kolom,
          label: labelKirim,
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
      setUbahNama(false);
      await onTersimpan(saved.id);
      // Induk me-remount section ini; laporkan sisa kotor (perataan/label).
      laporKotor(kotorAlign() || kotorLabel());
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
      setLabel({});
      await onDihapus();
    } catch (e2) {
      toast.error(errorMessage(e2));
    }
  }

  /** Satu baris kolom; baris tersembunyi diklik untuk menampilkan. */
  function renderBaris(f: ExcelField, tampil: boolean, indeks: number | null) {
    const teks = labelOf(f);
    const kustom = label[f.key] !== undefined;
    return (
      <div
        key={f.key}
        onClick={() => togolKolom(f.key, !tampil)}
        onDragOver={tampil ? (e) => { e.preventDefault(); setTujuanSeret(f.key); } : undefined}
        onDrop={tampil ? (e) => { e.preventDefault(); jatuhSeret(f.key, false); } : undefined}
        onDragEnd={() => {
          seretRef.current = null;
          setTujuanSeret(null);
        }}
        className={cn(
          'flex cursor-pointer items-center gap-1.5 border-b px-1.5 py-0.5 last:border-0 transition-colors',
          tampil ? 'hover:bg-accent/30' : 'bg-muted/30 text-muted-foreground hover:bg-accent/20',
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
              onClick={(e) => e.stopPropagation()}
              onDragStart={(e) => {
                seretRef.current = f.key;
                e.dataTransfer.effectAllowed = 'move';
              }}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                e.preventDefault();
                geserTerpilih(indeks, e.key === 'ArrowUp' ? -1 : 1);
              }}
              className="grid size-5 shrink-0 cursor-grab place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
            >
              <GripVertical size={14} />
            </span>
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {indeks + 1}.
            </span>
          </>
        ) : (
          <>
            <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground">
              <Plus size={12} />
            </span>
            <span aria-hidden className="w-6 shrink-0" />
          </>
        )}
        <Checkbox
          id={`chk_kolom_${tableKey}_${f.key}`}
          checked={tampil}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={(c) => togolKolom(f.key, !!c)}
          aria-label={tampil ? `Sembunyikan ${teks}` : `Tampilkan ${teks}`}
        />
        {editLabelKey === f.key ? (
          <span className="flex min-w-0 flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Input
              id={`input_label_kolom_${tableKey}_${f.key}`}
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
              id={`btn_simpan_label_kolom_${tableKey}_${f.key}`}
              aria-label={`Simpan nama header ${teks}`}
              title="Simpan (kosong = kembali ke bawaan)"
              onClick={() => simpanLabelBaris(f.key)}
              className="grid size-5 shrink-0 place-items-center rounded text-foreground hover:bg-accent"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              id={`btn_batal_label_kolom_${tableKey}_${f.key}`}
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
              title={kustom ? `${teks} → ${label[f.key]}` : teks}
            >
              {label[f.key] ?? teks}
            </span>
            <button
              type="button"
              id={`btn_label_kolom_${tableKey}_${f.key}`}
              aria-label={kustom ? `Ubah nama header ${teks} (kini: ${label[f.key]})` : `Ubah nama header ${teks}`}
              title={kustom ? `Nama kustom: ${label[f.key]} — klik untuk ubah` : 'Ubah nama header'}
              onClick={(e) => { e.stopPropagation(); setEditLabelKey(f.key); setDrafLabel(label[f.key] ?? ''); }}
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded hover:bg-accent hover:text-foreground',
                kustom ? 'text-foreground' : 'text-muted-foreground/60',
              )}
            >
              <Pencil size={12} />
            </button>
          </>
        )}
        {(() => {
          const a = align[f.key] ?? 'center';
          const Ikon = a === 'left' ? AlignLeft : a === 'right' ? AlignRight : AlignCenter;
          const label = a === 'left' ? 'kiri' : a === 'right' ? 'kanan' : 'tengah';
          return (
            <button
              type="button"
              id={`btn_align_kolom_${tableKey}_${f.key}`}
              aria-label={`Perataan ${teks}: ${label} — klik untuk ganti`}
              title={`Perataan: ${label} — klik untuk ganti`}
              onClick={(e) => { e.stopPropagation(); sikulAlign(f.key); }}
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded hover:bg-accent hover:text-foreground',
                a === 'center' ? 'text-muted-foreground/60' : 'text-foreground',
              )}
            >
              <Ikon size={14} />
            </button>
          );
        })()}
      </div>
    );
  }

  if (!bolehUbah) {
    return (
      <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
        Hanya super_admin yang dapat mengubah preset kolom.
      </p>
    );
  }

  /** Nilai dropdown: id preset, atau penanda mode (baru/lengkap/kustom). */
  const nilaiPreset = editId !== null
    ? String(editId)
    : modeBaru
      ? PRESET_BARU
      : kustomAwal
        ? PRESET_KUSTOM
        : PRESET_LENGKAP;

  return (
    <form
      id={`form_preset_kolom_${tableKey}`}
      onSubmit={simpan}
      className="flex flex-col gap-2"
    >
      {/* Bar preset: pilih preset aktif, klaim bawaan, tambah, ubah nama, hapus. */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
        <span className="shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Preset
        </span>
        <div className="min-w-44 flex-1">
          <Select
            value={nilaiPreset}
            onValueChange={(v) => {
              if (v === PRESET_BARU || v === PRESET_KUSTOM) return;
              if (v === PRESET_LENGKAP) {
                onPilihLengkap();
                return;
              }
              const p = presets.find((x) => x.id === Number(v));
              if (p) onPilihPreset(p);
            }}
          >
            <SelectTrigger id={`select_preset_${tableKey}`} size="sm" className="w-full" aria-label="Preset aktif">
              <SelectValue placeholder="Pilih preset" />
            </SelectTrigger>
            <SelectContent>
              {modeBaru ? <SelectItem value={PRESET_BARU}>Preset baru (belum disimpan)</SelectItem> : null}
              <SelectItem value={PRESET_LENGKAP}>Lengkap (semua kolom)</SelectItem>
              {kustomAwal ? <SelectItem value={PRESET_KUSTOM}>Lengkap (kustom)</SelectItem> : null}
              {presets.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.id === bawaanId ? `${p.nama} (bawaan)` : p.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tampilNama ? (
          <div className="flex min-w-44 flex-[2] items-center gap-1">
            <Input
              id={`input_nama_preset_${tableKey}`}
              autoFocus
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              maxLength={50}
              placeholder={modeBaru ? 'Nama preset baru…' : 'Nama preset'}
              aria-label="Nama preset"
              className="h-8 flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!modeBaru) setUbahNama(false);
                }
                if (e.key === 'Escape' && !modeBaru) setUbahNama(false);
              }}
            />
            {!modeBaru ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    id={`btn_selesai_ubah_nama_${tableKey}`}
                    aria-label="Selesai ubah nama"
                    onClick={() => setUbahNama(false)}
                  >
                    <Check size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Selesai ubah nama (tersimpan lewat Simpan)</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={bawaan ? 'secondary' : 'ghost'}
              size="icon-sm"
              id={`btn_preset_bawaan_${tableKey}`}
              aria-label={bawaan ? 'Preset bawaan aktif' : 'Jadikan preset bawaan'}
              aria-pressed={bawaan}
              disabled={modeLengkap}
              onClick={() => setBawaan((v) => !v)}
            >
              <Pin size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Preset ini dipakai otomatis bila user belum memilih preset</p>
          </TooltipContent>
        </Tooltip>
        <Button
          id={`btn_preset_baru_${tableKey}`}
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onPilihPreset(null)}
        >
          <Plus size={14} /> Baru
        </Button>
        {editId !== null && !ubahNama ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                id={`btn_ubah_nama_preset_${tableKey}`}
                aria-label="Ubah nama preset"
                onClick={() => setUbahNama(true)}
              >
                <Pencil size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ubah nama preset</p>
            </TooltipContent>
          </Tooltip>
        ) : null}
        {editId ? (
          <ConfirmDelete
            title="Hapus preset?"
            description={`Preset "${nama}" akan dihapus untuk tabel ini.`}
            onConfirm={() => void hapus()}
            tip="Hapus preset"
          >
            <Button
              id={`btn_hapus_preset_${tableKey}`}
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              aria-label="Hapus preset"
            >
              <Trash2 size={14} />
            </Button>
          </ConfirmDelete>
        ) : null}
      </div>

      {/* Pencarian + aksi massal untuk hasil yang tersaring. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1 sm:max-w-56">
          <Input
            id={`input_cari_kolom_${tableKey}`}
            value={cariKolom}
            onChange={(e) => setCariKolom(e.target.value)}
            onKeyDown={(e) => {
              // Enter di pencarian tidak boleh men-submit form (simpan preset).
              if (e.key === 'Enter') e.preventDefault();
            }}
            placeholder="Cari kolom…"
            aria-label="Cari kolom"
            className="h-8 w-full pr-7"
          />
          {cariKolom !== '' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  id={`btn_hapus_cari_kolom_${tableKey}`}
                  aria-label="Bersihkan pencarian"
                  onClick={() => setCariKolom('')}
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
          {kolom.length} tampil · {fields.length - kolom.length} tersembunyi
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                id={`btn_pilih_semua_kolom_${tableKey}`}
                type="button"
                disabled={kolomCocok.length === 0 || semuaTampilTerpilih}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => aturSemuaTampil(true)}
              >
                Tampilkan semua
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{cariKolom.trim() ? 'Tampilkan semua kolom hasil pencarian' : 'Tampilkan semua kolom'}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                id={`btn_kosongkan_kolom_${tableKey}`}
                type="button"
                disabled={kolomCocok.length === 0 || kolomCocok.every((f) => !kolom.includes(f.key))}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => aturSemuaTampil(false)}
              >
                Sembunyikan
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{cariKolom.trim() ? 'Sembunyikan kolom hasil pencarian' : 'Sembunyikan semua kolom'}</p>
            </TooltipContent>
          </Tooltip>
        </span>
      </div>

      {/* Dua grup: tampil (berurut) dan tersembunyi. Header grup menempel di
          atas area gulir dialog agar konteks tetap terlihat. */}
      <div className="rounded-md border">
        {barisKolom.tampil.length === 0 && barisKolom.sembunyi.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">Tidak ada kolom cocok.</p>
        ) : (
          <>
            {barisKolom.tampil.length > 0 ? (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-card/95 px-2 py-1 backdrop-blur-sm">
                  <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Tampil · {barisKolom.tampil.length}
                  </span>
                  <span className="text-[11px] text-muted-foreground">seret: urutan · ikon: perataan & nama</span>
                </div>
                {barisKolom.tampil.map(({ f, indeks }) => renderBaris(f, true, indeks))}
              </>
            ) : null}
            {barisKolom.sembunyi.length > 0 ? (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-card/95 px-2 py-1 backdrop-blur-sm">
                  <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Tersembunyi · {barisKolom.sembunyi.length}
                  </span>
                  <span className="text-[11px] text-muted-foreground">klik untuk menampilkan</span>
                </div>
                {barisKolom.sembunyi.map((f) => renderBaris(f, false, null))}
              </>
            ) : null}
          </>
        )}
      </div>
    </form>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { errorMessage } from '../../api/client';
import {
  createPresetTabel,
  deletePresetTabel,
  updatePresetTabel,
  type PresetTabel,
} from '../../api/preset';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { labelKolom, bersihLabel, kanonLabel } from '@/lib/labelKolom';
import { useAksiBagian, useBagian } from '@/components/kelolaHalaman/kotor';
import { muatToolbarPreset, simpanToolbarPreset, type AlignKolomApi } from '@/api/toolbarPreset';
import { AlignCenter, AlignLeft, AlignRight } from '@/icons';
import TombolIkon from '@/components/TombolIkon';
import { bacaAlign, kabariToolbar, type AlignKolom } from './jenis';

/** Bandingkan peta perataan tanpa peduli urutan kunci. */
function kanonAlign(o: Partial<Record<string, AlignKolom>>): string {
  return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
}
import { useLembagaAktif } from '@/lembagaAktif';
import ConfirmDelete from '@/components/ConfirmDelete';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Check, Eye, EyeOff, GripVertical, Pencil, Plus, Trash2, X } from '@/icons';
import { toast } from 'sonner';
import type { ExcelField } from '../excel/types';

/** Nilai khusus di dropdown preset: bukan id preset, tapi mode semua kolom. */
const PRESET_LENGKAP = '__lengkap';
/** Nilai khusus: susunan "Lengkap kustom" yang tersimpan (bukan preset). */
const PRESET_KUSTOM = '__kustom';
/** Nilai khusus: preset baru yang belum disimpan. */
const PRESET_BARU = '__baru';

export interface TabKolomProps {
  tableKey: string;
  fields: ExcelField[];
  fieldKeys: Set<string>;
  presets: PresetTabel[];
  /** Susunan "Lengkap kustom" tersimpan (null = semua kolom). */
  kolomAwal?: string[] | null;
  /** Nama header kustom susunan yang dibuka (milik induk; diedit di section
   *  Nama & Perataan, dipakai section ini saat simpan preset). */
  label: Record<string, string>;
  setLabel: Dispatch<SetStateAction<Record<string, string>>>;
  /** Acuan label tersimpan (milik induk) untuk deteksi kotor. */
  labelAwalRef: { current: string };
  /** Preset yang dibuka untuk diedit (null = preset baru). Induk me-remount
   *  tab setiap kali preset awal berubah lewat `key`. */
  presetAwal: PresetTabel | null;
  /** Buka dengan semua kolom terpilih (entri "Lengkap") agar bisa
   *  dimodifikasi lalu disimpan sebagai preset baru. */
  mulaiLengkap: boolean;
  /** Minta induk membuka entri "Lengkap" (remount + reset state). */
  onPilihLengkap: () => void;
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
 *  seret untuk menggeser) dan kolom tersembunyi (klik untuk menampilkan).
 *  Nama header kustom & perataan dikelola di section Nama & Perataan; state
 *  nama (`label`) diangkat ke induk agar simpan preset menyertakannya. */
export default function TabKolom({
  tableKey,
  fields,
  fieldKeys,
  presets,
  kolomAwal = null,
  label,
  setLabel,
  labelAwalRef,
  presetAwal,
  mulaiLengkap,
  onPilihLengkap,
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
  /** Perataan kolom: per TABEL (bukan per preset), jadi tidak ikut berubah
   *  saat preset berganti. Dulu tinggal di tab Nama & Perataan terpisah. */
  const [align, setAlign] = useState<Partial<Record<string, AlignKolom>>>({});
  const alignAwalRef = useRef<string>(kanonAlign({}));
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
  useEffect(() => { void muatAlign(); }, [muatAlign]);
  const kotorAlign = useCallback(() => kanonAlign(align) !== alignAwalRef.current, [align]);
  /** Siklus perataan: tengah → kiri → kanan → tengah (absen = ikut bawaan). */
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
  /** Ubah nama header satu baris; mentah hingga blur supaya spasi di tengah
   *  tidak terpotong saat mengetik. */
  function ubahLabelBaris(key: string, nilai: string) {
    const t = nilai.slice(0, 60);
    setLabel((prev) => (prev[key] === t ? prev : { ...prev, [key]: t }));
  }
  /** Rapikan saat blur: trim, kosong = kembali ke label bawaan. */
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
  const [, setBusy] = useState(false);
  const laporKotor = useBagian('kolom', () => simpanPreset());
  /** Acuan "tersimpan" untuk mendeteksi perubahan belum disimpan. */
  const awalNamaRef = useRef(presetAwal?.nama ?? '');
  const awalKolomRef = useRef(kolom);
  const kotorPreset = useCallback(() => (
    nama !== awalNamaRef.current ||
    kolom.length !== awalKolomRef.current.length ||
    kolom.some((k, i) => k !== awalKolomRef.current[i])
  ), [nama, kolom]);
  const kotorLabel = useCallback(
    () => kanonLabel(label) !== labelAwalRef.current,
    [label, labelAwalRef],
  );
  useEffect(() => {
    laporKotor(kotorPreset() || kotorLabel() || kotorAlign());
  }, [kotorPreset, kotorLabel, kotorAlign, laporKotor]);
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
  const semuaTampilTerpilih = fields.length > 0 && fields.every((f) => kolom.includes(f.key));
  /** Atribut field per key (untuk daftar kolom berurutan). */
  const fieldByKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  /** Dua grup kolom: tampil (urutan `kolom`) dan tersembunyi. `indeks` =
   *  posisi asli di `kolom`. */
  const barisKolom = useMemo(() => {
    const tampil = kolom
      .map((k, i) => ({ f: fieldByKey.get(k), i }))
      .filter((x): x is { f: ExcelField; i: number } => !!x.f)
      .map(({ f, i }) => ({ f, indeks: i }));
    const sembunyi = fields.filter((f) => !kolom.includes(f.key));
    return { tampil, sembunyi };
  }, [kolom, fields, fieldByKey]);

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
        return [...prev, ...fields.filter((f) => !ada.has(f.key)).map((f) => f.key)];
      }
      return [];
    });
  }
  /** Togol tampil/sembunyi semua: satu tombol di kanan judul section.
   *  Ikon di-memo agar identitasnya stabil (hindari efek daftar ulang tiap
   *  render → loop setState). */
  const ikonTogol = useMemo(
    () => (semuaTampilTerpilih ? <EyeOff /> : <Eye />),
    [semuaTampilTerpilih],
  );
  useAksiBagian('kolom', {
    label: semuaTampilTerpilih ? 'Sembunyikan semua kolom' : 'Tampilkan semua kolom',
    onClick: () => aturSemuaTampil(!semuaTampilTerpilih),
    disabled: fields.length === 0,
    ikon: ikonTogol,
    idTombol: `btn_togol_tampil_kolom_${tableKey}`,
  });

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

  /** Simpan bagian ini (dipanggil form maupun tombol Simpan terpadu).
   *  Kembalikan `false` bila gagal (cangkang membatalkan tutup dialog). */
  async function simpanPreset(): Promise<boolean> {
    if (kolom.length === 0) {
      toast.error('Pilih minimal satu kolom.');
      return false;
    }
    /* Label & perataan kini milik TABEL (`toolbar_preset.label`/`.align`),
       BUKAN preset: preset hanya menyimpan kolom mana yang tampil. Karena itu
       keduanya disimpan sekali di sini, terlepas dari preset yang dipakai -
       dan preset yang dibuat TIDAK mengirim label lagi. */
    const labelSimpan = bersihLabel(label, fieldKeys);
    const alignSimpan: AlignKolomApi = {};
    for (const [k, v] of Object.entries(align)) {
      if (v !== undefined && fieldKeys.has(k)) alignSimpan[k] = v;
    }
    /** Simpan setelan per tabel (label + perataan). Kembalikan false bila gagal. */
    const simpanSetelanTabel = async (): Promise<boolean> => {
      if (!kotorLabel() && !kotorAlign()) return true;
      try {
        await simpanToolbarPreset(tableKey, undefined, undefined, alignSimpan, labelSimpan);
        labelAwalRef.current = kanonLabel(labelSimpan);
        alignAwalRef.current = kanonAlign(alignSimpan);
        kabariToolbar(tableKey);
        return true;
      } catch (err) {
        toast.error(errorMessage(err));
        return false;
      }
    };
    if (!nama.trim()) {
      // Mode Lengkap tanpa nama: terapkan langsung ke tabel, tanpa membuat preset.
      if (modeLengkap) {
        onPakaiLengkap(kolom, {});
        const okSetelan = await simpanSetelanTabel();
        laporKotor(false);
        return okSetelan;
      }
      toast.error('Nama preset wajib diisi.');
      return false;
    }
    setBusy(true);
    try {
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
          // Label bukan milik preset lagi; disimpan per tabel di bawah.
          label: null,
        });
        saved = res.data[0];
        pesan = res.pesan;
      }
      if (!saved) {
        throw new Error('Preset gagal disimpan.');
      }
      // Setelan per tabel (label + perataan) disimpan terpisah dari preset:
      // preset hanya menentukan kolom mana yang TAMPIL.
      if (!(await simpanSetelanTabel())) return false;
      toast.success(pesan);
      setEditId(saved.id);
      setUbahNama(false);
      await onTersimpan(saved.id);
      laporKotor(false);
      return true;
    } catch (e2) {
      toast.error(errorMessage(e2));
      return false;
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
      labelAwalRef.current = kanonLabel({});
      await onDihapus();
    } catch (e2) {
      toast.error(errorMessage(e2));
    }
  }

  /** Satu baris kolom; baris tersembunyi diklik untuk menampilkan.
   *  Kolom TAMPIL juga bisa menyunting nama header + perataan langsung di
   *  barisnya: keduanya setelan per TABEL (bukan per preset), jadi tidak ikut
   *  berubah saat preset berganti - dan menaruhnya sebaris menghapus keperluan
   *  mencocokkan nama kolom antar dua daftar terpisah. Kolom tersembunyi tak
   *  perlu nama tampil karena tak muncul di tabel. */
  function renderBaris(f: ExcelField, tampil: boolean, indeks: number | null) {
    const teks = labelOf(f);
    const kustom = label[f.key] !== undefined;
    const nilaiAlign = align[f.key] ?? 'center';
    const IkonAlign = nilaiAlign === 'left' ? AlignLeft : nilaiAlign === 'right' ? AlignRight : AlignCenter;
    const teksAlign = nilaiAlign === 'left' ? 'kiri' : nilaiAlign === 'right' ? 'kanan' : 'tengah';
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
        <span
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
          title={`Nama bawaan: ${teks}`}
        >
          {teks}
        </span>
        {tampil ? (
          <>
            <Input
              id={`input_nama_tampilan_${tableKey}_${f.key}`}
              value={label[f.key] ?? ''}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => ubahLabelBaris(f.key, e.target.value)}
              onBlur={(e) => rapiLabelBaris(f.key, e.target.value)}
              maxLength={60}
              placeholder="—"
              aria-label={`Nama tampilan ${teks} (kosongkan untuk bawaan)`}
              className={cn('h-6 min-w-0 flex-[1.4] text-xs', !kustom && 'text-muted-foreground')}
            />
            <TombolIkon
              tip={`Perataan: ${teksAlign} — klik untuk ganti`}
              size="icon-xs"
              variant="ghost"
              id={`btn_align_tampilan_${tableKey}_${f.key}`}
              aria-label={`Perataan ${teks}: ${teksAlign} — klik untuk ganti`}
              /* Jangan teruskan ke baris: klik baris = togol tampil/sembunyi, jadi
                 tanpa ini menekan tombol perataan malah menyembunyikan kolomnya. */
              onClick={(e) => {
                e.stopPropagation();
                sikulAlign(f.key);
              }}
              className={cn(
                'shrink-0 rounded hover:bg-accent hover:text-foreground',
                nilaiAlign === 'center' ? 'text-muted-foreground/60' : 'text-foreground',
              )}
            >
              <IkonAlign size={14} />
            </TombolIkon>
          </>
        ) : null}
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
      {/* Bar preset: pilih preset aktif, tambah, ubah nama, hapus. */}
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
                  {p.nama}
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
              className="h-[26px] flex-1"
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

      {/* Dua grup: tampil (berurut) dan tersembunyi. Header grup menempel di
          atas area gulir dialog agar konteks tetap terlihat. */}
      <div className="rounded-md border">
        {barisKolom.tampil.length === 0 && barisKolom.sembunyi.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">Belum ada kolom.</p>
        ) : (
          <>
            {barisKolom.tampil.length > 0 ? (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-card/95 px-2 py-1 backdrop-blur-sm">
                  <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Tampil · {barisKolom.tampil.length}
                  </span>
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

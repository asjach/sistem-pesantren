import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { errorMessage } from '../api/client';
import {
  createPresetTabel,
  deletePresetTabel,
  listPresetTabel,
  setPresetAktif,
  updatePresetTabel,
  type PresetTabel,
} from '../api/preset';
import { listLembaga, type Lembaga } from '../api/master';
import { useAuth } from '../auth/AuthContext';
import type { ExcelField } from './ExcelTable';
import MultiSelect from './MultiSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ConfirmDelete from '@/components/ConfirmDelete';
import { Checkbox } from '@/components/ui/checkbox';
import { useGridPrefs, type AlignName } from '@/components/GridPrefs';
import { useStandarTampilan } from '@/standarTampilan';
import { cn } from '@/lib/utils';
import { AlignCenter, AlignLeft, AlignRight, X } from '@/icons';
import { toast } from 'sonner';

const LENGKAP = '_lengkap';
const KELOLA = '_kelola';

/** API imperatif PresetKolom untuk dipakai pemanggil (mis. context menu header
 *  tabel: tampil/sembunyikan kolom pada preset tanpa membuka dialog). */
export interface PresetKolomApi {
  presets: PresetTabel[];
  toggleKolom: (presetId: number, key: string, tampil: boolean) => Promise<void>;
}

/** Tombol segmented perataan kolom (kiri/tengah/kanan) untuk satu field.
 *  Perataan bersifat global per field (berlaku di semua tabel), jadi
 *  langsung tersimpan saat diklik — tidak menunggu Simpan preset. */
function AlignToggle({
  fieldKey,
  sumber,
  align,
  onSet,
}: {
  fieldKey: string;
  /** Sumber kontrol (semua/terpilih) — bagian dari id agar unik di DOM. */
  sumber: 'semua' | 'terpilih';
  align: AlignName;
  onSet: (fieldKey: string, a: AlignName) => void;
}) {
  const opsi = [
    { nilai: 'left' as const, id: 'kiri', label: 'Kiri', Icon: AlignLeft },
    { nilai: 'center' as const, id: 'tengah', label: 'Tengah', Icon: AlignCenter },
    { nilai: 'right' as const, id: 'kanan', label: 'Kanan', Icon: AlignRight },
  ];
  return (
    <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label={`Perataan ${fieldKey}`}>
      {opsi.map(({ nilai, id, label, Icon }) => (
        <button
          key={nilai}
          id={`btn_align_${id}_${sumber}_${fieldKey}`}
          type="button"
          title={`Rata ${label.toLowerCase()} (berlaku semua tabel)`}
          aria-label={`Rata ${label.toLowerCase()}`}
          aria-pressed={align === nilai}
          onClick={() => onSet(fieldKey, nilai)}
          className={cn(
            'grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            align === nilai && 'bg-accent text-foreground',
          )}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
}

/** Combobox preset kolom tampilan tabel + dialog kelola (tersimpan di DB per lembaga). */
export default function PresetKolom({
  tableKey,
  fields,
  onApply,
  apiRef,
}: {
  tableKey: string;
  fields: ExcelField[];
  onApply: (keys: string[] | null, label?: Record<string, string> | null) => void;
  apiRef?: MutableRefObject<PresetKolomApi | null>;
}) {
  const { user: me } = useAuth();
  const isPesantren = me?.roles.some((r) => r.name === 'super_admin')
    || ((me?.roles.some((r) => r.name === 'admin') ?? false) && (me?.lembagas?.length ?? 0) === 0);

  const [presets, setPresets] = useState<PresetTabel[]>([]);
  const [aktifId, setAktifId] = useState<number | null>(null);
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [busy, setBusy] = useState(false);

  const [dokOpen, setDokOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nama, setNama] = useState('');
  const [lembagaIds, setLembagaIds] = useState<string[]>([]);
  const [kolom, setKolom] = useState<Set<string>>(new Set());
  /** Nama header kustom per key kolom (kosong = label bawaan). */
  const [labelKustom, setLabelKustom] = useState<Record<string, string>>({});
  const [bolehUbah, setBolehUbah] = useState(true);
  const [cariKolom, setCariKolom] = useState('');

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const editPreset = useMemo(
    () => (editId === null ? null : presets.find((p) => p.id === editId) ?? null),
    [editId, presets],
  );
  const { align, setAlign } = useGridPrefs();
  const { tampilan: standar, isPribadi, tandai, hapus: hapusPribadi, merekam, simpanKeStandar } = useStandarTampilan();
  /** Preset aktif bawaan dari standar lembaga (nama), bila user belum memilih. */
  const stdNama = standar?.presetAktif?.[tableKey] ?? null;
  /** Tabel berkolom sangat banyak (mis. Santri 72 kolom) memakai dialog tinggi
   *  penuh agar panel-panelnya punya area gulir sendiri. */
  const banyakKolom = fields.length > 30;
  const kolomTampil = useMemo(() => {
    const q = cariKolom.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter((f) => f.label.toLowerCase().includes(q));
  }, [fields, cariKolom]);
  const terpilih = useMemo(() => fields.filter((f) => kolom.has(f.key)), [fields, kolom]);
  const semuaTampilTerpilih = kolomTampil.length > 0 && kolomTampil.every((f) => kolom.has(f.key));

  function togolKolom(key: string, aktif: boolean) {
    setKolom((prev) => {
      const next = new Set(prev);
      if (aktif) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function togolSemuaTampil() {
    setKolom((prev) => {
      const next = new Set(prev);
      if (semuaTampilTerpilih) {
        for (const f of kolomTampil) next.delete(f.key);
      } else {
        for (const f of kolomTampil) next.add(f.key);
      }
      return next;
    });
  }

  const terapkan = useCallback((preset: PresetTabel | null) => {
    if (!preset) {
      onApply(null, null);
      return;
    }
    const keys = preset.kolom.filter((k) => fieldKeys.has(k));
    const label: Record<string, string> = {};
    for (const [k, v] of Object.entries(preset.label ?? {})) {
      if (fieldKeys.has(k) && v.trim() !== '') label[k] = v.trim();
    }
    onApply(keys.length > 0 ? keys : null, Object.keys(label).length > 0 ? label : null);
  }, [fieldKeys, onApply]);

  const muat = useCallback(async (pilihId?: number | null) => {
    try {
      const res = await listPresetTabel(tableKey);
      const daftar = res.data.presets;
      setPresets(daftar);
      const targetId = pilihId !== undefined ? pilihId : res.data.aktif_preset_id;
      let target = targetId === null ? null : daftar.find((p) => p.id === targetId) ?? null;
      // Belum dipilih user → pakai preset aktif dari standar lembaga (bila ada).
      if (target === null && stdNama && !isPribadi(`preset.${tableKey}`)) {
        target = daftar.find((p) => p.nama === stdNama) ?? null;
      }
      setAktifId(target?.id ?? null);
      terapkan(target);
    } catch (e) {
      setPresets([]);
      setAktifId(null);
      terapkan(null);
      toast.error(errorMessage(e));
    }
  }, [tableKey, terapkan, stdNama, isPribadi]);

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  // Standar lembaga datang belakangan (setelah muat awal) → terapkan ulang.
  useEffect(() => {
    if (stdNama) void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stdNama]);

  /** Tampilkan/sembunyikan satu kolom pada preset (dipakai context menu
   *  header tabel): simpan langsung ke DB, lalu segarkan + terapkan ulang. */
  const toggleKolomPreset = useCallback(async (presetId: number, key: string, tampil: boolean) => {
    const p = presets.find((x) => x.id === presetId);
    if (!p) return;
    const next = new Set(p.kolom);
    if (tampil) next.add(key);
    else next.delete(key);
    if (next.size === 0) {
      toast.error('Preset harus menyisakan minimal satu kolom.');
      return;
    }
    try {
      await updatePresetTabel(presetId, { kolom: [...next] });
      toast.success(tampil ? 'Kolom ditampilkan pada preset.' : 'Kolom disembunyikan dari preset.');
      await muat(aktifId);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [presets, aktifId, muat]);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = { presets, toggleKolom: toggleKolomPreset };
  }, [apiRef, presets, toggleKolomPreset]);

  useEffect(() => {
    listLembaga({ per_page: 100 }).then((p) => setLembagas(p.data)).catch(() => {});
  }, []);

  async function pilihPreset(v: string) {
    if (v === KELOLA) {
      bukaKelola(null);
      return;
    }
    const id = v === LENGKAP ? null : Number(v);
    const target = id === null ? null : presets.find((p) => p.id === id) ?? null;
    setAktifId(target?.id ?? null);
    terapkan(target);
    if (merekam) {
      // Bertindak sebagai lembaga → preset aktif ikut disimpan ke standar lembaga.
      hapusPribadi(`preset.${tableKey}`);
      simpanKeStandar({ presetAktif: { [tableKey]: target?.nama ?? null } });
      return;
    }
    // Pilihan user menang atas preset aktif dari standar lembaga.
    tandai(`preset.${tableKey}`);
    try {
      await setPresetAktif(tableKey, target?.id ?? null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  function bukaKelola(preset: PresetTabel | null) {
    setEditId(preset?.id ?? null);
    setNama(preset?.nama ?? '');
    setLembagaIds(
      preset
        ? (preset.lembaga_id === null ? [] : [String(preset.lembaga_id)])
        : (isPesantren ? [] : lembagas.map((l) => String(l.id))),
    );
    setKolom(new Set(preset ? preset.kolom.filter((k) => fieldKeys.has(k)) : []));
    const awal: Record<string, string> = {};
    for (const [k, v] of Object.entries(preset?.label ?? {})) {
      if (fieldKeys.has(k)) awal[k] = v;
    }
    setLabelKustom(awal);
    setBolehUbah(isPesantren || preset === null || preset.lembaga_id !== null);
    setCariKolom('');
    setDokOpen(true);
  }

  const labelPreset = useCallback((p: PresetTabel) => (
    p.lembaga_id === null ? p.nama : `${p.nama} (${p.lembaga?.kode ?? p.lembaga?.nama ?? p.lembaga_id})`
  ), []);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!bolehUbah) return;
    if (!nama.trim() || kolom.size === 0) return;
    if (lembagaIds.length === 0) return;
    setBusy(true);
    try {
      const label: Record<string, string> = {};
      for (const [k, v] of Object.entries(labelKustom)) {
        if (kolom.has(k) && v.trim() !== '') label[k] = v.trim().slice(0, 60);
      }
      const labelKirim = Object.keys(label).length > 0 ? label : null;
      let saved: PresetTabel | undefined;
      let pesan = 'Preset kolom disimpan.';
      if (editId) {
        const res = await updatePresetTabel(editId, { nama: nama.trim(), kolom: [...kolom], label: labelKirim });
        saved = res.data[0];
        pesan = res.pesan;
      } else {
        const res = await createPresetTabel({
          table_key: tableKey,
          nama: nama.trim(),
          lembaga_ids: lembagaIds.map(Number),
          kolom: [...kolom],
          label: labelKirim,
        });
        saved = res.data[0];
        pesan = res.pesan;
      }
      if (!saved) {
        throw new Error('Belum ada lembaga tujuan untuk preset ini.');
      }
      toast.success(pesan);
      setEditId(saved.id);
      await muat(saved.id);
      await setPresetAktif(tableKey, saved.id);
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
      setKolom(new Set());
      setLabelKustom({});
      await muat(null);
      await setPresetAktif(tableKey, null);
    } catch (e2) {
      toast.error(errorMessage(e2));
    }
  }

  return (
    <>
      <Select value={aktifId === null ? LENGKAP : String(aktifId)} onValueChange={(v) => void pilihPreset(v)}>
        <SelectTrigger
          id={`select_preset_kolom_${tableKey}`}
          title="Preset kolom tampilan"
          aria-label="Preset kolom tampilan"
          className="w-44"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={LENGKAP}>Lengkap</SelectItem>
            {presets.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{labelPreset(p)}</SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value={KELOLA}>Kelola preset…</SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={dokOpen} onOpenChange={setDokOpen}>
        <DialogContent
          className={cn(
            'sm:max-w-4xl',
            banyakKolom && 'lg:max-w-6xl lg:h-[85dvh] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden',
          )}
        >
          <DialogHeader>
            <DialogTitle>Kelola preset kolom</DialogTitle>
            <DialogDescription>
              Preset menyimpan pilihan kolom untuk tabel ini. Isi nama header pada kolom terpilih
              untuk mengganti tampilannya (kosongkan = nama bawaan). Perataan kolom berlaku global
              untuk field tersebut di semua halaman (bawaan: kiri).
            </DialogDescription>
          </DialogHeader>

          <form
            id={`form_preset_kolom_${tableKey}`}
            onSubmit={simpan}
            className={cn('flex flex-col gap-3', banyakKolom && 'lg:min-h-0')}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`input_nama_preset_${tableKey}`}>Nama preset</FieldLabel>
                <Input
                  id={`input_nama_preset_${tableKey}`}
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  maxLength={50}
                  placeholder="mis. default"
                  disabled={!bolehUbah}
                />
              </Field>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor={`select_lembaga_preset_${tableKey}`}>
                    {editId ? 'Lembaga' : 'Generate ke lembaga'}
                  </FieldLabel>
                  {!editId && bolehUbah && lembagas.length > 1 ? (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => setLembagaIds(
                        lembagaIds.length === lembagas.length ? [] : lembagas.map((l) => String(l.id)),
                      )}
                    >
                      {lembagaIds.length === lembagas.length ? 'Kosongkan' : 'Pilih semua'}
                    </button>
                  ) : null}
                </div>
                {editId ? (
                  <Input
                    id={`select_lembaga_preset_${tableKey}`}
                    value={editPreset?.lembaga
                      ? `${editPreset.lembaga.kode ?? editPreset.lembaga.nama}`
                      : 'Global (semua lembaga)'}
                    disabled
                  />
                ) : (
                  <MultiSelect
                    id={`select_lembaga_preset_${tableKey}`}
                    title="Generate ke lembaga"
                    values={lembagaIds}
                    onChange={setLembagaIds}
                    disabled={!bolehUbah}
                    placeholder="Pilih satu atau beberapa lembaga"
                    options={lembagas.map((l) => ({ value: String(l.id), label: l.kode ?? l.nama }))}
                  />
                )}
                {!editId && bolehUbah && lembagaIds.length === 0 ? (
                  <p className="text-xs text-destructive">Pilih minimal satu lembaga tujuan.</p>
                ) : null}
                {!editId && lembagaIds.length > 1 ? (
                  <p className="text-xs text-muted-foreground">
                    Preset digenerate ke {lembagaIds.length} lembaga; tiap lembaga dapat mengedit salinannya.
                  </p>
                ) : null}
                {!bolehUbah ? (
                  <p className="text-xs text-muted-foreground">
                    Preset global hanya dapat diubah admin pesantren. Pilih “+ Preset baru” untuk membuat preset lembaga.
                  </p>
                ) : null}
              </Field>
            </div>

            {/* Tiga panel: daftar preset (kiri), semua kolom (tengah), dan
                kolom terpilih + perataan (kanan). */}
            <div className={cn('flex flex-col gap-3 lg:flex-row', banyakKolom && 'lg:min-h-0 lg:flex-1')}>
              {/* Panel 1 — preset */}
              <section className="flex flex-col gap-2 lg:w-44 lg:shrink-0">
                <FieldLabel>Preset</FieldLabel>
                <Button
                  id={`btn_preset_baru_${tableKey}`}
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => bukaKelola(null)}
                >
                  + Preset baru
                </Button>
                <div
                  className={cn(
                    'flex flex-col gap-1 overflow-auto rounded-md border p-1',
                    banyakKolom ? 'max-h-40 lg:max-h-none lg:min-h-0 lg:flex-1' : 'max-h-64',
                  )}
                >
                  {presets.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">Belum ada preset.</p>
                  ) : presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => bukaKelola(p)}
                      className={cn(
                        'rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        editId === p.id ? 'bg-accent font-medium' : 'hover:bg-accent/60',
                      )}
                    >
                      {labelPreset(p)}
                    </button>
                  ))}
                </div>
              </section>

              {/* Panel 2 — semua kolom (dengan pencarian + perataan global) */}
              <section className="flex min-h-0 flex-col gap-2 lg:flex-1">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel>Kolom tersedia ({fields.length})</FieldLabel>
                  <button
                    type="button"
                    disabled={!bolehUbah || kolomTampil.length === 0}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={togolSemuaTampil}
                  >
                    {semuaTampilTerpilih ? 'Kosongkan' : cariKolom.trim() ? 'Pilih hasil' : 'Pilih semua'}
                  </button>
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
                    'flex flex-col gap-0.5 overflow-auto rounded-md border p-1',
                    banyakKolom ? 'max-h-64 lg:max-h-none lg:min-h-0 lg:flex-1' : 'max-h-64',
                  )}
                >
                  {kolomTampil.length === 0 ? (
                    <p className="px-1.5 py-1 text-xs text-muted-foreground">Tidak ada kolom cocok.</p>
                  ) : kolomTampil.map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-accent/40"
                    >
                      <Checkbox
                        id={`chk_kolom_${tableKey}_${f.key}`}
                        checked={kolom.has(f.key)}
                        disabled={!bolehUbah}
                        onCheckedChange={(c) => togolKolom(f.key, !!c)}
                      />
                      <label
                        htmlFor={`chk_kolom_${tableKey}_${f.key}`}
                        className="min-w-0 flex-1 cursor-pointer truncate text-sm"
                        title={f.label}
                      >
                        {f.label}
                      </label>
                      <AlignToggle
                        fieldKey={f.key}
                        sumber="semua"
                        align={align[f.key] ?? 'center'}
                        onSet={setAlign}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Panel 3 — kolom terpilih */}
              <section className="flex min-h-0 flex-col gap-2 lg:w-72 lg:shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel>Terpilih ({kolom.size})</FieldLabel>
                  {kolom.size > 0 && bolehUbah ? (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => setKolom(new Set())}
                    >
                      Kosongkan
                    </button>
                  ) : null}
                </div>
                <div
                  className={cn(
                    'flex flex-col gap-0.5 overflow-auto rounded-md border p-1',
                    banyakKolom ? 'max-h-64 lg:max-h-none lg:min-h-0 lg:flex-1' : 'max-h-64',
                  )}
                >
                  {terpilih.length === 0 ? (
                    <p className="px-1.5 py-1 text-xs text-muted-foreground">Belum ada kolom dipilih.</p>
                  ) : terpilih.map((f) => (
                    <div
                      key={f.key}
                      className="flex flex-col gap-1 rounded-md px-1 py-1 hover:bg-accent/40"
                    >
                      <div className="flex items-center gap-1">
                        <span className="min-w-0 flex-1 truncate text-sm" title={f.label}>
                          {f.label}
                        </span>
                        <AlignToggle
                          fieldKey={f.key}
                          sumber="terpilih"
                          align={align[f.key] ?? 'center'}
                          onSet={setAlign}
                        />
                        <button
                          id={`btn_keluar_kolom_${tableKey}_${f.key}`}
                          type="button"
                          title="Keluarkan dari pilihan"
                          aria-label={`Keluarkan ${f.label} dari pilihan`}
                          disabled={!bolehUbah}
                          onClick={() => togolKolom(f.key, false)}
                          className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <Input
                        id={`input_label_${tableKey}_${f.key}`}
                        value={labelKustom[f.key] ?? ''}
                        onChange={(e) => setLabelKustom((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        maxLength={60}
                        placeholder={`Nama header (bawaan: ${f.label})`}
                        aria-label={`Nama header kustom untuk ${f.label}`}
                        disabled={!bolehUbah}
                        className="h-7 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <DialogFooter className="mt-auto">
              {editId && bolehUbah ? (
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
              <Button type="button" variant="outline" onClick={() => setDokOpen(false)}>Tutup</Button>
              {bolehUbah ? (
                <Button
                  id={`btn_simpan_preset_${tableKey}`}
                  type="submit"
                  disabled={busy || !nama.trim() || kolom.size === 0 || (!editId && lembagaIds.length === 0)}
                >
                  Simpan
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import {
  createPresetTabel,
  deletePresetTabel,
  updatePresetTabel,
  type PresetTabel,
} from '../../api/preset';
import type { Lembaga } from '../../api/master';
import MultiSelect from '../MultiSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
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
import { useGridPrefs } from '@/components/GridPrefs';
import { cn } from '@/lib/utils';
import { X } from '@/icons';
import { toast } from 'sonner';
import AlignToggle from './AlignToggle';
import type { ExcelField } from '../excel/types';

export interface KelolaPresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableKey: string;
  fields: ExcelField[];
  fieldKeys: Set<string>;
  presets: PresetTabel[];
  lembagas: Lembaga[];
  isPesantren: boolean;
  banyakKolom: boolean;
  /** Preset yang dibuka untuk diedit (null = preset baru). Dialog di-remount
   *  pemanggil setiap kali preset awal berubah lewat `key`. */
  presetAwal: PresetTabel | null;
  /** Minta pemanggil membuka preset lain / preset baru (remount + reset state). */
  onPilihPreset: (preset: PresetTabel | null) => void;
  /** Preset tersimpan → pemanggil menyegarkan daftar + menetapkannya aktif. */
  onTersimpan: (presetId: number) => Promise<void>;
  /** Preset dihapus → pemanggil menyegarkan daftar + mengosongkan preset aktif. */
  onDihapus: () => Promise<void>;
}

/** Dialog kelola preset kolom: daftar preset, pilih/atur kolom + perataan
 *  global, dan nama header kustom (tersimpan di DB per lembaga). */
export default function KelolaPresetDialog({
  open,
  onOpenChange,
  tableKey,
  fields,
  fieldKeys,
  presets,
  lembagas,
  isPesantren,
  banyakKolom,
  presetAwal,
  onPilihPreset,
  onTersimpan,
  onDihapus,
}: KelolaPresetDialogProps) {
  const [editId, setEditId] = useState<number | null>(presetAwal?.id ?? null);
  const [nama, setNama] = useState(presetAwal?.nama ?? '');
  const [lembagaIds, setLembagaIds] = useState<string[]>(
    presetAwal
      ? (presetAwal.lembaga_id === null ? [] : [String(presetAwal.lembaga_id)])
      : (isPesantren ? [] : lembagas.map((l) => String(l.id))),
  );
  const [kolom, setKolom] = useState<Set<string>>(
    new Set(presetAwal ? presetAwal.kolom.filter((k) => fieldKeys.has(k)) : []),
  );
  /** Nama header kustom per key kolom (kosong = label bawaan). */
  const [labelKustom, setLabelKustom] = useState<Record<string, string>>(() => {
    const awal: Record<string, string> = {};
    for (const [k, v] of Object.entries(presetAwal?.label ?? {})) {
      if (fieldKeys.has(k)) awal[k] = v;
    }
    return awal;
  });
  const [bolehUbah, setBolehUbah] = useState(isPesantren || presetAwal === null || presetAwal.lembaga_id !== null);
  const [cariKolom, setCariKolom] = useState('');
  const [busy, setBusy] = useState(false);

  const editPreset = useMemo(
    () => (editId === null ? null : presets.find((p) => p.id === editId) ?? null),
    [editId, presets],
  );
  const kolomTampil = useMemo(() => {
    const q = cariKolom.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter((f) => f.label.toLowerCase().includes(q));
  }, [fields, cariKolom]);
  const terpilih = useMemo(() => fields.filter((f) => kolom.has(f.key)), [fields, kolom]);
  const semuaTampilTerpilih = kolomTampil.length > 0 && kolomTampil.every((f) => kolom.has(f.key));
  const { align, setAlign } = useGridPrefs();

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

  const labelPreset = (p: PresetTabel) => (
    p.lembaga_id === null ? p.nama : `${p.nama} (${p.lembaga?.kode ?? p.lembaga?.nama ?? p.lembaga_id})`
  );

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
      await onTersimpan(saved.id);
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
      await onDihapus();
    } catch (e2) {
      toast.error(errorMessage(e2));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                onClick={() => onPilihPreset(null)}
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
                    onClick={() => onPilihPreset(p)}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
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
  );
}

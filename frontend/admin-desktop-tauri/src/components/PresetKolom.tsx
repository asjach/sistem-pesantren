import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
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
import { toast } from 'sonner';

const LENGKAP = '_lengkap';
const KELOLA = '_kelola';

/** Combobox preset kolom tampilan tabel + dialog kelola (tersimpan di DB per lembaga). */
export default function PresetKolom({
  tableKey,
  fields,
  onApply,
}: {
  tableKey: string;
  fields: ExcelField[];
  onApply: (keys: string[] | null) => void;
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
  const [bolehUbah, setBolehUbah] = useState(true);

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const editPreset = useMemo(
    () => (editId === null ? null : presets.find((p) => p.id === editId) ?? null),
    [editId, presets],
  );

  const terapkan = useCallback((preset: PresetTabel | null) => {
    if (!preset) {
      onApply(null);
      return;
    }
    const keys = preset.kolom.filter((k) => fieldKeys.has(k));
    onApply(keys.length > 0 ? keys : null);
  }, [fieldKeys, onApply]);

  const muat = useCallback(async (pilihId?: number | null) => {
    try {
      const res = await listPresetTabel(tableKey);
      const daftar = res.data.presets;
      setPresets(daftar);
      const targetId = pilihId !== undefined ? pilihId : res.data.aktif_preset_id;
      const target = targetId === null ? null : daftar.find((p) => p.id === targetId) ?? null;
      setAktifId(target?.id ?? null);
      terapkan(target);
    } catch (e) {
      setPresets([]);
      setAktifId(null);
      terapkan(null);
      toast.error(errorMessage(e));
    }
  }, [tableKey, terapkan]);

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

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
    setBolehUbah(isPesantren || preset === null || preset.lembaga_id !== null);
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
      let saved: PresetTabel | undefined;
      let pesan = 'Preset kolom disimpan.';
      if (editId) {
        const res = await updatePresetTabel(editId, { nama: nama.trim(), kolom: [...kolom] });
        saved = res.data[0];
        pesan = res.pesan;
      } else {
        const res = await createPresetTabel({
          table_key: tableKey,
          nama: nama.trim(),
          lembaga_ids: lembagaIds.map(Number),
          kolom: [...kolom],
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
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Kelola preset kolom</DialogTitle>
            <DialogDescription>
              Preset menyimpan pilihan kolom untuk tabel ini. Pilih satu atau beberapa lembaga tujuan; tiap lembaga dapat mengedit salinannya.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex max-h-64 w-full flex-col gap-1 overflow-auto rounded-md border p-2 sm:max-h-none sm:w-60">
              <Button
                id={`btn_preset_baru_${tableKey}`}
                type="button"
                variant="outline"
                className="mb-1 shrink-0"
                onClick={() => bukaKelola(null)}
              >
                + Preset baru
              </Button>
              {presets.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">Belum ada preset.</p>
              ) : presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => bukaKelola(p)}
                  className={`rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    editId === p.id ? 'bg-accent font-medium' : 'hover:bg-accent/60'
                  }`}
                >
                  {labelPreset(p)}
                </button>
              ))}
            </div>
            <form id={`form_preset_kolom_${tableKey}`} onSubmit={simpan} className="flex flex-1 flex-col gap-3">
              <FieldGroup className="gap-3">
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
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel>Kolom ditampilkan</FieldLabel>
                    <button
                      type="button"
                      disabled={!bolehUbah}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => setKolom(kolom.size === fieldKeys.size ? new Set() : new Set(fieldKeys))}
                    >
                      {kolom.size === fieldKeys.size ? 'Kosongkan' : 'Pilih semua'}
                    </button>
                  </div>
                  <div className="grid max-h-52 grid-cols-1 gap-1 overflow-auto rounded-md border p-2 sm:grid-cols-2">
                    {fields.map((f) => (
                      <label
                        key={f.key}
                        htmlFor={`chk_kolom_${tableKey}_${f.key}`}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          id={`chk_kolom_${tableKey}_${f.key}`}
                          checked={kolom.has(f.key)}
                          disabled={!bolehUbah}
                          onCheckedChange={(c) => {
                            setKolom((prev) => {
                              const next = new Set(prev);
                              if (c) next.add(f.key);
                              else next.delete(f.key);
                              return next;
                            });
                          }}
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </Field>
              </FieldGroup>
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

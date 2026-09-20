import { useMemo, useRef, useState } from 'react';
import { errorMessage } from '../../api/client';
import {
  createPresetTabel,
  deletePresetTabel,
  setPresetBawaan,
  updatePresetTabel,
  type PresetTabel,
} from '../../api/preset';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { DialogFooter } from '@/components/ui/dialog';
import ConfirmDelete from '@/components/ConfirmDelete';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Pin } from '@/icons';
import { toast } from 'sonner';
import type { ExcelField } from '../excel/types';

export interface TabKolomProps {
  tableKey: string;
  fields: ExcelField[];
  fieldKeys: Set<string>;
  presets: PresetTabel[];
  banyakKolom: boolean;
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
  onTutup: () => void;
}

/** Tab Kolom dialog Kelola tabel: preset kolom GLOBAL (satu definisi untuk
 *  semua lembaga), dikelola super_admin. Pilih/atur kolom tampil + nama
 *  header kustom. */
export default function TabKolom({
  tableKey,
  fields,
  fieldKeys,
  presets,
  banyakKolom,
  presetAwal,
  mulaiLengkap,
  onPilihLengkap,
  bawaanId,
  onPilihPreset,
  onTersimpan,
  onPakaiLengkap,
  onDihapus,
  onTutup,
}: TabKolomProps) {
  const [editId, setEditId] = useState<number | null>(presetAwal?.id ?? null);
  const [nama, setNama] = useState(presetAwal?.nama ?? '');
  /** Status bawaan = bagian form (tersimpan via Simpan, boleh dikosongkan). */
  const [bawaan, setBawaan] = useState(presetAwal ? presetAwal.id === bawaanId : false);
  const awalBawaan = useRef(presetAwal ? presetAwal.id === bawaanId : false);
  const [kolom, setKolom] = useState<Set<string>>(
    () => new Set(presetAwal ? presetAwal.kolom.filter((k) => fieldKeys.has(k)) : mulaiLengkap ? [...fieldKeys] : []),
  );
  const [cariKolom, setCariKolom] = useState('');
  const [busy, setBusy] = useState(false);
  /** Mode Lengkap: bukan hasil edit preset (tanpa id) — perubahan disimpan
   *  sebagai preset baru sehingga nama wajib diisi saat submit. */
  const modeLengkap = mulaiLengkap && editId === null;

  const kolomTampil = useMemo(() => {
    const q = cariKolom.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter((f) => f.label.toLowerCase().includes(q));
  }, [fields, cariKolom]);
  const semuaTampilTerpilih = kolomTampil.length > 0 && kolomTampil.every((f) => kolom.has(f.key));

  function togolKolom(key: string, aktif: boolean) {
    setKolom((prev) => {
      const next = new Set(prev);
      if (aktif) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function aturSemuaTampil(aktif: boolean) {
    setKolom((prev) => {
      const next = new Set(prev);
      for (const f of kolomTampil) {
        if (aktif) next.add(f.key);
        else next.delete(f.key);
      }
      return next;
    });
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (kolom.size === 0) return;
    if (!nama.trim()) {
      // Mode Lengkap tanpa nama: terapkan langsung ke tabel, tanpa membuat preset.
      if (modeLengkap) {
        onPakaiLengkap([...kolom], {});
        onTutup();
      }
      return;
    }
    setBusy(true);
    try {
      // Nama header tunggal dari Kamus Label; label kustom preset tak dikelola
      // lagi (null = bersihkan sisa lama bila ada).
      let saved: PresetTabel | undefined;
      let pesan = 'Preset kolom disimpan.';
      if (editId) {
        const res = await updatePresetTabel(editId, { nama: nama.trim(), kolom: [...kolom], label: null });
        saved = res.data[0];
        pesan = res.pesan;
      } else {
        const res = await createPresetTabel({
          table_key: tableKey,
          nama: nama.trim(),
          kolom: [...kolom],
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
      onTutup();
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
      await onDihapus();
    } catch (e2) {
      toast.error(errorMessage(e2));
    }
  }

  return (
    <form
      id={`form_preset_kolom_${tableKey}`}
      onSubmit={simpan}
      className={cn('flex flex-col gap-2', banyakKolom && 'lg:min-h-0')}
    >
      <div className="flex items-end gap-3">
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
      </div>

      {/* Dua panel: daftar preset (kiri), dan tabel kolom + header
          kustom (kanan). */}
      <div className={cn('flex flex-col gap-2 lg:flex-row', banyakKolom && 'lg:min-h-0 lg:flex-1')}>
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
            <button
              id={`btn_preset_lengkap_${tableKey}`}
              type="button"
              title="Semua kolom — kurangi lalu simpan sebagai preset baru"
              onClick={onPilihLengkap}
              className={cn(
                'rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-accent/60',
                mulaiLengkap && editId === null ? 'bg-accent font-medium' : '',
              )}
            >
              <span className="block truncate">Lengkap (semua kolom)</span>
            </button>
            {presets.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">Belum ada preset lain.</p>
            ) : presets.map((p) => {
              const tanda = p.id === bawaanId;
              return (
                <div key={p.id} className="group flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onPilihPreset(p)}
                    title={tanda ? `${p.nama} (bawaan)` : p.nama}
                    className={cn(
                      'min-w-0 flex-1 rounded-md px-2 py-1 text-left text-xs transition-colors',
                      editId === p.id ? 'bg-accent font-medium' : 'hover:bg-accent/60',
                    )}
                  >
                    <span className="block truncate">
                      {p.nama}
                    </span>
                  </button>
                  {tanda ? (
                    <span
                      title="Preset bawaan"
                      aria-label="Preset bawaan"
                      className="grid size-6 shrink-0 place-items-center text-foreground"
                    >
                      <Pin size={13} />
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* Panel 2 — tabel kolom: pilih tampil + nama header kustom */}
        <section className="flex min-h-0 flex-col gap-2 lg:min-w-0 lg:flex-1">
          <div className="flex items-center justify-between gap-2">
            <FieldLabel>Kolom ({kolom.size}/{fields.length} tampil)</FieldLabel>
            <span className="flex shrink-0 items-center gap-2">
              <button
                id={`btn_pilih_semua_kolom_${tableKey}`}
                type="button"
                disabled={kolomTampil.length === 0 || semuaTampilTerpilih}
                title={cariKolom.trim() ? 'Pilih semua kolom hasil pencarian' : 'Pilih semua kolom'}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => aturSemuaTampil(true)}
              >
                Pilih semua
              </button>
              <button
                id={`btn_kosongkan_kolom_${tableKey}`}
                type="button"
                disabled={kolomTampil.length === 0 || kolomTampil.every((f) => !kolom.has(f.key))}
                title={cariKolom.trim() ? 'Batalkan pilihan kolom hasil pencarian' : 'Batalkan semua pilihan kolom'}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => aturSemuaTampil(false)}
              >
                Kosongkan
              </button>
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
              'overflow-auto rounded-md border',
              banyakKolom ? 'max-h-64 lg:max-h-none lg:min-h-0 lg:flex-1' : 'max-h-64',
            )}
          >
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                <tr className="border-b">
                  <th className="w-10 px-2 py-1.5 text-center font-medium" title="Tampilkan kolom">Tampil</th>
                  <th className="px-2 py-1.5 text-left font-medium">Kolom</th>
                </tr>
              </thead>
              <tbody>
                {kolomTampil.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-2 py-3 text-center text-muted-foreground">
                      Tidak ada kolom cocok.
                    </td>
                  </tr>
                ) : kolomTampil.map((f) => {
                  const aktif = kolom.has(f.key);
                  return (
                    <tr
                      key={f.key}
                      className={cn('border-b last:border-0 hover:bg-accent/40', !aktif && 'opacity-50')}
                    >
                      <td className="px-2 py-1 text-center">
                        <Checkbox
                          id={`chk_kolom_${tableKey}_${f.key}`}
                          checked={aktif}
                          onCheckedChange={(c) => togolKolom(f.key, !!c)}
                          aria-label={`Tampilkan ${f.label}`}
                        />
                      </td>
                      <td className="truncate px-2 py-1" title={f.label}>
                        {f.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

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
        <Button type="button" variant="outline" onClick={onTutup}>Tutup</Button>
        <Button
          id={`btn_simpan_preset_${tableKey}`}
          type="submit"
          disabled={busy || kolom.size === 0 || (!modeLengkap && !nama.trim())}
        >
          {modeLengkap && !nama.trim() ? 'Terapkan' : modeLengkap ? 'Simpan sebagai preset' : 'Simpan'}
        </Button>
      </DialogFooter>
    </form>
  );
}

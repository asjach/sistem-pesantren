import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import {
  hapusUrutPreset,
  muatUrutPreset,
  simpanUrutPreset,
  type ArahUrut,
  type OpsiUrut,
  type PresetUrutData,
} from '@/api/urutPreset';
import { useAuth } from '@/auth/AuthContext';
import { useKamusPeta } from '@/components/useKamusPeta';
import MultiSelect from '@/components/MultiSelect';
import FilterField from '@/components/FilterField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp, Plus, Trash2 } from '@/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const KELOLA = '_kelola';
const TANPA = '_tanpa';
const IKUT = '_ikut';

/** Dropdown Urutkan yang sumbernya Preset Urut (global per tabel) + dialog
 *  "Kelola urutan": pilih kolom/kode urut yang sah dari backend, susun opsi,
 *  atur arah & opsi bawaan. Menggantikan hardcode `opsiUrut` per halaman. */
export default function PresetUrut({
  tableKey,
  urutAktif,
  arahUrut = 'naik',
  onUrut,
}: {
  tableKey: string;
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  onUrut?: (nilai: string[], arah: 'naik' | 'turun') => void;
}) {
  const { user } = useAuth();
  const bolehSimpan = bisa(user, 'urut_preset.ubah') || bisa(user, 'urut_preset.tambah');

  const [data, setData] = useState<PresetUrutData | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OpsiUrut[]>([]);
  const [busy, setBusy] = useState(false);
  /** table_key yang opsi bawaannya sudah diterapkan (sekali per tabel). */
  const sudahRef = useRef('');

  const muat = useCallback(async () => {
    try {
      const res = await muatUrutPreset(tableKey);
      setData(res.data);
    } catch {
      // Gagal memuat preset: dropdown tampil tanpa opsi (urutan tetap jalan).
      setData({ table_key: tableKey, opsi: [], tersedia: [] });
    }
  }, [tableKey]);

  useEffect(() => {
    void muat();
    sudahRef.current = '';
  }, [muat]);

  const tabelKamus = useMemo(
    () => [...new Set((data?.tersedia ?? []).flatMap((k) => k.kolom.map((c) => c.split('.')[0])))],
    [data],
  );
  const kamus = useKamusPeta(tabelKamus);

  /** Nama tampil sebuah kode urut: label kamus kolom (bila ada) / nama kolom. */
  const labelKode = useCallback(
    (kolom: string[]) =>
      kolom
        .map((k) => {
          const namaKolom = k.split('.')[1] ?? k;
          return kamus[k]?.label?.trim() || namaKolom.replace(/_/g, ' ');
        })
        .join(' + '),
    [kamus],
  );

  const opsi = data?.opsi ?? [];
  const kunciAktif = (urutAktif ?? []).join(',');
  const idxAktif = opsi.findIndex((o) => o.kode.join(',') === kunciAktif);
  const nilaiSelect = idxAktif >= 0 ? String(idxAktif) : kunciAktif === '' ? TANPA : '';

  // Terapkan opsi bawaan sekali saat preset termuat & halaman belum punya urutan.
  useEffect(() => {
    if (!data || !onUrut) return;
    if ((urutAktif ?? []).length > 0 || sudahRef.current === tableKey) return;
    sudahRef.current = tableKey;
    const bawaan = data.opsi.find((o) => o.bawaan);
    if (bawaan) onUrut(bawaan.kode, bawaan.arah ?? arahUrut ?? 'naik');
  }, [data, tableKey, urutAktif, arahUrut, onUrut]);

  function pilihNilai(v: string) {
    if (v === KELOLA) {
      setDraft(opsi.map((o) => ({ ...o, kode: [...o.kode] })));
      setOpen(true);
      return;
    }
    if (v === TANPA) {
      onUrut?.([], arahUrut);
      return;
    }
    const it = opsi[Number(v)];
    if (it) onUrut?.(it.kode, it.arah ?? arahUrut ?? 'naik');
  }

  function balikArah() {
    if ((urutAktif ?? []).length === 0) return;
    onUrut?.(urutAktif ?? [], arahUrut === 'naik' ? 'turun' : 'naik');
  }

  function ubah(i: number, patch: Partial<OpsiUrut>) {
    setDraft((d) => d.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  }

  function setBawaan(i: number) {
    setDraft((d) => d.map((o, j) => ({ ...o, bawaan: j === i })));
  }

  function geser(i: number, delta: number) {
    setDraft((d) => {
      const j = i + delta;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function simpan() {
    const bersih: OpsiUrut[] = [];
    for (const o of draft) {
      if (o.kode.length === 0) {
        toast.error('Ada opsi yang belum memilih kolom.');
        return;
      }
      bersih.push({
        kode: o.kode,
        label: o.label.trim() || labelKode(o.kode),
        arah: o.arah,
        bawaan: o.bawaan,
      });
    }
    setBusy(true);
    try {
      await simpanUrutPreset(tableKey, bersih);
      await muat();
      toast.success('Preset urut disimpan.');
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function kosongkan() {
    setBusy(true);
    try {
      await hapusUrutPreset(tableKey);
      setDraft([]);
      await muat();
      toast.success('Preset urut dikosongkan.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <span className="flex items-end gap-1.5">
        <FilterField label="Urutkan" htmlFor={`select_urut_${tableKey}`}>
          <Select value={nilaiSelect || undefined} onValueChange={pilihNilai}>
            <SelectTrigger id={`select_urut_${tableKey}`} className="w-44">
              <SelectValue placeholder="Urutkan…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={TANPA}>Tanpa urutan</SelectItem>
                {opsi.map((o, i) => (
                  <SelectItem key={`${o.kode.join(',')}-${i}`} value={String(i)}>
                    {o.label}
                    {o.bawaan ? ' •' : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
              <SelectItem value={KELOLA}>Kelola urutan…</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <Button
          id={`btn_arah_urut_${tableKey}`}
          variant="outline"
          size="sm"
          title="Balik arah urutan"
          aria-label={`Arah urutan: ${arahUrut === 'naik' ? 'naik' : 'turun'}`}
          disabled={(urutAktif ?? []).length === 0}
          onClick={balikArah}
        >
          {arahUrut === 'naik' ? '▲ Naik' : '▼ Turun'}
        </Button>
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kelola urutan</DialogTitle>
            <DialogDescription>
              Opsi urut untuk tabel ini (global, berlaku semua lembaga). Pilih satu atau beberapa
              kolom per opsi — urutan pilihannya mengikuti urutan klik. Tandai satu opsi sebagai
              bawaan untuk urutan awal saat halaman dibuka.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
            {draft.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Belum ada opsi. Klik “+ Opsi”.
              </p>
            ) : (
              draft.map((o, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-md border p-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
                    <Input
                      id={`input_label_urut_${tableKey}_${i}`}
                      className="h-7 flex-1"
                      value={o.label}
                      maxLength={60}
                      placeholder={labelKode(o.kode) || 'Label opsi'}
                      disabled={!bolehSimpan}
                      onChange={(e) => ubah(i, { label: e.target.value })}
                    />
                    <Button
                      type="button" variant="outline" size="icon-sm"
                      id={`btn_urut_naik_${tableKey}_${i}`}
                      title="Naikkan opsi" aria-label="Naikkan opsi"
                      disabled={!bolehSimpan || i === 0}
                      onClick={() => geser(i, -1)}
                    >
                      <ChevronUp size={14} />
                    </Button>
                    <Button
                      type="button" variant="outline" size="icon-sm"
                      id={`btn_urut_turun_${tableKey}_${i}`}
                      title="Turunkan opsi" aria-label="Turunkan opsi"
                      disabled={!bolehSimpan || i === draft.length - 1}
                      onClick={() => geser(i, 1)}
                    >
                      <ChevronDown size={14} />
                    </Button>
                    <Button
                      type="button" variant="outline" size="icon-sm"
                      id={`btn_urut_hapus_${tableKey}_${i}`}
                      title="Hapus opsi" aria-label="Hapus opsi"
                      disabled={!bolehSimpan}
                      onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-end gap-3 pl-6">
                    <span className="flex flex-col gap-0.5">
                      <label
                        htmlFor={`select_kode_urut_${tableKey}_${i}`}
                        className="text-[11px] leading-tight text-muted-foreground"
                      >
                        Kolom
                      </label>
                      <MultiSelect
                        id={`select_kode_urut_${tableKey}_${i}`}
                        title="Kolom urut"
                        values={o.kode}
                        onChange={(v) => ubah(i, { kode: v })}
                        disabled={!bolehSimpan}
                        placeholder="Pilih kolom…"
                        options={(data?.tersedia ?? []).map((k) => ({
                          value: k.kode,
                          label: labelKode(k.kolom),
                        }))}
                      />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <label
                        htmlFor={`select_arah_urut_${tableKey}_${i}`}
                        className="text-[11px] leading-tight text-muted-foreground"
                      >
                        Arah
                      </label>
                      <Select
                        value={o.arah ?? IKUT}
                        onValueChange={(v) => ubah(i, { arah: v === IKUT ? null : (v as ArahUrut) })}
                        disabled={!bolehSimpan}
                      >
                        <SelectTrigger id={`select_arah_urut_${tableKey}_${i}`} className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value={IKUT}>Ikut (naik)</SelectItem>
                            <SelectItem value="naik">▲ Naik</SelectItem>
                            <SelectItem value="turun">▼ Turun</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </span>
                    <label className="flex items-center gap-1.5 pb-1 text-xs">
                      <Checkbox
                        id={`check_bawaan_urut_${tableKey}_${i}`}
                        checked={o.bawaan}
                        disabled={!bolehSimpan}
                        onCheckedChange={() => setBawaan(i)}
                      />
                      Bawaan
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className={cn('gap-2 sm:justify-between')}>
            <Button
              type="button"
              variant="outline"
              id={`btn_urut_tambah_${tableKey}`}
              disabled={!bolehSimpan}
              onClick={() => setDraft((d) => [...d, { kode: [], label: '', arah: null, bawaan: d.length === 0 }])}
            >
              <Plus size={14} /> Opsi
            </Button>
            <span className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                id={`btn_urut_kosongkan_${tableKey}`}
                disabled={!bolehSimpan || busy || opsi.length === 0}
                onClick={() => void kosongkan()}
              >
                Kosongkan
              </Button>
              <Button
                type="button"
                id={`btn_urut_simpan_${tableKey}`}
                disabled={!bolehSimpan || busy}
                onClick={() => void simpan()}
              >
                {busy ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

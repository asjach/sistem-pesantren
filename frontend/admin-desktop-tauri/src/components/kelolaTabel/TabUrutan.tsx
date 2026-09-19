import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '@/api/client';
import {
  hapusUrutPreset,
  muatUrutPreset,
  simpanUrutPreset,
  type ArahUrut,
  type OpsiUrut,
  type PresetUrutData,
} from '@/api/urutPreset';
import { useLembagaAktif } from '@/lembagaAktif';
import { useKamusPeta } from '@/components/useKamusPeta';
import MultiSelect from '@/components/MultiSelect';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GripVertical, Plus, Trash2 } from '@/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const IKUT = '_ikut';

/** Tab Urutan dialog Kelola tabel: susun opsi urut (global, berlaku semua
 *  lembaga), atur arah & opsi bawaan. Draft = salinan penuh opsi tersimpan;
 *  Simpan mengganti seluruh daftar (semantik sama seperti dialog lama). */
export default function TabUrutan({ tableKey, onTutup }: { tableKey: string; onTutup: () => void }) {
  // Kelola urutan = pengaturan global super_admin EFEKTIF (mati saat bertindak).
  const { efektifSuper: bolehSimpan } = useLembagaAktif();

  const [data, setData] = useState<PresetUrutData | null>(null);
  const [draft, setDraft] = useState<OpsiUrut[]>([]);
  const [busy, setBusy] = useState(false);

  const muat = useCallback(async () => {
    try {
      const res = await muatUrutPreset(tableKey);
      setData(res.data);
      setDraft(res.data.opsi.map((o) => ({ ...o, kode: [...o.kode] })));
    } catch {
      setData({ table_key: tableKey, opsi: [], tersedia: [] });
      setDraft([]);
    }
  }, [tableKey]);

  useEffect(() => {
    void muat();
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

  function ubah(i: number, patch: Partial<OpsiUrut>) {
    setDraft((d) => d.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  }

  /** Geser posisi kolom dalam satu opsi (urutan klik = urutan ORDER BY). */
  function geserKolom(i: number, dari: number, ke: number) {
    setDraft((d) => d.map((o, j) => {
      if (j !== i) return o;
      const kode = [...o.kode];
      if (ke < 0 || ke >= kode.length) return o;
      const [pindah] = kode.splice(dari, 1);
      kode.splice(ke, 0, pindah);
      return { ...o, kode };
    }));
  }

  function setBawaan(i: number) {
    setDraft((d) => d.map((o, j) => ({ ...o, bawaan: j === i })));
  }

  /** Seret-untuk-memindah posisi opsi: indeks sumber via ref, target via hover. */
  const seretRef = useRef<number | null>(null);
  const [tujuanSeret, setTujuanSeret] = useState<number | null>(null);

  function jatuhSeret(i: number) {
    const dari = seretRef.current;
    seretRef.current = null;
    setTujuanSeret(null);
    if (dari === null || dari === i) return;
    setDraft((d) => {
      const next = [...d];
      const [pindah] = next.splice(dari, 1);
      next.splice(i, 0, pindah);
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
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex max-h-[50vh] min-h-0 flex-col gap-2 overflow-y-auto pr-1">
        {draft.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Belum ada opsi. Klik “+ Opsi”.
          </p>
        ) : (
          draft.map((o, i) => (
            <div
              key={i}
              onDragOver={(e) => { if (bolehSimpan) { e.preventDefault(); setTujuanSeret(i); } }}
              onDrop={() => jatuhSeret(i)}
              onDragEnd={() => { seretRef.current = null; setTujuanSeret(null); }}
              className={cn(
                'flex items-center gap-1.5 rounded-md border p-1.5',
                tujuanSeret === i && seretRef.current !== i && 'border-accent bg-accent/20',
              )}
            >
              <span
                role="button"
                tabIndex={bolehSimpan ? 0 : undefined}
                aria-label={`Seret untuk memindah opsi ${i + 1}`}
                title={bolehSimpan ? 'Seret untuk memindah posisi opsi' : undefined}
                draggable={bolehSimpan}
                onDragStart={(e) => { seretRef.current = i; e.dataTransfer.effectAllowed = 'move'; }}
                onKeyDown={(e) => {
                  if (!bolehSimpan) return;
                  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                  e.preventDefault();
                  const ke = e.key === 'ArrowUp' ? i - 1 : i + 1;
                  if (ke < 0 || ke >= draft.length) return;
                  seretRef.current = i;
                  jatuhSeret(ke);
                }}
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground',
                  bolehSimpan ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-50',
                )}
              >
                <GripVertical size={14} />
              </span>
              <Input
                id={`input_label_urut_${tableKey}_${i}`}
                className="h-7 w-40 shrink-0"
                value={o.label}
                maxLength={60}
                placeholder={labelKode(o.kode) || 'Label opsi'}
                title="Label opsi"
                disabled={!bolehSimpan}
                onChange={(e) => ubah(i, { label: e.target.value })}
              />
              <div className="min-w-0 flex-1" title="Kolom urut">
                <MultiSelect
                  id={`select_kode_urut_${tableKey}_${i}`}
                  title="Kolom urut"
                  values={o.kode}
                  onChange={(v) => ubah(i, { kode: v })}
                  onMove={(dari, ke) => geserKolom(i, dari, ke)}
                  disabled={!bolehSimpan}
                  placeholder="Pilih kolom…"
                  options={(data?.tersedia ?? []).map((k) => ({
                    value: k.kode,
                    label: labelKode(k.kolom),
                  }))}
                />
              </div>
              <Select
                value={o.arah ?? IKUT}
                onValueChange={(v) => ubah(i, { arah: v === IKUT ? null : (v as ArahUrut) })}
                disabled={!bolehSimpan}
              >
                <SelectTrigger
                  id={`select_arah_urut_${tableKey}_${i}`}
                  title="Arah urut"
                  className="h-7 w-28 shrink-0 text-xs"
                >
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
              <label
                className="flex shrink-0 cursor-pointer items-center gap-1 text-xs whitespace-nowrap"
                title="Jadikan urutan bawaan saat halaman dibuka"
              >
                <Checkbox
                  id={`check_bawaan_urut_${tableKey}_${i}`}
                  checked={o.bawaan}
                  disabled={!bolehSimpan}
                  onCheckedChange={() => setBawaan(i)}
                />
                Bawaan
              </label>
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
          ))
        )}
      </div>

      <DialogFooter className={cn('mt-auto gap-2 sm:justify-between')}>
        <span className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            id={`btn_urut_tambah_${tableKey}`}
            disabled={!bolehSimpan}
            onClick={() => setDraft((d) => [...d, { kode: [], label: '', arah: null, bawaan: d.length === 0 }])}
          >
            <Plus size={14} /> Opsi
          </Button>
          <Button
            type="button"
            variant="outline"
            id={`btn_urut_kosongkan_${tableKey}`}
            disabled={!bolehSimpan || busy || opsi.length === 0}
            onClick={() => void kosongkan()}
          >
            Kosongkan
          </Button>
        </span>
        <span className="flex gap-2">
          <Button type="button" variant="outline" onClick={onTutup}>Tutup</Button>
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
    </div>
  );
}

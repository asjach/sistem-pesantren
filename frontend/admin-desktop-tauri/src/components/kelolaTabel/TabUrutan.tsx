import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ChevronDown, ChevronUp, Plus, Trash2 } from '@/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const IKUT = '_ikut';

/** Tab Urutan dialog Kelola tabel: susun opsi urut (global, berlaku semua
 *  lembaga), atur arah & opsi bawaan. Draft = salinan penuh opsi tersimpan;
 *  Simpan mengganti seluruh daftar (semantik sama seperti dialog lama). */
export default function TabUrutan({ tableKey, onTutup }: { tableKey: string; onTutup: () => void }) {
  const { user } = useAuth();
  // Kelola urutan = pengaturan global super_admin (dialog ini pun hanya dibuka super_admin).
  const bolehSimpan = (user?.roles ?? []).some((r) => r.name === 'super_admin');

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
      <p className="text-xs text-muted-foreground">
        Opsi urut untuk tabel ini (global, berlaku semua lembaga). Pilih satu atau beberapa
        kolom per opsi — urutan pilihannya mengikuti urutan klik. Tandai satu opsi sebagai
        bawaan untuk urutan awal saat halaman dibuka.
      </p>
      <div className="flex max-h-[50vh] min-h-0 flex-col gap-2 overflow-y-auto pr-1">
        {draft.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Belum ada opsi. Klik “+ Opsi”.
          </p>
        ) : (
          draft.map((o, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-md border p-1.5">
              <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
              <Input
                id={`input_label_urut_${tableKey}_${i}`}
                className="h-7 min-w-0 flex-1"
                value={o.label}
                maxLength={60}
                placeholder={labelKode(o.kode) || 'Label opsi'}
                title="Label opsi"
                disabled={!bolehSimpan}
                onChange={(e) => ubah(i, { label: e.target.value })}
              />
              <div className="w-44 shrink-0" title="Kolom urut">
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
          ))
        )}
      </div>

      <DialogFooter className={cn('mt-auto gap-2 sm:justify-between')}>
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
          <Button type="button" variant="outline" onClick={onTutup}>Tutup</Button>
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
    </div>
  );
}

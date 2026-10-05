import { labelKolom } from '@/lib/labelKolom';
import { useBagian } from '@/components/kelolaHalaman/kotor';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import MultiSelect from '@/components/MultiSelect';
import { Button } from '@/components/ui/button';
import TombolIkon from '@/components/TombolIkon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { ArrowDownAZ, ArrowUpAZ, GripVertical, Plus, Trash2 } from '@/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const IKUT = '_ikut';

/** Section Urutan dialog Kelola Tabel: susun opsi urut (global, berlaku semua
 *  lembaga), atur arah per opsi maupun per kolom & opsi bawaan. Draft =
 *  salinan penuh opsi tersimpan; Simpan mengganti seluruh daftar. */
export default function TabUrutan({ tableKey }: { tableKey: string }) {
  // Kelola urutan = pengaturan global super_admin EFEKTIF (mati saat bertindak).
  const { efektifSuper: bolehSimpan } = useLembagaAktif();

  const [data, setData] = useState<PresetUrutData | null>(null);
  const [draft, setDraft] = useState<OpsiUrut[]>([]);
  const [busy, setBusy] = useState(false);
  const laporKotor = useBagian('urutan', () => void simpan());
  /** Draf terakhir yang sama dengan isi server (acuan deteksi kotor). */
  const acuanRef = useRef('[]');

  const muat = useCallback(async () => {
    try {
      const res = await muatUrutPreset(tableKey);
      setData(res.data);
      const bersih = res.data.opsi.map((o) => ({ ...o, kode: [...o.kode], arah_kolom: o.arah_kolom ? { ...o.arah_kolom } : null }));
      setDraft(bersih);
      acuanRef.current = JSON.stringify(bersih);
    } catch {
      setData({ table_key: tableKey, opsi: [], tersedia: [] });
      setDraft([]);
      acuanRef.current = '[]';
    }
  }, [tableKey]);

  useEffect(() => {
    void muat();
  }, [muat]);

  useEffect(() => {
    laporKotor(JSON.stringify(draft) !== acuanRef.current);
  }, [draft, laporKotor]);

  /** Nama tampilan sebuah kode urut: nama kolom saja (mis. `nama_lengkap`). */
  const labelKode = useCallback(
    (kolom: string[]) =>
      kolom
        .map((k) => labelKolom(k.split('.')[1] ?? k))
        .join(' + '),
    [],
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

  /** Arah satu kolom dalam satu opsi: khusus (arah_kolom) atau ikut global. */
  function arahKolomDari(o: OpsiUrut, kode: string): ArahUrut | null {
    return o.arah_kolom?.[kode] ?? null;
  }

  function setArahKolom(i: number, kode: string, arah: ArahUrut | null) {
    setDraft((d) => d.map((o, j) => {
      if (j !== i) return o;
      const peta = { ...(o.arah_kolom ?? {}) };
      if (arah === null) delete peta[kode];
      else peta[kode] = arah;
      return { ...o, arah_kolom: Object.keys(peta).length === 0 ? null : peta };
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
        arah_kolom: o.arah_kolom && Object.keys(o.arah_kolom).length > 0 ? o.arah_kolom : null,
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
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-col gap-1">
        {draft.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">
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
                'flex items-center gap-1 rounded-md border p-1',
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
                className="h-6 w-36 shrink-0"
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
                  title="Arah untuk kolom tanpa pengaturan sendiri"
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
              <TombolIkon
                type="button" variant="outline" size="icon-sm"
                id={`btn_urut_hapus_${tableKey}_${i}`}
                tip="Hapus opsi"
                disabled={!bolehSimpan}
                onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} />
              </TombolIkon>
              {/* Arah per kolom: muncul hanya bila opsi memilih ≥ 2 kolom. */}
              {o.kode.length >= 2 && bolehSimpan && (
                <div
                  className="flex w-full flex-wrap items-center gap-1.5 border-t pt-1.5 pl-7"
                  data-part="arah_kolom_urut"
                >
                  <span className="text-[11px] text-muted-foreground">Arah per kolom:</span>
                  {o.kode.map((k) => {
                    const arahIni = arahKolomDari(o, k);
                    return (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]"
                      >
                        <span className="max-w-40 truncate">{labelKode([k])}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              id={`btn_arah_kolom_${tableKey}_${i}_${k.replace(/[^a-z0-9_]/gi, '_')}`}
                              aria-label={`Arah kolom ${labelKode([k])}: ${arahIni === 'turun' ? 'turun' : arahIni === 'naik' ? 'naik' : 'ikut global'}`}
                              disabled={!bolehSimpan}
                              onClick={() => {
                                // Siklus: ikut global → naik → turun → ikut global.
                                setArahKolom(i, k, arahIni === null ? 'naik' : arahIni === 'naik' ? 'turun' : null);
                              }}
                              className={cn(
                                'grid size-5 place-items-center rounded hover:bg-accent disabled:opacity-50',
                                arahIni === 'turun' && 'text-blue-600 dark:text-blue-400',
                                arahIni === 'naik' && 'text-emerald-600 dark:text-emerald-400',
                              )}
                            >
                              {arahIni === 'turun'
                                ? <ArrowDownAZ size={12} />
                                : arahIni === 'naik'
                                  ? <ArrowUpAZ size={12} />
                                  : <span className="text-[10px] text-muted-foreground">ikut</span>}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{arahIni === null ? `Arah ${labelKode([k])}: ikut global (${o.arah === 'turun' ? 'turun' : 'naik'}) — klik untuk ganti` : `Arah ${labelKode([k])}: ${arahIni} — klik untuk ganti`}</p>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                    );
                  })}
                </div>
              )}
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
            onClick={() => setDraft((d) => [...d, { kode: [], label: '', arah: null, arah_kolom: null, bawaan: d.length === 0 }])}
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
      </DialogFooter>
    </div>
  );
}

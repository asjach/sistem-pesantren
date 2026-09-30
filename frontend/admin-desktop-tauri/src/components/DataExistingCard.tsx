import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/api/client';
import { listLembaga, type Lembaga } from '@/api/master';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Download } from '@/icons';
import { toast } from 'sonner';
import { unduhExcelDataExisting, type DataExistingPayload } from '@/lib/excelDataExisting';

/**
 * Card "Data existing (update)" — dipakai seragam oleh semua dialog import:
 * chip pilihan lembaga (bawaan seluruh lembaga yang boleh diakses, terkunci
 * hanya bila akun punya satu lembaga) + tautan unduh di sisi kanan.
 *
 * Filter lembaga di toolbar TIDAK membatasi pilihan di sini; daftar diambil
 * tiap dialog dibuka agar ikut peran act-as terbaru.
 */
export default function DataExistingCard({
  aktif,
  id,
  judul = 'Data existing (update)',
  deskripsi = 'Terisi — edit lalu import.',
  labelTombol = 'Unduh',
  judulTooltip,
  ambil,
  namaBerkas,
  judulSheet,
}: {
  /** Dialog sedang terbuka (daftar diambil saat dibuka). */
  aktif: boolean;
  /** `id` unik tombol unduh. */
  id: string;
  judul?: string;
  deskripsi?: string;
  labelTombol?: string;
  judulTooltip?: string;
  /** Ambil data existing dari backend; tanpa argumen = seluruh lingkup akses. */
  ambil: (jenjangs?: string[]) => Promise<DataExistingPayload>;
  /** Nama berkas + judul sheet untuk unduhan. */
  namaBerkas: string;
  judulSheet?: string;
}) {
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [dataIds, setDataIds] = useState<string[]>([]);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    if (!aktif) return;
    let hidup = true;
    listLembaga({ per_page: 1000 })
      .then((p) => { if (hidup) setLembagas(p.data); })
      .catch(() => { if (hidup) setLembagas([]); });

    return () => { hidup = false; };
  }, [aktif]);

  useEffect(() => { if (!aktif) setSiap(false); }, [aktif]);

  useEffect(() => {
    if (!aktif || siap || lembagas.length === 0) return;
    setDataIds(lembagas.map((l) => l.jenjang));
    setSiap(true);
  }, [aktif, siap, lembagas]);

  const toggle = useCallback((kode: string) => {
    setDataIds((s) => (s.includes(kode) ? s.filter((x) => x !== kode) : [...s, kode]));
  }, []);

  const terkunci = lembagas.length <= 1;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{judul}</p>
      <p className="text-xs text-muted-foreground">{deskripsi}</p>
      <div className="flex flex-nowrap items-center gap-2">
        <div
          className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto"
          role="group"
          aria-label="Lembaga sumber data existing"
        >
          {lembagas.length > 1 && (
            <label className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold">
              <Checkbox
                id="check_data_semua"
                checked={dataIds.length === lembagas.length && lembagas.length > 0}
                onCheckedChange={() => setDataIds((s) =>
                  s.length === lembagas.length ? [] : lembagas.map((l) => l.jenjang),
                )}
              /> Semua
            </label>
          )}
          {lembagas.map((l) => (
            <label
              key={l.jenjang}
              className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
              title={terkunci ? 'Satu-satunya lembaga Anda (otomatis)' : l.nama}
            >
              <Checkbox
                id={`check_data_lembaga_${l.jenjang}`}
                checked={dataIds.includes(l.jenjang)}
                disabled={terkunci}
                onCheckedChange={() => toggle(l.jenjang)}
              /> {l.jenjang}
            </label>
          ))}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="link"
              className="h-auto shrink-0 px-0"
              disabled={dataIds.length === 0}
              onClick={() => {
                // Pilihan penuh = seluruh lingkup akses (tanpa parameter; backend
                // yang memutuskan cakupan sesuai peran akun).
                const ids = dataIds.length === lembagas.length ? undefined : dataIds;
                void ambil(ids)
                  .then((data) => unduhExcelDataExisting(data, namaBerkas, judulSheet))
                  .catch((e) => toast.error(errorMessage(e)));
              }}
            >
              <Download data-icon="inline-start" size={16} />
              {labelTombol}{dataIds.length > 0 && dataIds.length < lembagas.length ? ` (${dataIds.length})` : ''}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{judulTooltip ?? 'Unduh data existing untuk diedit lalu diimport kembali'}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/api/client';
import {
  importSantriGabungan,
  periksaImportSantriGabungan,
  unduhDataSantriGabungan,
  unduhTemplateSantriGabungan,
  type ImportPeriksa,
} from '@/api/santri';
import { listLembaga, type Lembaga } from '@/api/master';
import { useLembagaAktif } from '@/lembagaAktif';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Upload } from '@/icons';
import { toast } from 'sonner';

/**
 * Dialog import gabungan siswa (keanggotaan + identitas). Keanggotaan WAJIB:
 * tiap baris harus punya `jenjang` (santri minimal terdaftar di 1 jenjang).
 * Dipakai halaman Santri Per Lembaga.
 */
export default function ImportSantriGabunganDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void | Promise<void>;
}) {
  const { jenjang: jenjangAktif, adaSemua } = useLembagaAktif();
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [dataIds, setDataIds] = useState<string[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [periksaHasil, setPeriksaHasil] = useState<ImportPeriksa | null>(null);
  const [busy, setBusy] = useState(false);
  const [periksaBusy, setPeriksaBusy] = useState(false);

  useEffect(() => {
    listLembaga({ per_page: 1000 }).then((p) => setLembagas(p.data)).catch(() => setLembagas([]));
  }, []);

  const dataTerkunci = lembagas.length === 1 || jenjangAktif != null;

  useEffect(() => {
    if (!open) return;
    setImportFile(null);
    setPeriksaHasil(null);
    if (jenjangAktif != null && lembagas.some((l) => l.jenjang === jenjangAktif)) {
      setDataIds([jenjangAktif]);
      return;
    }
    setDataIds(lembagas.map((l) => l.jenjang));
  }, [open, jenjangAktif, lembagas]);

  const toggleDataId = useCallback((id: string) => {
    setDataIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import santri</DialogTitle>
          <DialogDescription>
            Satu file: keanggotaan (blok awal) + identitas. Kolom `jenjang` wajib diisi —
            santri minimal terdaftar di 1 jenjang. Cocok santri_id / NIK / NIS; baris baru otomatis dibuat.
          </DialogDescription>
        </DialogHeader>
        <form className="grid grid-cols-2 gap-4" onSubmit={async (e) => {
          e.preventDefault();
          if (!importFile || !periksaHasil?.siap_import) return;
          setBusy(true);
          try {
            const res = await importSantriGabungan({ file: importFile });
            if (res.errors?.length) {
              toast.error(res.errors.map((x) => `Baris ${x.row} (${x.attribute}): ${x.errors.join(', ')}`).join(' · '));
            } else {
              toast.success(res.pesan ?? 'Import selesai.');
              onOpenChange(false);
              await onDone();
            }
          } catch (e2) {
            toast.error(errorMessage(e2));
          } finally {
            setBusy(false);
          }
        }}>
          <div className="col-span-2 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template kosong</p>
              <p className="text-xs text-muted-foreground">Mulai dari nol: blok keanggotaan + identitas.</p>
              <Button
                id="btn_unduh_template_gabungan"
                type="button"
                variant="link"
                className="h-auto justify-start px-0"
                onClick={() => void unduhTemplateSantriGabungan().catch((e) => toast.error(errorMessage(e)))}
              >
                <Download data-icon="inline-start" size={16} /> Template gabungan
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data existing (update)</p>
              <p className="text-xs text-muted-foreground">Terisi santri_id — edit lalu upload untuk update.</p>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lembaga sumber data existing">
                {!dataTerkunci && lembagas.length > 1 && (
                  <label
                    className="inline-flex h-7 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                  >
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
                    className="inline-flex h-7 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                    title={dataTerkunci ? 'Satu-satunya lembaga Anda (otomatis)' : l.nama}
                  >
                    <Checkbox
                      id={`check_data_lembaga_${l.id}`}
                      checked={dataIds.includes(l.jenjang)}
                      disabled={dataTerkunci}
                      onCheckedChange={() => toggleDataId(l.jenjang)}
                    /> {l.jenjang}
                  </label>
                ))}
                <Button
                  id="btn_unduh_data_gabungan"
                  type="button"
                  variant="link"
                  className="h-auto shrink-0 px-0"
                  disabled={dataIds.length === 0}
                  title="Unduh data existing (pra-isi santri_id) untuk update via Excel"
                  onClick={() => {
                    // Pilihan penuh = semua lingkup (tanpa parameter).
                    const ids = !adaSemua || dataIds.length === lembagas.length ? undefined : dataIds;
                    void unduhDataSantriGabungan(ids).catch((e) => toast.error(errorMessage(e)));
                  }}
                >
                  <Download data-icon="inline-start" size={16} /> Unduh{dataIds.length > 0 && dataIds.length < lembagas.length ? ` (${dataIds.length})` : ''}
                </Button>
              </div>
            </div>
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Langkah 2 — Upload & periksa</p>
            <div className="flex items-center gap-2">
              <input
                id="input_file_import_santri"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setPeriksaHasil(null); }}
              />
              <Button
                id="btn_pilih_file_import_santri"
                type="button"
                variant="outline"
                onClick={() => document.getElementById('input_file_import_santri')?.click()}
              >
                <Upload data-icon="inline-start" size={16} /> Pilih file
              </Button>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={importFile?.name ?? ''}>
                {importFile?.name ?? 'Belum ada file dipilih (.xlsx, .xls, .csv)'}
              </span>
            </div>
          </div>
          {periksaHasil ? (
            <div className="col-span-2 rounded-md border p-4 text-sm" id="hasil_periksa_import_santri">
              <p className="font-medium">
                {periksaHasil.ringkasan.baris_diproses} baris diperiksa · {periksaHasil.ringkasan.baris_valid} valid · {periksaHasil.ringkasan.baris_gagal} bermasalah
                {(periksaHasil.ringkasan.baris_diperbarui ?? 0) > 0 ? ` · ${periksaHasil.ringkasan.baris_diperbarui} pembaruan` : ''}
              </p>
              {periksaHasil.errors.length > 0 ? (
                <ul className="mt-3 max-h-48 space-y-1.5 overflow-auto text-xs text-destructive">
                  {periksaHasil.errors.slice(0, 50).map((x, i) => <li key={`${x.row}-${x.attribute}-${i}`}>Baris {x.row} ({x.attribute}): {x.errors.join(', ')}</li>)}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-emerald-600">Tidak ada masalah — siap diimport.</p>
              )}
            </div>
          ) : null}
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button id="btn_periksa_import_santri" type="button" variant="outline" disabled={!importFile || periksaBusy || busy} onClick={async () => {
              if (!importFile) return;
              setPeriksaBusy(true);
              try {
                const res = await periksaImportSantriGabungan({ file: importFile });
                setPeriksaHasil(res);
                if (res.siap_import) toast.success(res.pesan); else toast.error(res.pesan);
              } catch (e2) {
                setPeriksaHasil(null);
                toast.error(errorMessage(e2));
              } finally {
                setPeriksaBusy(false);
              }
            }}>{periksaBusy ? 'Memeriksa…' : 'Periksa'}</Button>
            <Button id="btn_import_santri" type="submit" disabled={busy || periksaBusy || !periksaHasil?.siap_import}>Import</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/api/client';
import {
  unduhDataSantriGabungan,
  unduhTemplateSantriGabungan,
} from '@/api/santri';
import { listLembaga, type Lembaga } from '@/api/master';
import { useLembagaAktif } from '@/lembagaAktif';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Upload } from '@/icons';
import { toast } from 'sonner';
import ImportSantriBertahapDialog from '@/components/ImportSantriBertahapDialog';

/**
 * Dialog import gabungan siswa (keanggotaan + identitas). Keanggotaan WAJIB:
 * tiap baris harus punya `jenjang` (santri minimal terdaftar di 1 jenjang).
 * Unduh template/data di sini; file diimport lewat dialog bertahap
 * (browser membaca file lalu mengirim 1000 baris per panggilan).
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
  const [bertahap, setBertahap] = useState(false);

  useEffect(() => {
    listLembaga({ per_page: 1000 }).then((p) => setLembagas(p.data)).catch(() => setLembagas([]));
  }, []);

  const dataTerkunci = lembagas.length === 1 || jenjangAktif != null;

  useEffect(() => {
    if (!open) return;
    setBertahap(false);
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
            santri minimal terdaftar di 1 jenjang. Cocok santri_id lalu NIS + lembaga; baris baru otomatis dibuat.
            Bila `tahaj_masuk` diisi (tahun ajaran yang ada), riwayat belajar perdana dibuat
            otomatis memakai `tingkat_masuk`.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
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
            <p className="text-xs text-muted-foreground">Terisi santri_id — edit lalu import untuk update.</p>
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
          <div className="col-span-2 flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Langkah 2 — Import bertahap</p>
            <p className="text-xs text-muted-foreground">
              File dibaca di browser lalu dikirim 1000 baris per panggilan — ringan untuk ribuan baris.
            </p>
            <Button
              id="btn_buka_import_santri_bertahap"
              type="button"
              className="self-start"
              onClick={() => setBertahap(true)}
            >
              <Upload data-icon="inline-start" size={16} /> Buka import bertahap
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
      <ImportSantriBertahapDialog open={bertahap} onOpenChange={setBertahap} onSelesai={() => { setBertahap(false); onOpenChange(false); void onDone(); }} />
    </Dialog>
  );
}

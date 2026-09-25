import { FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ImportBertahapUmumDialog from '@/components/ImportBertahapUmumDialog';
import { KOLOM_IMPORT_PSB } from '@/components/psb/bersama';
import {
  batalPotongPsb,
  importPsbPotong,
  unduhGalatPsb,
  type PsbGelombang,
} from '@/api/psb';
import type { Lembaga } from '@/api/master';

/** Dialog import bertahap PSB: konteks gelombang + lembaga tujuan per sesi. */
export function DialogImportPsb({ open, gelombangs, lembagas, gelombang, lembaga, onGelombang, onLembaga, onOpenChange, onSelesai, onTemplate }: {
  open: boolean;
  gelombangs: PsbGelombang[];
  lembagas: Lembaga[];
  gelombang: string;
  lembaga: string;
  onGelombang: (v: string) => void;
  onLembaga: (v: string) => void;
  onOpenChange: (open: boolean) => void;
  onSelesai: () => void;
  onTemplate: () => Promise<unknown>;
}) {
  return (
    <ImportBertahapUmumDialog
      open={open}
      onOpenChange={onOpenChange}
      config={{
        idPrefix: 'psb',
        judul: 'Import data PSB bertahap',
        deskripsi: 'Pilih gelombang + lembaga. Kolom wajib: nik dan nama_lengkap.',
        kolom: KOLOM_IMPORT_PSB,
        wajib: ['nik', 'nama_lengkap'],
        idTombol: { template: 'btn_template_psb' },
        labelTemplate: 'Unduh template Excel',
        unduhTemplate: onTemplate,
        konteks: () => ({ gelombang_id: Number(gelombang), jenjang: lembaga }),
        konteksSiap: gelombang !== '' && lembaga !== '',
        kirim: ({ sesi_id, mode, total, konteks, baris, terakhir }) =>
          importPsbPotong({
            ...(sesi_id === undefined ? {} : { sesi_id }),
            mode, ...(sesi_id === undefined ? { total } : {}),
            gelombang_id: Number(konteks.gelombang_id),
            jenjang: String(konteks.jenjang),
            baris, ...(terakhir ? { terakhir } : {}),
          }),
        batal: batalPotongPsb,
        unduhGalat: unduhGalatPsb,
        children: (
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="select_gelombang_psb">Gelombang</FieldLabel>
              <Select value={gelombang} onValueChange={onGelombang}>
                <SelectTrigger id="select_gelombang_psb" className="w-full">
                  <SelectValue placeholder="Pilih gelombang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {gelombangs.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.nama}{g.tahun_ajaran ? ` — ${g.tahun_ajaran.nama}` : ''}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="select_import_psb_lembaga">Lembaga tujuan</FieldLabel>
              <Select value={lembaga} onValueChange={onLembaga}>
                <SelectTrigger id="select_import_psb_lembaga" className="w-full">
                  <SelectValue placeholder="Pilih lembaga" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {lembagas.map((l) => (
                      <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        ),
        onSelesai,
      }}
    />
  );
}

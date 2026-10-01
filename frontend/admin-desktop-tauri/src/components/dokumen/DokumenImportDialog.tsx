import ImportBertahapUmumDialog from '@/components/ImportBertahapUmumDialog';
import {
  batalPotongDokumen,
  dataDokumenExisting,
  importDokumenPotong,
  KOLOM_IMPORT_DOKUMEN,
  unduhGalatDokumen,
  unduhTemplateDokumen,
  type TipeDokumen,
} from '@/api/dokumen';

const LABEL_TIPE: Record<TipeDokumen, string> = {
  santri: 'santri',
  pegawai: 'guru',
  lembaga: 'madrasah',
};

const WAJIB: Record<TipeDokumen, string[]> = {
  santri: ['nis_lokal', 'jenjang', 'jenis_dokumen'],
  pegawai: ['jenjang', 'jenis_dokumen'],
  lembaga: ['jenjang', 'jenis_dokumen'],
};

const DESKRIPSI: Record<TipeDokumen, string> = {
  santri: 'Kolom wajib: nis_lokal + jenjang + jenis_dokumen. Yang diimport adalah data dokumen (bukan berkas fisik); baris cocok diperbarui hanya kolom terisi.',
  pegawai: 'Kolom wajib: jenjang + jenis_dokumen, plus identitas pegawai (pegawai_id / NIPP / nama unik). Yang diimport adalah data dokumen (bukan berkas fisik).',
  lembaga: 'Kolom wajib: jenjang + jenis_dokumen. Yang diimport adalah data dokumen (bukan berkas fisik); baris cocok diperbarui hanya kolom terisi.',
};

/** Dialog import daftar dokumen (checklist) per tipe — pembungkus dialog generik. */
export default function DokumenImportDialog({ open, onOpenChange, tipe, onSelesai }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tipe: TipeDokumen;
  onSelesai: () => void;
}) {
  const kolom = KOLOM_IMPORT_DOKUMEN[tipe];

  return (
    <ImportBertahapUmumDialog
      open={open}
      onOpenChange={onOpenChange}
      config={{
        idPrefix: `dokumen_${tipe}`,
        judul: `Import daftar dokumen ${LABEL_TIPE[tipe]}`,
        deskripsi: DESKRIPSI[tipe],
        kolom,
        wajib: WAJIB[tipe],
        labelTemplate: `Unduh template Excel ${LABEL_TIPE[tipe]}`,
        unduhTemplate: () => unduhTemplateDokumen(tipe),
        unduhData: {
          label: `Unduh data dokumen ${LABEL_TIPE[tipe]} existing`,
          ambil: (jenjangs) => dataDokumenExisting(tipe, jenjangs),
          namaBerkas: `data-dokumen-${tipe}-existing.xlsx`,
          judulSheet: 'Data Dokumen',
        },
        kirim: ({ sesi_id, mode, total, baris, terakhir }) =>
          importDokumenPotong(tipe, {
            ...(sesi_id === undefined ? {} : { sesi_id }),
            mode, ...(sesi_id === undefined ? { total } : {}), baris,
            ...(terakhir ? { terakhir } : {}),
          }),
        batal: (sid) => batalPotongDokumen(tipe, sid),
        unduhGalat: (sid) => unduhGalatDokumen(tipe, sid),
        onSelesai: () => {
          onOpenChange(false);
          onSelesai();
        },
      }}
    />
  );
}

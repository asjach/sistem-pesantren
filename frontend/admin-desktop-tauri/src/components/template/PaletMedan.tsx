import { TIPE_MEDAN, type TipeMedan } from '@/lib/template/tipe';

const LABEL: Record<TipeMedan, string> = {
  teks: 'Teks',
  paragraf: 'Paragraf',
  gambar: 'Gambar',
  centang: 'Centang',
  tanda_tangan: 'Tanda tangan',
  baris_berulang: 'Daftar baris',
  halaman_otomatis: 'Nomor halaman',
  garis: 'Garis',
  kotak: 'Kotak',
};

const KETERANGAN: Record<TipeMedan, string> = {
  teks: 'Satu baris: nama, nomor, NIP.',
  paragraf: 'Banyak baris: alamat, keterangan, isi surat.',
  gambar: 'Foto, logo, atau stempel.',
  centang: 'Tanda centang bila nilai cocok.',
  tanda_tangan: 'Hanya penanda tempat, tidak dicetak.',
  baris_berulang: 'Tabel isi dari daftar di database.',
  halaman_otomatis: 'Nomor halaman berjalan.',
  garis: 'Pemisah, garis kop, atau garis tabel.',
  kotak: 'Pembatas kolom atau judul seksi berlatar.',
};

interface PaletMedanProps {
  /** Tipe yang sedang diseret, untuk memberi umpan balik visual. */
  seret?: TipeMedan | null;
  onSeretMulai: (tipe: TipeMedan, e: React.DragEvent) => void;
  onSeretSelesai: () => void;
  onTambah: (tipe: TipeMedan) => void;
}

/**
 * Palet jenis medan. Seret ke kanvas untuk menentukan posisi, atau klik untuk
 * memakai posisi bawaan. Seret memakai HTML5 drag and drop, sama seperti
 * penyusunan kolom tabel yang sudah dipakai di proyek ini.
 */
export default function PaletMedan({ seret, onSeretMulai, onSeretSelesai, onTambah }: PaletMedanProps) {
  return (
    <div className="flex flex-col gap-1 p-2">
      {TIPE_MEDAN.map((tipe) => (
        <button
          key={tipe}
          id={`btn_palet_${tipe}`}
          type="button"
          draggable
          onDragStart={(e) => onSeretMulai(tipe, e)}
          onDragEnd={onSeretSelesai}
          onClick={() => onTambah(tipe)}
          title={KETERANGAN[tipe]}
          className={
            seret === tipe
              ? 'rounded-md border border-primary bg-primary/10 px-2 py-1.5 text-left text-sm'
              : 'rounded-md border border-border px-2 py-1.5 text-left text-sm hover:border-primary/60 hover:bg-accent'
          }
        >
          <span className="block font-medium">{LABEL[tipe]}</span>
          <span className="block text-xs text-muted-foreground">{KETERANGAN[tipe]}</span>
        </button>
      ))}
    </div>
  );
}

export { LABEL as LABEL_TIPE_MEDAN, KETERANGAN as KETERANGAN_TIPE_MEDAN };

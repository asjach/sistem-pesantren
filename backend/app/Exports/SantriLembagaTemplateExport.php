<?php

namespace App\Exports;

use App\Models\Lembaga;
use App\Models\Santri;
use App\Services\RefService;
use App\Services\SantriImporService;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Template import GABUNGAN siswa — urutan kolom: blok `lembaga_santri` dulu
 * (keanggotaan), lalu seluruh kolom profil (`Santri::KOLOM_PROFIL`).
 * File ini juga bisa dipakai memutakhirkan data (round-trip: unduh data
 * existing → edit → upload; kolom `santri_id` sebagai kunci eksak).
 *
 * - Seluruh sel bertipe TEKS (NIS/NIK/NISN tidak berubah jadi angka).
 * - Header: KUNING = wajib diisi, BIRU = opsional. `nik`/`nis_lokal`
 *   salah-satu-wajib (minimal satu kunci identitas selain santri_id).
 * - `jenjang` kunci lembaga (case-insensitive, mis. MI/MD/MTS/MLN); dropdown
 *   dibatasi lingkup pengunduh.
 * - Daftar nilai dropdown disimpan di sheet tersembunyi "Referensi"
 *   (import hanya membaca sheet pertama).
 */
class SantriLembagaTemplateExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithEvents, WithHeadings, WithTitle
{
    /** Batas baris data yang diberi dropdown/border (baris 2–5001). Bukan batas
     *  import: baris di luar rentang ini tetap diproses (tanpa dropdown bantuannya). */
    private const BARIS_TERAKHIR = 5001;

    /** Blok keanggotaan — selalu di awal, sebelum kolom profil. */
    public const BLOK_LEMBAGA = [
        'santri_id', 'jenjang', 'nis_lokal',
        'nis_kemenag', 'is_active_lembaga', 'tgl_masuk', 'tgl_selesai',
        'tahaj_masuk', 'tingkat_masuk', 'no_urut',
        'nama_sekolah_asal', 'npsn_sekolah_asal', 'nss_sekolah_asal', 'alamat_sekolah_asal',
    ];

    public function __construct(private ?string $lembagaId = null, private array $kodeDiizinkan = []) {}

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    /** Satu sumber daftar kolom (dipakai heading, baris contoh, & validasi). */
    public static function kolom(): array
    {
        return array_merge(self::BLOK_LEMBAGA, Santri::KOLOM_PROFIL);
    }

    /** Kolom wajib = rule import bertanda `required` + kunci lembaga/identitas. */
    public static function kolomWajib(): array
    {
        // jenjang/nama_lengkap/jk memakai `required_without` (bukan `required`
        // polos) sehingga tidak tertangkap pemindaian rule — tandai eksplisit.
        $wajib = ['jenjang', 'nama_lengkap', 'jk'];
        foreach (SantriImporService::rules() as $kolom => $aturan) {
            if (in_array('required', $aturan, true)) {
                $wajib[] = $kolom;
            }
        }

        return array_unique($wajib);
    }

    /**
     * Pilihan dropdown per kolom: enum tetap + kamus efektif `RefService`.
     *
     * @return array<string, string[]>
     */
    public function pilihan(): array
    {
        $pilihan = [
            'jk' => ['L', 'P'],
            'tipe_santri' => ['asrama', 'non_asrama'],
            'kewarganegaraan' => ['WNI', 'WNA'],
            'is_active_lembaga' => ['Ya', 'Tidak'],
            'jenjang' => $this->jenjangOperasional(),
        ];

        foreach (SantriTemplateExport::REF_KOLOM as $kolom => $tipe) {
            if (! array_key_exists($kolom, $pilihan)) {
                $pilihan[$kolom] = RefService::kodeAktif($tipe, $this->lembagaId);
            }
        }

        return $pilihan;
    }

    /** Jenjang lembaga operasional untuk dropdown (dibatasi lingkup pengunduh). */
    protected function jenjangOperasional(): array
    {
        if ($this->kodeDiizinkan !== []) {
            return array_values($this->kodeDiizinkan);
        }

        return Lembaga::query()
            ->when($this->lembagaId !== null, fn ($q) => $q->where('jenjang', $this->lembagaId))
            ->orderBy('jenjang')
            ->pluck('jenjang')
            ->all();
    }

    public function headings(): array
    {
        return self::kolom();
    }

    public function title(): string
    {
        return 'Data Siswa';
    }

    public function array(): array
    {
        $jenjang = $this->jenjangOperasional();
        $contoh = [
            'santri_id' => '',
            'jenjang' => $jenjang[0] ?? '',
            'nis_lokal' => '26001',
            'nis_kemenag' => '',
            'is_active_lembaga' => 'Ya',
            'tgl_masuk' => '2026-07-01',
            'tgl_selesai' => '',
            'tahaj_masuk' => '2026/2027',
            'tingkat_masuk' => '1',
            'no_urut' => '1',
            'nama_sekolah_asal' => 'SD Negeri 1 Bangkalan',
            'npsn_sekolah_asal' => '20512345',
            'nss_sekolah_asal' => '',
            'alamat_sekolah_asal' => '',
            'nama_lengkap' => 'Ahmad Fauzi',
            'nama_singkat' => 'Ahmad',
            'nik' => '1234567890123456',
            'nisn' => '1234567890',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
            'tmp_lahir' => 'Bangkalan',
            'tipe_santri' => 'non_asrama',
            'kewarganegaraan' => 'WNI',
        ];

        // Kolom dropdown: pakai nilai efektif pertama agar contoh pasti valid.
        foreach ($this->pilihan() as $kolom => $nilai) {
            if (in_array($kolom, self::kolom(), true) && $nilai !== [] && ! isset($contoh[$kolom])) {
                $contoh[$kolom] = $nilai[0];
            }
        }

        return [array_map(fn (string $kolom) => $contoh[$kolom] ?? '', self::kolom())];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $kolom = self::kolom();
                $wajib = self::kolomWajib();
                $lastCol = Coordinate::stringFromColumnIndex(count($kolom));
                $lastRow = self::BARIS_TERAKHIR;

                $this->gayaHeader($sheet, $kolom, $wajib, $lastCol);
                $this->isiDropdown($sheet, $kolom, $lastRow);
            },
        ];
    }

    /** Header: wajib = kuning, opsional = biru; bekukan baris 1 + autofilter. */
    private function gayaHeader(Worksheet $sheet, array $kolom, array $wajib, string $lastCol): void
    {
        $sheet->getRowDimension(1)->setRowHeight(34);

        foreach ($kolom as $i => $nama) {
            $col = Coordinate::stringFromColumnIndex($i + 1);
            $style = $sheet->getStyle("{$col}1");
            $style->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1F2937');
            $style->getFill()->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setARGB(in_array($nama, $wajib, true) ? 'FFFFE699' : 'FFDCE6F1');
            $style->getAlignment()
                ->setWrapText(true)
                ->setVertical(Alignment::VERTICAL_CENTER)
                ->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $style->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setARGB('FF9CA3AF');

            $sheet->getColumnDimension($col)->setWidth(in_array($nama, ['nama_lengkap', 'alamat', 'email_santri'], true) ? 28 : 18);
        }

        $sheet->freezePane('A2');
        $sheet->setAutoFilter("A1:{$lastCol}1");
    }

    /** Dropdown data-validation + daftar nilai di sheet tersembunyi "Referensi". */
    private function isiDropdown(Worksheet $sheet, array $kolom, int $lastRow): void
    {
        $referensi = $sheet->getParent()->createSheet();
        $referensi->setTitle('Referensi');
        $referensi->setSheetState(Worksheet::SHEETSTATE_HIDDEN);

        $colSumber = 1;
        foreach ($this->pilihan() as $nama => $nilai) {
            if ($nilai === []) {
                continue;
            }
            $posisi = array_search($nama, $kolom, true);
            if ($posisi === false) {
                continue;
            }

            $sumber = Coordinate::stringFromColumnIndex($colSumber);
            $referensi->setCellValue("{$sumber}1", "pilihan_{$nama}");
            foreach ($nilai as $r => $v) {
                $referensi->setCellValueExplicit("{$sumber}".($r + 2), (string) $v, DataType::TYPE_STRING);
            }
            $referensi->getColumnDimension($sumber)->setWidth(20);

            $target = Coordinate::stringFromColumnIndex($posisi + 1);
            $batas = count($nilai) + 1;
            $validasi = new DataValidation;
            // CATAT: atribut OOXML `showDropDown` INVERTED — lihat SantriTemplateExport.
            $validasi->setType(DataValidation::TYPE_LIST)
                ->setShowDropDown(true)
                ->setErrorStyle(DataValidation::STYLE_STOP)
                ->setAllowBlank(true)
                ->setShowErrorMessage(true)
                ->setErrorTitle('Nilai tidak valid')
                ->setError('Pilih nilai dari daftar. Unduh ulang template bila referensi baru saja berubah.')
                ->setFormula1("'Referensi'!$".$sumber.'$2:$'.$sumber.'$'.$batas);
            $sheet->setDataValidation("{$target}2:{$target}{$lastRow}", $validasi);

            $colSumber++;
        }
    }
}

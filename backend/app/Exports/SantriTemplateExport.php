<?php

namespace App\Exports;

use App\Imports\SantriLengkapImport;
use App\Models\Santri;
use App\Services\RefService;
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
 * Template import santri (101) — heading snake_case mengikuti SantriLengkapImport:
 * seluruh kolom profil (`Santri::KOLOM_PROFIL`) + kolom penempatan/lembaga.
 *
 * - Seluruh sel bertipe TEKS (NIS/NIK/NISN/RT tidak berubah jadi angka).
 * - Header: KUNING = wajib diisi, BIRU = opsional (nullable).
 * - Kolom enum/kamus diberi dropdown data-validation; nilainya dibaca LIVE dari
 *   `RefService` (global + shadow lembaga terpilih) sehingga admin cukup mengunduh
 *   ulang template setelah menambah/mengubah nilai referensi.
 * - Daftar nilai dropdown disimpan di sheet tersembunyi "Referensi"
 *   (import hanya membaca sheet pertama — lihat SantriLengkapImport::sheets()).
 */
class SantriTemplateExport extends DefaultValueBinder implements FromArray, WithHeadings, WithCustomValueBinder, WithEvents, WithTitle
{
    /** Batas baris data yang diberi dropdown/border (baris 2–1001). */
    private const BARIS_TERAKHIR = 1001;

    /** Kolom santri → tipe kamus `RefService` (dropdown). */
    public const REF_KOLOM = [
        'agama' => 'agama',
        'cita_cita' => 'cita_cita',
        'hobi' => 'hobi',
        'kebutuhan_khusus' => 'kebutuhan_khusus',
        'kebutuhan_disabilitas' => 'disabilitas',
        'tmp_lahir' => 'tmp_lahir',
        'ayah_tmp_lahir' => 'tmp_lahir',
        'ibu_tmp_lahir' => 'tmp_lahir',
        'wali_tmp_lahir' => 'tmp_lahir',
        'ayah_status' => 'status_ortu',
        'ibu_status' => 'status_ortu',
        'wali_status' => 'status_ortu',
        'ayah_pekerjaan' => 'pekerjaan',
        'ibu_pekerjaan' => 'pekerjaan',
        'wali_pekerjaan' => 'pekerjaan',
        'ayah_pendidikan' => 'pendidikan',
        'ibu_pendidikan' => 'pendidikan',
        'wali_pendidikan' => 'pendidikan',
        'ayah_penghasilan' => 'penghasilan',
        'ibu_penghasilan' => 'penghasilan',
        'wali_penghasilan' => 'penghasilan',
        'ayah_status_tempat_tinggal' => 'status_tinggal',
        'ibu_status_tempat_tinggal' => 'status_tinggal',
        'wali_status_tempat_tinggal' => 'status_tinggal',
        'status_tempat_tinggal' => 'status_tinggal',
        'jarak_ke_pesantren' => 'jarak',
        'waktu_tempuh' => 'waktu_tempuh',
        'transportasi' => 'transportasi',
        'bahasa_sehari' => 'bahasa_sehari_hari',
        'yang_membiayai' => 'yang_membiayai',
        'provinsi' => 'provinsi',
        'kab_kota' => 'kota',
        'kecamatan' => 'kecamatan',
        'desa_kelurahan' => 'desa_kelurahan',
    ];

    public function __construct(private ?int $lembagaId = null) {}

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    /** Satu sumber daftar kolom (dipakai heading, baris contoh, & validasi). */
    public static function kolom(): array
    {
        return array_merge(
            ['lembaga_id', 'kelas_id', 'tingkat', 'no_absen'],
            Santri::KOLOM_PROFIL,
        );
    }

    /** Kolom wajib = rule import bertanda `required` (satu sumber kebenaran). */
    public static function kolomWajib(): array
    {
        $wajib = [];
        foreach ((new SantriLengkapImport(null))->rules() as $kolom => $aturan) {
            if (in_array('required', $aturan, true)) {
                $wajib[] = $kolom;
            }
        }

        return $wajib;
    }

    /**
     * Pilihan dropdown per kolom: enum tetap + kamus efektif `RefService` (data terbaru).
     *
     * @return array<string, string[]>
     */
    public function pilihan(): array
    {
        $pilihan = [
            'jk' => ['L', 'P'],
            'tipe_santri' => ['asrama', 'non_asrama'],
            'kewarganegaraan' => ['WNI', 'WNA'],
        ];

        foreach (self::REF_KOLOM as $kolom => $tipe) {
            if (! array_key_exists($kolom, $pilihan)) {
                $pilihan[$kolom] = RefService::kodeAktif($tipe, $this->lembagaId);
            }
        }

        return $pilihan;
    }

    public function headings(): array
    {
        return self::kolom();
    }

    public function title(): string
    {
        return 'Data Santri';
    }

    public function array(): array
    {
        $contoh = [
            'nama_lengkap' => 'Ahmad Fauzi',
            'nama_singkat' => 'Ahmad',
            'nik' => '1234567890123456',
            'nisn' => '1234567890',
            'nis' => '26001',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
            'tmp_lahir' => 'Bangkalan',
            'tipe_santri' => 'non_asrama',
            'kewarganegaraan' => 'WNI',
        ];

        // Kolom dropdown: pakai nilai efektif pertama agar contoh pasti valid.
        foreach ($this->pilihan() as $kolom => $nilai) {
            if (in_array($kolom, self::kolom(), true) && $nilai !== []) {
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
            $validasi = new DataValidation();
            $validasi->setType(DataValidation::TYPE_LIST)
                ->setErrorStyle(DataValidation::STYLE_STOP)
                ->setAllowBlank(true)
                ->setShowErrorMessage(true)
                ->setErrorTitle('Nilai tidak valid')
                ->setError('Pilih nilai dari daftar. Unduh ulang template bila referensi baru saja berubah.')
                ->setFormula1("'Referensi'!$".$sumber."$2:$".$sumber."$".$batas);
            $sheet->setDataValidation("{$target}2:{$target}{$lastRow}", $validasi);

            $colSumber++;
        }
    }
}

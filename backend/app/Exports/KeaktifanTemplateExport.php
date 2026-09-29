<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Template import riwayat keaktifan pegawai — kolom kunci: pegawai_id/nipp +
 * jenjang + tahun_ajaran. Baris hanya sah bila penempatan (`lembaga_pegawai`)
 * ada di lembaga baris; tugas kosong mewarisi penempatan.
 *
 * Gaya (sejajar SantriTemplateExport): header wajib kuning / opsional biru,
 * bekukan baris 1 + autofilter, baris 2 = CONTOH italic abu-abu (wajib
 * diganti/dihapus sebelum import), dropdown dari sheet Referensi tersembunyi.
 */
class KeaktifanTemplateExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithEvents, WithHeadings, WithTitle
{
    private const BARIS_TERAKHIR = 5001;

    /** Lebar kolom khusus; kolom lain 18. */
    private const LEBAR = [
        'pegawai_id' => 12, 'nipp' => 14, 'nama_lengkap' => 28,
        'jenjang' => 10, 'tahun_ajaran' => 14, 'tugas_utama' => 18,
        'status_keaktifan' => 16, 'no_sk' => 24, 'tgl_sk' => 12,
    ];

    public static function kolom(): array
    {
        return [
            'pegawai_id', 'nipp', 'nama_lengkap', 'jenjang', 'tahun_ajaran',
            'tugas_utama', 'status_keaktifan', 'no_sk', 'tgl_sk',
        ];
    }

    public static function kolomWajib(): array
    {
        return ['jenjang', 'tahun_ajaran'];
    }

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    public function headings(): array
    {
        return self::kolom();
    }

    public function title(): string
    {
        return 'Keaktifan Pegawai';
    }

    public function array(): array
    {
        return [[
            '', 'PST-001', '', 'MI', '2025/2026',
            'Guru Kelas', 'Ya', 'SK/001/2025', '2025-07-01',
        ]];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $kolom = self::kolom();
                $wajib = self::kolomWajib();
                $lastCol = Coordinate::stringFromColumnIndex(count($kolom));

                $this->gayaHeader($sheet, $kolom, $wajib, $lastCol);
                $this->gayaContoh($sheet, $kolom);
                $this->isiDropdown($sheet, $kolom);
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

            $sheet->getColumnDimension($col)->setWidth(self::LEBAR[$nama] ?? 18);
        }

        $sheet->freezePane('A2');
        $sheet->setAutoFilter("A1:{$lastCol}1");
    }

    /** Baris 2 (CONTOH): italic abu-abu + isian abu muda — tanda wajib diganti/dihapus. */
    private function gayaContoh(Worksheet $sheet, array $kolom): void
    {
        $sheet->getRowDimension(2)->setRowHeight(20);
        $lastCol = Coordinate::stringFromColumnIndex(count($kolom));

        $sheet->getStyle("A2:{$lastCol}2")->applyFromArray([
            'font' => ['italic' => true, 'size' => 10, 'color' => ['argb' => 'FF6B7280']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF3F4F6']],
        ]);
    }

    /** Dropdown data-validation + daftar nilai di sheet tersembunyi "Referensi". */
    private function isiDropdown(Worksheet $sheet, array $kolom): void
    {
        $referensi = $sheet->getParent()->createSheet();
        $referensi->setTitle('Referensi');
        $referensi->setSheetState(Worksheet::SHEETSTATE_HIDDEN);

        $opsi = [
            'jenjang' => ['MI', 'MD', 'MTS', 'MA', 'MLN'],
            'status_keaktifan' => ['Ya', 'Tidak'],
        ];
        $colSumber = 1;
        foreach ($opsi as $nama => $nilai) {
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
            // CATAT: atribut OOXML `showDropDown` INVERTED — writer PhpSpreadsheet menulis
            // "0" saat properti true. Tanpa setShowDropDown(true), XML berisi "1" dan Excel
            // MENGSEMBUNYIKAN panah dropdown (Reader/Xlsx/DataValidations.php:45).
            $validasi->setType(DataValidation::TYPE_LIST)
                ->setShowDropDown(true)
                ->setErrorStyle(DataValidation::STYLE_STOP)
                ->setAllowBlank(true)
                ->setShowErrorMessage(true)
                ->setErrorTitle('Nilai tidak valid')
                ->setError('Pilih nilai dari daftar.')
                ->setFormula1("'Referensi'!$".$sumber.'$2:$'.$sumber.'$'.$batas);
            $sheet->setDataValidation("{$target}2:{$target}".self::BARIS_TERAKHIR, $validasi);

            $colSumber++;
        }
    }
}

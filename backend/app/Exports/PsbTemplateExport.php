<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Template import PSB — kolom mengikuti PsbImport::rules() (heading_row snake_case).
 *
 * Header berkode warna (seragam template lain): kuning = wajib diisi,
 * biru = opsional.
 */
class PsbTemplateExport implements FromArray, WithEvents, WithHeadings
{
    /** Kolom wajib sesuai PsbImport::rules(). */
    public const WAJIB = ['nik', 'nama_lengkap'];

    public function headings(): array
    {
        return [
            'nik',
            'nama_lengkap',
            'jk',
            'tgl_lahir',
            'tipe_santri',
            'email_ortu',
            'telp_ortu',
            'nama_ayah',
            'nama_ibu',
            'no_pendaftaran',
        ];
    }

    public function array(): array
    {
        return [[
            '1234567890123456',
            'Ahmad Fauzi',
            'L',
            '2015-07-01',
            'non_asrama',
            'ortu@example.com',
            '081234567890',
            'Bapak Fauzi',
            'Ibu Fauzi',
            '',
        ]];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $kolom = $this->headings();
                $lastCol = Coordinate::stringFromColumnIndex(count($kolom));

                $sheet->getRowDimension(1)->setRowHeight(30);
                foreach ($kolom as $i => $nama) {
                    $col = Coordinate::stringFromColumnIndex($i + 1);
                    $style = $sheet->getStyle("{$col}1");
                    $style->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1F2937');
                    $style->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB(
                        in_array($nama, self::WAJIB, true) ? 'FFFFE699' : 'FFDCE6F1'
                    );
                    $style->getAlignment()->setWrapText(true)->setVertical(Alignment::VERTICAL_CENTER)->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $style->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setARGB('FF9CA3AF');
                    $sheet->getColumnDimension($col)->setWidth(18);
                }
                $sheet->freezePane('A2');
                $sheet->setAutoFilter("A1:{$lastCol}1");
            },
        ];
    }
}

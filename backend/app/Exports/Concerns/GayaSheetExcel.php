<?php

namespace App\Exports\Concerns;

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Gaya sheet seragam untuk export data existing (dipakai juga template):
 * header tebal — kuning = wajib diisi, biru = opsional — baris 1 dibekukan,
 * autofilter, border tipis, dan zebra pada baris data.
 */
trait GayaSheetExcel
{
    /** Batas baris data yang diberi zebra (baris lebih dari ini tetap rapi
     *  lewat header + border; zebra di_skip agar berkas besar tak berat). */
    protected const MAKS_BARIS_ZEBRA = 5000;

    /**
     * @param  list<string>  $kolom  nama kolom sesuai urutan heading
     * @param  list<string>  $wajib  subset kolom wajib (kuning)
     * @param  array<string, int>  $lebar  lebar khusus per kolom
     */
    protected function gayaSheet(Worksheet $sheet, array $kolom, array $wajib, array $lebar = []): void
    {
        $lastCol = Coordinate::stringFromColumnIndex(count($kolom));

        $sheet->getRowDimension(1)->setRowHeight(30);
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

            $sheet->getColumnDimension($col)->setWidth($lebar[$nama] ?? 18);
        }

        $sheet->freezePane('A2');
        $sheet->setAutoFilter("A1:{$lastCol}1");

        $lastRow = $sheet->getHighestRow();
        if ($lastRow < 2) {
            return;
        }

        $sheet->getStyle("A2:{$lastCol}{$lastRow}")
            ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setARGB('FFE5E7EB');

        for ($baris = 2; $baris <= min($lastRow, self::MAKS_BARIS_ZEBRA + 1); $baris += 2) {
            $sheet->getStyle("A{$baris}:{$lastCol}{$baris}")
                ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFF8FAFC');
        }
    }
}

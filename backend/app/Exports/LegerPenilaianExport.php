<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;

/**
 * Unduh Leger Nilai (crosstab santri × mapel) ke Excel. Kolom & baris disusun
 * controller (sumber yang sama dengan tampilan tabel) — kelas ini hanya
 * memaksa seluruh sel bertipe teks agar NIS/angka tak diformat ulang Excel.
 */
class LegerPenilaianExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithHeadings, WithTitle
{
    /**
     * @param  list<string>  $kolom
     * @param  list<list<string|int|float|null>>  $baris
     */
    public function __construct(private array $kolom, private array $baris) {}

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    public function headings(): array
    {
        return $this->kolom;
    }

    public function array(): array
    {
        return $this->baris;
    }

    public function title(): string
    {
        return 'Leger Nilai';
    }
}

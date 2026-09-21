<?php

namespace App\Exports;

use App\Models\Kelas;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;

/**
 * Unduh daftar nama kelas satu lembaga + TA — pasangan dari import-nama
 * (berkas ini bisa menjadi acuan/arsip sisi seberang). Sel bertipe TEKS.
 */
class KelasNamaExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithHeadings, WithTitle
{
    public function __construct(private int $lembagaId, private string $tahunAjaran) {}

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    public function headings(): array
    {
        return ['nama_kelas', 'tingkat', 'urutan'];
    }

    public function title(): string
    {
        return 'Daftar Kelas';
    }

    public function array(): array
    {
        return Kelas::where('lembaga_id', $this->lembagaId)
            ->where('tahun_ajaran', $this->tahunAjaran)
            ->orderBy('urutan')->orderBy('nama_kelas')
            ->get(['nama_kelas', 'tingkat', 'urutan'])
            ->map(fn (Kelas $k) => [
                (string) $k->nama_kelas,
                (string) ($k->tingkat ?? ''),
                (string) $k->urutan,
            ])
            ->all();
    }
}

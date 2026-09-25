<?php

namespace App\Exports;

use App\Exports\Concerns\GayaSheetExcel;
use App\Models\Kelas;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;

/**
 * Unduh data kelas existing — kolom SAMA PERSIS dengan template import
 * (`KelasTemplateExport::kolom()`), terisi data nyata. Alur round-trip:
 * unduh → edit sel → import lagi (kunci = jenjang + tahun_ajaran + nama_kelas).
 *
 * `walas` diisi NIP (import menerima NIP lebih dulu, fallback nama). Seluruh
 * sel bertipe TEKS agar angka tidak berubah format.
 */
class KelasDataExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithEvents, WithHeadings, WithTitle
{
    use GayaSheetExcel;

    /** @param  list<string>  $jenjang  lembaga yang boleh diakses (sudah disaring) */
    public function __construct(private array $jenjang) {}

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    public function headings(): array
    {
        return KelasTemplateExport::kolom();
    }

    public function title(): string
    {
        return 'Data Kelas';
    }

    public function array(): array
    {
        if ($this->jenjang === []) {
            return [];
        }

        return Kelas::with('walas:id,nip,nama_lengkap')
            ->whereIn('jenjang', $this->jenjang)
            ->orderBy('jenjang')
            ->orderBy('tahun_ajaran')
            ->orderBy('urutan')
            ->orderBy('nama_kelas')
            ->get()
            ->map(fn (Kelas $k) => [
                (string) $k->jenjang,
                (string) $k->tahun_ajaran,
                (string) $k->nama_kelas,
                (string) ($k->nama_alias ?? ''),
                (string) ($k->walas?->nip ?? $k->walas?->nama_lengkap ?? ''),
                (string) ($k->tingkat ?? ''),
                (string) ($k->urutan ?? ''),
                $k->kapasitas === null ? '' : (string) $k->kapasitas,
            ])
            ->all();
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $this->gayaSheet($event->sheet->getDelegate(), KelasTemplateExport::kolom(), KelasTemplateExport::WAJIB, ['nama_kelas' => 20, 'nama_alias' => 20, 'walas' => 24]);
            },
        ];
    }
}

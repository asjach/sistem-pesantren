<?php

namespace App\Exports;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Santri;
use Carbon\CarbonInterface;
use DateTimeInterface;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;

/**
 * Unduh data siswa existing satu lembaga — kolom SAMA PERSIS dengan template
 * gabungan (`SantriLembagaTemplateExport::kolom()`), terisi `santri_id` +
 * profil + keanggotaan. Alur round-trip: unduh → edit sel → upload via
 * import gabungan (`santri_id` menjadi kunci eksak).
 *
 * Seluruh sel bertipe TEKS agar NIS/NIK tidak berubah jadi angka saat dibuka.
 */
class SantriLembagaDataExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithHeadings, WithTitle
{
    public function __construct(private int $lembagaId) {}

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    public function headings(): array
    {
        return SantriLembagaTemplateExport::kolom();
    }

    public function title(): string
    {
        return 'Data Siswa';
    }

    public function array(): array
    {
        $kode = Lembaga::whereKey($this->lembagaId)->value('kode');

        return LembagaSantri::where('lembaga_id', $this->lembagaId)
            ->with('santri')
            ->orderBy('santri_id')
            ->get()
            ->filter(fn (LembagaSantri $ls) => $ls->santri !== null)
            ->map(function (LembagaSantri $ls) use ($kode) {
                $s = $ls->santri;
                $baris = [
                    'santri_id' => (string) $s->id,
                    'kode_lembaga' => (string) ($kode ?? ''),
                    'lembaga_id' => (string) $ls->lembaga_id,
                    'nis_lokal' => (string) ($ls->nis_lokal ?? ''),
                    'nis_kemenag' => (string) ($ls->nis_kemenag ?? ''),
                    'is_active' => $ls->is_active ? '1' : '0',
                    'tgl_mulai' => $this->teks($ls->tgl_mulai),
                    'tgl_selesai' => $this->teks($ls->tgl_selesai),
                ];
                foreach (Santri::KOLOM_PROFIL as $kolom) {
                    $baris[$kolom] = $this->teks($s->getAttribute($kolom));
                }

                return array_map(fn (string $kolom) => $baris[$kolom] ?? '', SantriLembagaTemplateExport::kolom());
            })
            ->all();
    }

    protected function teks(mixed $nilai): string
    {
        if ($nilai === null) {
            return '';
        }
        if ($nilai instanceof CarbonInterface || $nilai instanceof DateTimeInterface) {
            return $nilai->format('Y-m-d');
        }
        if (is_bool($nilai)) {
            return $nilai ? '1' : '0';
        }

        return (string) $nilai;
    }
}

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
    /** @param  list<int>  $lembagaIds */
    public function __construct(private array $lembagaIds) {}

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
        return LembagaSantri::whereIn('jenjang', $this->lembagaIds)
            ->with('santri')
            ->orderBy('jenjang')
            ->orderBy('santri_id')
            ->get()
            ->filter(fn (LembagaSantri $ls) => $ls->santri !== null)
            ->map(function (LembagaSantri $ls) {
                $s = $ls->santri;
                $baris = [
                    'santri_id' => (string) $s->id,
                    'kode_lembaga' => (string) $ls->jenjang,
                    'jenjang' => (string) $ls->jenjang,
                    'nis_lokal' => (string) ($ls->nis_lokal ?? ''),
                    'nis_kemenag' => (string) ($ls->nis_kemenag ?? ''),
                    'is_active_lembaga' => (string) $ls->is_active_lembaga,
                    'tgl_masuk' => $this->teks($ls->tgl_masuk),
                    'tgl_selesai' => $this->teks($ls->tgl_selesai),
                    'tahaj_masuk' => (string) ($ls->tahaj_masuk ?? ''),
                    'tingkat_masuk' => (string) ($ls->tingkat_masuk ?? ''),
                    'no_urut' => $ls->no_urut !== null ? (string) $ls->no_urut : '',
                    'nama_sekolah_asal' => (string) ($ls->nama_sekolah_asal ?? ''),
                    'npsn_sekolah_asal' => (string) ($ls->npsn_sekolah_asal ?? ''),
                    'nss_sekolah_asal' => (string) ($ls->nss_sekolah_asal ?? ''),
                    'alamat_sekolah_asal' => (string) ($ls->alamat_sekolah_asal ?? ''),
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

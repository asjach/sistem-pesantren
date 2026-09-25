<?php

namespace App\Exports;

use App\Exports\Concerns\GayaSheetExcel;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use DateTimeInterface;
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
 * Unduh data arsip mutasi keluar existing — kolom SAMA PERSIS dengan template
 * import (`MutasiKeluarTemplateExport::kolom()`), terisi data nyata. Alur
 * round-trip: unduh → edit sel → import lagi (kunci = NIS lokal + jenjang +
 * tanggal; tanggal kosong tetap satu nilai).
 *
 * `kelas_terakhir` ditulis sebagai NAMA rombel + `tahun_ajaran` Rombelnya
 * (import membaca nama lebih dulu), bukan id. Semua sel bertipe TEKS.
 */
class MutasiKeluarDataExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithEvents, WithHeadings, WithTitle
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
        return MutasiKeluarTemplateExport::kolom();
    }

    public function title(): string
    {
        return 'Data Mutasi Keluar';
    }

    public function array(): array
    {
        if ($this->jenjang === []) {
            return [];
        }

        $nis = LembagaSantri::query()
            ->whereIn('jenjang', $this->jenjang)
            ->pluck('nis_lokal', 'santri_id');

        return MutasiKeluar::with('kelasTerakhir:id,nama_kelas,tahun_ajaran')
            ->whereIn('jenjang', $this->jenjang)
            ->orderBy('jenjang')
            ->orderBy('tanggal_mutasi')
            ->orderBy('id')
            ->get()
            ->map(function (MutasiKeluar $m) use ($nis) {
                return [
                    (string) ($nis[$m->santri_id] ?? ''),
                    (string) $m->jenjang,
                    $this->teks($m->tanggal_mutasi),
                    (string) ($m->alasan_mutasi ?? ''),
                    (string) ($m->kelasTerakhir?->nama_kelas ?? ''),
                    (string) ($m->kelasTerakhir?->tahun_ajaran ?? ''),
                    (string) ($m->no_surat ?? ''),
                    (string) ($m->nama_sekolah_tujuan ?? ''),
                    (string) ($m->npsn_sekolah_tujuan ?? ''),
                    (string) ($m->nsm_sekolah_tujuan ?? ''),
                    (string) ($m->alamat_sekolah_tujuan ?? ''),
                    (string) ($m->keterangan ?? ''),
                ];
            })
            ->all();
    }

    protected function teks(mixed $nilai): string
    {
        if ($nilai === null) {
            return '';
        }
        if ($nilai instanceof DateTimeInterface) {
            return $nilai->format('Y-m-d');
        }

        return (string) $nilai;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $this->gayaSheet($event->sheet->getDelegate(), MutasiKeluarTemplateExport::kolom(), MutasiKeluarTemplateExport::WAJIB, ['kelas_terakhir' => 16, 'tahun_ajaran' => 16, 'tanggal_mutasi' => 16, 'alasan_mutasi' => 26, 'nama_sekolah_tujuan' => 26, 'alamat_sekolah_tujuan' => 30, 'keterangan' => 26, 'no_surat' => 16]);
            },
        ];
    }
}

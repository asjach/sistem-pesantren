<?php

namespace App\Exports;

use App\Exports\Concerns\GayaSheetExcel;
use App\Models\RiwayatBelajar;
use App\Services\RefService;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
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
 * Unduh data riwayat belajar existing — kolom SAMA PERSIS dengan template
 * import (`RiwayatBelajarTemplateExport::KOLOM`), terisi data nyata. Alur
 * round-trip: unduh → edit sel → import lagi (kunci = NIS lokal + jenjang +
 * tahun ajaran + semester).
 *
 * `status_awal`/`status_akhir` ditulis sebagai LABEL (import memetakan label →
 * kode, kode lama tetap diterima). Semua sel bertipe TEKS.
 */
class RiwayatBelajarDataExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithEvents, WithHeadings, WithTitle
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
        return RiwayatBelajarTemplateExport::KOLOM;
    }

    public function title(): string
    {
        return 'Data Riwayat Belajar';
    }

    public function array(): array
    {
        if ($this->jenjang === []) {
            return [];
        }

        $label = $this->labelStatus();
        $baris = $this->query()->get();

        return $baris->map(fn (RiwayatBelajar $r) => [
            (string) ($r->nis_lokal ?? ''),
            (string) $r->jenjang,
            (string) $r->tahun_ajaran,
            (string) ($r->nama_kelas ?? ''),
            (string) $r->semester,
            $this->teks($r->tgl_masuk),
            $r->no_absen === null ? '' : (string) $r->no_absen,
            (string) ($r->tingkat ?? ''),
            $label['status_awal'][$r->status_awal] ?? (string) ($r->status_awal ?? ''),
            $label['status_akhir'][$r->status_akhir] ?? (string) ($r->status_akhir ?? ''),
        ])->all();
    }

    protected function query(): Builder
    {
        return RiwayatBelajar::query()
            ->leftJoin('lembaga_santri', function ($j) {
                $j->on('lembaga_santri.santri_id', '=', 'riwayat_belajar.santri_id')
                    ->on('lembaga_santri.jenjang', '=', 'riwayat_belajar.jenjang');
            })
            ->leftJoin('kelas', 'kelas.id', '=', 'riwayat_belajar.kelas_id')
            ->whereIn('riwayat_belajar.jenjang', $this->jenjang)
            ->select('riwayat_belajar.*', 'lembaga_santri.nis_lokal', 'kelas.nama_kelas')
            ->orderBy('riwayat_belajar.jenjang')
            ->orderBy('riwayat_belajar.tahun_ajaran')
            ->orderBy('riwayat_belajar.semester')
            ->orderBy('riwayat_belajar.santri_id');
    }

    /**
     * Kode → label status (label = nilai yang tampil di dropdown template).
     * Query langsung ke tabel ref (bukan cache `RefService`) supaya berkas
     * tak bergantung cache lama.
     *
     * @return array<string, array<string, string>>
     */
    protected function labelStatus(): array
    {
        $petakan = function (string $tipe): array {
            $kunci = RefService::KEY[$tipe];
            $map = [];
            $baris = DB::table(RefService::table($tipe))
                ->where('is_active', true)
                ->orderBy('urutan')
                ->orderBy('nama')
                ->get();
            foreach ($baris as $r) {
                $map[(string) $r->{$kunci}] ??= (string) $r->nama;
            }

            return $map;
        };

        return ['status_awal' => $petakan('status_awal'), 'status_akhir' => $petakan('status_akhir')];
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
                $this->gayaSheet($event->sheet->getDelegate(), RiwayatBelajarTemplateExport::KOLOM, ['nis_lokal', 'jenjang', 'tahun_ajaran', 'semester'], ['nama_kelas' => 16, 'tahun_ajaran' => 16, 'tgl_masuk' => 14]);
            },
        ];
    }
}

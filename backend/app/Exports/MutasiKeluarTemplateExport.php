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
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Template import arsip mutasi keluar: hanya heading (tanpa baris contoh agar
 * tak ikut terimport). Kunci santri: `nis_lokal` + `jenjang`.
 * `kelas_terakhir` diisi NAMA rombel (id numerik tetap diterima);
 * `tahun_ajaran` opsional sebagai lingkup pencarian nama (wajib diisi bila
 * nama yang sama ada di beberapa tahun ajaran). Sel bertipe TEKS agar NIS
 * ber-nol-depan tidak berubah format.
 *
 * Header berkode warna (seragam template lain): kuning = wajib diisi,
 * biru = opsional.
 */
class MutasiKeluarTemplateExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithEvents, WithHeadings, WithTitle
{
    /** Kolom wajib. */
    public const WAJIB = ['nis_lokal', 'jenjang', 'tanggal_mutasi', 'alasan_mutasi'];

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    public static function kolom(): array
    {
        return [
            'nis_lokal', 'jenjang', 'tanggal_mutasi', 'alasan_mutasi',
            'kelas_terakhir', 'tahun_ajaran', 'no_surat', 'nama_sekolah_tujuan',
            'npsn_sekolah_tujuan', 'nsm_sekolah_tujuan', 'alamat_sekolah_tujuan',
            'keterangan',
        ];
    }

    public function headings(): array
    {
        return self::kolom();
    }

    public function title(): string
    {
        return 'Import Mutasi Keluar';
    }

    public function array(): array
    {
        return [];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $kolom = self::kolom();
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

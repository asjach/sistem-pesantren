<?php

namespace App\Exports;

use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Template import pengampu (kelas × mapel → guru) multi-lembaga + multi-TA:
 * hanya heading (tanpa baris contoh agar tak ikut terimport). Kolom `guru`
 * diisi NIP (diutamakan) atau nama lengkap pegawai; kosong = baris pengampu
 * tanpa guru (seperti hasil Generate). Sel bertipe TEKS.
 *
 * Header berkode warna (seragam template lain): kuning = wajib diisi,
 * biru = opsional.
 */
class PengampuTemplateExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithEvents, WithHeadings, WithTitle
{
    /** Kolom wajib: lingkup per baris + kelas + mapel (`guru` boleh kosong). */
    public const WAJIB = ['jenjang', 'tahun_ajaran', 'nama_kelas', 'nama_mapel'];

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    public static function kolom(): array
    {
        return ['jenjang', 'tahun_ajaran', 'nama_kelas', 'nama_mapel', 'guru'];
    }

    public function headings(): array
    {
        return self::kolom();
    }

    public function title(): string
    {
        return 'Import Pengampu';
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

                $opsi = [
                    'jenjang' => DB::table('lembaga')->orderBy('jenjang')->pluck('jenjang')->all(),
                    'tahun_ajaran' => DB::table('tahun_ajaran')->orderBy('nama')->pluck('nama')->all(),
                ];
                foreach ($opsi as $nama => $nilai) {
                    if ($nilai === []) {
                        continue;
                    }
                    $posisi = array_search($nama, $kolom, true);
                    if ($posisi === false) {
                        continue;
                    }
                    $target = Coordinate::stringFromColumnIndex($posisi + 1);
                    $validasi = new DataValidation;

                    $validasi->setType(DataValidation::TYPE_LIST)
                        ->setShowDropDown(true)
                        ->setErrorStyle(DataValidation::STYLE_STOP)
                        ->setAllowBlank(true)
                        ->setShowErrorMessage(true)
                        ->setErrorTitle('Nilai tidak valid')
                        ->setError('Pilih nilai dari daftar.')
                        ->setFormula1('"'.implode(',', $nilai).'"');
                    $sheet->setDataValidation("{$target}2:{$target}5001", $validasi);
                }
            },
        ];
    }
}

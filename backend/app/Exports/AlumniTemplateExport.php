<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class AlumniTemplateExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithEvents, WithHeadings, WithTitle
{
    public const WAJIB = ['nis_lokal', 'jenjang', 'tahun_ajaran_lulus'];

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    public static function kolom(): array
    {
        return [
            'nis_lokal', 'jenjang', 'tahun_ajaran_lulus', 'tanggal_lulus', 'kelas_lulus',
            'nomor_ijazah', 'no_peserta', 'skhun', 'no_surat_ijazah', 'kegiatan_setelah_lulus',
            'penyerahan_ijazah', 'melanjutkan', 'catatan',
        ];
    }

    public function headings(): array
    {
        return self::kolom();
    }

    public function title(): string
    {
        return 'Import Alumni';
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

                // Validasi inline (tanpa sheet tersembunyi): daftar literal.
                $opsi = [
                    'jenjang' => DB::table('lembaga')->orderBy('jenjang')->pluck('jenjang')->all(),
                    'penyerahan_ijazah' => ['sudah', 'belum'],
                    'melanjutkan' => ['ya', 'tidak'],
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
                    // CATAT: atribut OOXML `showDropDown` INVERTED — setShowDropDown(true)
                    // membuat panah dropdown TAMPIL di Excel.
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

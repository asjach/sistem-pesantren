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
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Template import modul Penilaian — satu kelas untuk EMPAT template terpisah.
 * Kolom & contoh baris ditentukan pemanggil (`PenilaianController`), sehingga
 * template `nilai` bisa memuat kolom MAPEL dinamis sesuai jenjang/kelas.
 */
class PenilaianTemplateExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithEvents, WithHeadings, WithTitle
{
    private const BARIS_TERAKHIR = 501;

    /**
     * @param  list<string>  $kolom
     * @param  array<string, string>  $contoh  kolom => nilai contoh
     * @param  array<string, list<string>>  $pilihan  kolom => opsi dropdown
     */
    public function __construct(
        private string $tipe,
        private string $judul,
        private array $kolom,
        private array $contoh = [],
        private array $pilihan = [],
    ) {}

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    public function headings(): array
    {
        return $this->kolom;
    }

    public function title(): string
    {
        return mb_substr($this->judul, 0, 31);
    }

    public function array(): array
    {
        if ($this->contoh === []) {
            return [];
        }
        $baris = [];
        foreach ($this->kolom as $k) {
            $baris[$k] = $this->contoh[$k] ?? '';
        }

        return [$baris];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $kolom = $this->kolom;
                if ($kolom === []) {
                    return;
                }
                $lastCol = Coordinate::stringFromColumnIndex(count($kolom));

                $sheet->getRowDimension(1)->setRowHeight(30);
                foreach ($kolom as $i => $nama) {
                    $col = Coordinate::stringFromColumnIndex($i + 1);
                    $style = $sheet->getStyle("{$col}1");
                    $style->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1F2937');
                    $style->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB(
                        in_array($nama, ['nis_lokal', 'nama', 'jenjang', 'kelas', 'tahun_ajaran', 'semester'], true)
                            ? 'FFFFE699'
                            : 'FFDCE6F1'
                    );
                    $style->getAlignment()->setWrapText(true)->setVertical(Alignment::VERTICAL_CENTER)->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $style->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setARGB('FF9CA3AF');
                    $sheet->getColumnDimension($col)->setWidth(18);
                }
                $sheet->freezePane('A2');
                $sheet->setAutoFilter("A1:{$lastCol}1");

                if ($this->contoh !== []) {
                    $sheet->getRowDimension(2)->setRowHeight(20);
                    $sheet->getStyle("A2:{$lastCol}2")->applyFromArray([
                        'font' => ['italic' => true, 'size' => 10, 'color' => ['argb' => 'FF6B7280']],
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF3F4F6']],
                    ]);
                }

                $pilihan = $this->pilihan;
                if ($pilihan === []) {
                    return;
                }

                $referensi = $sheet->getParent()->createSheet();
                $referensi->setTitle('Referensi');
                $referensi->setSheetState(Worksheet::SHEETSTATE_HIDDEN);

                $colSumber = 1;
                foreach ($pilihan as $nama => $nilai) {
                    if ($nilai === []) {
                        continue;
                    }
                    $posisi = array_search($nama, $kolom, true);
                    if ($posisi === false) {
                        continue;
                    }
                    $sumber = Coordinate::stringFromColumnIndex($colSumber);
                    $referensi->setCellValue("{$sumber}1", "pilihan_{$nama}");
                    foreach ($nilai as $r => $v) {
                        $referensi->setCellValueExplicit("{$sumber}".($r + 2), (string) $v, DataType::TYPE_STRING);
                    }
                    $referensi->getColumnDimension($sumber)->setWidth(20);

                    $target = Coordinate::stringFromColumnIndex($posisi + 1);
                    $batas = count($nilai) + 1;
                    $validasi = new DataValidation;
                    $validasi->setType(DataValidation::TYPE_LIST)
                        ->setShowDropDown(true)
                        ->setErrorStyle(DataValidation::STYLE_STOP)
                        ->setAllowBlank(true)
                        ->setShowErrorMessage(true)
                        ->setErrorTitle('Nilai tidak valid')
                        ->setError('Pilih nilai dari daftar.')
                        ->setFormula1("'Referensi'!\${$sumber}\$2:\${$sumber}\${$batas}");
                    $sheet->setDataValidation("{$target}2:{$target}".self::BARIS_TERAKHIR, $validasi);
                    $colSumber++;
                }
            },
        ];
    }

    /** Pilihan dropdown standar (jenjang dari master lembaga). */
    public static function pilihanJenjang(): array
    {
        return DB::table('lembaga')->orderBy('jenjang')->pluck('jenjang')->all();
    }
}

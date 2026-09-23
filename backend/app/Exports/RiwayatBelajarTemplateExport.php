<?php

namespace App\Exports;

use App\Services\RefService;
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
 * Template import riwayat belajar — nama kolom mengikuti tabel `riwayat_belajar`
 * (tanpa `nis`; NIS ada di `lembaga_santri`), kecuali kelas memakai
 * `nama_kelas` (nama rombel, mis. '1A') agar ramah diisi. Kolom `nik`/`nis_lokal`
 * adalah kunci pencocokan santri: `nik` diutamakan, fallback `nis_lokal` + `jenjang`.
 */
class RiwayatBelajarTemplateExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithEvents, WithHeadings, WithTitle
{
    private const BARIS_TERAKHIR = 501;

    public const KOLOM = [
        'nik', 'nis_lokal', 'jenjang', 'tahun_ajaran', 'nama_kelas',
        'semester', 'tgl_masuk', 'no_absen', 'tingkat', 'status_awal', 'status_akhir',
    ];

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    public function headings(): array
    {
        return self::KOLOM;
    }

    public function title(): string
    {
        return 'Riwayat Belajar';
    }

    public function array(): array
    {
        return [[
            'nik' => '1234567890123456',
            'nis_lokal' => '26001',
            'jenjang' => '2',
            'tahun_ajaran' => '2025/2026',
            'nama_kelas' => '1A',
            'semester' => '1',
            'tgl_masuk' => '2026-07-01',
            'no_absen' => '1',
            'tingkat' => '1',
            'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif',
        ]];
    }

    /** @return array<string, string[]> */
    public function pilihan(): array
    {
        $kode = fn (string $tipe): array => array_map(
            fn ($r) => $r->{RefService::KEY[$tipe]},
            RefService::efektifSemuaLembaga($tipe)
        );

        return [
            'semester' => ['1', '2'],
            'status_awal' => $kode('status_awal'),
            'status_akhir' => $kode('status_akhir'),
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $kolom = self::KOLOM;
                $lastCol = Coordinate::stringFromColumnIndex(count($kolom));

                $sheet->getRowDimension(1)->setRowHeight(30);
                foreach ($kolom as $i => $nama) {
                    $col = Coordinate::stringFromColumnIndex($i + 1);
                    $style = $sheet->getStyle("{$col}1");
                    $style->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1F2937');
                    $style->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB(
                        in_array($nama, ['nik', 'nis_lokal', 'jenjang', 'tahun_ajaran', 'semester'], true)
                            ? 'FFFFE699'
                            : 'FFDCE6F1'
                    );
                    $style->getAlignment()->setWrapText(true)->setVertical(Alignment::VERTICAL_CENTER)->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $style->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setARGB('FF9CA3AF');
                    $sheet->getColumnDimension($col)->setWidth(18);
                }
                $sheet->freezePane('A2');
                $sheet->setAutoFilter("A1:{$lastCol}1");

                // Dropdown dari sheet Referensi tersembunyi.
                $referensi = $sheet->getParent()->createSheet();
                $referensi->setTitle('Referensi');
                $referensi->setSheetState(Worksheet::SHEETSTATE_HIDDEN);

                $colSumber = 1;
                foreach ($this->pilihan() as $nama => $nilai) {
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
}

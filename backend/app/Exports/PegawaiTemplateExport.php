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
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** Template import Buku Induk Guru (identitas `pegawai` saja). */
class PegawaiTemplateExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithEvents, WithHeadings, WithTitle
{
    private const BARIS_TERAKHIR = 5001;

    public static function kolom(): array
    {
        return [
            'pegawai_id', 'nama_lengkap', 'nip', 'nik', 'jenis_kelamin',
            'gelar_depan', 'gelar_belakang', 'tempat_lahir', 'tanggal_lahir',
            'no_hp', 'email_pribadi', 'email_gws', 'status_aktif',
            'tgl_mulai_kerja', 'no_sk_awal', 'tgl_sk_awal', 'pendidikan_terakhir', 'jenis_ptk',
            'status_pernikahan', 'agama', 'gol_darah',
        ];
    }

    public static function kolomWajib(): array
    {
        return ['nama_lengkap', 'jenis_kelamin'];
    }

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    public function headings(): array
    {
        return self::kolom();
    }

    public function title(): string
    {
        return 'Data Pegawai';
    }

    public function array(): array
    {
        return [[
            '', 'Siti Rahayu', '198501012010012001', '3510010101850001', 'P',
            'Hj.', 'S.Pd.', 'Bangkalan', '1985-01-01',
            '081234567890', 'siti@example.com', '', 'aktif',
            '2010-07-01', 'SK/001/2010', '2010-07-01', 'S1', 'Guru Kelas',
            'Menikah', 'Islam', 'O',
        ]];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $kolom = self::kolom();
                $wajib = self::kolomWajib();
                $lastCol = Coordinate::stringFromColumnIndex(count($kolom));

                $sheet->getRowDimension(1)->setRowHeight(34);
                foreach ($kolom as $i => $nama) {
                    $col = Coordinate::stringFromColumnIndex($i + 1);
                    $style = $sheet->getStyle("{$col}1");
                    $style->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1F2937');
                    $style->getFill()->setFillType(Fill::FILL_SOLID)
                        ->getStartColor()->setARGB(in_array($nama, $wajib, true) ? 'FFFFE699' : 'FFDCE6F1');
                    $style->getAlignment()->setWrapText(true)
                        ->setVertical(Alignment::VERTICAL_CENTER)
                        ->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $style->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setARGB('FF9CA3AF');
                    $sheet->getColumnDimension($col)->setWidth(20);
                }
                $sheet->freezePane('A2');
                $sheet->setAutoFilter("A1:{$lastCol}1");

                $referensi = $sheet->getParent()->createSheet();
                $referensi->setTitle('Referensi');
                $referensi->setSheetState(Worksheet::SHEETSTATE_HIDDEN);
                $opsi = [
                    'jenis_kelamin' => ['L', 'P'],
                    'status_aktif' => ['aktif', 'cuti', 'keluar'],
                ];
                $colSumber = 1;
                foreach ($opsi as $nama => $nilai) {
                    $posisi = array_search($nama, $kolom, true);
                    if ($posisi === false) {
                        continue;
                    }
                    $sumber = Coordinate::stringFromColumnIndex($colSumber);
                    $referensi->setCellValue("{$sumber}1", "pilihan_{$nama}");
                    foreach ($nilai as $r => $v) {
                        $referensi->setCellValueExplicit("{$sumber}".($r + 2), (string) $v, DataType::TYPE_STRING);
                    }
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
                        ->setFormula1("'Referensi'!$".$sumber.'$2:$'.$sumber.'$'.$batas);
                    $sheet->setDataValidation("{$target}2:{$target}".self::BARIS_TERAKHIR, $validasi);
                    $colSumber++;
                }
            },
        ];
    }
}

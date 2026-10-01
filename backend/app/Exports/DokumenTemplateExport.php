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

/**
 * Template import daftar dokumen (checklist) — satu kelas untuk tiga tipe
 * (santri / pegawai / lembaga); kolom identitas pemilik berbeda per tipe.
 * Yang diimport adalah DATA dokumen, bukan berkas fisik.
 *
 * Gaya seragam template lain: header wajib kuning / opsional biru, freeze
 * baris 1 + autofilter, baris 2 = CONTOH italic abu-abu (wajib diganti/
 * dihapus sebelum import), dropdown dari sheet Referensi tersembunyi.
 */
class DokumenTemplateExport extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithEvents, WithHeadings, WithTitle
{
    private const BARIS_TERAKHIR = 5001;

    public function __construct(private string $tipe) {}

    public static function kolom(string $tipe): array
    {
        return match ($tipe) {
            'santri' => ['nis_lokal', 'jenjang', 'jenis_dokumen', 'nama_file', 'penyimpanan', 'catatan'],
            'pegawai' => ['pegawai_id', 'nipp', 'nama_lengkap', 'jenjang', 'jenis_dokumen', 'status_verifikasi', 'catatan'],
            'lembaga' => ['jenjang', 'jenis_dokumen', 'status_verifikasi', 'catatan'],
            default => [],
        };
    }

    public static function kolomWajib(string $tipe): array
    {
        return match ($tipe) {
            'santri' => ['nis_lokal', 'jenjang', 'jenis_dokumen'],
            'pegawai' => ['jenjang', 'jenis_dokumen'],
            'lembaga' => ['jenjang', 'jenis_dokumen'],
            default => [],
        };
    }

    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }

    public function headings(): array
    {
        return self::kolom($this->tipe);
    }

    public function title(): string
    {
        return 'Dokumen';
    }

    public function array(): array
    {
        $contoh = match ($this->tipe) {
            'santri' => ['26001', 'MI', 'Kartu Keluarga', '', 'Server', ''],
            'pegawai' => ['', 'PST-001', '', 'MI', 'Ijazah S1', 'Valid', 'Sesuai arsip'],
            'lembaga' => ['MI', 'Izin Operasional', 'Valid', 'SK Kemenag 2026'],
        };
        // Petakan posisional sejajar kolom (kunci tak dipakai di array()).
        $kolom = self::kolom($this->tipe);
        $urut = match ($this->tipe) {
            'santri' => ['nis_lokal' => 0, 'jenjang' => 1, 'jenis_dokumen' => 2, 'nama_file' => 3, 'penyimpanan' => 4, 'catatan' => 5],
            'pegawai' => ['pegawai_id' => 0, 'nipp' => 1, 'nama_lengkap' => 2, 'jenjang' => 3, 'jenis_dokumen' => 4, 'status_verifikasi' => 5, 'catatan' => 6],
            'lembaga' => ['jenjang' => 0, 'jenis_dokumen' => 1, 'status_verifikasi' => 2, 'catatan' => 3],
        };

        return [array_map(function (string $k) use ($contoh, $urut) {
            return $contoh[$urut[$k]] ?? '';
        }, $kolom)];
    }

    /** Daftar dropdown per kolom (divalidasi import memetakan label → kode). */
    public function pilihan(): array
    {
        return [
            'jenjang' => ['MI', 'MD', 'MTS', 'MA', 'MLN'],
            'status_verifikasi' => ['Menunggu', 'Valid', 'Ditolak'],
            'penyimpanan' => ['Server', 'Lokal', 'Test'],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $kolom = self::kolom($this->tipe);
                $wajib = self::kolomWajib($this->tipe);
                $lastCol = Coordinate::stringFromColumnIndex(count($kolom));

                $this->gayaHeader($sheet, $kolom, $wajib, $lastCol);
                $this->gayaContoh($sheet, $lastCol);
                $this->isiDropdown($sheet, $kolom);
            },
        ];
    }

    /** Header: wajib = kuning, opsional = biru; bekukan baris 1 + autofilter. */
    private function gayaHeader(Worksheet $sheet, array $kolom, array $wajib, string $lastCol): void
    {
        $sheet->getRowDimension(1)->setRowHeight(34);

        foreach ($kolom as $i => $nama) {
            $col = Coordinate::stringFromColumnIndex($i + 1);
            $style = $sheet->getStyle("{$col}1");
            $style->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1F2937');
            $style->getFill()->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setARGB(in_array($nama, $wajib, true) ? 'FFFFE699' : 'FFDCE6F1');
            $style->getAlignment()
                ->setWrapText(true)
                ->setVertical(Alignment::VERTICAL_CENTER)
                ->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $style->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setARGB('FF9CA3AF');
            $sheet->getColumnDimension($col)->setWidth($nama === 'catatan' ? 30 : 18);
        }

        $sheet->freezePane('A2');
        $sheet->setAutoFilter("A1:{$lastCol}1");
    }

    /** Baris 2 (CONTOH): italic abu-abu + isian abu muda — tanda wajib diganti/dihapus. */
    private function gayaContoh(Worksheet $sheet, string $lastCol): void
    {
        $sheet->getRowDimension(2)->setRowHeight(20);

        $sheet->getStyle("A2:{$lastCol}2")->applyFromArray([
            'font' => ['italic' => true, 'size' => 10, 'color' => ['argb' => 'FF6B7280']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF3F4F6']],
        ]);
    }

    /** Dropdown data-validation + daftar nilai di sheet tersembunyi "Referensi". */
    private function isiDropdown(Worksheet $sheet, array $kolom): void
    {
        $referensi = $sheet->getParent()->createSheet();
        $referensi->setTitle('Referensi');
        $referensi->setSheetState(Worksheet::SHEETSTATE_HIDDEN);

        $opsi = $this->pilihan();
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
            $referensi->getColumnDimension($sumber)->setWidth(20);

            $target = Coordinate::stringFromColumnIndex($posisi + 1);
            $batas = count($nilai) + 1;
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
                ->setFormula1("'Referensi'!\$".$sumber.'$2:$'.$sumber.'$'.$batas);
            $sheet->setDataValidation("{$target}2:{$target}".self::BARIS_TERAKHIR, $validasi);

            $colSumber++;
        }
    }
}

<?php

namespace App\Exports;

use App\Models\Santri;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithHeadings;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;

/**
 * Template import santri (101) — heading snake_case mengikuti SantriLengkapImport:
 * seluruh kolom profil (`Santri::KOLOM_PROFIL`) + kolom penempatan/lembaga.
 * `lembaga_id` boleh dikosongkan (legacy tanpa track; mengikuti aturan peran admin).
 * Semua sel ditulis sebagai TEKS agar angka (NIS/NIK/RT/NISN) tidak berubah tipe.
 */
class SantriTemplateExport extends DefaultValueBinder implements FromArray, WithHeadings, WithCustomValueBinder
{
    public function bindValue(Cell $cell, $value): bool
    {
        $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

        return true;
    }
    /** Satu sumber daftar kolom (dipakai heading & baris contoh). */
    public static function kolom(): array
    {
        return array_merge(
            ['lembaga_id', 'kelas_id', 'tingkat', 'no_absen'],
            Santri::KOLOM_PROFIL,
        );
    }

    public function headings(): array
    {
        return self::kolom();
    }

    public function array(): array
    {
        $contoh = [
            'nama_lengkap' => 'Ahmad Fauzi',
            'nama_singkat' => 'Ahmad',
            'nik' => '1234567890123456',
            'nisn' => '1234567890',
            'nis' => '26001',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
            'tmp_lahir' => 'Bangkalan',
            'tipe_santri' => 'non_asrama',
            'kewarganegaraan' => 'WNI',
            'agama' => 'Islam',
        ];

        return [array_map(fn (string $kolom) => $contoh[$kolom] ?? '', self::kolom())];
    }
}

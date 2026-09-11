<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;

/**
 * Template import PSB — kolom mengikuti PsbImport::rules() (heading_row snake_case).
 */
class PsbTemplateExport implements FromArray, WithHeadings
{
    public function headings(): array
    {
        return [
            'nik',
            'nama_lengkap',
            'jk',
            'tgl_lahir',
            'tipe_santri',
            'email_ortu',
            'telp_ortu',
            'nama_ayah',
            'nama_ibu',
            'no_pendaftaran',
        ];
    }

    public function array(): array
    {
        return [[
            '1234567890123456',
            'Ahmad Fauzi',
            'L',
            '2015-07-01',
            'non_asrama',
            'ortu@example.com',
            '081234567890',
            'Bapak Fauzi',
            'Ibu Fauzi',
            '',
        ]];
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImportSesi extends Model
{
    protected $table = 'import_sesi';

    protected $guarded = ['id'];

    protected $casts = [
        'galat_contoh' => 'array',
    ];

    public const JALAN = 'jalan';

    public const SELESAI = 'selesai';

    public const BATAL = 'batal';

    /** Umur sesi maksimum (jam) sebelum dianggap basi dan dibersihkan. */
    public const TTL_JAM = 24;

    public function ringkasan(): array
    {
        $valid = $this->dibuat + $this->diperbarui;

        return [
            'baris_diproses' => $this->offset,
            'baris_valid' => $valid,
            'baris_gagal' => $this->gagal,
            'baris_dilewati' => max(0, $this->offset - $valid - $this->gagal),
            'dibuat' => $this->dibuat,
            'diperbarui' => $this->diperbarui,
            'riwayat_dibuat' => (int) ($this->riwayat_dibuat ?? 0),
        ];
    }
}

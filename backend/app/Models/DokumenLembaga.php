<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Berkas tingkat lembaga (izin operasional, akreditasi, dll) — sejajar dokumen_santri/dokumen_pegawai. */
class DokumenLembaga extends Model
{
    protected $table = 'dokumen_lembaga';

    protected $guarded = ['id'];

    protected $casts = ['status_verifikasi' => 'string'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }
}

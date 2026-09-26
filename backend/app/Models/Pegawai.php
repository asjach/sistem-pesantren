<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Buku Induk Guru (modul pegawai): identitas murni; penempatan = `lembaga_pegawai`, riwayat per TA = `keaktifan_pegawai`. */
class Pegawai extends Model
{
    protected $table = 'pegawai';

    protected $guarded = ['id'];

    public const AKTIF = 'aktif';

    protected $casts = [
        'tanggal_lahir' => 'date:Y-m-d',
        'tgl_mulai_kerja' => 'date:Y-m-d',
    ];

    public function penempatan(): HasMany
    {
        return $this->hasMany(LembagaPegawai::class, 'pegawai_id');
    }

    public function akun(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function keaktifan(): HasMany
    {
        return $this->hasMany(KeaktifanPegawai::class, 'pegawai_id');
    }
}

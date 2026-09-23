<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Master pegawai (modul 200): wali kelas merujuk ke sini via `kelas.walas_id`. */
class Pegawai extends Model
{
    protected $table = 'pegawai';

    protected $guarded = ['id'];

    public const AKTIF = 'aktif';

    public function keaktifan(): HasMany
    {
        return $this->hasMany(KeaktifanPegawai::class, 'pegawai_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Aset cetak yang diunggah pengguna (stempel, tanda tangan). Gambar dari
 * database — logo lembaga, foto santri, foto pegawai — tidak dicatat di sini.
 */
class AsetDokumen extends Model
{
    protected $table = 'aset_dokumen';

    protected $guarded = ['id'];

    protected $casts = ['lebar_px' => 'integer', 'tinggi_px' => 'integer', 'ukuran_byte' => 'integer'];

    public function scopeCari(Builder $query, ?string $cari): Builder
    {
        if ($cari === null || trim($cari) === '') {
            return $query;
        }

        return $query->where('nama', 'like', '%'.trim($cari).'%');
    }

    public function scopeTersedia(Builder $query, array $jenjang): Builder
    {
        return $query->where(function (Builder $dalam) use ($jenjang) {
            $dalam->whereNull('jenjang');

            if ($jenjang !== []) {
                $dalam->orWhereIn('jenjang', $jenjang);
            }
        });
    }

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class Kelas extends Model
{
    protected $table = 'kelas';

    protected $fillable = ['lembaga_id', 'tahun_ajaran_id', 'walas_id', 'tingkat', 'nama_kelas', 'kapasitas', 'urutan'];

    protected $casts = ['urutan' => 'integer'];

    /**
     * Normalisasi nama kelas (trim + rapatkan spasi ganda).
     * Dipakai juga sebagai pembanding unik di controller/import.
     */
    public static function normalisasiNama(?string $nama): string
    {
        return preg_replace('/\s+/u', ' ', trim((string) $nama)) ?? '';
    }

    /** Semua penulis (controller/import) menyimpan nama yang sudah rapi. */
    protected function namaKelas(): Attribute
    {
        return Attribute::set(fn (?string $value): string => self::normalisasiNama($value));
    }

    public function lembaga()
    {
        return $this->belongsTo(Lembaga::class);
    }

    public function tahunAjaran()
    {
        return $this->belongsTo(TahunAjaran::class);
    }

    public function walas()
    {
        return $this->belongsTo(Pegawai::class, 'walas_id');
    }

    public function scopeTenantScope(Builder $query): Builder
    {
        $user = auth()->user();
        if ($user->bolehPesantren()) {
            return $query;
        }
        if ($user->hasAnyRole(['orang_tua', 'guru', 'santri'])) {
            return $query->whereRaw('1 = 0');
        }
        $ids = $user->lembagaIdsDenganPasangan();
        if (empty($ids)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('lembaga_id', $ids);
    }
}

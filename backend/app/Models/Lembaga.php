<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Lembaga extends Model
{
    protected $table = 'lembaga';

    protected $primaryKey = 'jenjang';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['jenjang', 'nama', 'nama_singkat', 'mudir_am', 'status', 'npsn', 'nsm', 'npwp', 'no_izin_operasional', 'tgl_izin', 'no_sk_pendirian', 'tgl_sk_pendirian', 'tahun_berdiri', 'no_sk_kemenkumham', 'akreditasi', 'tgl_akreditasi', 'penyelenggara', 'provinsi', 'kab_kota', 'kecamatan', 'desa', 'rt', 'rw', 'kode_pos', 'alamat', 'lintang', 'bujur', 'telepon', 'email', 'website', 'logo_url', 'waktu_belajar', 'mode_rapor', 'template_rapor', 'is_seleksi', 'kelompok_psb', 'is_active'];

    protected $casts = ['tgl_izin' => 'date', 'tgl_sk_pendirian' => 'date', 'tgl_akreditasi' => 'date', 'lintang' => 'decimal:7', 'bujur' => 'decimal:7', 'is_seleksi' => 'boolean', 'is_active' => 'boolean'];

    public function kelas()
    {
        return $this->hasMany(Kelas::class, 'jenjang', 'jenjang');
    }

    public function lembagaSantri()
    {
        return $this->hasMany(LembagaSantri::class, 'jenjang', 'jenjang');
    }

    /** Pasangan MI↔MD (pengecualian timbal-balik): jenjang counterpart, else null. */
    public static function pasanganJenjang(string $jenjang): ?string
    {
        return match ($jenjang) {
            'MI' => 'MD',
            'MD' => 'MI',
            default => null,
        };
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

        return $query->whereIn('jenjang', $ids);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Lembaga extends Model
{
    protected $table = 'lembaga';

    protected $fillable = ['parent_id', 'nama', 'nama_singkat', 'kode', 'mudir_am', 'jenjang', 'status', 'npsn', 'nsm', 'npwp', 'no_izin_operasional', 'tgl_izin', 'no_sk_pendirian', 'tgl_sk_pendirian', 'tahun_berdiri', 'no_sk_kemenkumham', 'akreditasi', 'tgl_akreditasi', 'penyelenggara', 'provinsi', 'kab_kota', 'kecamatan', 'desa', 'rt', 'rw', 'kode_pos', 'alamat', 'lintang', 'bujur', 'telepon', 'email', 'website', 'logo_url', 'waktu_belajar', 'mode_rapor', 'template_rapor', 'is_seleksi', 'kelompok_psb', 'is_active'];

    protected $casts = ['tgl_izin' => 'date', 'tgl_sk_pendirian' => 'date', 'tgl_akreditasi' => 'date', 'lintang' => 'decimal:7', 'bujur' => 'decimal:7', 'is_seleksi' => 'boolean', 'is_active' => 'boolean'];

    public function parent()
    {
        return $this->belongsTo(Lembaga::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(Lembaga::class, 'parent_id');
    }

    public function kelas()
    {
        return $this->hasMany(Kelas::class);
    }

    public function lembagaSantri()
    {
        return $this->hasMany(LembagaSantri::class, 'lembaga_id');
    }

    protected static function booted(): void
    {
        static::saving(function (Lembaga $m) {
            if (! is_null($m->parent_id) && ! is_null($m->getKey()) && (int) $m->parent_id === (int) $m->getKey()) {
                throw new \InvalidArgumentException('parent_id tidak boleh sama dengan id sendiri.');
            }
        });
    }

    /** Pasangan MI↔MD (pengecualian timbal-balik): id counterpart operasional, else null. */
    public static function pasanganId(int $id): ?int
    {
        static $cache = [];
        if (array_key_exists($id, $cache)) {
            return $cache[$id];
        }
        $kode = static::whereKey($id)->whereNotNull('parent_id')->value('kode');
        $lawan = $kode === 'MI' ? 'MD' : ($kode === 'MD' ? 'MI' : null);
        $cache[$id] = $lawan === null
            ? null
            : static::where('kode', $lawan)->whereNotNull('parent_id')->value('id');
        $cache[$id] = $cache[$id] === null ? null : (int) $cache[$id];

        return $cache[$id];
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

        return $query->whereIn('id', $ids);
    }
}

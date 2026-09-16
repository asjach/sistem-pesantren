<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class TahunAjaran extends Model
{
    protected $table = 'tahun_ajaran';

    protected $fillable = ['lembaga_id', 'nama', 'tanggal_mulai', 'tanggal_selesai', 'is_aktif', 'is_active'];

    protected $casts = ['is_aktif' => 'boolean', 'is_active' => 'boolean'];

    public function lembaga()
    {
        return $this->belongsTo(Lembaga::class);
    }

    /**
     * TA global: `lembaga_id` NULL = bawaan semua lembaga; baris lembaga hanya
     * dipakai untuk menyembunyikan (`is_active` = false). `is_aktif` = TA berjalan.
     */

    /** Daftar TA yang berlaku untuk satu lembaga (baris lembaga menang atas global). */
    public static function efektif(?int $lembagaId): Collection
    {
        $global = static::query()->whereNull('lembaga_id')->get();
        $milik = $lembagaId === null
            ? collect()
            : static::query()->where('lembaga_id', $lembagaId)->get();

        $map = [];
        foreach ($global as $row) {
            $map[$row->nama] = $row;
        }
        foreach ($milik as $row) {
            $map[$row->nama] = $row;
        }

        return collect($map)
            ->filter(fn (self $row) => $row->is_active)
            ->sortByDesc(fn (self $row) => sprintf('%s|%010d', $row->tanggal_mulai ?? '', $row->id))
            ->values();
    }

    /** TA aktif untuk satu lembaga: baris lembaga lebih dulu, lalu TA aktif global. */
    public static function aktif(?int $lembagaId = null): ?self
    {
        $efektif = static::efektif($lembagaId);
        $milik = $efektif->first(fn (self $row) => $row->is_aktif && $row->lembaga_id !== null);

        return $milik ?? $efektif->firstWhere('is_aktif', true);
    }

    /**
     * Resolusi TA untuk satu lembaga: TA yang diminta bila berlaku untuk lembaga
     * itu, bila tidak TA aktif (lembaga/global).
     */
    public static function resolve(?int $lembagaId, ?int $dimintaId = null): int
    {
        $efektif = static::efektif($lembagaId);
        if ($dimintaId && $efektif->contains('id', $dimintaId)) {
            return $dimintaId;
        }
        $aktif = static::aktif($lembagaId);
        if ($aktif) {
            return $aktif->id;
        }

        throw ValidationException::withMessages(['tahun_ajaran_id' => 'Belum ada tahun ajaran aktif.']);
    }

    /** TA global (lembaga_id NULL) dengan nama tertentu. */
    public static function global(): Builder
    {
        return static::query()->whereNull('lembaga_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Tahun ajaran murni global (data pesantren). Kunci alami = `nama` (mis.
 * '2025/2026'), dipakai sebagai PK string; anak-anak FK ke kolom ini.
 * Sembunyikan/tampilkan per lembaga lewat pivot `lembaga_tahun_ajaran`.
 */
class TahunAjaran extends Model
{
    protected $table = 'tahun_ajaran';

    protected $primaryKey = 'nama';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['nama', 'tanggal_mulai', 'tanggal_selesai', 'is_aktif'];

    protected $casts = ['is_aktif' => 'boolean'];

    /** Pola nama kanonis tahun ajaran (grup 1 & 2 = tahun awal/akhir). */
    public const POLA = '/^(\d{4})\/(\d{4})$/';

    /** Normalisasi nama: trim, rapatkan spasi, hapus spasi di sekitar '/'. */
    public static function normalisasiNama(?string $nama): string
    {
        $rapi = preg_replace('/\s+/u', ' ', trim((string) $nama)) ?? '';

        return str_replace(' /', '/', str_replace('/ ', '/', $rapi));
    }

    /** Daftar TA yang berlaku untuk satu lembaga (TA tersembunyi dibuang). */
    public static function efektif(?int $lembagaId): Collection
    {
        $tersembunyi = $lembagaId === null
            ? collect()
            : LembagaTahunAjaran::query()
                ->where('lembaga_id', $lembagaId)
                ->where('is_active', false)
                ->pluck('tahun_ajaran');

        return static::query()
            ->when($tersembunyi->isNotEmpty(), fn (Builder $q) => $q->whereNotIn('nama', $tersembunyi))
            ->orderByDesc('tanggal_mulai')
            ->orderByDesc('nama')
            ->get();
    }

    /** TA aktif (satu, global). */
    public static function aktif(?int $lembagaId = null): ?self
    {
        return static::efektif($lembagaId)->firstWhere('is_aktif', true);
    }

    /**
     * Resolusi TA untuk satu lembaga: TA yang diminta bila berlaku untuk lembaga
     * itu, bila tidak TA aktif.
     */
    public static function resolve(?int $lembagaId, ?string $diminta = null): string
    {
        $efektif = static::efektif($lembagaId);
        if ($diminta !== null && $efektif->contains('nama', $diminta)) {
            return $diminta;
        }
        $aktif = $efektif->firstWhere('is_aktif', true);
        if ($aktif) {
            return $aktif->nama;
        }

        throw ValidationException::withMessages(['tahun_ajaran' => 'Belum ada tahun ajaran aktif.']);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Template cetak. Lihat migration create_template_dokumen_table untuk arti
 * kolom `halaman`, `definisi`, dan perbedaan jenis 'pdf' vs 'html'.
 */
class TemplateDokumen extends Model
{
    public const KATEGORI = ['surat', 'sertifikat', 'daftar', 'rapor', 'sk', 'berita_acara', 'lainnya'];

    public const JENIS_PDF = 'pdf';

    public const JENIS_HTML = 'html';

    protected $table = 'template_dokumen';

    protected $guarded = ['id'];

    protected $casts = [
        'halaman' => 'array',
        'definisi' => 'array',
        'jumlah_halaman' => 'integer',
        'aktif' => 'boolean',
    ];

    /**
     * Template yang boleh dilihat: yang global (jenjang null) plus yang milik
     * lembaga pada daftar $jenjang. Daftar kosong berarti hanya global, bukan
     * "tampilkan semua" — itu yang membuat filter tenant tetap rapat.
     *
     * @param  list<string>  $jenjang
     */
    public function scopeTersedia(Builder $query, array $jenjang): Builder
    {
        return $query->where(function (Builder $dalam) use ($jenjang) {
            $dalam->whereNull('jenjang');

            if ($jenjang !== []) {
                $dalam->orWhereIn('jenjang', $jenjang);
            }
        });
    }

    public function scopeAktif(Builder $query): Builder
    {
        return $query->where('aktif', true);
    }

    public function scopeJenis(Builder $query, string $jenis): Builder
    {
        return $query->where('jenis', $jenis);
    }

    public function scopeCari(Builder $query, ?string $cari): Builder
    {
        if ($cari === null || trim($cari) === '') {
            return $query;
        }

        return $query->where(function (Builder $dalam) use ($cari) {
            $dalam->where('nama', 'like', '%'.$cari.'%')
                ->orWhere('kode', 'like', '%'.$cari.'%');
        });
    }

    public function scopeUrut(Builder $query, ?string $kolom, string $arah = 'naik'): Builder
    {
        $arah = strtolower($arah) === 'turun' ? 'desc' : 'asc';
        $kolom = in_array($kolom, ['nama', 'kode', 'kategori', 'jumlah_halaman', 'created_at'], true) ? $kolom : 'nama';

        return $query->orderBy($kolom, $arah)->orderBy('id', $arah);
    }

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }

    public function ukuranHalaman(int $nomor): array
    {
        $daftar = $this->halaman ?? [];
        $halaman = $daftar[$nomor - 1] ?? null;

        return [
            'lebar_mm' => round((float) ($halaman['lebar_mm'] ?? 210), 2),
            'tinggi_mm' => round((float) ($halaman['tinggi_mm'] ?? 297), 2),
        ];
    }
}

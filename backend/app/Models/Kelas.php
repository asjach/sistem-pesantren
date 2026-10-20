<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class Kelas extends Model
{
    /** Status jadwal per kelas, berurutan dari yang paling longgar. */
    public const STATUS_JADWAL = ['draft', 'pembahasan', 'final'];

    protected $table = 'kelas';

    protected $fillable = ['jenjang', 'tahun_ajaran', 'walas_id', 'tingkat', 'nama_kelas', 'nama_alias', 'status_jadwal', 'kapasitas', 'urutan'];

    protected $casts = ['urutan' => 'integer'];

    /**
     * Status jadwal gabungan satu lembaga + tahun ajaran.
     *
     * Final hanya bila SELURUH kelas final; selain itu pembahasan bila ada
     * kelas yang sedang dibahas, selebihnya draft.
     *
     * @param  iterable<int, self>  $kelas
     */
    public static function statusJadwalGabungan(iterable $kelas): string
    {
        $daftar = collect($kelas);

        if ($daftar->isEmpty()) {
            return 'draft';
        }

        if ($daftar->every(fn (self $k): bool => $k->status_jadwal === 'final')) {
            return 'final';
        }

        if ($daftar->contains(fn (self $k): bool => $k->status_jadwal === 'pembahasan')) {
            return 'pembahasan';
        }

        return 'draft';
    }

    /** Jadwal kelas terkunci (final) sampai statusnya dikembalikan ke draft. */
    public function jadwalTerkunci(): bool
    {
        return $this->status_jadwal === 'final';
    }

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
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function tahunAjaran()
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
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

        return $query->whereIn('jenjang', $ids);
    }
}

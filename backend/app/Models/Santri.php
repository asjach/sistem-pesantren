<?php

namespace App\Models;

use App\Support\NikFlag;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Buku induk: identitas santri murni.
 *
 * TIDAK menyimpan relasi riwayat (`jenjang`, `kelas_id`, `tahun_ajaran`).
 * - Keanggotaan per lembaga (NIS lokal/kemenag, status aktif) → `lembaga_santri`.
 * - Jejak akademik per TA/semester → `riwayat_belajar`.
 * - `is_active_pst` = turunan: ada ≥1 `riwayat_belajar` aktif (default 'Tidak').
 */
class Santri extends Model
{
    /** Nilai kanonis kolom keaktifan pesantren (ENUM). */
    public const YA = 'Ya';

    public const TIDAK = 'Tidak';

    protected $table = 'santri';

    /** Bawaan status keaktifan pesantren (turunan; juga menutup default DB di SQLite). */
    protected $attributes = ['is_active_pst' => self::TIDAK];

    /** Kolom profil identitas yang boleh diubah langsung; status/foto di luar ini. */
    public const KOLOM_PROFIL = [
        'nama_lengkap', 'nama_singkat', 'nik', 'nisn', 'tmp_lahir', 'tgl_lahir',
        'jk', 'anak_ke', 'j_saudara', 'tipe_santri', 'no_hp_santri', 'email_santri',
        'agama', 'cita_cita', 'hobi', 'kebutuhan_khusus', 'kebutuhan_disabilitas', 'nomor_kip',
        'no_kk', 'kepala_keluarga', 'kewarganegaraan', 'bahasa_sehari', 'status_tempat_tinggal',
        'jarak_ke_pesantren', 'waktu_tempuh', 'transportasi', 'tanggal_masuk',
        'alamat', 'rt', 'rw', 'kode_pos', 'provinsi', 'kab_kota', 'kecamatan', 'desa_kelurahan',
        'ayah_nama', 'ayah_nik', 'ayah_tmp_lahir', 'ayah_tgl_lahir', 'ayah_status',
        'ayah_pekerjaan', 'ayah_pendidikan', 'ayah_penghasilan', 'ayah_telp', 'ayah_alamat',
        'ayah_status_tempat_tinggal',
        'ibu_nama', 'ibu_nik', 'ibu_tmp_lahir', 'ibu_tgl_lahir', 'ibu_status',
        'ibu_pekerjaan', 'ibu_pendidikan', 'ibu_penghasilan', 'ibu_telp', 'ibu_alamat',
        'ibu_status_tempat_tinggal',
        'wali_nama', 'wali_nik', 'wali_tmp_lahir', 'wali_tgl_lahir', 'wali_status',
        'wali_pekerjaan', 'wali_pendidikan', 'wali_penghasilan', 'wali_telp', 'wali_alamat',
        'wali_status_tempat_tinggal',
        'yang_membiayai',
    ];

    protected $fillable = [
        'nama_lengkap',
        'nama_singkat',
        'nik',
        'nisn',
        'tmp_lahir', // ref_tmp_lahir
        'tgl_lahir',
        'jk',
        'anak_ke',
        'j_saudara',
        'tipe_santri',
        'no_hp_santri',
        'email_santri',
        'agama',
        'cita_cita',
        'hobi',
        'kebutuhan_khusus',
        'kebutuhan_disabilitas',
        'nomor_kip',
        'ayah_nama',
        'ayah_nik',
        'ayah_tmp_lahir',
        'ayah_tgl_lahir',
        'ayah_status',
        'ayah_pendidikan',
        'ayah_pekerjaan',
        'ayah_penghasilan',
        'ayah_telp',
        'ayah_alamat',
        'ayah_status_tempat_tinggal',
        'ibu_nama',
        'ibu_nik',
        'ibu_tmp_lahir',
        'ibu_tgl_lahir',
        'ibu_status',
        'ibu_pendidikan',
        'ibu_pekerjaan',
        'ibu_penghasilan',
        'ibu_telp',
        'ibu_alamat',
        'ibu_status_tempat_tinggal',
        'wali_nama',
        'wali_nik',
        'wali_tmp_lahir',
        'wali_tgl_lahir',
        'wali_status',
        'wali_pendidikan',
        'wali_pekerjaan',
        'wali_penghasilan',
        'wali_telp',
        'wali_alamat',
        'wali_status_tempat_tinggal',
        'yang_membiayai',
        'no_kk',
        'kepala_keluarga',
        'kewarganegaraan',
        'bahasa_sehari',
        'status_tempat_tinggal',
        'jarak_ke_pesantren',
        'waktu_tempuh',
        'transportasi',
        'tanggal_masuk',
        'provinsi',
        'kab_kota',
        'kecamatan',
        'desa_kelurahan',
        'rt',
        'rw',
        'alamat',
        'kode_pos',
        'foto_url',
        'is_active_pst', // turunan: ada riwayat aktif
    ];

    protected $casts = ['tgl_lahir' => 'date', 'ayah_tgl_lahir' => 'date', 'ibu_tgl_lahir' => 'date', 'wali_tgl_lahir' => 'date', 'tanggal_masuk' => 'date'];

    /**
     * NIK/no.KK yang digitnya bukan 16 otomatis berawalan `X-` saat disimpan
     * agar ketahuan tak valid (`X-320410460905001`). Berlaku semua jalur tulis
     * (manual, import, ACC). Idempoten; nilai valid tak berubah.
     */
    protected static function booted(): void
    {
        static::saving(function (Santri $santri) {
            foreach (['nik', 'no_kk', 'ayah_nik', 'ibu_nik', 'wali_nik'] as $kolom) {
                $santri->{$kolom} = NikFlag::tandai($santri->getAttribute($kolom));
            }
        });
    }

    /** Keanggotaan per lembaga (semua baris, termasuk riwayat lama). */
    public function lembagaSantri(): HasMany
    {
        return $this->hasMany(LembagaSantri::class, 'santri_id');
    }

    /** Keanggotaan yang sedang aktif. */
    public function lembagaAktif(): HasMany
    {
        return $this->hasMany(LembagaSantri::class, 'santri_id')->where('is_active_lembaga', LembagaSantri::YA);
    }

    public function riwayatBelajar(): HasMany
    {
        return $this->hasMany(RiwayatBelajar::class, 'santri_id')->orderBy('id', 'desc');
    }

    /** Dipakai otorisasi aksi per lembaga (riwayat berjalan di lembaga admin). */
    public function riwayatAktif(): HasMany
    {
        return $this->hasMany(RiwayatBelajar::class, 'santri_id')->where('is_active_riwayat', self::YA);
    }

    // Helper baca: alumni = ada baris alumni; lulus/mutasi tidak disimpan di santri.
    public function isAlumni(): bool
    {
        return $this->alumni()->exists();
    }

    // Dipakai portal wali 203 (daftar anak + cek akses).
    public function waliRelasi(): HasMany
    {
        return $this->hasMany(WaliSantriRelasi::class, 'santri_id');
    }

    public function mutasiKeluar(): HasMany
    {
        return $this->hasMany(MutasiKeluar::class, 'santri_id');
    }

    public function alumni(): HasMany
    {
        return $this->hasMany(Alumni::class, 'santri_id');
    }

    /**
     * Scope tenant: admin scoped melihat santri yang punya keanggotaan di
     * lembaganya + santri tanpa keanggotaan sama sekali (arsip pusat/belum diterima).
     */
    public function scopeTenantScope(Builder $query): Builder
    {
        $authUser = auth()->user();

        if ($authUser->bolehPesantren()) {
            return $query;
        }

        if ($authUser->hasAnyRole(['guru', 'orang_tua', 'santri'])) {
            return $query->whereRaw('1 = 0');
        }

        $ids = $authUser->lembagaIdsDenganPasangan();

        return $query->where(fn (Builder $q) => $q
            ->whereHas('lembagaSantri', fn (Builder $ls) => $ls->whereIn('jenjang', $ids))
            ->orWhereDoesntHave('lembagaSantri'));
    }

    /** Hitung ulang `is_active_pst` dari riwayat aktif (invariant turunan). */
    public function hitungUlangStatusGlobal(): void
    {
        $this->update([
            'is_active_pst' => RiwayatBelajar::where('santri_id', $this->id)->where('is_active_riwayat', self::YA)->exists()
                ? self::YA
                : self::TIDAK,
        ]);
    }
}

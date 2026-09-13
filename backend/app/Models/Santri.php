<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Santri extends Model
{
    protected $table = 'santri';

    /** Kolom profil yang boleh diubah langsung (PATCH); lembaga/kelas/status/foto
     *  tidak termasuk — relasional/turunan. */
    public const KOLOM_PROFIL = [
        'nama_lengkap', 'nama_singkat', 'nik', 'nisn', 'nis', 'tmp_lahir', 'tgl_lahir',
        'jk', 'anak_ke', 'j_saudara', 'tipe_santri', 'no_hp_santri', 'email_santri',
        'agama', 'cita_cita', 'hobi', 'kebutuhan_khusus', 'kebutuhan_disabilitas', 'nomor_kip',
        'no_kk', 'kewarganegaraan', 'bahasa_sehari', 'status_tempat_tinggal',
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
        'lembaga_id',
        'kelas_id',
        'nama_lengkap',
        'nama_singkat',
        'nik',
        'nisn',
        'nis',
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
        'status_global', // boolean: true=aktif, false=non-aktif
    ];

    protected $casts = ['status_global' => 'boolean', 'tgl_lahir' => 'date', 'ayah_tgl_lahir' => 'date', 'ibu_tgl_lahir' => 'date', 'wali_tgl_lahir' => 'date', 'tanggal_masuk' => 'date'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'lembaga_id');
    }

    public function kelas(): BelongsTo
    {
        return $this->belongsTo(Kelas::class, 'kelas_id');
    }

    public function riwayatBelajar(): HasMany
    {
        return $this->hasMany(RiwayatBelajar::class, 'santri_id')->orderBy('id', 'desc');
    }

    // Dipakai authorizeTenant 102 (riwayat berjalan di lembaga admin).
    public function riwayatAktif(): HasMany
    {
        return $this->hasMany(RiwayatBelajar::class, 'santri_id')->where('is_aktif', true);
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

    // Konvensi terkunci: LIST boleh lebar se-pesantren (= semua lembaga), AKSI ketat AND per-lembaga (102/200).
    // Guard: guru/orang_tua/santri/kasir tidak boleh list santri via endpoint admin (akses via endpoint khusus relasi).
    // Kasir hanya lembaganya untuk pembayaran (cek via canAccessLembaga di 103); admin full + super_admin semua.
    public function scopeTenantScope(Builder $query): Builder
    {
        $authUser = auth()->user();

        if ($authUser->hasRole('super_admin') || $authUser->isAdminFull()) {
            return $query;
        }

        if ($authUser->hasAnyRole(['guru', 'orang_tua', 'santri'])) {
            return $query->whereRaw('1 = 0');
        }

        // Single-tenant: tenant = lembaga via pivot user_lembaga.
        return $query->whereIn('lembaga_id', $authUser->lembagaIds());
    }

    /** NIS WAJIB unik: dicek ke master santri + arsip riwayat_belajar santri lain.
     *  $kecualiSantriId dipakai saat memperbarui santri yang sama (import/kenaikan). */
    public static function nisDipakai(?string $nis, ?int $kecualiSantriId = null): bool
    {
        $nis = $nis !== null ? trim($nis) : '';
        if ($nis === '') {
            return false;
        }

        $dipakaiMaster = static::where('nis', $nis)
            ->when($kecualiSantriId, fn (Builder $q) => $q->where('id', '!=', $kecualiSantriId))
            ->exists();
        if ($dipakaiMaster) {
            return true;
        }

        return RiwayatBelajar::where('nis', $nis)
            ->when($kecualiSantriId, fn (Builder $q) => $q->where('santri_id', '!=', $kecualiSantriId))
            ->exists();
    }
}

<?php

namespace App\Services;

/**
 * Katalog kanonis allowlist urut daftar (satu sumber kebenaran).
 *
 * Kunci = `table_key` grid di frontend (bukan URL endpoint), nilai =
 * `kode urut => kolom ORDER BY berurutan`. Dipakai `UrutDaftar::parseUrut`
 * (validasi & pemetaan kolom) sekaligus oleh endpoint Preset Urut
 * (`UrutPresetController`) untuk menyajikan kode yang sah ke dialog pengelolaan.
 */
class UrutKatalog
{
    /** @var array<string, array<string, list<string>>> */
    public const PETA = [
        'santri' => [
            'nama' => ['santri.nama_lengkap'],
            'nik' => ['santri.nik'],
            'nisn' => ['santri.nisn'],
            'jk' => ['santri.jk'],
            'tipe' => ['santri.tipe_santri'],
            'status' => ['santri.is_active_pst'],
            'id' => ['santri.id'],
        ],
        'keanggotaan' => [
            'nama' => ['santri.nama_lengkap'],
            'jk' => ['santri.jk'],
            'lembaga' => ['lembaga.kode'],
            'nis_lokal' => ['lembaga_santri.nis_lokal'],
            'nis_kemenag' => ['lembaga_santri.nis_kemenag'],
            'aktif' => ['lembaga_santri.is_active_lembaga'],
            'mulai' => ['lembaga_santri.tgl_masuk'],
            'selesai' => ['lembaga_santri.tgl_selesai'],
            'id' => ['lembaga_santri.id'],
        ],
        'users' => [
            'nama' => ['users.name'],
            'email' => ['users.email'],
            'hp' => ['users.phone'],
            'username' => ['users.username'],
            'id' => ['users.id'],
        ],
        'tahun_ajaran' => [
            'nama' => ['tahun_ajaran.nama'],
            'mulai' => ['tahun_ajaran.tanggal_mulai'],
            'selesai' => ['tahun_ajaran.tanggal_selesai'],
            'aktif' => ['tahun_ajaran.is_aktif'],
            'lembaga' => ['lembaga.kode'],
            'id' => ['tahun_ajaran.id'],
        ],
        'lembaga' => [
            'kode' => ['lembaga.kode'],
            'nama' => ['lembaga.nama'],
            'induk' => ['induk.nama'],
            'kelompok' => ['lembaga.kelompok_psb'],
            'seleksi' => ['lembaga.is_seleksi'],
            'id' => ['lembaga.id'],
        ],
        'kelas' => [
            'nama' => ['kelas.nama_kelas'],
            'tingkat' => ['kelas.tingkat'],
            'urutan' => ['kelas.urutan'],
            'kapasitas' => ['kelas.kapasitas'],
            'lembaga' => ['lembaga.kode'],
            'ta' => ['tahun_ajaran.nama'],
            'id' => ['kelas.id'],
        ],
        'riwayat_belajar' => [
            'santri' => ['santri.nama_lengkap'],
            'kelas' => ['kelas.nama_kelas'],
            'lembaga' => ['lembaga.kode'],
            'ta' => ['tahun_ajaran.nama'],
            'tingkat' => ['riwayat_belajar.tingkat'],
            'semester' => ['riwayat_belajar.semester'],
            'absen' => ['riwayat_belajar.no_absen'],
            'id' => ['riwayat_belajar.id'],
        ],
        'kenaikan_santri_genap' => [
            'santri' => ['santri.nama_lengkap'],
            'kelas' => ['kelas.nama_kelas'],
            'lembaga' => ['lembaga.kode'],
            'ta' => ['tahun_ajaran.nama'],
            'tingkat' => ['riwayat_belajar.tingkat'],
            'semester' => ['riwayat_belajar.semester'],
            'absen' => ['riwayat_belajar.no_absen'],
            'id' => ['riwayat_belajar.id'],
        ],
        'mutasi_arsip' => [
            'santri' => ['santri.nama_lengkap'],
            'tanggal' => ['mutasi_keluar.tanggal_mutasi'],
            'lembaga' => ['lembaga.kode'],
            'kelas' => ['kelas.nama_kelas'],
            'id' => ['mutasi_keluar.id'],
        ],
        'kelulusan_alumni' => [
            'santri' => ['santri.nama_lengkap'],
            'tanggal' => ['alumni.tanggal_lulus'],
            'lembaga' => ['lembaga.kode'],
            'ta' => ['tahun_ajaran.nama'],
            'kelas' => ['kelas.nama_kelas'],
            'id' => ['alumni.id'],
        ],
        'pengajuan_biodata' => [
            'santri' => ['santri.nama_lengkap'],
            'status' => ['pengajuan_biodata_santri.status'],
            'id' => ['pengajuan_biodata_santri.id'],
        ],
        'psb' => [
            'nama' => ['psb_calon_santri.nama_lengkap'],
            'nik' => ['psb_calon_santri.nik'],
            'gelombang' => ['psb_gelombang.nama'],
            'lembaga' => ['lembaga.kode'],
            'status' => ['psb_calon_santri.status_pendaftaran'],
            'id' => ['psb_calon_santri.id'],
        ],
    ];

    /**
     * Peta allowlist untuk satu table_key.
     *
     * @return array<string, list<string>>
     */
    public static function peta(string $tableKey): array
    {
        return self::PETA[$tableKey] ?? [];
    }

    public static function kenal(string $tableKey): bool
    {
        return isset(self::PETA[$tableKey]);
    }

    /**
     * Daftar kode urut yang sah + kolom DB-nya (untuk dialog pengelolaan).
     *
     * @return list<array{kode: string, kolom: list<string>}>
     */
    public static function tersedia(string $tableKey): array
    {
        $daftar = [];
        foreach (self::peta($tableKey) as $kode => $kolom) {
            $daftar[] = ['kode' => (string) $kode, 'kolom' => array_values($kolom)];
        }

        return $daftar;
    }
}

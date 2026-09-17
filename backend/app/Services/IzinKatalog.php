<?php

namespace App\Services;

/**
 * Katalog kanonis izin matriks (satu sumber kebenaran).
 *
 * - Kunci: `{modul}.{aksi}`. Baris matriks Kelola Izin + validasi API
 *   + audit FE semuanya diturunkan dari sini.
 * - Izin = AKSI (boleh melakukan apa). Cakupan DATA (lembaga mana)
 *   tetap diatur pivot `user_lembaga` (`bolehPesantren()`), bukan izin.
 * - Modul pseudo (tanpa endpoint sendiri) memakai `lihat` untuk
 *   visibilitas halaman: daftar_kelas, pindah_kelas, kenaikan, kelulusan,
 *   rekap_santri, mutasi_keluar, tampilan_standar, server, izin —
 *   sebagian plus `ubah` untuk aksinya (pindah_kelas, kenaikan, kelulusan,
 *   mutasi_keluar, izin).
 */
class IzinKatalog
{
    /** @var array<string, list<string>> modul => aksi (urut tampil). */
    public const MODUL_AKSI = [
        'dashboard' => ['lihat'],
        'pengguna' => ['lihat', 'tambah', 'ubah', 'hapus'],
        'lembaga' => ['lihat', 'tambah', 'ubah', 'hapus'],
        'tahun_ajaran' => ['lihat', 'tambah', 'ubah', 'hapus'],
        'kelas' => ['lihat', 'tambah', 'ubah', 'hapus'],
        'referensi' => ['lihat', 'tambah', 'ubah', 'hapus'],
        'psb' => ['lihat', 'tambah', 'ubah', 'hapus'],
        'kegiatan_psb' => ['lihat', 'tambah', 'ubah', 'hapus'],
        'dokumen_wajib' => ['lihat', 'tambah', 'hapus'],
        'santri' => ['lihat', 'tambah', 'ubah', 'hapus'],
        'riwayat_belajar' => ['lihat', 'tambah', 'ubah'],
        'daftar_kelas' => ['lihat'],
        'pindah_kelas' => ['lihat', 'ubah'],
        'kenaikan' => ['lihat', 'ubah'],
        'kelulusan' => ['lihat', 'ubah'],
        'rekap_santri' => ['lihat'],
        'mutasi_keluar' => ['lihat', 'ubah'],
        'pengajuan_biodata' => ['lihat', 'ubah'],
        'preset_tabel' => ['lihat', 'tambah', 'ubah', 'hapus'],
        'tampilan' => ['lihat', 'ubah', 'hapus'],
        'tampilan_standar' => ['lihat'],
        'server' => ['lihat'],
        'izin' => ['lihat', 'ubah'],
    ];

    /** Izin yang tidak diberikan ke role `admin` (eksklusif super_admin). */
    public const EKSKLUSIF_SUPER_ADMIN = [
        'lembaga.tambah',
        'tampilan_standar.lihat',
        'server.lihat',
        'izin.lihat',
        'izin.ubah',
    ];

    /** @return list<string> semua nama izin `modul.aksi`. */
    public static function semua(): array
    {
        $daftar = [];
        foreach (self::MODUL_AKSI as $modul => $aksi) {
            foreach ($aksi as $a) {
                $daftar[] = "{$modul}.{$a}";
            }
        }

        return $daftar;
    }

    /** @return list<string> izin bawaan untuk sebuah role. */
    public static function untukRole(string $role): array
    {
        if ($role === 'super_admin') {
            return self::semua();
        }
        if ($role === 'admin') {
            return array_values(array_diff(self::semua(), self::EKSKLUSIF_SUPER_ADMIN));
        }

        return [];
    }

    public static function dikenal(string $izin): bool
    {
        return in_array($izin, self::semua(), true);
    }
}

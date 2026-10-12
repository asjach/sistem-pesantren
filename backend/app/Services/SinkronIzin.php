<?php

namespace App\Services;

use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Penyelaras izin di DATABASE dengan katalog kanonis (`IzinKatalog`).
 *
 *  Latar: izin & peran dibuat oleh SEEDER, sedangkan katalog bisa bertambah
 *  kapan saja (modul baru). Database yang sudah jalan tak ikut berubah saat
 *  katalog bertambah — akibatnya rute ber-`permission:` menolak SEMUA peran
 *  dengan "User does not have the right permissions.". Ini pernah terjadi pada
 *  modul `komponen_custom`: izinnya ada di katalog, tapi belum pernah dibuat di
 *  DB, sehingga setelan komponen custom (ukuran, tipe, nilai awal) gagal
 *  disimpan padahal super_admin.
 *
 *  `jalankan()` dipakai MIGRASI dan bersifat ADITIF: izin yang belum ada
 *  dibuat, lalu diberikan ke peran sesuai bawaan katalog. Izin yang sudah ada
 *  TIDAK dicabut — penyesuaian matriks dari halaman Kelola Izin tetap utuh.
 *  (Seeder tetap boleh menyetel ulang ke bawaan; itu memang tugasnya.)
 */
class SinkronIzin
{
    /** Guard izin & peran aplikasi (selaras `RoleSeeder`/`PermissionSeeder`). */
    public const GUARD = 'sanctum';

    /**
     * Buat izin katalog yang belum ada di DB.
     *
     * @return list<string> nama izin yang BARU dibuat (kosong = DB sudah selaras)
     */
    public static function buatIzinHilang(): array
    {
        $ada = Permission::where('guard_name', self::GUARD)->pluck('name')->all();
        $baru = array_values(array_diff(IzinKatalog::semua(), $ada));

        foreach ($baru as $nama) {
            Permission::create(['name' => $nama, 'guard_name' => self::GUARD]);
        }

        if ($baru !== []) {
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }

        return $baru;
    }

    /**
     * Berikan `$nama` ke tiap peran sesuai BAWAAN katalog. Aditif: peran yang
     * sudah punya izin lain tak kehilangan apa pun.
     *
     * @param  list<string>  $nama
     * @return array<string, list<string>> peran => izin yang diberikan
     */
    public static function terapkanBawaanKeRole(array $nama): array
    {
        if ($nama === []) {
            return [];
        }

        $hasil = [];
        foreach (Role::where('guard_name', self::GUARD)->get() as $role) {
            $bawaan = array_values(array_intersect(IzinKatalog::untukRole($role->name), $nama));
            if ($bawaan === []) {
                continue;
            }
            $role->givePermissionTo($bawaan);
            $hasil[$role->name] = $bawaan;
        }

        return $hasil;
    }

    /**
     * Selaraskan DB dengan katalog (aditif). Aman dijalankan berkali-kali.
     *
     * @return list<string> nama izin yang baru dibuat
     */
    public static function jalankan(): array
    {
        $baru = self::buatIzinHilang();
        self::terapkanBawaanKeRole($baru);

        return $baru;
    }
}

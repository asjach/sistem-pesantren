<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\IzinKatalog;
use App\Services\SinkronIzin;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Katalog izin (`IzinKatalog`) adalah satu sumber kebenaran; database harus
 * selalu memuatnya. Dua penyimpangan yang pernah lolos ke production dijaga
 * di sini:
 *
 *  1. Modul BARU di katalog tapi izinnya belum dibuat di DB → rute ber-
 *     `permission:` menolak SEMUA peran (termasuk super_admin) dengan
 *     "User does not have the right permissions." — inilah yang membuat
 *     setelan komponen custom (ukuran, tipe input, nilai awal) gagal disimpan.
 *  2. Nama izin di rute yang tak ada di katalog (salah ketik atau modul
 *     dihapus) → rute itu tak bisa diakses siapa pun, tanpa gejala lain.
 */
class IzinKatalogTest extends TestCase
{
    use RefreshDatabase;

    /** Justru memeriksa hasil MIGRASI — seeder izin dimatikan. */
    protected bool $seedIzinBawaan = false;

    public function test_migrasi_membuat_seluruh_izin_katalog(): void
    {
        $ada = Permission::where('guard_name', SinkronIzin::GUARD)->pluck('name')->all();
        $kurang = array_values(array_diff(IzinKatalog::semua(), $ada));

        $this->assertSame([], $kurang,
            'Izin katalog belum dibuat di DB (butuh migrasi `SinkronIzin::jalankan()`): '.implode(', ', $kurang));
    }

    public function test_setiap_izin_yang_dipakai_rute_ada_di_katalog(): void
    {
        $isi = (string) file_get_contents(base_path('routes/api.php'));

        // `->middleware('permission:a.b|c.d')` — ambil tiap nama izinnya.
        preg_match_all('/permission:([a-z0-9_.|]+)/', $isi, $cocok);
        $nama = [];
        foreach ($cocok[1] as $grup) {
            foreach (explode('|', $grup) as $satu) {
                if ($satu !== '') {
                    $nama[$satu] = true;
                }
            }
        }

        $this->assertNotEmpty($nama, 'Tak ada `permission:` yang terbaca di routes/api.php.');
        foreach (array_keys($nama) as $izin) {
            $this->assertTrue(
                IzinKatalog::dikenal($izin),
                "Rute memakai izin \"{$izin}\" yang tak ada di IzinKatalog (salah ketik / modul dihapus).",
            );
        }
    }

    public function test_penyelaras_menambal_izin_hilang_tanpa_mencabut_penyesuaian(): void
    {
        // Tiru kondisi production sebelum migrasi penyelaras: modul ada di
        // katalog, tapi izinnya belum pernah dibuat di DB.
        Permission::where('name', 'like', 'komponen_custom.%')->delete();

        $peranAdmin = Role::create(['name' => 'admin', 'guard_name' => SinkronIzin::GUARD]);
        // Penyesuaian manual (mis. dari halaman Kelola Izin) yang TIDAK boleh
        // dicabut oleh penyelaras.
        $peranAdmin->givePermissionTo(Permission::where('name', 'santri.lihat')->firstOrFail());

        $baru = SinkronIzin::jalankan();

        $this->assertEqualsCanonicalizing(
            ['komponen_custom.lihat', 'komponen_custom.tambah', 'komponen_custom.ubah', 'komponen_custom.hapus'],
            $baru,
            'Izin modul yang belum ada di DB seharusnya dibuat oleh penyelaras.',
        );

        // Bawaan katalog: admin boleh menulis setelan komponen custom.
        foreach (['komponen_custom.lihat', 'komponen_custom.tambah', 'komponen_custom.ubah', 'komponen_custom.hapus'] as $izin) {
            $this->assertTrue(
                $peranAdmin->fresh()->hasPermissionTo($izin),
                "Peran admin tak mendapat izin {$izin} dari penyelaras.",
            );
        }

        // Aditif: izin yang sudah diatur sebelumnya TIDAK dicabut.
        $this->assertTrue($peranAdmin->fresh()->hasPermissionTo('santri.lihat'));
    }

    public function test_penyelaras_idempoten(): void
    {
        SinkronIzin::jalankan();
        $this->assertSame([], SinkronIzin::jalankan(), 'Penyelaras seharusnya tak membuat izin baru lagi.');
    }

    public function test_seeder_menyetel_peran_ke_bawaan_katalog(): void
    {
        $this->seed([RoleSeeder::class, PermissionSeeder::class]);

        foreach (['super_admin', 'admin'] as $nama) {
            $this->assertEqualsCanonicalizing(
                IzinKatalog::untukRole($nama),
                Role::where('name', $nama)->firstOrFail()->permissions->pluck('name')->all(),
                "Izin peran {$nama} tidak sama dengan bawaan katalog.",
            );
        }
    }

    /**
     * Regresi bug yang dilaporkan: menyetel komponen (mis. "nilai awal"
     * combobox) gagal dengan "User does not have the right permissions."
     * karena izin `komponen_custom.*` tak pernah dibuat di DB.
     *
     *  Di sini keadaannya ditiru apa adanya seperti DB yang sudah jalan:
     *  peran SUDAH ada, izin modulnya belum — lalu migrasi penyelaras
     *  dijalankan. Tanpa seeder izin, jadi hanya jalur migrasi yang diuji.
     */
    public function test_admin_boleh_menyimpan_setelan_komponen_tanpa_seeder_izin(): void
    {
        $this->seed(RoleSeeder::class);
        Permission::where('name', 'like', 'komponen_custom.%')->delete();

        // = migrasi `sinkronkan_izin_role_dari_katalog`.
        SinkronIzin::jalankan();

        $admin = User::create([
            'name' => 'Admin Uji',
            'email' => 'admin_izin_'.uniqid().'@example.com',
            'phone' => '0815'.str_pad((string) random_int(40000000, 49999999), 8, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $admin->assignRole('admin');

        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'komponen' => 'inp_nilai_awal',
            'setelan' => ['nilaiDefault' => 'Aktif'],
        ])->assertStatus(200)->assertJsonPath('data.setelan.nilaiDefault', 'Aktif');
    }
}

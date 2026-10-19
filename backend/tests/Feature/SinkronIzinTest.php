<?php

namespace Tests\Feature;

use App\Services\IzinKatalog;
use App\Services\SinkronIzin;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SinkronIzinTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
    }

    public function test_buat_izin_hilang_membuat_yang_belum_ada(): void
    {
        $korban = IzinKatalog::semua()[0];
        Permission::where('name', $korban)->delete();
        $this->assertFalse(
            Permission::where('name', $korban)->exists(),
            'prasyarat: izin sengaja dihapus lebih dulu',
        );

        $baru = SinkronIzin::buatIzinHilang();

        $this->assertContains($korban, $baru, 'izin yang hilang harus dibuat ulang');
        $this->assertTrue(Permission::where('name', $korban)->exists());
        $this->assertSame(SinkronIzin::GUARD, Permission::where('name', $korban)->value('guard_name'));
    }

    /** Idempoten: panggilan kedua tak menemukan apa pun untuk dibuat. */
    public function test_buat_izin_hilang_idempoten(): void
    {
        SinkronIzin::buatIzinHilang();
        $kedua = SinkronIzin::buatIzinHilang();
        $this->assertSame([], $kedua, 'panggilan kedua tak boleh membuat izin lagi');
    }

    /** INI PITFALL YANG DIKUNCI: setelah sinkron, SELURUH izin katalog ada di DB. */
    public function test_setelah_jalankan_semua_izin_katalog_ada_di_db(): void
    {
        SinkronIzin::jalankan();

        $katalog = IzinKatalog::semua();
        $ada = Permission::where('guard_name', SinkronIzin::GUARD)->pluck('name')->all();
        $hilang = array_values(array_diff($katalog, $ada));

        $this->assertSame(
            [],
            $hilang,
            'izin katalog yang belum ada di DB akan membuat rute permission: menolak SEMUA peran: '.implode(', ', $hilang),
        );
    }

    public function test_terapkan_bawaan_memberi_izin_ke_peran_yang_berhak(): void
    {

        Permission::whereIn('name', array_slice(IzinKatalog::semua(), 0, 3))->delete();
        $baru = SinkronIzin::buatIzinHilang();
        $this->assertNotEmpty($baru);
        $hasil = SinkronIzin::terapkanBawaanKeRole($baru);

        foreach ($hasil as $namaRole => $izin) {
            $role = Role::where('name', $namaRole)->firstOrFail();
            foreach ($izin as $satu) {
                $this->assertTrue(
                    $role->hasPermissionTo($satu),
                    "{$namaRole} harus punya {$satu}",
                );
            }
        }
        $this->assertNotEmpty($hasil, 'ada peran yang mendapat izin bawaan');
    }

    public function test_terapkan_bawaan_kosong_tidak_menyentuh_apa_pun(): void
    {
        $this->assertSame([], SinkronIzin::terapkanBawaanKeRole([]));
    }

    /** ADITIF: izin yang sudah dimatikan manual tak boleh hidup lagi. */
    public function test_aditif_tidak_mencabut_izin_yang_dipangkas_admin(): void
    {
        SinkronIzin::jalankan();

        $santri = Role::where('name', 'admin')->firstOrFail();
        $dicabut = 'santri.lihat';
        $this->assertTrue($santri->hasPermissionTo($dicabut));

        $santri->revokePermissionTo($dicabut);
        $this->assertFalse($santri->fresh()->hasPermissionTo($dicabut));

        $baru = SinkronIzin::jalankan();
        $this->assertSame([], $baru, 'izin sudah ada, jadi tak ada yang baru');
        $this->assertFalse(
            $santri->fresh()->hasPermissionTo($dicabut),
            'penyesuaian matriks dari halaman Kelola Izin harus tetap utuh',
        );
    }

    public function test_jalankan_mengembalikan_daftar_izin_baru(): void
    {
        $korban = IzinKatalog::semua()[0];
        Permission::where('name', $korban)->delete();

        $baru = SinkronIzin::jalankan();
        $this->assertContains($korban, $baru);

        foreach ($baru as $nama) {
            $this->assertContains($nama, IzinKatalog::semua());
        }
    }
}

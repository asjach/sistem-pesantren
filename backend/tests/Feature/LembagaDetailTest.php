<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Detail lembaga lengkap (EMIS) via store/update. */
class LembagaDetailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    protected function makeSuperAdmin(): User
    {
        $u = User::create([
            'name' => 'Super',
            'email' => 'super_lembaga@example.com',
            'phone' => '081200000099',
            'password' => 'password',
        ]);
        $u->assignRole('super_admin');

        return $u;
    }

    public function test_update_menerima_seluruh_kolom_detail(): void
    {
        $super = $this->makeSuperAdmin();
        $lembaga = Lembaga::create(['nama' => 'MI Contoh', 'kode' => 'MI']);

        $res = $this->actingAs($super, 'sanctum')->putJson("/api/admin/lembaga/{$lembaga->id}", [
            'nama_singkat' => 'MIC',
            'mudir_am' => 'H. Contoh',
            'jenjang' => 'SD',
            'status' => 'swasta',
            'npsn' => '12345678',
            'nsm' => '123456789012',
            'npwp' => '01.234.567.8-999.000',
            'no_izin_operasional' => 'OP-1',
            'tgl_izin' => '2020-01-15',
            'tahun_berdiri' => 1998,
            'akreditasi' => 'A',
            'tgl_akreditasi' => '2024-06-01',
            'penyelenggara' => 'Yayasan Contoh',
            'provinsi' => 'Jawa Barat',
            'kab_kota' => 'Bandung',
            'kecamatan' => 'Coblong',
            'desa' => 'Dago',
            'rt' => '01',
            'rw' => '02',
            'kode_pos' => '40135',
            'alamat' => 'Jl. Contoh No. 1',
            'lintang' => -6.89,
            'bujur' => 107.61,
            'telepon' => '022123456',
            'email' => 'mi@contoh.sch.id',
            'website' => 'https://mi.contoh.sch.id',
            'waktu_belajar' => 'pagi',
            'mode_rapor' => 'terpisah',
            'template_rapor' => 'emis',
        ])->assertStatus(200);

        $this->assertSame('12345678', $res->json('npsn'));
        $this->assertSame('A', $res->json('akreditasi'));
        $this->assertSame('01', $lembaga->fresh()->rt);
        $this->assertSame('pagi', $lembaga->fresh()->waktu_belajar);
    }

    public function test_update_menolak_isian_tak_valid_dan_duplikat(): void
    {
        $super = $this->makeSuperAdmin();
        $a = Lembaga::create(['nama' => 'A', 'kode' => 'MA', 'npsn' => '11111111']);
        $b = Lembaga::create(['nama' => 'B', 'kode' => 'MB']);

        // NPSN duplikat milik lembaga lain.
        $this->actingAs($super, 'sanctum')->putJson("/api/admin/lembaga/{$b->id}", [
            'npsn' => '11111111',
        ])->assertStatus(422)->assertJsonValidationErrors(['npsn']);

        // Enum, email, koordinat, dan tahun tak valid.
        $this->actingAs($super, 'sanctum')->putJson("/api/admin/lembaga/{$b->id}", [
            'status' => 'internasional',
            'email' => 'bukan-email',
            'lintang' => 120,
            'tahun_berdiri' => 1500,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['status', 'email', 'lintang', 'tahun_berdiri']);

        $this->assertSame('MB', $b->fresh()->kode);
        $this->assertNull($a->fresh()->email);
    }

    public function test_daftar_keanggotaan_lintas_santri_dengan_filter(): void
    {
        $super = $this->makeSuperAdmin();
        $mi = Lembaga::create(['nama' => 'MI', 'kode' => 'MI']);
        $md = Lembaga::create(['nama' => 'MD', 'kode' => 'MD']);

        $s1 = Santri::create(['nama_lengkap' => 'Anggota Satu', 'jk' => 'L']);
        $s2 = Santri::create(['nama_lengkap' => 'Anggota Dua', 'jk' => 'P']);
        LembagaSantri::create(['santri_id' => $s1->id, 'lembaga_id' => $mi->id, 'nis_lokal' => '10001', 'is_active_lembaga' => 'Ya']);
        LembagaSantri::create(['santri_id' => $s2->id, 'lembaga_id' => $md->id, 'nis_lokal' => null, 'is_active_lembaga' => 'Ya']);
        LembagaSantri::create(['santri_id' => $s2->id, 'lembaga_id' => $mi->id, 'nis_lokal' => '10002', 'is_active_lembaga' => 'Tidak']);

        // Semua (tanpa filter status).
        $res = $this->actingAs($super, 'sanctum')->getJson('/api/admin/lembaga-santri?per_page=50')->assertStatus(200);
        $this->assertSame(3, $res->json('total'));

        // Filter lembaga + tanpa NIS.
        $res = $this->actingAs($super, 'sanctum')->getJson("/api/admin/lembaga-santri?lembaga_id={$md->id}&tanpa_nis=1")->assertStatus(200);
        $this->assertSame(1, $res->json('total'));
        $this->assertSame('Anggota Dua', $res->json('data.0.santri.nama_lengkap'));

        // Filter nonaktif + cari nama.
        $res = $this->actingAs($super, 'sanctum')->getJson('/api/admin/lembaga-santri?is_active_lembaga=0&search=Dua')->assertStatus(200);
        $this->assertSame(1, $res->json('total'));
        $this->assertSame('10002', $res->json('data.0.nis_lokal'));
    }
}

<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class GrupCustomTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Lembaga::create(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true]);
        TahunAjaran::create(['nama' => '2025/2026', 'is_aktif' => true]);
    }

    protected function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'phone' => '081234567890', 'password' => 'password']);
        $u->assignRole('super_admin');

        return $u;
    }

    public function test_crud_grup_dan_anggota(): void
    {
        $admin = $this->admin();
        $s1 = Santri::create(['nama_lengkap' => 'Ekskul Satu', 'jk' => 'L']);
        $s2 = Santri::create(['nama_lengkap' => 'Ekskul Dua', 'jk' => 'P']);

        // Buat grup (lingkup lembaga + TA + status).
        $grup = $this->actingAs($admin)->postJson('/api/admin/keuangan/grup-custom', [
            'nama' => 'Ekskul Matematika', 'keterangan' => 'Peserta olimpiade',
            'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'is_active' => true,
        ])->assertStatus(201)->json();
        $this->assertSame('Ekskul Matematika', $grup['nama']);
        $this->assertSame('MI', $grup['jenjang']);
        $this->assertTrue($grup['is_active']);
        $this->assertSame([], $grup['santri']);

        // Nama wajib unik.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/grup-custom', [
            'nama' => 'Ekskul Matematika',
        ])->assertStatus(422)->assertJsonValidationErrors('nama');

        // Tambah anggota (idempotent).
        $isi = fn () => $this->actingAs($admin)->getJson('/api/admin/keuangan/grup-custom')
            ->assertStatus(200)->json();
        $this->actingAs($admin)->postJson("/api/admin/keuangan/grup-custom/{$grup['id']}/anggota", [
            'santri_ids' => [$s1->id, $s2->id],
        ])->assertStatus(200);
        $this->actingAs($admin)->postJson("/api/admin/keuangan/grup-custom/{$grup['id']}/anggota", [
            'santri_ids' => [$s1->id],
        ])->assertStatus(200);
        $daftar = $isi();
        $this->assertCount(1, $daftar);
        $this->assertEqualsCanonicalizing([$s1->id, $s2->id], array_column($daftar[0]['santri'], 'id'));

        // Filter lingkup: jenjang lain / TA lain mengosongkan daftar.
        $kosong = fn (string $q) => $this->actingAs($admin)
            ->getJson("/api/admin/keuangan/grup-custom{$q}")->assertStatus(200)->json();
        $this->assertCount(0, $kosong('?jenjang=MD'));
        $this->assertCount(0, $kosong('?tahun_ajaran=2024/2025'));
        $this->assertCount(1, $kosong('?jenjang=MI&tahun_ajaran=2025/2026'));
        // Filter array (dari topBar multi-pilih) juga didukung.
        $this->assertCount(1, $kosong('?jenjang[]=MI&jenjang[]=MD'));

        // Anggota diperkaya nis/kelas/jenjang dari riwayat TA filter.
        DB::table('riwayat_belajar')->insert([
            'santri_id' => $s2->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI',
            'tingkat' => '3', 'semester' => '2', 'status_akhir' => 'aktif',
            'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('lembaga_santri')->insert([
            'santri_id' => $s2->id, 'jenjang' => 'MI', 'nis_lokal' => '77001',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $anggota = collect($isi()[0]['santri'])->keyBy('id');
        $this->assertSame('MI', $anggota[$s2->id]['jenjang']);
        $this->assertSame('77001', $anggota[$s2->id]['nis']);
        // TA multi-pilih: pengayaan anggota memakai TA aktif, tanpa galat.
        $multi = $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/grup-custom?tahun_ajaran[]=2025/2026')
            ->assertStatus(200)->json();
        $this->assertCount(1, $multi);
        $this->assertSame('MI', collect($multi[0]['santri'])->firstWhere('id', $s2->id)['jenjang']);

        // Santri tak dikenal ditolak.
        $this->actingAs($admin)->postJson("/api/admin/keuangan/grup-custom/{$grup['id']}/anggota", [
            'santri_ids' => [999999],
        ])->assertStatus(422);

        // Ubah nama.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/grup-custom/{$grup['id']}", [
            'nama' => 'Ekskul MTK', 'keterangan' => null,
        ])->assertStatus(200)->assertJsonPath('nama', 'Ekskul MTK');

        // Keluarkan satu anggota.
        $this->actingAs($admin)
            ->deleteJson("/api/admin/keuangan/grup-custom/{$grup['id']}/anggota/{$s1->id}")
            ->assertStatus(200);
        $daftar = $isi();
        $this->assertSame([$s2->id], array_column($daftar[0]['santri'], 'id'));

        // Hapus grup → anggota ikut bersih.
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/grup-custom/{$grup['id']}")
            ->assertStatus(200)->assertJson(['pesan' => 'Grup dihapus.']);
        $this->assertSame([], $isi());
        $this->assertDatabaseMissing('anggota_grup_santri_custom', ['grup_id' => $grup['id']]);
    }
}

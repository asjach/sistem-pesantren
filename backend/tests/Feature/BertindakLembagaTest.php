<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Mode "bertindak sebagai lembaga" (act-as) untuk super_admin via header X-Lembaga-Aktif. */
class BertindakLembagaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    protected int $seq = 0;

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->seq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->seq,
            'email' => "act{$this->seq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9000000000 + $this->seq * 137), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'lembaga_id' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    /** @return array{root: Lembaga, mi: Lembaga, md: Lembaga} */
    protected function lembaga(): array
    {
        $root = Lembaga::create(['nama' => 'Pesantren', 'kode' => 'PESANTREN', 'is_active' => true]);
        $mi = Lembaga::create(['parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI', 'is_active' => true]);
        $md = Lembaga::create(['parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD', 'is_active' => true]);

        return ['root' => $root, 'mi' => $mi, 'md' => $md];
    }

    protected function siapkanKelas(Lembaga $mi, Lembaga $md): void
    {
        $taMi = TahunAjaran::create(['lembaga_id' => $mi->id, 'nama' => '2026/2027', 'is_aktif' => true]);
        $taMd = TahunAjaran::create(['lembaga_id' => $md->id, 'nama' => '2026/2027', 'is_aktif' => true]);
        Kelas::create(['lembaga_id' => $mi->id, 'tahun_ajaran_id' => $taMi->id, 'nama_kelas' => 'I-A']);
        Kelas::create(['lembaga_id' => $md->id, 'tahun_ajaran_id' => $taMd->id, 'nama_kelas' => 'MD-A']);
    }

    public function test_tanpa_header_super_admin_tetap_penuh(): void
    {
        $l = $this->lembaga();
        $this->siapkanKelas($l['mi'], $l['md']);
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/lembaga', [
            'nama' => 'Unit Baru', 'kode' => 'UB',
        ])->assertStatus(201);

        $this->actingAs($pusat, 'sanctum')->getJson("/api/admin/kelas?lembaga_id={$l['md']->id}")
            ->assertStatus(200);
    }

    public function test_bertindak_membatasi_scope_dan_kemampuan_global(): void
    {
        $l = $this->lembaga();
        $this->siapkanKelas($l['mi'], $l['md']);
        $pusat = $this->makeUser('super_admin');

        // Dua user berbeda lembaga untuk uji daftar pengguna.
        $this->makeUser('guru', [$l['mi']->id]);
        $this->makeUser('guru', [$l['md']->id]);

        $hdr = ['X-Lembaga-Aktif' => (string) $l['mi']->id];

        // Data kelas menyempit ke MI.
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->getJson('/api/admin/kelas')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.lembaga_id', $l['mi']->id);

        // Lintas lembaga ditolak.
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)
            ->getJson("/api/admin/kelas?lembaga_id={$l['md']->id}")->assertStatus(403);

        // Kemampuan global dicabut.
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->postJson('/api/admin/lembaga', [
            'nama' => 'Unit Baru', 'kode' => 'UB',
        ])->assertStatus(403);

        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->postJson('/api/admin/psb/kegiatan', [
            'nama' => 'PSB 2027',
        ])->assertStatus(403);

        // Dashboard mengikuti lembaga aktif.
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->getJson('/api/dashboard/ringkasan')
            ->assertStatus(200)
            ->assertJsonPath('lembaga', 1);
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)
            ->getJson("/api/dashboard/ringkasan?lembaga_id={$l['md']->id}")->assertStatus(403);

        // Pengguna hanya dari MI.
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->getJson('/api/admin/users')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data');

        // Standar tampilan lembaga lain ditolak; sebar "semua" ditolak.
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)
            ->getJson("/api/admin/pengaturan-tampilan?lembaga_id={$l['md']->id}")->assertStatus(403);
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => 'semua',
            'data' => ['tema' => ['theme' => 'geist']],
        ])->assertStatus(403);

        // Referensi global: baris otomatis milik lembaga aktif (bukan global).
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->postJson('/api/admin/referensi/tingkat', [
            'nama' => 'Kelas 1', 'kode' => '1',
        ])->assertStatus(201);
        $this->assertSame(1, DB::table('ref_tingkat')->where('lembaga_id', $l['mi']->id)->count());
        $this->assertSame(0, DB::table('ref_tingkat')->whereNull('lembaga_id')->count());

        // Keluar mode (header dilepas) → kembali penuh.
        $this->flushHeaders();
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/lembaga', [
            'nama' => 'Unit Baru', 'kode' => 'UB',
        ])->assertStatus(201);
    }

    public function test_header_lembaga_tidak_dikenal_ditolak(): void
    {
        $this->lembaga();
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')->withHeaders(['X-Lembaga-Aktif' => '999999'])
            ->getJson('/api/admin/kelas')->assertStatus(403);
    }

    public function test_admin_lembaga_biasa_tidak_terpengaruh_header(): void
    {
        $l = $this->lembaga();
        $this->siapkanKelas($l['mi'], $l['md']);
        $adminMi = $this->makeUser('admin', [$l['mi']->id]);

        // Header act-as diabaikan untuk non-super_admin → tetap hanya MI.
        $this->actingAs($adminMi, 'sanctum')->withHeaders(['X-Lembaga-Aktif' => (string) $l['md']->id])
            ->getJson('/api/admin/kelas')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.lembaga_id', $l['mi']->id);
    }
}

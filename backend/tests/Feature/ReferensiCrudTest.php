<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\User;
use App\Services\RefService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Ubah kamus referensi: baris lembaga oleh admin lembaganya,
// baris global hanya super_admin (004).
class ReferensiCrudTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected int $userSeq = 0;

    protected function fixture(): array
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren Root', 'kode' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);

        return compact('root', 'mi', 'md');
    }

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => ucfirst($role) . ' ' . $this->userSeq,
            'email' => "refcrud_u{$this->userSeq}_" . uniqid() . '@example.com',
            'phone' => '08' . str_pad((string) (9300000000 + $this->userSeq * 137 + random_int(0, 99)), 10, '0', STR_PAD_LEFT),
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

    protected function namaEfektif(string $tipe, ?int $lembagaId): array
    {
        return array_map(fn ($r) => $r->nama ?? $r->kode, RefService::effective($tipe, $lembagaId));
    }

    // ---------- 1. admin ubah baris kamus lembaganya ----------

    public function test_01_admin_dapat_mengubah_nama_dan_urutan_baris_lembaga(): void
    {
        $f = $this->fixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $id = $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Memancing', 'lembaga_id' => $f['mi']->id,
        ])->assertStatus(201)->json('id');

        $this->actingAs($adminMi, 'sanctum')
            ->putJson("/api/admin/referensi/hobi/{$id}", ['nama' => 'Memancing Ikan', 'urutan' => 7])
            ->assertStatus(200)
            ->assertJsonPath('nama', 'Memancing Ikan')
            ->assertJsonPath('urutan', 7);

        $this->assertDatabaseHas('ref_hobi', ['id' => $id, 'nama' => 'Memancing Ikan', 'urutan' => 7]);
        $this->assertContains('Memancing Ikan', $this->namaEfektif('hobi', $f['mi']->id));
        $this->assertNotContains('Memancing', $this->namaEfektif('hobi', $f['mi']->id));
    }

    // ---------- 2. admin tidak boleh ubah baris global ----------

    public function test_02_admin_tidak_dapat_mengubah_baris_global(): void
    {
        $f = $this->fixture();
        $super = $this->makeUser('super_admin');
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $id = $this->actingAs($super, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Global Hobi',
        ])->assertStatus(201)->json('id');

        $this->actingAs($adminMi, 'sanctum')
            ->putJson("/api/admin/referensi/hobi/{$id}", ['nama' => 'Diubah Lembaga'])
            ->assertStatus(403);

        $this->assertDatabaseHas('ref_hobi', ['id' => $id, 'nama' => 'Global Hobi']);
    }

    // ---------- 3. super_admin ubah baris global ----------

    public function test_03_super_admin_dapat_mengubah_baris_global(): void
    {
        $f = $this->fixture();
        $super = $this->makeUser('super_admin');

        $id = $this->actingAs($super, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Global Lama',
        ])->assertStatus(201)->json('id');

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/referensi/hobi/{$id}", ['nama' => 'Global Baru', 'urutan' => 3])
            ->assertStatus(200)
            ->assertJsonPath('nama', 'Global Baru');

        $this->assertContains('Global Baru', $this->namaEfektif('hobi', null));
        $this->assertContains('Global Baru', $this->namaEfektif('hobi', $f['mi']->id));
    }

    // ---------- 4. admin lembaga lain ditolak ----------

    public function test_04_admin_lembaga_lain_tidak_dapat_mengubah(): void
    {
        $f = $this->fixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $adminMd = $this->makeUser('admin', [$f['md']->id]);

        $id = $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Hobi MI', 'lembaga_id' => $f['mi']->id,
        ])->assertStatus(201)->json('id');

        $this->actingAs($adminMd, 'sanctum')
            ->putJson("/api/admin/referensi/hobi/{$id}", ['nama' => 'Hobi MD'])
            ->assertStatus(403);
    }

    // ---------- 5. nama duplikat di scope sama ditolak ----------

    public function test_05_nama_duplikat_ditolak_422(): void
    {
        $f = $this->fixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $a = $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Hobi A', 'lembaga_id' => $f['mi']->id,
        ])->assertStatus(201)->json('id');
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Hobi B', 'lembaga_id' => $f['mi']->id,
        ])->assertStatus(201);

        $this->actingAs($adminMi, 'sanctum')
            ->putJson("/api/admin/referensi/hobi/{$a}", ['nama' => 'Hobi B'])
            ->assertStatus(422);
    }

    // ---------- 6. status: label/urutan berubah, kode tetap ----------

    public function test_06_status_hanya_label_dan_urutan(): void
    {
        $f = $this->fixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $id = $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/referensi/status_akhir', [
            'kode' => 'cuti_panjang', 'label' => 'Cuti', 'lembaga_id' => $f['mi']->id,
        ])->assertStatus(201)->json('id');

        $this->actingAs($adminMi, 'sanctum')
            ->putJson("/api/admin/referensi/status_akhir/{$id}", ['label' => 'Cuti Panjang', 'urutan' => 9])
            ->assertStatus(200)
            ->assertJsonPath('kode', 'cuti_panjang')
            ->assertJsonPath('label', 'Cuti Panjang');

        $this->assertDatabaseHas('ref_status_akhir', [
            'id' => $id, 'kode' => 'cuti_panjang', 'label' => 'Cuti Panjang', 'urutan' => 9,
        ]);
    }

    // ---------- 7. perubahan baris global invalidasi cache per-lembaga ----------

    public function test_07_perubahan_global_invalidasi_cache_per_lembaga(): void
    {
        $f = $this->fixture();
        $super = $this->makeUser('super_admin');

        $id = $this->actingAs($super, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Hobi Global Awal',
        ])->assertStatus(201)->json('id');

        // Prime cache per-lembaga MI (baris global ikut ter-cache).
        $this->assertContains('Hobi Global Awal', $this->namaEfektif('hobi', $f['mi']->id));

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/referensi/hobi/{$id}", ['nama' => 'Hobi Global Baru'])
            ->assertStatus(200);

        $efektif = $this->namaEfektif('hobi', $f['mi']->id);
        $this->assertContains('Hobi Global Baru', $efektif);
        $this->assertNotContains('Hobi Global Awal', $efektif);

        // forgetAlamat juga menginvalidasi cache alamat (global).
        DB::table('ref_alamat')->insert([
            'lembaga_id' => null, 'nama' => 'Alamat Global Awal', 'urutan' => 0, 'is_active' => true,
        ]);
        $alamatAwal = array_map(fn ($r) => $r->nama, RefService::effectiveAlamat($f['mi']->id));
        $this->assertContains('Alamat Global Awal', $alamatAwal);

        DB::table('ref_alamat')->whereNull('lembaga_id')->where('nama', 'Alamat Global Awal')
            ->update(['nama' => 'Alamat Global Baru']);
        RefService::forgetAlamat(null);

        $alamatBaru = array_map(fn ($r) => $r->nama, RefService::effectiveAlamat($f['mi']->id));
        $this->assertContains('Alamat Global Baru', $alamatBaru);
        $this->assertNotContains('Alamat Global Awal', $alamatBaru);
    }
}

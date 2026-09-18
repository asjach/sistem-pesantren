<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\PresetTabel;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PresetTabelTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    protected int $userSeq = 0;

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->userSeq,
            'email' => "preset{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9000000000 + $this->userSeq * 137), 10, '0', STR_PAD_LEFT),
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

    public function test_preset_global_hanya_super_admin(): void
    {
        $root = Lembaga::create(['nama' => 'Pesantren', 'kode' => 'PESANTREN', 'is_active' => true]);
        $mi = Lembaga::create(['parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI', 'is_active' => true]);

        $pusat = $this->makeUser('super_admin');
        $adminMi = $this->makeUser('admin', [$mi->id]);

        // Admin lembaga ditolak menulis (403), baris tak terbentuk.
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'psb', 'nama' => 'default', 'kolom' => ['nama'],
        ])->assertStatus(403);
        $this->assertSame(0, PresetTabel::count());

        // Super_admin menyimpan preset global (satu baris per nama).
        $res = $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'psb', 'nama' => 'default', 'kolom' => ['nama'],
        ]);
        $res->assertStatus(201);
        $id = (int) $res->json('data.0.id');
        $this->assertNull(PresetTabel::findOrFail($id)->lembaga_id);

        // Nama "lengkap" milik bawaan sistem.
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'psb', 'nama' => 'Lengkap', 'kolom' => ['nama'],
        ])->assertStatus(422)->assertJsonValidationErrors(['nama']);

        // Simpan ulang nama sama = menimpa kolom (bukan menambah baris).
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'psb', 'nama' => 'default', 'kolom' => ['nama', 'nik'],
        ])->assertStatus(201);
        $this->assertEquals(['nama', 'nik'], PresetTabel::findOrFail($id)->kolom);
        $this->assertSame(1, PresetTabel::where('table_key', 'psb')->where('nama', 'default')->count());

        // Admin boleh membaca + memilih (setAktif), tapi tak boleh ubah/hapus.
        $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/preset-tabel?table_key=psb')
            ->assertStatus(200)
            ->assertJsonPath('data.presets.0.nama', 'default');
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/preset-tabel/aktif', [
            'table_key' => 'psb', 'preset_id' => $id,
        ])->assertStatus(200);
        $this->actingAs($adminMi, 'sanctum')->putJson("/api/admin/preset-tabel/{$id}", [
            'kolom' => ['nama'],
        ])->assertStatus(403);
        $this->actingAs($adminMi, 'sanctum')->deleteJson("/api/admin/preset-tabel/{$id}")->assertStatus(403);

        // Super_admin ubah + hapus.
        $this->actingAs($pusat, 'sanctum')->putJson("/api/admin/preset-tabel/{$id}", [
            'kolom' => ['nama', 'status'],
        ])->assertStatus(200);
        $this->assertEquals(['nama', 'status'], PresetTabel::findOrFail($id)->kolom);
        $this->actingAs($pusat, 'sanctum')->deleteJson("/api/admin/preset-tabel/{$id}")->assertStatus(200);
        $this->assertSame(0, PresetTabel::where('table_key', 'psb')->count());
    }

    public function test_set_aktif_menolak_preset_tak_terlihat(): void
    {
        $root = Lembaga::create(['nama' => 'Pesantren', 'kode' => 'PESANTREN', 'is_active' => true]);
        $mi = Lembaga::create(['parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI', 'is_active' => true]);
        $md = Lembaga::create(['parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD', 'is_active' => true]);
        $adminMi = $this->makeUser('admin', [$mi->id]);

        // Baris lama milik lembaga lain: terlihat super_admin, tak terlihat admin MI.
        $asing = PresetTabel::create([
            'lembaga_id' => $md->id, 'table_key' => 'psb', 'nama' => 'warisan', 'kolom' => ['nama'],
        ]);

        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/preset-tabel/aktif', [
            'table_key' => 'psb', 'preset_id' => $asing->id,
        ])->assertStatus(403);
    }

    public function test_preset_menerima_kolom_banyak_melebihi_60(): void
    {
        $pusat = $this->makeUser('super_admin');

        // Tabel santri punya > 60 kolom (72) — tidak boleh ditolak batas lama.
        $kolom = array_map(fn ($i) => "kolom_{$i}", range(1, 72));
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'santri', 'nama' => 'semua kolom', 'kolom' => $kolom,
        ])->assertStatus(201);
        $this->assertCount(72, PresetTabel::firstOrFail()->kolom);

        // Batas aman tetap ada.
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'santri', 'nama' => 'kebablasan',
            'kolom' => array_map(fn ($i) => "kolom_{$i}", range(1, 201)),
        ])->assertStatus(422)->assertJsonValidationErrors(['kolom']);
    }

    public function test_preset_menyimpan_label_kustom_per_kolom(): void
    {
        $pusat = $this->makeUser('super_admin');

        // Label tersimpan; key di luar kolom + string kosong dibuang.
        $res = $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'keanggotaan', 'nama' => 'ringkas',
            'kolom' => ['santri', 'jk'],
            'label' => ['santri' => 'Nama Santri', 'jk' => '  ', 'kolom_asing' => 'X'],
        ]);
        $res->assertStatus(201);
        $id = (int) $res->json('data.0.id');
        $this->assertEquals(['santri' => 'Nama Santri'], PresetTabel::findOrFail($id)->label);

        // Index memuat label; ubah via PUT (null = hapus semua label kustom).
        $this->actingAs($pusat, 'sanctum')->getJson('/api/admin/preset-tabel?table_key=keanggotaan')
            ->assertJsonPath('data.presets.0.label', ['santri' => 'Nama Santri']);
        $this->actingAs($pusat, 'sanctum')->putJson("/api/admin/preset-tabel/{$id}", [
            'label' => ['jk' => 'Jenis Kelamin'],
        ])->assertStatus(200);
        $this->assertEquals(['jk' => 'Jenis Kelamin'], PresetTabel::findOrFail($id)->label);
        $this->actingAs($pusat, 'sanctum')->putJson("/api/admin/preset-tabel/{$id}", [
            'label' => null,
        ])->assertStatus(200);
        $this->assertNull(PresetTabel::findOrFail($id)->label);
    }
}

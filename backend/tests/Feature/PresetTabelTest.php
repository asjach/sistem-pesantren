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

    public function test_set_aktif_menolak_preset_tabel_lain_dan_non_global(): void
    {
        $pusat = $this->makeUser('super_admin');
        $admin = $this->makeUser('admin');

        $id = PresetTabel::create([
            'lembaga_id' => null, 'table_key' => 'psb', 'nama' => 'global', 'kolom' => ['nama'],
        ])->id;

        // Preset tabel lain tidak bisa dipilih untuk tabel ini.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/preset-tabel/aktif', [
            'table_key' => 'santri', 'preset_id' => $id,
        ])->assertStatus(422)->assertJsonValidationErrors(['preset_id']);

        // Baris lama per-lembaga tak terlihat siapa pun (403), tak bisa dipilih.
        $root = Lembaga::create(['nama' => 'Pesantren', 'kode' => 'PESANTREN', 'is_active' => true]);
        $warisan = PresetTabel::create([
            'lembaga_id' => $root->id, 'table_key' => 'psb', 'nama' => 'warisan', 'kolom' => ['nama'],
        ]);
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/preset-tabel/aktif', [
            'table_key' => 'psb', 'preset_id' => $warisan->id,
        ])->assertStatus(403);
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/preset-tabel/aktif', [
            'table_key' => 'psb', 'preset_id' => $warisan->id,
        ])->assertStatus(403);

        // ...dan tak bisa diubah (hapus lalu buat baru sebagai global).
        $this->actingAs($pusat, 'sanctum')->putJson("/api/admin/preset-tabel/{$warisan->id}", [
            'kolom' => ['nama'],
        ])->assertStatus(422)->assertJsonValidationErrors(['preset']);
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

    public function test_bawaan_satu_per_tabel_hanya_super_admin(): void
    {
        $pusat = $this->makeUser('super_admin');
        $admin = $this->makeUser('admin');

        $a = PresetTabel::create(['lembaga_id' => null, 'table_key' => 'psb', 'nama' => 'a', 'kolom' => ['nama']]);
        $b = PresetTabel::create(['lembaga_id' => null, 'table_key' => 'psb', 'nama' => 'b', 'kolom' => ['nama']]);

        // Non-super_admin ditolak (403 ganda: middleware izin + pastikanSuperAdmin).
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/preset-tabel/{$a->id}/bawaan")
            ->assertStatus(403);

        // Tetapkan A → index melaporkan default_preset_id.
        $this->actingAs($pusat, 'sanctum')->postJson("/api/admin/preset-tabel/{$a->id}/bawaan")
            ->assertStatus(200)
            ->assertJsonPath('pesan', 'Preset bawaan ditetapkan.');
        $this->assertTrue(PresetTabel::findOrFail($a->id)->is_default);
        $this->actingAs($pusat, 'sanctum')->getJson('/api/admin/preset-tabel?table_key=psb')
            ->assertJsonPath('data.default_preset_id', $a->id);

        // Tetapkan B → A otomatis tercabut (satu per tabel).
        $this->actingAs($pusat, 'sanctum')->postJson("/api/admin/preset-tabel/{$b->id}/bawaan")
            ->assertStatus(200);
        $this->assertFalse(PresetTabel::findOrFail($a->id)->is_default);
        $this->assertTrue(PresetTabel::findOrFail($b->id)->is_default);

        // Cabut B → tak ada bawaan.
        $this->actingAs($pusat, 'sanctum')->postJson("/api/admin/preset-tabel/{$b->id}/bawaan", ['bawaan' => false])
            ->assertStatus(200)
            ->assertJsonPath('pesan', 'Preset bawaan dicabut.');
        $this->actingAs($pusat, 'sanctum')->getJson('/api/admin/preset-tabel?table_key=psb')
            ->assertJsonPath('data.default_preset_id', null);
    }
}

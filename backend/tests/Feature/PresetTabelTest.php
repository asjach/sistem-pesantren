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

    public function test_preset_kolom_generate_ke_lembaga_pilihan_dan_bisa_diedit_lembaga(): void
    {
        $root = Lembaga::create(['nama' => 'Pesantren', 'kode' => 'PESANTREN', 'is_active' => true]);
        $mi = Lembaga::create(['parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI', 'is_active' => true]);
        $md = Lembaga::create(['parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD', 'is_active' => true]);

        $pusat = $this->makeUser('admin');
        $adminMi = $this->makeUser('admin', [$mi->id]);
        $adminMd = $this->makeUser('admin', [$md->id]);

        // Admin lembaga boleh men-generate ke pasangan MI↔MD.
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'psb', 'nama' => 'default', 'lembaga_ids' => [$mi->id, $md->id], 'kolom' => ['nama'],
        ])->assertStatus(201);

        // Admin pesantren generate ke beberapa lembaga sekaligus.
        $generate = $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'psb', 'nama' => 'default',
            'lembaga_ids' => [$root->id, $mi->id, $md->id],
            'kolom' => ['nama', 'lembaga', 'tipe', 'gelombang', 'status'],
        ]);
        $generate->assertStatus(201);
        $hasil = collect($generate->json('data'));
        $this->assertCount(3, $hasil);
        $this->assertEqualsCanonicalizing(
            [$root->id, $mi->id, $md->id],
            $hasil->pluck('lembaga_id')->all(),
        );
        $miDefaultId = (int) $hasil->firstWhere('lembaga_id', $mi->id)['id'];

        // Preset satu lembaga biasa (admin lembaga).
        $miPreset = $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'psb', 'nama' => 'nama saja', 'lembaga_ids' => [$mi->id], 'kolom' => ['nama'],
        ]);
        $miPreset->assertStatus(201);
        $miPresetId = (int) $miPreset->json('data.0.id');

        $this->actingAs($adminMd, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'psb', 'nama' => 'ringkas', 'lembaga_ids' => [$md->id], 'kolom' => ['nama', 'status'],
        ])->assertStatus(201);

        // Nama "lengkap" milik bawaan sistem.
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'psb', 'nama' => 'Lengkap', 'lembaga_ids' => [$mi->id], 'kolom' => ['nama'],
        ])->assertStatus(422)->assertJsonValidationErrors(['nama']);

        // Generate ulang dengan nama sama = menimpa kolom (bukan menambah baris).
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'psb', 'nama' => 'nama saja', 'lembaga_ids' => [$mi->id], 'kolom' => ['nama', 'nik'],
        ])->assertStatus(201);
        $this->assertEquals(['nama', 'nik'], PresetTabel::findOrFail($miPresetId)->kolom);
        $this->assertEquals(1, PresetTabel::where('lembaga_id', $mi->id)->where('table_key', 'psb')->where('nama', 'nama saja')->count());

        // Daftar efektif: tiap lembaga melihat miliknya sendiri.
        $listMi = $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/preset-tabel?table_key=psb');
        $listMi->assertStatus(200);
        $this->assertEqualsCanonicalizing(['default', 'nama saja'], collect($listMi->json('data.presets'))->pluck('nama')->all());

        $listMd = $this->actingAs($adminMd, 'sanctum')->getJson('/api/admin/preset-tabel?table_key=psb');
        $this->assertEqualsCanonicalizing(['default', 'ringkas'], collect($listMd->json('data.presets'))->pluck('nama')->all());

        $listPusat = $this->actingAs($pusat, 'sanctum')->getJson('/api/admin/preset-tabel?table_key=psb');
        $this->assertCount(5, $listPusat->json('data.presets'));

        // Salinan lembaga bisa diedit admin lembaga tsb; pasangan MI↔MD ikut boleh.
        $this->actingAs($adminMi, 'sanctum')->putJson("/api/admin/preset-tabel/{$miDefaultId}", [
            'kolom' => ['nama', 'nik'],
        ])->assertStatus(200);
        $this->assertEquals(['nama', 'nik'], PresetTabel::findOrFail($miDefaultId)->kolom);

        $this->actingAs($adminMd, 'sanctum')->putJson("/api/admin/preset-tabel/{$miDefaultId}", [
            'nama' => 'edit pasangan',
        ])->assertStatus(200);

        // Simpan pilihan terakhir + hapus preset → kembali Lengkap (null).
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/preset-tabel/aktif', [
            'table_key' => 'psb', 'preset_id' => $miPresetId,
        ])->assertStatus(200);
        $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/preset-tabel?table_key=psb')
            ->assertJsonPath('data.aktif_preset_id', $miPresetId);

        $this->actingAs($adminMi, 'sanctum')->deleteJson("/api/admin/preset-tabel/{$miPresetId}")->assertStatus(200);
        $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/preset-tabel?table_key=psb')
            ->assertJsonPath('data.aktif_preset_id', null);

        // Generate ulang oleh pusat ke subset menimpa salinan lembaga (termasuk editan admin MI).
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'psb', 'nama' => 'default', 'lembaga_ids' => [$mi->id], 'kolom' => ['nama', 'status'],
        ])->assertStatus(201);
        $this->assertEquals(['nama', 'status'], PresetTabel::where('lembaga_id', $mi->id)->where('table_key', 'psb')->where('nama', 'default')->firstOrFail()->kolom);
    }

    public function test_preset_menerima_kolom_banyak_melebihi_60(): void
    {
        $root = Lembaga::create(['nama' => 'Pesantren', 'kode' => 'PESANTREN', 'is_active' => true]);
        $pusat = $this->makeUser('admin');

        // Tabel santri punya > 60 kolom (72) — tidak boleh ditolak batas lama.
        $kolom = array_map(fn ($i) => "kolom_{$i}", range(1, 72));
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'santri', 'nama' => 'semua kolom', 'lembaga_ids' => [$root->id], 'kolom' => $kolom,
        ])->assertStatus(201);
        $this->assertCount(72, PresetTabel::firstOrFail()->kolom);

        // Batas aman tetap ada.
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/preset-tabel', [
            'table_key' => 'santri', 'nama' => 'kebablasan', 'lembaga_ids' => [$root->id],
            'kolom' => array_map(fn ($i) => "kolom_{$i}", range(1, 201)),
        ])->assertStatus(422)->assertJsonValidationErrors(['kolom']);
    }
}

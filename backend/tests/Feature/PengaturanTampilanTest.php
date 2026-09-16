<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\PengaturanTampilan;
use App\Models\PresetTabel;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PengaturanTampilanTest extends TestCase
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
            'email' => "tampilan{$this->userSeq}_".uniqid().'@example.com',
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

    /** @return array{0: Lembaga, 1: Lembaga, 2: Lembaga} */
    protected function lembaga(): array
    {
        $root = Lembaga::create(['nama' => 'Pesantren', 'kode' => 'PESANTREN', 'is_active' => true]);
        $mi = Lembaga::create(['parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI', 'is_active' => true]);
        $md = Lembaga::create(['parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD', 'is_active' => true]);

        return [$root, $mi, $md];
    }

    public function test_admin_lembaga_hanya_bisa_mengatur_lembaganya(): void
    {
        [, $mi, $md] = $this->lembaga();
        $adminMi = $this->makeUser('admin', [$mi->id]);
        $adminMd = $this->makeUser('admin', [$md->id]);

        // Lintas lembaga ditolak.
        $this->actingAs($adminMi, 'sanctum')->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => [$mi->id, $md->id],
            'data' => ['tema' => ['theme' => 'geist']],
        ])->assertStatus(403);

        // "semua" pun ditolak untuk admin lembaga.
        $this->actingAs($adminMi, 'sanctum')->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => 'semua',
            'data' => ['tema' => ['theme' => 'geist']],
        ])->assertStatus(403);

        // Lembaganya sendiri boleh.
        $this->actingAs($adminMi, 'sanctum')->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => [$mi->id],
            'data' => ['tema' => ['theme' => 'nusantara', 'mode' => 'gelap']],
        ])->assertStatus(201);

        // show tanpa param: otomatis lembaga tunggal.
        $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/pengaturan-tampilan')
            ->assertStatus(200)
            ->assertJsonPath('data.lembaga_id', $mi->id)
            ->assertJsonPath('data.versi', 1)
            ->assertJsonPath('data.tampilan.tema.theme', 'nusantara')
            ->assertJsonPath('data.tampilan.tema.mode', 'gelap');

        // Lembaga lain belum diatur.
        $this->actingAs($adminMd, 'sanctum')->getJson('/api/admin/pengaturan-tampilan')
            ->assertJsonPath('data.versi', 0)
            ->assertJsonPath('data.tampilan', null);

        // Membaca lembaga luar akses ditolak.
        $this->actingAs($adminMd, 'sanctum')->getJson("/api/admin/pengaturan-tampilan?lembaga_id={$mi->id}")
            ->assertStatus(403);
    }

    public function test_super_admin_sebar_ke_semua_dan_versi_naik(): void
    {
        [$root, $mi, $md] = $this->lembaga();
        $pusat = $this->makeUser('admin');

        $res = $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => 'semua',
            'data' => [
                'tema' => ['density' => 'nyaman'],
                'grid' => ['rowH' => 28, 'align' => ['nama' => 'center']],
            ],
        ]);
        $res->assertStatus(201);
        $this->assertCount(3, $res->json('data'));
        $this->assertSame(3, PengaturanTampilan::count());

        $this->actingAs($pusat, 'sanctum')->getJson("/api/admin/pengaturan-tampilan/versi?lembaga_id={$mi->id}")
            ->assertJsonPath('data.versi', 1);

        // Simpan ulang → versi naik, bukan baris baru.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => [$mi->id],
            'data' => ['grid' => ['rowH' => 30]],
        ])->assertStatus(201);

        $this->assertSame(3, PengaturanTampilan::count());
        $this->actingAs($pusat, 'sanctum')->getJson("/api/admin/pengaturan-tampilan/versi?lembaga_id={$mi->id}")
            ->assertJsonPath('data.versi', 2);
        $this->assertSame(30, PengaturanTampilan::where('lembaga_id', $mi->id)->firstOrFail()->data['grid']['rowH']);

        // Super admin dapat melihat lembaga mana pun.
        $this->actingAs($pusat, 'sanctum')->getJson("/api/admin/pengaturan-tampilan?lembaga_id={$root->id}")
            ->assertStatus(200)
            ->assertJsonPath('data.tampilan.tema.density', 'nyaman')
            ->assertJsonPath('data.versi', 1);
    }

    public function test_preset_aktif_disarikan_ke_lembaga_target(): void
    {
        [, $mi, $md] = $this->lembaga();
        $pusat = $this->makeUser('admin');

        PresetTabel::create([
            'lembaga_id' => $mi->id, 'table_key' => 'kelas', 'nama' => 'Ringkas',
            'kolom' => ['nama', 'tingkat'],
        ]);

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => [$md->id],
            'sumber_lembaga_id' => $mi->id,
            'data' => ['presetAktif' => ['kelas' => 'Ringkas']],
        ])->assertStatus(201);

        $salinan = PresetTabel::where('lembaga_id', $md->id)->where('table_key', 'kelas')->where('nama', 'Ringkas')->first();
        $this->assertNotNull($salinan);
        $this->assertEquals(['nama', 'tingkat'], $salinan->kolom);

        // Lembaga tanpa sumber tidak memunculkan preset baru.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => [$md->id],
            'data' => ['presetAktif' => ['kelas' => 'Tidak Ada']],
        ])->assertStatus(201);
        $this->assertSame(1, PresetTabel::where('lembaga_id', $md->id)->count());
    }

    public function test_lebar_dan_beku_menerima_nilai_null_untuk_menghapus(): void
    {
        [, $mi] = $this->lembaga();
        $pusat = $this->makeUser('admin');

        // Nilai lebar/beku per tabel.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => [$mi->id],
            'data' => [
                'lebar' => ['kelas' => ['nama' => 160]],
                'beku' => ['kelas' => 2],
            ],
        ])->assertStatus(201);

        // null = hapus lebar/beku tabel itu (dipakai tombol Reset/AutoFit).
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => [$mi->id],
            'data' => [
                'lebar' => ['kelas' => null],
                'beku' => ['kelas' => null],
            ],
        ])->assertStatus(201);

        $data = PengaturanTampilan::where('lembaga_id', $mi->id)->firstOrFail()->data;
        $this->assertSame(['kelas' => null], $data['lebar']);
        $this->assertSame(['kelas' => null], $data['beku']);
    }

    public function test_validasi_data_dan_reset_ke_bawaan(): void
    {
        [, $mi] = $this->lembaga();
        $adminMi = $this->makeUser('admin', [$mi->id]);

        $this->actingAs($adminMi, 'sanctum')->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => [$mi->id],
            'data' => ['grid' => ['rowH' => 5]],
        ])->assertStatus(422)->assertJsonValidationErrors(['data.grid.rowH']);

        $this->actingAs($adminMi, 'sanctum')->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => [$mi->id],
            'data' => ['tema' => ['mode' => 'senja']],
        ])->assertStatus(422)->assertJsonValidationErrors(['data.tema.mode']);

        $this->actingAs($adminMi, 'sanctum')->putJson('/api/admin/pengaturan-tampilan', [
            'lembaga_ids' => [$mi->id],
            'data' => ['tema' => ['theme' => 'geist']],
        ])->assertStatus(201);

        $this->actingAs($adminMi, 'sanctum')->deleteJson('/api/admin/pengaturan-tampilan')
            ->assertStatus(200);

        $this->assertSame(0, PengaturanTampilan::count());
        $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/pengaturan-tampilan')
            ->assertJsonPath('data.tampilan', null);
    }
}

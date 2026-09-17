<?php

namespace Tests\Feature;

use App\Models\LabelKolom;
use App\Models\Lembaga;
use App\Models\Santri;
use App\Models\UrutBawaan;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Kamus kolom level tabel database: CRUD, peta untuk grid, urut bawaan
 * per endpoint, dan guard admin pesantren.
 */
class KamusLabelTest extends TestCase
{
    use RefreshDatabase;

    protected int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->seq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->seq,
            'email' => "kamus_{$this->seq}_".uniqid().'@example.com',
            'phone' => '0814'.str_pad((string) (30000000 + $this->seq), 8, '0', STR_PAD_LEFT),
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

    public function test_admin_pesantren_crud_dan_peta(): void
    {
        $pusat = $this->makeUser('admin');

        $res = $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/kamus-kolom', [
            'tabel' => 'santri', 'kolom' => 'nama_lengkap',
            'label' => 'NAMA LENGKAP', 'align' => 'left', 'lebar' => 220,
            'kunci_lebar' => true, 'bisa_urut' => true, 'arah_bawaan' => 'naik',
            'tooltip' => 'Nama lengkap santri', 'format' => 'teks',
        ]);
        $res->assertStatus(201);
        $id = (int) $res->json('data.id');

        // Duplikat ditolak.
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/kamus-kolom', [
            'tabel' => 'santri', 'kolom' => 'nama_lengkap', 'label' => 'X',
        ])->assertStatus(422)->assertJsonValidationErrors(['kolom']);

        // Nilai di luar aturan ditolak.
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/kamus-kolom', [
            'tabel' => 'santri', 'kolom' => 'jk', 'align' => 'tengah',
        ])->assertStatus(422)->assertJsonValidationErrors(['align']);

        // Peta untuk grid memuat atribut kolom (kunci tabel.kolom).
        $peta = $this->actingAs($pusat, 'sanctum')->getJson('/api/admin/kamus-kolom/peta?tabel=santri,lembaga');
        $peta->assertStatus(200);
        $isi = $peta->json('data');
        $this->assertSame('NAMA LENGKAP', $isi['santri.nama_lengkap']['label']);
        $this->assertEquals(220, $isi['santri.nama_lengkap']['lebar']);
        $this->assertTrue($isi['santri.nama_lengkap']['kunci_lebar']);
        $this->assertArrayNotHasKey('lembaga.kode', $isi);

        // Update + hapus invalidasi cache peta.
        $this->actingAs($pusat, 'sanctum')->putJson("/api/admin/kamus-kolom/{$id}", [
            'tabel' => 'santri', 'kolom' => 'nama_lengkap', 'label' => 'NAMA',
        ])->assertStatus(200);
        $this->assertSame(
            'NAMA',
            $this->actingAs($pusat, 'sanctum')
                ->getJson('/api/admin/kamus-kolom/peta?tabel=santri')
                ->json('data')['santri.nama_lengkap']['label'],
        );

        $this->actingAs($pusat, 'sanctum')->deleteJson("/api/admin/kamus-kolom/{$id}")->assertStatus(200);
        $this->assertSame(0, LabelKolom::count());
    }

    public function test_admin_scoped_hanya_boleh_membaca(): void
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren', 'kode' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $scoped = $this->makeUser('admin', [$mi->id]);

        // Baca peta boleh (dipakai semua grid).
        $this->actingAs($scoped, 'sanctum')->getJson('/api/admin/kamus-kolom/peta?tabel=santri')->assertStatus(200);

        // Tulis ditolak.
        $this->actingAs($scoped, 'sanctum')->postJson('/api/admin/kamus-kolom', [
            'tabel' => 'santri', 'kolom' => 'nama_lengkap', 'label' => 'X',
        ])->assertStatus(403);
        $this->assertSame(0, LabelKolom::count());
    }

    public function test_urut_bawaan_seed_dan_ubah_lewat_kamus(): void
    {
        $pusat = $this->makeUser('admin');

        // Seed migrasi menyediakan default santri.
        $list = $this->actingAs($pusat, 'sanctum')->getJson('/api/admin/kamus-kolom/urut');
        $list->assertStatus(200);
        $this->assertContains('admin/santri', array_column($list->json('data'), 'endpoint'));

        // Ubah default santri → urut Nama saja (naik), hasil daftar ikut berubah.
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/kamus-kolom/urut', [
            'endpoint' => 'admin/santri', 'kunci' => ['nama'], 'arah' => 'naik',
        ])->assertStatus(200);

        $ahmad = Santri::create(['nama_lengkap' => 'Ahmad', 'jk' => 'P']);
        Santri::create(['nama_lengkap' => 'Budi', 'jk' => 'L']);

        $res = $this->actingAs($pusat, 'sanctum')->getJson('/api/admin/santri?per_page=50')->assertStatus(200);
        $this->assertSame(['Ahmad', 'Budi'], array_column($res->json('data'), 'nama_lengkap'));
        $this->assertNotNull($ahmad);

        // Kosongkan → kembali ke bawaan sistem (JK lalu Nama).
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/kamus-kolom/urut', [
            'endpoint' => 'admin/santri', 'kunci' => [],
        ])->assertStatus(200);
        $this->assertFalse(UrutBawaan::where('endpoint', 'admin/santri')->exists());

        $res2 = $this->actingAs($pusat, 'sanctum')->getJson('/api/admin/santri?per_page=50')->assertStatus(200);
        $this->assertSame(['Budi', 'Ahmad'], array_column($res2->json('data'), 'nama_lengkap'));

        // Di luar batas 3 kunci ditolak.
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/kamus-kolom/urut', [
            'endpoint' => 'admin/santri', 'kunci' => ['nama', 'jk', 'nik', 'nisn'],
        ])->assertStatus(422);
    }
}

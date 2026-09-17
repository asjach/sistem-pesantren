<?php

namespace Tests\Feature;

use App\Models\LabelKolom;
use App\Models\Lembaga;
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

    public function test_skema_menyediakan_tabel_dan_kolom(): void
    {
        $pusat = $this->makeUser('admin');

        $res = $this->actingAs($pusat, 'sanctum')->getJson('/api/admin/kamus-kolom/skema');
        $res->assertStatus(200);

        $data = collect($res->json('data'));
        $santri = $data->firstWhere('tabel', 'santri');
        $this->assertNotNull($santri);
        $this->assertContains('nama_lengkap', $santri['kolom']);

        // Tabel infrastruktur tidak ditawarkan.
        $this->assertNull($data->firstWhere('tabel', 'migrations'));
        $this->assertNull($data->firstWhere('tabel', 'label_kolom'));

        // Kolom di luar skema ditolak.
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/kamus-kolom', [
            'tabel' => 'santri', 'kolom' => 'kolom_karangan',
        ])->assertStatus(422)->assertJsonValidationErrors(['kolom']);
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

    public function test_generasi_upper_mengganti_underscore_dan_melewati_kolom_teknis(): void
    {
        $pusat = $this->makeUser('admin');

        $res = $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/kamus-kolom/generasi', [
            'mode' => 'upper',
        ]);
        $res->assertStatus(200);
        $this->assertGreaterThan(0, (int) $res->json('data.jumlah'));

        $this->assertSame(
            'NAMA LENGKAP',
            LabelKolom::where('tabel', 'santri')->where('kolom', 'nama_lengkap')->value('label'),
        );
        $this->assertSame(
            'NO HP SANTRI',
            LabelKolom::where('tabel', 'santri')->where('kolom', 'no_hp_santri')->value('label'),
        );

        // Generasi berlaku lintas tabel, bukan hanya tabel tertentu.
        $this->assertTrue(LabelKolom::where('tabel', 'lembaga')->exists());

        // Kolom teknis/audit tidak dibuatkan label.
        $this->assertFalse(LabelKolom::where('kolom', 'id')->exists());
        $this->assertFalse(LabelKolom::where('kolom', 'created_at')->exists());
        $this->assertFalse(LabelKolom::where('kolom', 'deleted_at')->exists());
        $this->assertSame(0, LabelKolom::where('kolom', 'like', '%\_id')->count());
    }

    public function test_generasi_proper_dan_lower(): void
    {
        $pusat = $this->makeUser('admin');

        $this->actingAs($pusat, 'sanctum')
            ->postJson('/api/admin/kamus-kolom/generasi', ['mode' => 'proper'])
            ->assertStatus(200);
        $this->assertSame(
            'Nama Lengkap',
            LabelKolom::where('tabel', 'santri')->where('kolom', 'nama_lengkap')->value('label'),
        );

        $this->actingAs($pusat, 'sanctum')
            ->postJson('/api/admin/kamus-kolom/generasi', ['mode' => 'lower'])
            ->assertStatus(200);
        $this->assertSame(
            'nama lengkap',
            LabelKolom::where('tabel', 'santri')->where('kolom', 'nama_lengkap')->value('label'),
        );
    }

    public function test_generasi_menjaga_atribut_lain_dan_menimpa_label(): void
    {
        $pusat = $this->makeUser('admin');
        LabelKolom::create([
            'tabel' => 'santri', 'kolom' => 'nama_lengkap', 'label' => 'NAMA KUSTOM',
            'align' => 'left', 'lebar' => 220, 'kunci_lebar' => true, 'bisa_urut' => false,
            'tooltip' => 'Nama lengkap santri', 'format' => 'teks',
        ]);

        $this->actingAs($pusat, 'sanctum')
            ->postJson('/api/admin/kamus-kolom/generasi', ['mode' => 'upper'])
            ->assertStatus(200);

        $row = LabelKolom::where('tabel', 'santri')->where('kolom', 'nama_lengkap')->first();
        $this->assertSame('NAMA LENGKAP', $row->label);
        $this->assertSame('left', $row->align);
        $this->assertSame(220, $row->lebar);
        $this->assertTrue($row->kunci_lebar);
        $this->assertFalse($row->bisa_urut);
        $this->assertSame('Nama lengkap santri', $row->tooltip);
        $this->assertSame('teks', $row->format);
    }

    public function test_generasi_mode_tidak_valid_ditolak(): void
    {
        $pusat = $this->makeUser('admin');

        $this->actingAs($pusat, 'sanctum')
            ->postJson('/api/admin/kamus-kolom/generasi', ['mode' => 'kapital'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['mode']);
        $this->assertSame(0, LabelKolom::count());
    }

    public function test_generasi_ditolak_untuk_admin_scoped(): void
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

        $this->actingAs($scoped, 'sanctum')
            ->postJson('/api/admin/kamus-kolom/generasi', ['mode' => 'upper'])
            ->assertStatus(403);
        $this->assertSame(0, LabelKolom::count());
    }
}

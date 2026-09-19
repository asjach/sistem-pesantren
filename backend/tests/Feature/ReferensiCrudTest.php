<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\User;
use App\Services\RefService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Ubah kamus referensi: nilai murni per lembaga; super_admin menambah ke
// semua lembaga sekaligus (fan-out, tanpa baris global).
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
        $mts = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Tsanawiyah', 'kode' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);

        return compact('root', 'mi', 'md', 'mts');
    }

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->userSeq,
            'email' => "refcrud_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9300000000 + $this->userSeq * 137 + random_int(0, 99)), 10, '0', STR_PAD_LEFT),
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

    // ---------- 2. super_admin menambah ke semua lembaga (fan-out) ----------

    public function test_02_super_admin_sebar_ke_semua_lembaga(): void
    {
        $f = $this->fixture();
        $super = $this->makeUser('super_admin');
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $res = $this->actingAs($super, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Sebar Hobi',
        ])->assertStatus(201);
        $this->assertCount(3, $res->json('data'));

        // Tiap lembaga punya barisnya; tanpa sisa global.
        $this->assertDatabaseHas('ref_hobi', ['lembaga_id' => $f['mi']->id, 'nama' => 'Sebar Hobi']);
        $this->assertDatabaseHas('ref_hobi', ['lembaga_id' => $f['md']->id, 'nama' => 'Sebar Hobi']);
        $this->assertDatabaseHas('ref_hobi', ['lembaga_id' => $f['mts']->id, 'nama' => 'Sebar Hobi']);
        $this->assertSame(0, DB::table('ref_hobi')->whereNull('lembaga_id')->count());
        $this->assertContains('Sebar Hobi', $this->namaEfektif('hobi', $f['mi']->id));
        $this->assertContains('Sebar Hobi', $this->namaEfektif('hobi', $f['md']->id));

        // Admin MI boleh ubah miliknya; milik MD tidak tersentuh.
        $idMi = (int) DB::table('ref_hobi')
            ->where('lembaga_id', $f['mi']->id)->where('nama', 'Sebar Hobi')->value('id');
        $this->actingAs($adminMi, 'sanctum')
            ->putJson("/api/admin/referensi/hobi/{$idMi}", ['nama' => 'Hobi MI'])
            ->assertStatus(200);
        $this->assertContains('Hobi MI', $this->namaEfektif('hobi', $f['mi']->id));
        $this->assertContains('Sebar Hobi', $this->namaEfektif('hobi', $f['md']->id));

        // Sebar ulang nilai yang sudah ada di semua lembaga → 422.
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Hobi MI', 'lembaga_id' => $f['md']->id,
        ])->assertStatus(201);
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Hobi MI', 'lembaga_id' => $f['mts']->id,
        ])->assertStatus(201);
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Hobi MI',
        ])->assertStatus(422);
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
            ->assertStatus(200);
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

    // ---------- 6. status: nama/urutan berubah, kode tetap ----------

    public function test_06_status_hanya_nama_dan_urutan(): void
    {
        $f = $this->fixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $id = $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/referensi/status_akhir', [
            'kode' => 'cuti_panjang', 'nama' => 'Cuti', 'lembaga_id' => $f['mi']->id,
        ])->assertStatus(201)->json('id');

        $this->actingAs($adminMi, 'sanctum')
            ->putJson("/api/admin/referensi/status_akhir/{$id}", ['nama' => 'Cuti Panjang', 'urutan' => 9])
            ->assertStatus(200)
            ->assertJsonPath('kode', 'cuti_panjang')
            ->assertJsonPath('nama', 'Cuti Panjang');

        $this->assertDatabaseHas('ref_status_akhir', [
            'id' => $id, 'kode' => 'cuti_panjang', 'nama' => 'Cuti Panjang', 'urutan' => 9,
        ]);
    }

    // ---------- 7. ubah satu lembaga tak mengganggu lainnya (cache) ----------

    public function test_07_ubah_satu_lembaga_tak_mengganggu_lainnya(): void
    {
        $f = $this->fixture();
        $super = $this->makeUser('super_admin');

        $this->actingAs($super, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Hobi Awal',
        ])->assertStatus(201);
        $idMi = (int) DB::table('ref_hobi')
            ->where('lembaga_id', $f['mi']->id)->where('nama', 'Hobi Awal')->value('id');

        // Prime cache per-lembaga MI.
        $this->assertContains('Hobi Awal', $this->namaEfektif('hobi', $f['mi']->id));

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/referensi/hobi/{$idMi}", ['nama' => 'Hobi Baru'])
            ->assertStatus(200);

        $efektif = $this->namaEfektif('hobi', $f['mi']->id);
        $this->assertContains('Hobi Baru', $efektif);
        $this->assertNotContains('Hobi Awal', $efektif);
        // MD tetap memegang nilai lama.
        $this->assertContains('Hobi Awal', $this->namaEfektif('hobi', $f['md']->id));

        // Alamat per lembaga ikut pola yang sama (tanpa global).
        DB::table('ref_alamat')->insert([
            'lembaga_id' => $f['mi']->id, 'nama' => 'Alamat Awal', 'urutan' => 0, 'is_active' => true,
        ]);
        $alamatAwal = array_map(fn ($r) => $r->nama, RefService::effectiveAlamat($f['mi']->id));
        $this->assertContains('Alamat Awal', $alamatAwal);
        $this->assertSame([], array_map(fn ($r) => $r->nama, RefService::effectiveAlamat($f['md']->id)));
    }

    // ---------- 8. urut tampil: urutan ASC, tie-break nama ASC ----------

    public function test_08_urut_tampil_urutan_lalu_nama(): void
    {
        $f = $this->fixture();

        // Tiga baris urutan sama (default 0) → urut nama ASC; urutan lebih awal menang.
        foreach (['Zuhud', 'Akhlak', 'Iman'] as $nama) {
            DB::table('ref_agama')->insert(['lembaga_id' => $f['mi']->id, 'nama' => $nama, 'urutan' => 0, 'is_active' => true]);
        }
        DB::table('ref_agama')->insert(['lembaga_id' => $f['mi']->id, 'nama' => 'Awal', 'urutan' => -1, 'is_active' => true]);
        RefService::forget();
        // Lembaga lain tak melihat nilai MI.
        $this->assertSame([], $this->namaEfektif('agama', $f['md']->id));

        $this->assertSame(['Awal', 'Akhlak', 'Iman', 'Zuhud'], RefService::kodeAktif('agama', $f['mi']->id));

        // Status: nilai = kode, tie-break memakai kolom tampilan `nama`.
        foreach ([['kode' => 'z_status', 'nama' => 'Zeta'], ['kode' => 'a_status', 'nama' => 'Alfa']] as $r) {
            DB::table('ref_status_awal')->insert($r + ['lembaga_id' => $f['mi']->id, 'urutan' => 0, 'is_active' => true]);
        }
        RefService::forget();

        $this->assertSame(['a_status', 'z_status'], RefService::kodeAktif('status_awal', $f['mi']->id));
    }

    // Regresi: cache HIT RefService dulu mengembalikan __PHP_Incomplete_Class
    // karena `cache.serializable_classes` = false (baris kamus di-cache sebagai stdClass).
    public function test_cache_hit_referensi_tidak_rusak(): void
    {
        $f = $this->fixture();
        config(['cache.default' => 'database']);
        Cache::clear();

        DB::table('ref_agama')->insert([
            'lembaga_id' => $f['mi']->id, 'nama' => 'Islam', 'urutan' => 0, 'is_active' => true,
        ]);
        RefService::forget();

        // Panggilan pertama mengisi cache; panggilan kedua membaca dari cache.
        $this->assertSame(['Islam'], RefService::kodeAktif('agama', $f['mi']->id));
        $this->assertSame(['Islam'], RefService::kodeAktif('agama', $f['mi']->id));
    }

    // ---------- 09. Padamkan + tampilkan kembali baris lembaga ----------

    public function test_09_padam_dan_pulihkan_baris_lembaga(): void
    {
        $f = $this->fixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $id = DB::table('ref_agama')->insertGetId(
            ['lembaga_id' => $f['mi']->id, 'nama' => 'Islam', 'urutan' => 0, 'is_active' => true]
        );

        // MI memadamkan miliknya sendiri (tanpa bayangan — barisnya langsung off).
        $this->actingAs($admin, 'sanctum')->deleteJson('/api/admin/referensi/agama/'.$id)
            ->assertStatus(200);
        $this->assertSame([], $this->namaEfektif('agama', $f['mi']->id));

        // Daftar default tidak memuat yang padam; termasuk_nonaktif memuatnya.
        $default = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/referensi/agama?lembaga_id='.$f['mi']->id)->assertStatus(200);
        $this->assertSame([], array_column($default->json(), 'nama'));

        $dengan = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/referensi/agama?lembaga_id='.$f['mi']->id.'&termasuk_nonaktif=1')->assertStatus(200);
        $baris = collect($dengan->json())->firstWhere('nama', 'Islam');
        $this->assertNotNull($baris);
        $this->assertFalse((bool) $baris['is_active']);

        // Pulihkan → entri tampil lagi.
        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/referensi/agama/'.$baris['id'].'/pulihkan')->assertStatus(200);
        $this->assertSame(['Islam'], $this->namaEfektif('agama', $f['mi']->id));

        // Pasangan MI↔MD boleh memulihkan baris milik pasangannya.
        $this->actingAs($admin, 'sanctum')->deleteJson('/api/admin/referensi/agama/'.$id)
            ->assertStatus(200);
        $adminMd = $this->makeUser('admin', [$f['md']->id]);
        $this->actingAs($adminMd, 'sanctum')
            ->postJson('/api/admin/referensi/agama/'.$id.'/pulihkan')->assertStatus(200);
        $this->assertSame(['Islam'], $this->namaEfektif('agama', $f['mi']->id));
    }

    // ---------- 10. Lembaga baru mewarisi benih kamus ----------
    public function test_10_lembaga_baru_mendapat_benih_kamus(): void
    {
        $f = $this->fixture();
        $super = $this->makeUser('super_admin');

        $this->actingAs($super, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Benih Hobi',
        ])->assertStatus(201);

        $baru = $this->actingAs($super, 'sanctum')->postJson('/api/admin/lembaga', [
            'nama' => "Mu'allimin", 'kode' => 'MLN', 'parent_id' => $f['root']->id,
        ])->assertStatus(201)->json();

        $this->assertContains('Benih Hobi', $this->namaEfektif('hobi', (int) $baru['id']));
    }

    // ---------- 11. Hapus permanen membuang baris ----------

    public function test_11_hapus_permanen_membuang_baris(): void
    {
        $f = $this->fixture();
        $super = $this->makeUser('super_admin');
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $idMi = DB::table('ref_hobi')->insertGetId(
            ['lembaga_id' => $f['mi']->id, 'nama' => 'Hobi Fana', 'urutan' => 0, 'is_active' => true]
        );
        $idMd = DB::table('ref_hobi')->insertGetId(
            ['lembaga_id' => $f['md']->id, 'nama' => 'Hobi Fana', 'urutan' => 0, 'is_active' => true]
        );
        $idMts = DB::table('ref_hobi')->insertGetId(
            ['lembaga_id' => $f['mts']->id, 'nama' => 'Hobi Fana', 'urutan' => 0, 'is_active' => true]
        );

        // Tanpa flag = padam biasa (baris tetap ada).
        $this->actingAs($adminMi, 'sanctum')->deleteJson("/api/admin/referensi/hobi/{$idMi}")
            ->assertStatus(200);
        $this->assertDatabaseHas('ref_hobi', ['id' => $idMi, 'is_active' => false]);

        // Flag permanen = baris dibuang; milik MD tak tersentuh.
        $this->actingAs($super, 'sanctum')->deleteJson("/api/admin/referensi/hobi/{$idMi}?permanen=1")
            ->assertStatus(200);
        $this->assertDatabaseMissing('ref_hobi', ['id' => $idMi]);
        $this->assertDatabaseHas('ref_hobi', ['id' => $idMd, 'nama' => 'Hobi Fana']);

        // Lintas lembaga di luar pasangan MI↔MD ditolak.
        $this->actingAs($adminMi, 'sanctum')->deleteJson("/api/admin/referensi/hobi/{$idMts}?permanen=1")
            ->assertStatus(403);
    }

    // ---------- 12. Tanpa filter = gabungan semua lembaga ----------

    public function test_12_tanpa_filter_gabung_semua_lembaga(): void
    {
        $f = $this->fixture();
        $super = $this->makeUser('super_admin');
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $this->actingAs($super, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => 'Hobi Gabung',
        ])->assertStatus(201);

        // Super: semua lembaga (MI, MD, MTS).
        $semua = $this->actingAs($super, 'sanctum')->getJson('/api/admin/referensi/hobi')
            ->assertStatus(200)->json();
        $this->assertCount(3, collect($semua)->where('nama', 'Hobi Gabung')->values()->all());

        // Admin MI: scope-nya (MI + pasangan MD), MTS tak ikut.
        $milik = $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/referensi/hobi')
            ->assertStatus(200)->json();
        $lembagaTampil = collect($milik)->pluck('lembaga_id')->unique()->sort()->values()->all();
        $this->assertSame([$f['mi']->id, $f['md']->id], $lembagaTampil);
    }
}

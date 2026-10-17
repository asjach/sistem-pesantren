<?php

namespace Tests\Feature;

use App\Models\KeaktifanPegawai;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\MataPelajaran;
use App\Models\Pegawai;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Modul Kurikulum & Mapel (BLOK 5): master mapel, kurikulum + komposisi,
 * pemetaan kelas→kurikulum, pengampu (kelas × mapel → guru), slot jam & jadwal
 * (termasuk penjaga bentrok kelas dan bentrok guru).
 */
class KurikulumModulTest extends TestCase
{
    use RefreshDatabase;

    private const TA = '2026/2027';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    private int $seq = 0;

    private function superAdmin(): User
    {
        $this->seq++;
        $u = User::create([
            'name' => 'Super '.$this->seq,
            'email' => "kurikulum{$this->seq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9300000000 + $this->seq * 77), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole('super_admin');

        return $u;
    }

    private function lembaga(string $jenjang): void
    {
        Lembaga::create([
            'nama' => 'Lembaga '.$jenjang, 'jenjang' => $jenjang,
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
    }

    private function kelas(string $nama, string $tingkat, string $jenjang = 'MI'): Kelas
    {
        return Kelas::create([
            'jenjang' => $jenjang, 'tahun_ajaran' => self::TA, 'nama_kelas' => $nama, 'tingkat' => $tingkat,
        ]);
    }

    private function guru(string $nama): KeaktifanPegawai
    {
        $this->seq++;
        $p = Pegawai::create(['nama_lengkap' => $nama.' '.$this->seq, 'jenis_kelamin' => 'L']);

        return KeaktifanPegawai::create([
            'pegawai_id' => $p->id, 'jenjang' => 'MI', 'tahun_ajaran' => self::TA,
            'status_keaktifan' => KeaktifanPegawai::AKTIF,
        ]);
    }

    /** Baris referensi `tingkat` untuk jenjang MI (daftar pilihan cakupan). */
    private function tingkat(string $nama, int $urutan): void
    {
        DB::table('ref_tingkat')->updateOrInsert(
            ['jenjang' => 'MI', 'nama' => $nama],
            ['urutan' => $urutan, 'is_active' => true]
        );
    }

    private function mapel(string $nama, string $jenjang = 'MI'): MataPelajaran
    {
        return MataPelajaran::create(['jenjang' => $jenjang, 'nama_mapel' => $nama, 'kelompok' => 'formal']);
    }

    // ---------- 01. master mapel ----------

    public function test_01_mapel_crud_dan_larangan_hapus_bila_dipakai(): void
    {
        $this->lembaga('MI');
        $this->lembaga('MD');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel', ['jenjang' => 'MI', 'nama_mapel' => 'Fiqih', 'kelompok' => 'formal'])
            ->assertStatus(201);

        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/mapel?jenjang=MI')
            ->assertStatus(200)
            ->assertJsonCount(1);

        $mapel = MataPelajaran::first();
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$mapel->id}", ['is_active' => false])
            ->assertStatus(200)
            ->assertJsonPath('is_active', false);

        // Belum dipakai → boleh hapus.
        $this->actingAs($super, 'sanctum')
            ->deleteJson("/api/admin/kurikulum/mapel/{$mapel->id}")
            ->assertStatus(200);

        // Dipakai kurikulum → tolak (nonaktifkan saja).
        $dipakai = $this->mapel('Fiqih');
        $kur = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/kurikulum', ['jenjang' => 'MI', 'nama' => 'Kurikulum Kemenag'])
            ->assertStatus(201)->json();
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/komposisi', ['kurikulum_id' => $kur['id'], 'mata_pelajaran_id' => $dipakai->id])
            ->assertStatus(201);

        $this->actingAs($super, 'sanctum')
            ->deleteJson("/api/admin/kurikulum/mapel/{$dipakai->id}")
            ->assertStatus(422);
    }

    // ---------- 01b. singkatan mapel (opsional, ≤50, ikut dicari) ----------

    public function test_01b_mapel_menyimpan_singkatan(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $id = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel', [
                'jenjang' => 'MI', 'nama_mapel' => 'Matematika', 'kelompok' => 'formal',
                'kode_mapel' => 'MTK', 'singkatan' => 'Mat.',
            ])
            ->assertStatus(201)
            ->assertJsonPath('singkatan', 'Mat.')
            ->json('id');

        // Daftar mapel mengembalikan baris apa adanya → singkatan ikut terkirim.
        $baris = collect($this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/mapel?jenjang=MI')->assertStatus(200)->json())
            ->firstWhere('id', $id);
        $this->assertSame('Mat.', $baris['singkatan']);

        // Bisa diperbaiki…
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$id}", ['singkatan' => 'Mt.'])
            ->assertStatus(200)->assertJsonPath('singkatan', 'Mt.');

        // …dan dikosongkan → null (bukan string kosong).
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$id}", ['singkatan' => null])
            ->assertStatus(200)->assertJsonPath('singkatan', null);
        $this->assertDatabaseHas('mata_pelajaran', ['id' => $id, 'singkatan' => null]);

        // Melebihi lebar kolom (50) → 422.
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$id}", ['singkatan' => str_repeat('x', 51)])
            ->assertStatus(422);

        // Pencarian mencakup singkatan, bukan cuma nama & kode.
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$id}", ['singkatan' => 'Mat.'])
            ->assertStatus(200);
        $cari = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/mapel?jenjang=MI&q=Mat.')
            ->assertStatus(200)->json();
        $this->assertCount(1, $cari);
        $this->assertSame('Matematika', $cari[0]['nama_mapel']);
    }

    // ---------- 01c. terapkan kode & singkatan dari kamus mapel ----------

    public function test_01c_terapkan_kamus_mengisi_kode_dan_singkatan(): void
    {
        $this->lembaga('MI');
        $this->lembaga('MD');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        // Kamus MI: dua entri lengkap + satu tanpa kode/singkatan (tak menyumbang).
        foreach ([
            ['nama' => 'Matematika', 'kode' => 'MTK', 'singkatan' => 'Mat.'],
            ['nama' => 'Bahasa Arab', 'kode' => 'BAR2', 'singkatan' => 'B. Ar.'],
            ['nama' => 'Fikih'],
        ] as $entri) {
            $this->actingAs($super, 'sanctum')
                ->postJson('/api/admin/referensi/mapel', $entri + ['jenjang' => 'MI'])
                ->assertStatus(201);
        }

        $matematika = $this->mapel('Matematika');
        // Nama mapel beda huruf besar/kecil dari kamus + kode sudah terisi.
        $arab = MataPelajaran::create([
            'jenjang' => 'MI', 'nama_mapel' => 'bahasa arab',
            'kelompok' => 'formal', 'kode_mapel' => 'BAR',
        ]);
        $fikih = $this->mapel('Fikih');
        $md = $this->mapel('Matematika', 'MD');

        // Periksa: menghitung saja — belum ada yang ditulis.
        $periksa = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/terapkan-kamus', ['jenjang' => 'MI', 'mode' => 'periksa'])
            ->assertStatus(200)
            ->assertJsonPath('diubah', 2)
            ->assertJsonPath('sudah_lengkap', 0)
            ->assertJsonPath('tanpa_kamus', 1)
            ->json();
        $this->assertCount(2, $periksa['contoh']);
        $this->assertContains('Matematika', array_column($periksa['contoh'], 'nama_mapel'));
        $this->assertNull($matematika->fresh()->kode_mapel);
        $this->assertNull($arab->fresh()->singkatan);

        // Eksekusi: kode & singkatan terisi dari kamus.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/terapkan-kamus', ['jenjang' => 'MI'])
            ->assertStatus(200)
            ->assertJsonPath('diubah', 2);
        $this->assertSame('MTK', $matematika->fresh()->kode_mapel);
        $this->assertSame('Mat.', $matematika->fresh()->singkatan);
        // Kode yang SUDAH diisi tidak ditimpa; singkatan kosongnya terisi.
        $this->assertSame('BAR', $arab->fresh()->kode_mapel);
        $this->assertSame('B. Ar.', $arab->fresh()->singkatan);
        // Kamus kosong & jenjang lain dibiarkan apa adanya.
        $this->assertNull($fikih->fresh()->kode_mapel);
        $this->assertNull($md->fresh()->kode_mapel);

        // Idempoten: pemanggilan kedua tak mengubah apa pun.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/terapkan-kamus', ['jenjang' => 'MI'])
            ->assertStatus(200)
            ->assertJsonPath('diubah', 0)
            ->assertJsonPath('sudah_lengkap', 2)
            ->assertJsonPath('pesan', 'Tidak ada mapel yang perlu diisi dari kamus.');

        // `timpa` membuat kamus menang — hanya baris yang benar-benar berubah dihitung.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/terapkan-kamus', ['jenjang' => 'MI', 'timpa' => true])
            ->assertStatus(200)
            ->assertJsonPath('diubah', 1);
        $this->assertSame('BAR2', $arab->fresh()->kode_mapel);

        // Role tanpa kurikulum.ubah ditolak sebelum apa pun dihitung.
        $guru = User::create([
            'name' => 'Guru Mapel', 'email' => 'gurumapel_'.uniqid().'@example.com',
            'phone' => '081300000001', 'password' => 'password',
        ]);
        $guru->assignRole('guru');
        $this->actingAs($guru, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/terapkan-kamus', ['jenjang' => 'MI'])
            ->assertStatus(403);
    }

    // ---------- 02. kurikulum + komposisi mapel ----------

    public function test_02_komposisi_mapel_kurikulum(): void
    {
        $this->lembaga('MI');
        $this->lembaga('MD');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kur = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/kurikulum', ['jenjang' => 'MI', 'nama' => 'Kurikulum Kemenag'])
            ->assertStatus(201)->json();

        $fiqih = $this->mapel('Fiqih');
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/komposisi', [
                'kurikulum_id' => $kur['id'], 'mata_pelajaran_id' => $fiqih->id,
                'urutan' => 1, 'kkm' => 70,
            ])
            ->assertStatus(201);

        $res = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/komposisi?kurikulum_id={$kur['id']}")
            ->assertStatus(200)->json();
        $this->assertCount(1, $res['baris']);
        $this->assertSame('Fiqih', $res['baris'][0]['mata_pelajaran']['nama_mapel']);
        $this->assertCount(0, $res['tersedia']);

        // Mapel jenjang lain ditolak.
        $mapelMd = $this->mapel('Fiqih MD', 'MD');
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/komposisi', ['kurikulum_id' => $kur['id'], 'mata_pelajaran_id' => $mapelMd->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('mata_pelajaran_id');
    }

    // ---------- 03. kelas → kurikulum, generate & simpan pengampu ----------

    public function test_03_kelas_kurikulum_dan_pengampu(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelas = $this->kelas('1A', '1');
        $kur = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/kurikulum', ['jenjang' => 'MI', 'nama' => 'Kurikulum Kemenag'])
            ->assertStatus(201)->json();

        // Komposisi: Fiqih berlaku semua tingkat (tanpa cakupan), Bahasa Arab
        // hanya tingkat 2 — kelas 1A tidak melihatnya.
        $this->tingkat('2', 2);
        $fiqih = $this->mapel('Fiqih');
        $arab = $this->mapel('Bahasa Arab');
        foreach ([[$fiqih->id, null], [$arab->id, ['2']]] as [$mapelId, $tingkat]) {
            $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/komposisi', [
                'kurikulum_id' => $kur['id'], 'mata_pelajaran_id' => $mapelId, 'tingkat' => $tingkat,
            ])->assertStatus(201);
        }

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/kelas/{$kelas->id}", ['kurikulum_ids' => [$kur['id']]])
            ->assertStatus(200);

        $peta = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/kelas?jenjang=MI&tahun_ajaran='.urlencode(self::TA))
            ->assertStatus(200)->json();
        $this->assertSame([$kur['id']], $peta['kelas'][0]['kurikulum_ids']);

        // Generate pengampu: hanya mapel yang berlaku untuk kelas 1A (Fiqih —
        // Bahasa Arab dibatasi tingkat 2).
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/pengampu/generate', ['kelas_id' => $kelas->id])
            ->assertStatus(200)
            ->assertJsonPath('dibuat', 1);

        $guru = $this->guru('Ust. Ahmad');
        $guruRes = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/guru-aktif?jenjang=MI&tahun_ajaran='.urlencode(self::TA))
            ->assertStatus(200)->json();
        $this->assertCount(1, $guruRes);
        $this->assertSame($guru->id, $guruRes[0]['keaktifan_pegawai_id']);

        // Pasang guru ke pengampu Fiqih.
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/pengampu', [
                'kelas_id' => $kelas->id,
                'baris' => [['mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => $guru->id]],
            ])
            ->assertStatus(200);

        $res = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/pengampu?kelas_id={$kelas->id}")
            ->assertStatus(200)->json();
        $barisFiqih = collect($res['baris'])->firstWhere('mata_pelajaran_id', $fiqih->id);
        $this->assertSame($guru->id, $barisFiqih['keaktifan_pegawai_id']);
        $this->assertNotNull($barisFiqih['guru']);
        $this->assertTrue($barisFiqih['dari_kurikulum']);

        // Pengampu yang sudah punya nilai tidak boleh dihapus lewat sync.
        $santri = Santri::create(['nama_lengkap' => 'Santri A', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'nis_lokal' => '26001', 'is_active_lembaga' => 'Ya']);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'semester' => '1',
            'kelas_id' => $kelas->id, 'tingkat' => '1', 'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif', 'is_active_riwayat' => RiwayatBelajar::YA,
        ]);
        $peristiwaId = DB::table('peristiwa_nilai')->insertGetId([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'kode' => 'ASAS', 'nama' => 'ASAS',
            'cakupan' => 'semua', 'kurikulum' => 'keduanya', 'jenis_rapor' => 'akhir', 'urutan' => 1,
            'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $pengampuId = DB::table('pengampu_mapel')->where('kelas_id', $kelas->id)->value('id');
        DB::table('nilai_santri')->insert([
            'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampuId,
            'tahun_ajaran' => self::TA, 'semester' => '1', 'peristiwa_id' => $peristiwaId,
            'nilai_akhir' => 80, 'sumber' => 'impor', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/pengampu', ['kelas_id' => $kelas->id, 'baris' => []])
            ->assertStatus(422)
            ->assertJsonValidationErrors('baris');
    }

    /**
     * Cakupan TINGKAT per mapel kurikulum (pengganti jangkar `tingkat` tunggal):
     *  - kosong = berlaku di SEMUA tingkat,
     *  - berisi = hanya tingkat-teingkat itu.
     *
     * Dicek di dua sisi: penyimpanan (PUT komposisi) dan efeknya saat kurikulum
     * dipakai kelas (daftar pengampu = yang benar-benar berlaku).
     */
    public function test_02b_cakupan_tingkat_mapel_kurikulum(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        // Tingkat untuk jenjang MI (dipakai daftar pilihan & validasi).
        $this->tingkat('1', 1);
        $this->tingkat('2', 2);

        $kelas1A = $this->kelas('1A', '1');
        $kelas2A = $this->kelas('2A', '2');
        $kur = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/kurikulum', ['jenjang' => 'MI', 'nama' => 'Kurikulum Kemenag'])
            ->assertStatus(201)->json();
        $semua = $this->mapel('Fiqih');
        $khusus = $this->mapel('Bahasa Arab');

        // Tanpa cakupan → berlaku semua tingkat.
        $barisSemua = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/komposisi', [
                'kurikulum_id' => $kur['id'], 'mata_pelajaran_id' => $semua->id,
            ])->assertStatus(201)->json();
        $this->assertSame([], $barisSemua['tingkat']);

        // Dengan cakupan → hanya tingkat itu (bisa lebih dari satu).
        $barisKhusus = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/komposisi', [
                'kurikulum_id' => $kur['id'], 'mata_pelajaran_id' => $khusus->id,
                'tingkat' => ['2'],
            ])->assertStatus(201)->json();
        $this->assertSame(['2'], $barisKhusus['tingkat']);

        // Tingkat tak dikenal ditolak (salah ketik tak boleh diam-diam).
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/komposisi/{$barisKhusus['id']}", ['tingkat' => ['9']])
            ->assertStatus(422)
            ->assertJsonValidationErrors('tingkat');

        foreach ([$kelas1A, $kelas2A] as $k) {
            $this->actingAs($super, 'sanctum')
                ->putJson("/api/admin/kurikulum/kelas/{$k->id}", ['kurikulum_ids' => [$kur['id']]])
                ->assertStatus(200);
        }

        // Respons daftar komposisi harus membawa `tingkat` sebagai daftar NAMA
        // (bukan objek pivot) — relasi bernama sama pernah menimpanya.
        $daftar = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/komposisi?kurikulum_id={$kur['id']}")
            ->assertStatus(200)->json();
        $tingkatPerMapel = collect($daftar['baris'])->mapWithKeys(
            fn ($b) => [$b['mata_pelajaran']['nama_mapel'] => $b['tingkat']]
        );
        $this->assertSame([], $tingkatPerMapel[$semua->nama_mapel]);
        $this->assertSame(['2'], $tingkatPerMapel[$khusus->nama_mapel]);

        // Kelas tingkat 1: hanya mapel tanpa cakupan. Kelas tingkat 2: keduanya.
        $pengampu1A = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/pengampus?kelas_ids[]={$kelas1A->id}")
            ->assertStatus(200)->json();
        $this->assertSame([$semua->id], array_column($pengampu1A['baris'], 'mata_pelajaran_id'));

        $pengampu2A = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/pengampus?kelas_ids[]={$kelas2A->id}")
            ->assertStatus(200)->json();
        $this->assertEqualsCanonicalizing(
            [$semua->id, $khusus->id],
            array_column($pengampu2A['baris'], 'mata_pelajaran_id')
        );

        // Cakupan dikosongkan lagi → berlaku semua tingkat.
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/komposisi/{$barisKhusus['id']}", ['tingkat' => []])
            ->assertStatus(200)->assertJsonPath('tingkat', []);
        $pengampu1AAfter = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/pengampus?kelas_ids[]={$kelas1A->id}")
            ->assertStatus(200)->json();
        $this->assertEqualsCanonicalizing(
            [$semua->id, $khusus->id],
            array_column($pengampu1AAfter['baris'], 'mata_pelajaran_id')
        );

        // Menghapus mapel dari kurikulum ikut menghapus cakupan kelasnya.
        $this->actingAs($super, 'sanctum')
            ->deleteJson("/api/admin/kurikulum/komposisi/{$barisKhusus['id']}")
            ->assertStatus(200);
        $this->assertDatabaseMissing('kurikulum_mapel_tingkat', ['kurikulum_mapel_id' => $barisKhusus['id']]);
    }

    /**
     * Aksi massal: satu cakupan tingkat diterapkan ke BANYAK baris komposisi
     * sekaligus (checkbox tabel komposisi).
     *
     * Yang dijaga: daftar = SET (mengganti cakupan lama tiap baris, bukan
     * ditambahkan), kosong = berlaku semua tingkat, tingkat tak dikenal ditolak
     * SEBELUM ada baris yang tersentuh, dan baris milik jenjang lain forbidden.
     */
    public function test_02c_terapkan_tingkat_banyak_baris_komposisi(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $this->tingkat('1', 1);
        $this->tingkat('2', 2);
        $this->tingkat('3', 3);

        $kur = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/kurikulum', ['jenjang' => 'MI', 'nama' => 'Kurikulum Kemenag'])
            ->assertStatus(201)->json();
        $ids = [];
        foreach (['Fiqih', 'Bahasa Arab', 'Akidah Akhlak'] as $nama) {
            $ids[] = $this->actingAs($super, 'sanctum')
                ->postJson('/api/admin/kurikulum/komposisi', [
                    'kurikulum_id' => $kur['id'], 'mata_pelajaran_id' => $this->mapel($nama)->id,
                ])->assertStatus(201)->json()['id'];
        }

        // Terapkan tingkat 2 & 3 ke dua baris pertama.
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/komposisi/tingkat-bulk', [
                'ids' => [$ids[0], $ids[1]], 'tingkat' => ['2', '3'],
            ])
            ->assertStatus(200)
            ->assertJsonPath('tersentuh', 2)
            ->assertJsonPath('tingkat', ['2', '3']);

        $daftar = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/komposisi?kurikulum_id={$kur['id']}")
            ->assertStatus(200)->json();
        $perBaris = collect($daftar['baris'])->mapWithKeys(fn ($b) => [$b['id'] => $b['tingkat']]);
        $this->assertSame(['2', '3'], $perBaris[$ids[0]]);
        $this->assertSame(['2', '3'], $perBaris[$ids[1]]);
        $this->assertSame([], $perBaris[$ids[2]], 'baris tak terpilih tak boleh ikut berubah');

        // SET, bukan tambah: baris pertama dicakup ['2','3'], sekarang ['1'] saja.
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/komposisi/tingkat-bulk', ['ids' => [$ids[0]], 'tingkat' => ['1']])
            ->assertStatus(200);
        $this->assertSame(
            [['kurikulum_mapel_id' => $ids[0], 'tingkat' => '1']],
            DB::table('kurikulum_mapel_tingkat')->where('kurikulum_mapel_id', $ids[0])->get()
                ->map(fn ($r) => ['kurikulum_mapel_id' => $r->kurikulum_mapel_id, 'tingkat' => $r->tingkat])->all()
        );

        // Kosong = berlaku semua tingkat (untuk semua baris terpilih).
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/komposisi/tingkat-bulk', [
                'ids' => [$ids[0], $ids[1]], 'tingkat' => [],
            ])
            ->assertStatus(200)->assertJsonPath('tingkat', []);
        $this->assertDatabaseMissing('kurikulum_mapel_tingkat', ['kurikulum_mapel_id' => $ids[0]]);
        $this->assertDatabaseMissing('kurikulum_mapel_tingkat', ['kurikulum_mapel_id' => $ids[1]]);

        // Tingkat tak dikenal → 422 dan tak ada baris yang berubah.
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/komposisi/tingkat-bulk', [
                'ids' => [$ids[0]], 'tingkat' => ['9'],
            ])
            ->assertStatus(422)->assertJsonValidationErrors('tingkat');
        $this->assertDatabaseMissing('kurikulum_mapel_tingkat', ['kurikulum_mapel_id' => $ids[0]]);

        // `tingkat` wajib ada (kosong = semua tingkat, absen = tak jelas).
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/komposisi/tingkat-bulk', ['ids' => [$ids[0]]])
            ->assertStatus(422)->assertJsonValidationErrors('tingkat');

        // Daftar kosong & baris tak dikenal ditolak.
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/komposisi/tingkat-bulk', ['ids' => [], 'tingkat' => ['1']])
            ->assertStatus(422)->assertJsonValidationErrors('ids');

        // Baris komposisi jenjang lain Forbidden untuk admin MI (MTS, bukan
        // pasangan MI↔MD yang boleh diakses timbal-balik).
        $this->lembaga('MTS');
        $kurMts = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/kurikulum', ['jenjang' => 'MTS', 'nama' => 'Kurikulum MTS'])
            ->assertStatus(201)->json();
        $barisMts = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/komposisi', [
                'kurikulum_id' => $kurMts['id'], 'mata_pelajaran_id' => $this->mapel('Tarikh Islam', 'MTS')->id,
            ])->assertStatus(201)->json()['id'];
        $adminMi = User::create([
            'name' => 'Admin MI', 'email' => 'bulk_admin_mi@example.com',
            'phone' => '081234500099', 'password' => 'password',
        ]);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $adminMi->id, 'jenjang' => 'MI',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->actingAs($adminMi, 'sanctum')
            ->putJson('/api/admin/kurikulum/komposisi/tingkat-bulk', ['ids' => [$ids[0], $barisMts], 'tingkat' => ['1']])
            ->assertStatus(403);
        // Baris milik pengguna sendiri tetap tak tersentuh (wewenang dicek dulu).
        $this->assertDatabaseMissing('kurikulum_mapel_tingkat', ['kurikulum_mapel_id' => $ids[0]]);
    }

    /**
     * Tabel pengampu bisa menampilkan BANYAK kelas sekaligus (rel Kelas), jadi
     * pengampu diambil dalam satu request (`pengampus`) — bukan satu request per
     * kelas. Baris harus tetap berlabel kelas asalnya, dan wewenang tetap dijaga
     * per kelas (satu kelas di luar wewenang pengguna → 403).
     */
    public function test_03b_daftar_pengampu_banyak_kelas_dalam_satu_request(): void
    {
        $this->lembaga('MI');
        // MTS (bukan pasangan MI↔MD): admin MI berpasangan dengan MD, jadi
        // batas wewenang diuji lewat lembaga yang tak berpasangan.
        $this->lembaga('MTS');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelasA = $this->kelas('1A', '1');
        $kelasB = $this->kelas('1B', '1');
        $kur = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/kurikulum', ['jenjang' => 'MI', 'nama' => 'Kurikulum Kemenag'])
            ->assertStatus(201)->json();
        $fiqih = $this->mapel('Fiqih');
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/komposisi', [
                'kurikulum_id' => $kur['id'], 'mata_pelajaran_id' => $fiqih->id,
            ])->assertStatus(201);
        foreach ([$kelasA, $kelasB] as $k) {
            $this->actingAs($super, 'sanctum')
                ->putJson("/api/admin/kurikulum/kelas/{$k->id}", ['kurikulum_ids' => [$kur['id']]])
                ->assertStatus(200);
            $this->actingAs($super, 'sanctum')
                ->postJson('/api/admin/kurikulum/pengampu/generate', ['kelas_id' => $k->id])
                ->assertStatus(200);
        }

        $guru = $this->guru('Ust. Ahmad');
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/kurikulum/pengampu', [
            'kelas_id' => $kelasB->id,
            'baris' => [['mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => $guru->id]],
        ])->assertStatus(200);

        // Satu request untuk dua kelas → baris keduanya, berlabel kelas asalnya.
        $res = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/pengampus?'.http_build_query(['kelas_ids' => [$kelasB->id, $kelasA->id]]))
            ->assertStatus(200)->json();
        $this->assertCount(2, $res['kelas']);
        $this->assertSame([$kelasB->id, $kelasA->id], array_column($res['kelas'], 'id'));
        $this->assertCount(2, $res['baris']);
        foreach ($res['baris'] as $baris) {
            $this->assertSame($fiqih->id, $baris['mata_pelajaran_id']);
            $this->assertTrue($baris['dari_kurikulum']);
            $this->assertContains($baris['nama_kelas'], ['1A', '1B']);
        }
        $barisB = collect($res['baris'])->firstWhere('kelas_id', $kelasB->id);
        $barisA = collect($res['baris'])->firstWhere('kelas_id', $kelasA->id);
        $this->assertSame($guru->id, $barisB['keaktifan_pegawai_id']);
        $this->assertNull($barisA['keaktifan_pegawai_id']);

        // Kelas di luar wewenang pengguna → 403 (wewenang tetap per kelas).
        $kelasLain = $this->kelas('1T', '1', 'MTS');
        $adminMi = User::create([
            'name' => 'Admin MI', 'email' => 'kurikulum_admin_mi@example.com',
            'phone' => '081234500099', 'password' => 'password',
        ]);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $adminMi->id, 'jenjang' => 'MI',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->actingAs($adminMi, 'sanctum')
            ->getJson('/api/admin/kurikulum/pengampus?'.http_build_query(['kelas_ids' => [$kelasA->id, $kelasLain->id]]))
            ->assertStatus(403);

        // Kelas yang tak ada → 422; daftar kosong → 422.
        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/pengampus?'.http_build_query(['kelas_ids' => [$kelasA->id, 999999]]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('kelas_ids.1');
        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/pengampus', ['kelas_ids' => []])
            ->assertStatus(422)
            ->assertJsonValidationErrors('kelas_ids');
    }

    // ---------- 04. slot jam & jadwal (bentrok kelas + bentrok guru) ----------

    public function test_04_jadwal_menjaga_bentrok_kelas_dan_guru(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelasA = $this->kelas('1A', '1');
        $kelasB = $this->kelas('1B', '1');
        $kur = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/kurikulum', ['jenjang' => 'MI', 'nama' => 'Kurikulum Kemenag'])
            ->assertStatus(201)->json();
        $fiqih = $this->mapel('Fiqih');
        $arab = $this->mapel('Bahasa Arab');
        foreach ([$fiqih->id, $arab->id] as $mapelId) {
            $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/komposisi', [
                'kurikulum_id' => $kur['id'], 'mata_pelajaran_id' => $mapelId,
            ])->assertStatus(201);
        }

        $guruSama = $this->guru('Ust. Ahmad');
        $guruLain = $this->guru('Ust. Budi');

        // Pengampu disimpan PER KELAS sebagai satu daftar utuh (sync): baris di
        // luar daftar dihapus, jadi satu panggilan memuat seluruh mapel kelas.
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/kurikulum/pengampu', [
            'kelas_id' => $kelasA->id,
            'baris' => [
                ['mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => $guruSama->id],
                ['mata_pelajaran_id' => $arab->id, 'keaktifan_pegawai_id' => $guruLain->id],
            ],
        ])->assertStatus(200);
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/kurikulum/pengampu', [
            'kelas_id' => $kelasB->id,
            'baris' => [['mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => $guruSama->id]],
        ])->assertStatus(200);

        $pengampu = [];
        foreach ([[$kelasA, $fiqih, '1A-Fiqih'], [$kelasA, $arab, '1A-Bahasa Arab'], [$kelasB, $fiqih, '1B-Fiqih']] as [$k, $m, $kunci]) {
            $pengampu[$kunci] = DB::table('pengampu_mapel')
                ->where('kelas_id', $k->id)->where('mata_pelajaran_id', $m->id)->value('id');
        }

        $slot = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/slot', [
                'jenjang' => 'MI', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45', 'urutan' => 1,
            ])
            ->assertStatus(201)->json();

        // 1A Fiqih Senin jam 1 → boleh.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/jadwal', [
                'pengampu_mapel_id' => $pengampu['1A-Fiqih'], 'slot_jam_id' => $slot['id'], 'hari' => 'senin',
            ])
            ->assertStatus(201);

        // Kelas 1A sudah terisi pada Senin jam 1 → mapel lain 1A ditolak.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/jadwal', [
                'pengampu_mapel_id' => $pengampu['1A-Bahasa Arab'], 'slot_jam_id' => $slot['id'], 'hari' => 'senin',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('slot_jam_id');

        // Guru yang sama sudah mengajar 1A pada Senin jam 1 → 1B ditolak.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/jadwal', [
                'pengampu_mapel_id' => $pengampu['1B-Fiqih'], 'slot_jam_id' => $slot['id'], 'hari' => 'senin',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('pengampu_mapel_id');

        // Hari berbeda → boleh.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/jadwal', [
                'pengampu_mapel_id' => $pengampu['1B-Fiqih'], 'slot_jam_id' => $slot['id'], 'hari' => 'selasa',
            ])
            ->assertStatus(201);

        $jadwal = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/jadwal?kelas_id={$kelasA->id}")
            ->assertStatus(200)->json();
        $this->assertCount(1, $jadwal['baris']);
        $this->assertSame('Fiqih', $jadwal['baris'][0]['nama_mapel']);
        // 1A-Arab belum terjadwal → muncul sebagai pilihan.
        $this->assertCount(1, $jadwal['belum_terjadwal']);
    }
}

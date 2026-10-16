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

    // ---------- 01d. buat mapel baru dari kamus ----------

    public function test_01d_buat_mapel_dari_kamus_melewati_nama_yang_sudah_ada(): void
    {
        $this->lembaga('MI');
        $this->lembaga('MD');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        foreach ([
            ['nama' => 'Matematika', 'kode' => 'MTK', 'singkatan' => 'Mat.'],
            ['nama' => 'Bahasa Arab', 'kode' => 'BAR', 'singkatan' => 'B. Ar.'],
            ['nama' => 'Fikih'],
        ] as $entri) {
            $this->actingAs($super, 'sanctum')
                ->postJson('/api/admin/referensi/mapel', $entri + ['jenjang' => 'MI'])
                ->assertStatus(201);
        }
        // Kamus nonaktif tidak boleh melahirkan mapel.
        $nonaktif = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/referensi/mapel', ['nama' => 'Tahfidz', 'jenjang' => 'MI'])
            ->assertStatus(201)->json('id');
        $this->actingAs($super, 'sanctum')
            ->deleteJson("/api/admin/referensi/mapel/{$nonaktif}?jenjang=MI")
            ->assertStatus(200);

        // Sudah ada sebagai mapel — walau namanya beda huruf besar/kecil.
        $lama = MataPelajaran::create([
            'jenjang' => 'MI', 'nama_mapel' => 'matematika', 'kelompok' => 'formal',
        ]);

        // Periksa: menghitung saja (termasuk `sudah_ada` untuk nama yang mirip).
        $periksa = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/dari-kamus', ['jenjang' => 'MI', 'mode' => 'periksa'])
            ->assertStatus(200)
            ->assertJsonPath('dibuat', 2)
            ->assertJsonPath('sudah_ada', 1)
            ->json();
        $this->assertCount(2, $periksa['contoh']);
        $this->assertSame('formal', $periksa['kelompok']);
        $this->assertSame(1, MataPelajaran::where('jenjang', 'MI')->count());

        // Eksekusi: kode & singkatan kamus ikut tersalin, kelompok dari permintaan.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/dari-kamus', ['jenjang' => 'MI', 'kelompok' => 'pesantren'])
            ->assertStatus(200)
            ->assertJsonPath('dibuat', 2);
        $arab = MataPelajaran::where('jenjang', 'MI')->where('nama_mapel', 'Bahasa Arab')->first();
        $fikih = MataPelajaran::where('jenjang', 'MI')->where('nama_mapel', 'Fikih')->first();
        $this->assertNotNull($arab);
        $this->assertSame('pesantren', $arab->kelompok);
        $this->assertSame('BAR', $arab->kode_mapel);
        $this->assertSame('B. Ar.', $arab->singkatan);
        $this->assertNotNull($fikih);
        $this->assertNull($fikih->kode_mapel);
        $this->assertTrue($fikih->is_active);
        // Baris lama tidak disentuh & tak ada kembaran 'Matematika'.
        $this->assertSame('matematika', $lama->fresh()->nama_mapel);
        $this->assertSame(3, MataPelajaran::where('jenjang', 'MI')->count());
        $this->assertSame(0, MataPelajaran::where('nama_mapel', 'Tahfidz')->count());
        // Jenjang lain tidak ikut terisi.
        $this->assertSame(0, MataPelajaran::where('jenjang', 'MD')->count());

        // Idempoten: semua nama kamus sudah ada.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/dari-kamus', ['jenjang' => 'MI'])
            ->assertStatus(200)
            ->assertJsonPath('dibuat', 0)
            ->assertJsonPath('sudah_ada', 3)
            ->assertJsonPath('pesan', 'Semua nama di kamus sudah ada sebagai mapel.');

        // Izin: pembuatan butuh kurikulum.tambah.
        $guru = User::create([
            'name' => 'Guru Kamus', 'email' => 'gurukamus_'.uniqid().'@example.com',
            'phone' => '081300000002', 'password' => 'password',
        ]);
        $guru->assignRole('guru');
        $this->actingAs($guru, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/dari-kamus', ['jenjang' => 'MI'])
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
                'tingkat' => null, 'urutan' => 1, 'kkm' => 70,
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

        // Komposisi: Fiqih semua tingkat, Bahasa Arab khusus tingkat 2.
        $fiqih = $this->mapel('Fiqih');
        $arab = $this->mapel('Bahasa Arab');
        foreach ([[$fiqih->id, null], [$arab->id, '2']] as [$mapelId, $tingkat]) {
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

        // Generate pengampu: hanya mapel yang berlaku di tingkat 1 (Fiqih).
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

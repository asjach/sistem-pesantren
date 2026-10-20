<?php

namespace Tests\Feature;

use App\Models\JadwalPelajaran;
use App\Models\KeaktifanPegawai;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\MataPelajaran;
use App\Models\Pegawai;
use App\Models\PengampuMapel;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\SlotJamPelajaran;
use App\Models\TahunAjaran;
use App\Models\User;
use App\Models\VarianJadwal;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Modul Mapel & Pengampu (BLOK 5): master mapel (KKM + urutan tampil rapor),
 * pengampu (kelas × mapel → guru), salin daftar mapel antar kelas, slot jam &
 * jadwal (termasuk penjaga bentrok kelas dan bentrok guru).
 *
 * Modul kurikulum + komposisi + peta kelas→kurikulum sudah DIHAPUS: daftar
 * mapel sebuah kelas YAITUH baris `pengampu_mapel` itu sendiri.
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

    private function kelas(string $nama, string $tingkat, string $jenjang = 'MI', string $ta = self::TA): Kelas
    {
        return Kelas::create([
            'jenjang' => $jenjang, 'tahun_ajaran' => $ta, 'nama_kelas' => $nama, 'tingkat' => $tingkat,
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

    private function mapel(string $nama, string $jenjang = 'MI', array $tambahan = []): MataPelajaran
    {
        return MataPelajaran::create([
            'jenjang' => $jenjang, 'nama_mapel' => $nama, 'kelompok' => 'formal',
        ] + $tambahan);
    }

    public function test_01_mapel_crud_kkm_urutan_dan_larangan_hapus_bila_dipakai(): void
    {
        $this->lembaga('MI');
        $this->lembaga('MD');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel', [
                'jenjang' => 'MI', 'nama_mapel' => 'Fiqih', 'kelompok' => 'formal',
                'kkm' => 75, 'urutan' => 2,
            ])
            ->assertStatus(201)
            ->assertJsonPath('urutan', 2);
        $this->assertDatabaseHas('mata_pelajaran', ['nama_mapel' => 'Fiqih', 'kkm' => 75]);

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel', ['jenjang' => 'MI', 'nama_mapel' => 'Akidah', 'kelompok' => 'formal'])
            ->assertStatus(201)
            ->assertJsonPath('kkm', null)
            ->assertJsonPath('urutan', 0);

        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/mapel?jenjang=MI')
            ->assertStatus(200)
            ->assertJsonCount(2);

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel', ['jenjang' => 'MI', 'nama_mapel' => 'fiqih', 'kelompok' => 'formal'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('nama_mapel');

        $mapel = MataPelajaran::where('nama_mapel', 'Fiqih')->first();
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$mapel->id}", ['is_active' => false])
            ->assertStatus(200)
            ->assertJsonPath('is_active', false);

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$mapel->id}", ['kkm' => 120])
            ->assertStatus(422)
            ->assertJsonValidationErrors('kkm');
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$mapel->id}", ['urutan' => -1])
            ->assertStatus(422)
            ->assertJsonValidationErrors('urutan');
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$mapel->id}", ['kkm' => null])
            ->assertStatus(200)
            ->assertJsonPath('kkm', null);

        $this->actingAs($super, 'sanctum')
            ->deleteJson("/api/admin/kurikulum/mapel/{$mapel->id}")
            ->assertStatus(200);

        $dipakai = $this->mapel('Fiqih');
        $kelas = $this->kelas('1A', '1');
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/pengampu', [
                'kelas_id' => $kelas->id,
                'baris' => [['mata_pelajaran_id' => $dipakai->id, 'keaktifan_pegawai_id' => null]],
            ])->assertStatus(200);
        $this->actingAs($super, 'sanctum')
            ->deleteJson("/api/admin/kurikulum/mapel/{$dipakai->id}")
            ->assertStatus(422);
    }

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

        $baris = collect($this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/mapel?jenjang=MI')->assertStatus(200)->json())
            ->firstWhere('id', $id);
        $this->assertSame('Mat.', $baris['singkatan']);

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$id}", ['singkatan' => 'Mt.'])
            ->assertStatus(200)->assertJsonPath('singkatan', 'Mt.');

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$id}", ['singkatan' => null])
            ->assertStatus(200)->assertJsonPath('singkatan', null);
        $this->assertDatabaseHas('mata_pelajaran', ['id' => $id, 'singkatan' => null]);

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$id}", ['singkatan' => str_repeat('x', 51)])
            ->assertStatus(422);

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$id}", ['singkatan' => 'Mat.'])
            ->assertStatus(200);
        $cari = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/mapel?jenjang=MI&q=Mat.')
            ->assertStatus(200)->json();
        $this->assertCount(1, $cari);
        $this->assertSame('Matematika', $cari[0]['nama_mapel']);
    }

    public function test_01c_terapkan_kamus_mengisi_kode_dan_singkatan(): void
    {
        $this->lembaga('MI');
        $this->lembaga('MD');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

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

        $arab = MataPelajaran::create([
            'jenjang' => 'MI', 'nama_mapel' => 'bahasa arab',
            'kelompok' => 'formal', 'kode_mapel' => 'BAR',
        ]);
        $fikih = $this->mapel('Fikih');
        $md = $this->mapel('Matematika', 'MD');

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

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/terapkan-kamus', ['jenjang' => 'MI'])
            ->assertStatus(200)
            ->assertJsonPath('diubah', 2);
        $this->assertSame('MTK', $matematika->fresh()->kode_mapel);
        $this->assertSame('Mat.', $matematika->fresh()->singkatan);

        $this->assertSame('BAR', $arab->fresh()->kode_mapel);
        $this->assertSame('B. Ar.', $arab->fresh()->singkatan);

        $this->assertNull($fikih->fresh()->kode_mapel);
        $this->assertNull($md->fresh()->kode_mapel);

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/terapkan-kamus', ['jenjang' => 'MI'])
            ->assertStatus(200)
            ->assertJsonPath('diubah', 0)
            ->assertJsonPath('sudah_lengkap', 2)
            ->assertJsonPath('pesan', 'Tidak ada mapel yang perlu diisi dari kamus.');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/terapkan-kamus', ['jenjang' => 'MI', 'timpa' => true])
            ->assertStatus(200)
            ->assertJsonPath('diubah', 1);
        $this->assertSame('BAR2', $arab->fresh()->kode_mapel);

        $guru = User::create([
            'name' => 'Guru Mapel', 'email' => 'gurumapel_'.uniqid().'@example.com',
            'phone' => '081300000001', 'password' => 'password',
        ]);
        $guru->assignRole('guru');
        $this->actingAs($guru, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/terapkan-kamus', ['jenjang' => 'MI'])
            ->assertStatus(403);
    }

    public function test_02_pengampu_kelas_menyimpan_guru_dan_menolak_buang_yang_bernilai(): void
    {
        $this->lembaga('MI');
        $this->lembaga('MD');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelas = $this->kelas('1A', '1');
        $fiqih = $this->mapel('Fiqih', 'MI', ['kkm' => 70, 'urutan' => 1]);
        $arab = $this->mapel('Bahasa Arab', 'MI', ['urutan' => 2]);
        $guru = $this->guru('Ust. Ahmad');

        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/pengampu', [
                'kelas_id' => $kelas->id,
                'baris' => [
                    ['mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => $guru->id],
                    ['mata_pelajaran_id' => $arab->id, 'keaktifan_pegawai_id' => null],
                ],
            ])->assertStatus(200);

        $guruRes = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/guru-aktif?jenjang=MI&tahun_ajaran='.urlencode(self::TA))
            ->assertStatus(200)->json();
        $this->assertCount(1, $guruRes);
        $this->assertSame($guru->id, $guruRes[0]['keaktifan_pegawai_id']);

        $res = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/pengampu?kelas_id={$kelas->id}")
            ->assertStatus(200)->json();
        $this->assertCount(2, $res['baris']);
        $this->assertSame($fiqih->id, $res['baris'][0]['mata_pelajaran_id']);
        $barisFiqih = collect($res['baris'])->firstWhere('mata_pelajaran_id', $fiqih->id);
        $this->assertSame($guru->id, $barisFiqih['keaktifan_pegawai_id']);
        $this->assertNotNull($barisFiqih['guru']);
        $this->assertEquals(70, (float) $barisFiqih['kkm']);

        $mapelMd = $this->mapel('Fiqih MD', 'MD');
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/pengampu', [
                'kelas_id' => $kelas->id,
                'baris' => [['mata_pelajaran_id' => $mapelMd->id, 'keaktifan_pegawai_id' => null]],
            ])->assertStatus(422)
            ->assertJsonValidationErrors('mata_pelajaran_id');

        $santri = Santri::create(['nama_lengkap' => 'Santri A', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'nis_lokal' => '26001', 'is_active_lembiga' => 'Ya']);
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
        $pengampuId = DB::table('pengampu_mapel')->where('kelas_id', $kelas->id)
            ->where('mata_pelajaran_id', $fiqih->id)->value('id');
        DB::table('nilai_santri')->insert([
            'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampuId,
            'tahun_ajaran' => self::TA, 'semester' => '1', 'peristiwa_id' => $peristiwaId,
            'nilai_akhir' => 80, 'sumber' => 'impor', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/pengampu', [
                'kelas_id' => $kelas->id,
                'baris' => [['mata_pelajaran_id' => $arab->id, 'keaktifan_pegawai_id' => null]],
            ])->assertStatus(422)
            ->assertJsonValidationErrors('baris');
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

        $this->lembaga('MTS');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelasA = $this->kelas('1A', '1');
        $kelasB = $this->kelas('1B', '1');
        $fiqih = $this->mapel('Fiqih');
        foreach ([$kelasA, $kelasB] as $k) {
            $this->actingAs($super, 'sanctum')
                ->putJson('/api/admin/kurikulum/pengampu', [
                    'kelas_id' => $k->id,
                    'baris' => [['mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => null]],
                ])->assertStatus(200);
        }

        $guru = $this->guru('Ust. Ahmad');
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/kurikulum/pengampu', [
            'kelas_id' => $kelasB->id,
            'baris' => [['mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => $guru->id]],
        ])->assertStatus(200);

        $res = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/pengampus?'.http_build_query(['kelas_ids' => [$kelasB->id, $kelasA->id]]))
            ->assertStatus(200)->json();
        $this->assertCount(2, $res['kelas']);
        $this->assertSame([$kelasB->id, $kelasA->id], array_column($res['kelas'], 'id'));
        $this->assertCount(2, $res['baris']);
        foreach ($res['baris'] as $baris) {
            $this->assertSame($fiqih->id, $baris['mata_pelajaran_id']);
            $this->assertContains($baris['nama_kelas'], ['1A', '1B']);
        }
        $barisB = collect($res['baris'])->firstWhere('kelas_id', $kelasB->id);
        $barisA = collect($res['baris'])->firstWhere('kelas_id', $kelasA->id);
        $this->assertSame($guru->id, $barisB['keaktifan_pegawai_id']);
        $this->assertNull($barisA['keaktifan_pegawai_id']);

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

        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/pengampus?'.http_build_query(['kelas_ids' => [$kelasA->id, 999999]]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('kelas_ids.1');
        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/pengampus', ['kelas_ids' => []])
            ->assertStatus(422)
            ->assertJsonValidationErrors('kelas_ids');
    }

    public function test_04_jadwal_menjaga_bentrok_kelas_dan_guru(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelasA = $this->kelas('1A', '1');
        $kelasB = $this->kelas('1B', '1');
        $fiqih = $this->mapel('Fiqih');
        $arab = $this->mapel('Bahasa Arab');

        $guruSama = $this->guru('Ust. Ahmad');
        $guruLain = $this->guru('Ust. Budi');

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

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/jadwal', [
                'pengampu_mapel_id' => $pengampu['1A-Fiqih'], 'slot_jam_id' => $slot['id'], 'hari' => 'senin',
            ])
            ->assertStatus(201);

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/jadwal', [
                'pengampu_mapel_id' => $pengampu['1A-Bahasa Arab'], 'slot_jam_id' => $slot['id'], 'hari' => 'senin',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('slot_jam_id');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/jadwal', [
                'pengampu_mapel_id' => $pengampu['1B-Fiqih'], 'slot_jam_id' => $slot['id'], 'hari' => 'senin',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('pengampu_mapel_id');

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

        $this->assertCount(1, $jadwal['belum_terjadwal']);
    }

    public function test_05_salin_pengampu_dari_kelas_lain(): void
    {
        $this->lembaga('MI');
        $this->lembaga('MTS');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelasA = $this->kelas('1A', '1');
        $kelasB = $this->kelas('1B', '1');
        $fiqih = $this->mapel('Fiqih');
        $arab = $this->mapel('Bahasa Arab');
        $guru = $this->guru('Ust. Ahmad');

        $this->actingAs($super, 'sanctum')->putJson('/api/admin/kurikulum/pengampu', [
            'kelas_id' => $kelasA->id,
            'baris' => [
                ['mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => $guru->id],
                ['mata_pelajaran_id' => $arab->id, 'keaktifan_pegawai_id' => null],
            ],
        ])->assertStatus(200);
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/kurikulum/pengampu', [
            'kelas_id' => $kelasB->id,
            'baris' => [['mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => $guru->id]],
        ])->assertStatus(200);

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/pengampu/salin', [
                'kelas_id' => $kelasB->id, 'dari_kelas_id' => $kelasA->id,
            ])
            ->assertStatus(200)
            ->assertJsonPath('ditambah', 1);

        $res = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/pengampu?kelas_id={$kelasB->id}")
            ->assertStatus(200)->json();
        $this->assertCount(2, $res['baris']);
        $barisFiqih = collect($res['baris'])->firstWhere('mata_pelajaran_id', $fiqih->id);
        $barisArab = collect($res['baris'])->firstWhere('mata_pelajaran_id', $arab->id);
        $this->assertSame($guru->id, $barisFiqih['keaktifan_pegawai_id'], 'baris lama tak boleh ditimpa');
        $this->assertNull($barisArab['keaktifan_pegawai_id'], 'baris salinan tanpa guru');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/pengampu/salin', [
                'kelas_id' => $kelasB->id, 'dari_kelas_id' => $kelasA->id,
            ])
            ->assertStatus(200)
            ->assertJsonPath('ditambah', 0)
            ->assertJsonPath('pesan', 'Semua mapel kelas sumber sudah ada di kelas tujuan — tidak ada yang ditambahkan.');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/pengampu/salin', [
                'kelas_id' => $kelasB->id, 'dari_kelas_id' => $kelasB->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('dari_kelas_id');

        $kelasMts = $this->kelas('1T', '1', 'MTS');
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/pengampu/salin', [
                'kelas_id' => $kelasB->id, 'dari_kelas_id' => $kelasMts->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('dari_kelas_id');
    }

    /**
     * Pratinjau salin mapel: menunjukkan mana yang ditambah vs dilewati, tidak
     * menulis apa pun, dan menolak sumber dari tahun ajaran lain — salin antar
     * tahun ajaran adalah fitur halaman Jadwal Pelajaran.
     */
    public function test_05b_pratinjau_salin_mapel_dan_penolakan_antar_tahun_ajaran(): void
    {
        $this->lembaga('MI');
        $taLalu = '2025/2026';
        TahunAjaran::create(['nama' => $taLalu, 'is_aktif' => false]);
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $sumber = $this->kelas('1A', '1');
        $tujuan = $this->kelas('2A', '2');
        $fiqih = $this->mapel('Fiqih');
        $arab = $this->mapel('Bahasa Arab');

        // Sumber: Fiqih + Bahasa Arab. Tujuan: baru punya Fiqih.
        PengampuMapel::create(['kelas_id' => $sumber->id, 'mata_pelajaran_id' => $fiqih->id]);
        PengampuMapel::create(['kelas_id' => $sumber->id, 'mata_pelajaran_id' => $arab->id]);
        PengampuMapel::create(['kelas_id' => $tujuan->id, 'mata_pelajaran_id' => $fiqih->id]);

        $pratinjau = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/pengampu/salin/pratinjau?kelas_id={$tujuan->id}&dari_kelas_id={$sumber->id}")
            ->assertStatus(200)
            ->assertJsonPath('jumlah_ditambah', 1)
            ->assertJsonPath('jumlah_dilewati', 1)
            ->assertJsonPath('sumber.tahun_ajaran', self::TA)
            ->json();

        $this->assertSame([$arab->id], array_column($pratinjau['ditambah'], 'id'));
        $this->assertSame([$fiqih->id], array_column($pratinjau['dilewati'], 'id'));

        // Pratinjau murni baca: belum ada baris baru.
        $this->assertSame(1, PengampuMapel::where('kelas_id', $tujuan->id)->count());

        // Sumber dari tahun ajaran lain ditolak.
        $lama = $this->kelas('1A', '1', 'MI', $taLalu);
        $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/pengampu/salin/pratinjau?kelas_id={$tujuan->id}&dari_kelas_id={$lama->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('dari_kelas_id');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/pengampu/salin', [
                'kelas_id' => $tujuan->id, 'dari_kelas_id' => $sumber->id,
            ])
            ->assertStatus(200)
            ->assertJsonPath('ditambah', 1);

        $this->assertSame(2, PengampuMapel::where('kelas_id', $tujuan->id)->count());

        // Setelah salin, tidak ada lagi yang bisa ditambahkan.
        $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/pengampu/salin/pratinjau?kelas_id={$tujuan->id}&dari_kelas_id={$sumber->id}")
            ->assertStatus(200)
            ->assertJsonPath('jumlah_ditambah', 0)
            ->assertJsonPath('jumlah_dilewati', 2);
    }

    /**
     * Salin JADWAL antar tahun ajaran: hanya kelas yang sudah ada di TA tujuan,
     * guru dipetakan ke keaktifan TA tujuan (kosong bila tidak aktif), dan sel
     * yang sudah terisi tidak ditimpa.
     */
    public function test_06_salin_jadwal_antar_tahun_ajaran(): void
    {
        $this->lembaga('MI');
        $taLalu = '2025/2026';
        TahunAjaran::create(['nama' => $taLalu, 'is_aktif' => false]);
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $asal = $this->kelas('1A', '1', 'MI', $taLalu);
        $tujuan = $this->kelas('1A', '1');
        $this->kelas('2A', '2', 'MI', $taLalu); // tanpa pasangan di TA tujuan

        $fiqih = $this->mapel('Fiqih');
        $arab = $this->mapel('Bahasa Arab');

        // Guru aktif di kedua TA, dan guru yang hanya aktif di TA lama.
        $p1 = Pegawai::create(['nama_lengkap' => 'Ust. Ahmad', 'jenis_kelamin' => 'L']);
        $kSumber1 = KeaktifanPegawai::create(['pegawai_id' => $p1->id, 'jenjang' => 'MI', 'tahun_ajaran' => $taLalu, 'status_keaktifan' => 'Ya']);
        $kTujuan1 = KeaktifanPegawai::create(['pegawai_id' => $p1->id, 'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'status_keaktifan' => 'Ya']);

        $p2 = Pegawai::create(['nama_lengkap' => 'Ust. Lama', 'jenis_kelamin' => 'L']);
        $kSumber2 = KeaktifanPegawai::create(['pegawai_id' => $p2->id, 'jenjang' => 'MI', 'tahun_ajaran' => $taLalu, 'status_keaktifan' => 'Ya']);

        $pengampuFiqih = PengampuMapel::create(['kelas_id' => $asal->id, 'mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => $kSumber1->id]);
        $pengampuArab = PengampuMapel::create(['kelas_id' => $asal->id, 'mata_pelajaran_id' => $arab->id, 'keaktifan_pegawai_id' => $kSumber2->id]);

        $slot1 = SlotJamPelajaran::create([
            'jenjang' => 'MI', 'kelas_id' => $asal->id, 'nama_slot' => 'Jam 1',
            'jenis' => 'pelajaran', 'urutan' => 1,
        ]);
        JadwalPelajaran::create(['kelas_id' => $asal->id, 'pengampu_mapel_id' => $pengampuFiqih->id, 'slot_jam_id' => $slot1->id, 'hari' => 'senin']);
        JadwalPelajaran::create(['kelas_id' => $asal->id, 'pengampu_mapel_id' => $pengampuArab->id, 'slot_jam_id' => $slot1->id, 'hari' => 'selasa']);

        // Pratinjau: angka benar, tetapi belum ada yang ditulis.
        $pratinjau = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/jadwal/salin/pratinjau?'.http_build_query([
                'jenjang' => 'MI', 'tahun_ajaran_sumber' => $taLalu, 'tahun_ajaran_tujuan' => self::TA,
            ]))
            ->assertStatus(200)
            ->assertJsonPath('hitung.slot', 1)
            ->assertJsonPath('hitung.pengampu', 2)
            ->assertJsonPath('hitung.jadwal', 2)
            ->assertJsonPath('hitung.guru_dikosongkan', 1)
            ->json();

        $this->assertCount(1, $pratinjau['kelas']);
        $this->assertSame('2A', $pratinjau['kelas_dilewati'][0]['nama']);
        $this->assertSame(0, SlotJamPelajaran::where('kelas_id', $tujuan->id)->count());

        // Eksekusi.
        $tujuan->update(['status_jadwal' => 'pembahasan']);
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/jadwal/salin', [
                'jenjang' => 'MI', 'tahun_ajaran_sumber' => $taLalu, 'tahun_ajaran_tujuan' => self::TA,
            ])
            ->assertStatus(200)
            ->assertJsonPath('hitung.slot', 1)
            ->assertJsonPath('hitung.pengampu', 2)
            ->assertJsonPath('hitung.jadwal', 2);
        $this->assertSame('draft', $tujuan->fresh()->status_jadwal, 'hasil salin harus berstatus Draft');

        $jadwalTujuan = JadwalPelajaran::where('kelas_id', $tujuan->id)->get();
        $this->assertCount(2, $jadwalTujuan);
        $this->assertEqualsCanonicalizing(['senin', 'selasa'], $jadwalTujuan->pluck('hari')->all());

        // Guru dipetakan ke keaktifan TA tujuan; yang tidak aktif dikosongkan.
        $peta = PengampuMapel::where('kelas_id', $tujuan->id)->get()->keyBy('mata_pelajaran_id');
        $this->assertSame($kTujuan1->id, $peta[$fiqih->id]->keaktifan_pegawai_id);
        $this->assertNull($peta[$arab->id]->keaktifan_pegawai_id);

        // Salin ulang: semua sel sudah terisi -> tidak ada yang ditambah.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/jadwal/salin', [
                'jenjang' => 'MI', 'tahun_ajaran_sumber' => $taLalu, 'tahun_ajaran_tujuan' => self::TA,
            ])
            ->assertStatus(200)
            ->assertJsonPath('hitung.jadwal', 0)
            ->assertJsonPath('hitung.jadwal_dilewati', 2);

        $this->assertSame(2, JadwalPelajaran::where('kelas_id', $tujuan->id)->count());

        // Kelas tujuan yang Final dilewati seluruhnya.
        $tujuan->update(['status_jadwal' => 'final']);
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/jadwal/salin', [
                'jenjang' => 'MI', 'tahun_ajaran_sumber' => $taLalu, 'tahun_ajaran_tujuan' => self::TA,
            ])
            ->assertStatus(200)
            ->assertJsonPath('hitung.jadwal', 0)
            ->assertJsonPath('kelas_dilewati.0.nama', '1A');
    }

    /**
     * Status jadwal per kelas + agregat: final hanya bila seluruh kelas final.
     * Kelas final terkunci (jadwal/pengampu/salin mapel ditolak) sampai
     * dikembalikan ke draft.
     */
    public function test_07_status_jadwal_mengunci_perubahan_kelas_final(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $a = $this->kelas('1A', '1');
        $b = $this->kelas('1B', '1');
        $fiqih = $this->mapel('Fiqih');
        $slotA = SlotJamPelajaran::create([
            'jenjang' => 'MI', 'kelas_id' => $a->id, 'nama_slot' => 'Jam 1',
            'jenis' => 'pelajaran', 'urutan' => 1,
        ]);
        PengampuMapel::create(['kelas_id' => $a->id, 'mata_pelajaran_id' => $fiqih->id]);

        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/jadwal/status?'.http_build_query([
                'jenjang' => 'MI', 'tahun_ajaran' => self::TA,
            ]))
            ->assertStatus(200)
            ->assertJsonPath('status', 'draft');

        // Satu kelas pembahasan -> agregat pembahasan.
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/jadwal/status', ['kelas_id' => $a->id, 'status' => 'pembahasan'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'pembahasan');

        // Semua final -> agregat final.
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/jadwal/status', ['kelas_id' => $a->id, 'status' => 'final'])
            ->assertStatus(200);
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/jadwal/status', ['kelas_id' => $b->id, 'status' => 'final'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'final');

        // Kelas final menolak perubahan jadwal, pengampu, dan salin mapel.
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/jadwal/sel', [
                'kelas_id' => $a->id, 'slot_jam_id' => $slotA->id, 'hari' => 'senin',
                'mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => null,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('kelas_id');

        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/pengampu', ['kelas_id' => $a->id, 'baris' => []])
            ->assertStatus(422)
            ->assertJsonValidationErrors('kelas_id');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/pengampu/salin', ['kelas_id' => $a->id, 'dari_kelas_id' => $b->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('kelas_id');

        // Kembali ke draft -> boleh diubah lagi.
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/jadwal/status', ['kelas_id' => $a->id, 'status' => 'draft'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'draft');

        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/jadwal/sel', [
                'kelas_id' => $a->id, 'slot_jam_id' => $slotA->id, 'hari' => 'senin',
                'mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => null,
            ])
            ->assertStatus(200);
    }

    /**
     * Varian jadwal: snapshot manual, hanya satu aktif per TA + lembaga, dan
     * aktivasi memulihkan jadwal dari snapshot. Kelas Final dilewati.
     */
    public function test_08_varian_jadwal_snapshot_dan_aktifkan(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelas = $this->kelas('1A', '1');
        $fiqih = $this->mapel('Fiqih');
        $arab = $this->mapel('Bahasa Arab');
        $slot = SlotJamPelajaran::create([
            'jenjang' => 'MI', 'kelas_id' => $kelas->id, 'nama_slot' => 'Jam 1',
            'jenis' => 'pelajaran', 'urutan' => 1,
        ]);
        PengampuMapel::create(['kelas_id' => $kelas->id, 'mata_pelajaran_id' => $fiqih->id]);

        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/jadwal/sel', [
                'kelas_id' => $kelas->id, 'slot_jam_id' => $slot->id, 'hari' => 'senin',
                'mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => null,
            ])
            ->assertStatus(200);

        // Varian "Normal": satu sel.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/jadwal/varian', [
                'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama' => 'Normal',
            ])
            ->assertStatus(201)
            ->assertJsonPath('varian.0.nama', 'Normal')
            ->assertJsonPath('varian.0.is_active', true)
            ->assertJsonPath('varian.0.ringkasan.jadwal', 1);

        // Ubah jadwal, lalu simpan varian "Revisi".
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/jadwal/sel', [
                'kelas_id' => $kelas->id, 'slot_jam_id' => $slot->id, 'hari' => 'selasa',
                'mata_pelajaran_id' => $arab->id, 'keaktifan_pegawai_id' => null,
            ])
            ->assertStatus(200);

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/jadwal/varian', [
                'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama' => 'Revisi',
            ])
            ->assertStatus(201)
            ->assertJsonPath('varian.0.nama', 'Revisi')
            ->assertJsonPath('varian.0.is_active', true)
            ->assertJsonPath('varian.1.nama', 'Normal')
            ->assertJsonPath('varian.1.is_active', false);

        // Hanya satu yang aktif.
        $this->assertSame(1, VarianJadwal::where('is_active', true)->count());

        // Aktifkan "Normal" -> jadwal kembali ke satu sel (Senin).
        $normal = VarianJadwal::where('nama', 'Normal')->firstOrFail();
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/jadwal/varian/{$normal->id}/aktifkan")
            ->assertStatus(200)
            ->assertJsonPath('varian.0.nama', 'Normal')
            ->assertJsonPath('varian.0.is_active', true)
            ->assertJsonPath('ringkas.jadwal', 1);

        $this->assertSame(1, JadwalPelajaran::where('kelas_id', $kelas->id)->count());
        $this->assertSame('senin', JadwalPelajaran::where('kelas_id', $kelas->id)->value('hari'));
        $this->assertSame(1, VarianJadwal::where('is_active', true)->count());

        // Kelas Final dilewati saat aktivasi.
        $kelas->update(['status_jadwal' => 'final']);
        $revisi = VarianJadwal::where('nama', 'Revisi')->firstOrFail();
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/jadwal/varian/{$revisi->id}/aktifkan")
            ->assertStatus(200)
            ->assertJsonPath('ringkas.dilewati', 1)
            ->assertJsonPath('ringkas.kelas', 0);

        $this->assertSame(1, JadwalPelajaran::where('kelas_id', $kelas->id)->count());
    }

    /**
     * Struktur kurikulum dihitung dari snapshot varian: JP/minggu = jumlah sel
     * jadwal tiap mapel per tingkat (terbanyak antar kelas satu tingkat).
     * Minggu efektif tetap disimpan per jenjang + TA.
     */
    public function test_09_struktur_kurikulum_dihitung_dari_snapshot_varian(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $this->kelas('1A', '1');
        $this->kelas('1B', '1');
        $this->kelas('2A', '2');
        $fiqih = $this->mapel('Fiqih');
        $arab = $this->mapel('Bahasa Arab');
        $nonaktif = $this->mapel('Mapel Lama', 'MI', ['is_active' => false]);

        $jp = fn (int $n, int $mapelId): array => array_fill(0, $n, [
            'hari' => 'senin', 'slot_key' => 'senin|jam 1',
            'mata_pelajaran_id' => $mapelId, 'pegawai_id' => null,
        ]);

        $normal = VarianJadwal::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama' => 'Normal', 'is_active' => true,
            'snapshot' => ['kelas' => [
                ['nama' => '1A', 'slot' => [], 'pengampu' => [], 'jadwal' => [
                    ...$jp(3, $fiqih->id),
                    ...$jp(2, $arab->id),
                    ['hari' => 'senin', 'slot_key' => 'senin|jam 2', 'mata_pelajaran_id' => $nonaktif->id, 'pegawai_id' => null],
                ]],
                ['nama' => '1B', 'slot' => [], 'pengampu' => [], 'jadwal' => [
                    ...$jp(4, $fiqih->id),
                    ...$jp(1, $arab->id),
                ]],
                ['nama' => '2A', 'slot' => [], 'pengampu' => [], 'jadwal' => []],
            ]],
        ]);
        $ramadhan = VarianJadwal::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama' => 'Ramadhan', 'is_active' => false,
            'snapshot' => ['kelas' => [
                ['nama' => '1A', 'slot' => [], 'pengampu' => [], 'jadwal' => $jp(1, $fiqih->id)],
            ]],
        ]);

        $awal = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/struktur?'.http_build_query(['varian_id' => $normal->id]))
            ->assertStatus(200)
            ->assertJsonPath('minggu_efektif', 36)
            ->assertJsonPath('varian.nama', 'Normal')
            ->json();

        $this->assertSame(['1', '2'], $awal['tingkat']);
        $this->assertSame(['Normal', 'Ramadhan'], array_column($awal['varian_opsi'], 'nama'), 'varian nonaktif tetap muncul di combobox');

        $sel = collect($awal['sel'])->keyBy(fn (array $s): string => $s['mata_pelajaran_id'].'|'.$s['tingkat']);
        $this->assertCount(2, $sel, 'hanya mapel aktif yang dihitung');
        $this->assertSame(4, $sel[$fiqih->id.'|1']['jp_per_minggu'], 'dipakai jumlah terbanyak antar kelas satu tingkat');
        $this->assertSame(2, $sel[$arab->id.'|1']['jp_per_minggu']);
        $this->assertFalse(isset($sel[$nonaktif->id.'|1']), 'mapel nonaktif tidak masuk struktur');

        // Varian lain dihitung dari snapshot-nya sendiri.
        $lain = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/struktur?'.http_build_query(['varian_id' => $ramadhan->id]))
            ->assertStatus(200)
            ->json();
        $this->assertCount(1, $lain['sel']);
        $this->assertSame($fiqih->id, $lain['sel'][0]['mata_pelajaran_id']);
        $this->assertSame(1, $lain['sel'][0]['jp_per_minggu']);

        // Minggu efektif disimpan per jenjang + TA, berlaku untuk semua varian.
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/struktur', [
                'varian_id' => $normal->id, 'minggu_efektif' => 40,
            ])
            ->assertStatus(200)
            ->assertJsonPath('minggu_efektif', 40)
            ->assertJsonPath('pesan', 'Minggu efektif disimpan.');

        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/struktur?'.http_build_query(['varian_id' => $ramadhan->id]))
            ->assertStatus(200)
            ->assertJsonPath('minggu_efektif', 40)
            ->assertJsonPath('sel.0.jp_per_minggu', 1);

        // Varian wajib dipilih dan harus ada.
        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/struktur?jenjang=MI&tahun_ajaran='.self::TA)
            ->assertStatus(422)
            ->assertJsonValidationErrors('varian_id');

        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/struktur?'.http_build_query(['varian_id' => 999999]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('varian_id');
    }
}

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

    private function mapel(string $nama, string $jenjang = 'MI', array $tambahan = []): MataPelajaran
    {
        return MataPelajaran::create([
            'jenjang' => $jenjang, 'nama_mapel' => $nama, 'kelompok' => 'formal',
        ] + $tambahan);
    }

    // ---------- 01. master mapel (termasuk KKM & urutan rapor) ----------

    public function test_01_mapel_crud_kkm_urutan_dan_larangan_hapus_bila_dipakai(): void
    {
        $this->lembaga('MI');
        $this->lembaga('MD');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        // KKM & urutan tampil rapor kini milik master mapel (satu tempat per
        // jenjang — dulu tinggal di komposisi kurikulum yang sudah dihapus).
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel', [
                'jenjang' => 'MI', 'nama_mapel' => 'Fiqih', 'kelompok' => 'formal',
                'kkm' => 75, 'urutan' => 2,
            ])
            ->assertStatus(201)
            ->assertJsonPath('urutan', 2);
        $this->assertDatabaseHas('mata_pelajaran', ['nama_mapel' => 'Fiqih', 'kkm' => 75]);

        // KKM kosong = tanpa KKM (predikat manual, modul 202); urutan bawaan 0.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel', ['jenjang' => 'MI', 'nama_mapel' => 'Akidah', 'kelompok' => 'formal'])
            ->assertStatus(201)
            ->assertJsonPath('kkm', null)
            ->assertJsonPath('urutan', 0);

        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/mapel?jenjang=MI')
            ->assertStatus(200)
            ->assertJsonCount(2);

        // Nama kembar (beda huruf besar/kecil) ditolak.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel', ['jenjang' => 'MI', 'nama_mapel' => 'fiqih', 'kelompok' => 'formal'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('nama_mapel');

        $mapel = MataPelajaran::where('nama_mapel', 'Fiqih')->first();
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$mapel->id}", ['is_active' => false])
            ->assertStatus(200)
            ->assertJsonPath('is_active', false);

        // KKM di luar 0–100 & urutan negatif ditolak.
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

        // Belum dipakai pengampu → boleh hapus.
        $this->actingAs($super, 'sanctum')
            ->deleteJson("/api/admin/kurikulum/mapel/{$mapel->id}")
            ->assertStatus(200);

        // Dipakai pengampu kelas → tolak (nonaktifkan saja).
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

    // ---------- 02. pengampu: simpan per kelas + guru + guard nilai ----------

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

        // Simpan pengampu: satu daftar utuh per kelas (sync).
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/pengampu', [
                'kelas_id' => $kelas->id,
                'baris' => [
                    ['mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => $guru->id],
                    ['mata_pelajaran_id' => $arab->id, 'keaktifan_pegawai_id' => null],
                ],
            ])->assertStatus(200);

        // Daftar guru aktif jenjang+TA.
        $guruRes = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kurikulum/guru-aktif?jenjang=MI&tahun_ajaran='.urlencode(self::TA))
            ->assertStatus(200)->json();
        $this->assertCount(1, $guruRes);
        $this->assertSame($guru->id, $guruRes[0]['keaktifan_pegawai_id']);

        // Daftar pengampu kelas: urut mengikuti urutan rapor mapel, KKM terbawa.
        $res = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/pengampu?kelas_id={$kelas->id}")
            ->assertStatus(200)->json();
        $this->assertCount(2, $res['baris']);
        $this->assertSame($fiqih->id, $res['baris'][0]['mata_pelajaran_id']);
        $barisFiqih = collect($res['baris'])->firstWhere('mata_pelajaran_id', $fiqih->id);
        $this->assertSame($guru->id, $barisFiqih['keaktifan_pegawai_id']);
        $this->assertNotNull($barisFiqih['guru']);
        $this->assertEquals(70, (float) $barisFiqih['kkm']);

        // Mapel wajib sejenjang dengan kelas (dulu dijamin kurikulum kelas).
        $mapelMd = $this->mapel('Fiqih MD', 'MD');
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/pengampu', [
                'kelas_id' => $kelas->id,
                'baris' => [['mata_pelajaran_id' => $mapelMd->id, 'keaktifan_pegawai_id' => null]],
            ])->assertStatus(422)
            ->assertJsonValidationErrors('mata_pelajaran_id');

        // Pengampu yang sudah punya nilai tidak boleh dihapus lewat sync.
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

        // Baris bernilai dikeluarkan dari daftar → ditolak.
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
        // MTS (bukan pasangan MI↔MD): admin MI berpasangan dengan MD, jadi
        // batas wewenang diuji lewat lembaga yang tak berpasangan.
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

        // Satu request untuk dua kelas → baris keduanya, berlabel kelas asalnya.
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
        $fiqih = $this->mapel('Fiqih');
        $arab = $this->mapel('Bahasa Arab');

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

    // ---------- 05. salin daftar mapel antar kelas ----------

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

        // 1A: dua mapel (Arab tanpa guru). 1B: Fiqih saja, sudah berguru.
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

        // Salin 1A → 1B: hanya Bahasa Arab yang ditambahkan (Fiqih sudah ada),
        // dan baris baru TANPA guru.
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

        // Salin lagi → tidak ada yang ditambahkan (pesan menjelaskan).
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/pengampu/salin', [
                'kelas_id' => $kelasB->id, 'dari_kelas_id' => $kelasA->id,
            ])
            ->assertStatus(200)
            ->assertJsonPath('ditambah', 0)
            ->assertJsonPath('pesan', 'Semua mapel kelas sumber sudah ada di kelas tujuan — tidak ada yang ditambahkan.');

        // Kelas sumber = kelas tujuan → ditolak.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/pengampu/salin', [
                'kelas_id' => $kelasB->id, 'dari_kelas_id' => $kelasB->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('dari_kelas_id');

        // Beda jenjang → ditolak (peta mapel antar jenjang tak boleh bocor).
        $kelasMts = $this->kelas('1T', '1', 'MTS');
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/pengampu/salin', [
                'kelas_id' => $kelasB->id, 'dari_kelas_id' => $kelasMts->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('dari_kelas_id');
    }
}

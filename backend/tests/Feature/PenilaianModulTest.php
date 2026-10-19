<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\KomponenNilai;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\MataPelajaran;
use App\Models\NilaiKomponen;
use App\Models\PengampuMapel;
use App\Models\PeristiwaNilai;
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
 * Modul Penilaian per PERISTIWA: bawaan peristiwa (ASAS/ASAT/UJIAN/UAP),
 * saringan cakupan tingkat akhir di leger, hitung nilai akhir dari komponen,
 * dan rapor per peristiwa.
 */
class PenilaianModulTest extends TestCase
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
            'email' => "penilaian{$this->seq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9200000000 + $this->seq * 89), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole('super_admin');

        return $u;
    }

    private function lembaga(string $jenjang, string $nama): Lembaga
    {
        return Lembaga::create([
            'nama' => $nama, 'jenjang' => $jenjang,
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
    }

    private function tahunAjaran(): void
    {
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
    }

    /** Tingkat per jenjang (urutan menaik; tertinggi = tingkat akhir). */
    private function tingkat(string $jenjang, array $daftar): void
    {
        foreach ($daftar as $i => $nama) {
            DB::table('ref_tingkat')->insert([
                'jenjang' => $jenjang, 'nama' => $nama, 'urutan' => $i, 'is_active' => true,
            ]);
        }
    }

    /** Santri + keanggotaan + riwayat belajar di satu kelas. */
    private function santriDiKelas(string $nama, string $nis, int $kelasId, string $tingkat): Santri
    {
        $this->seq++;
        $s = Santri::create(['nama_lengkap' => $nama.' '.$this->seq, 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $s->id, 'jenjang' => 'MI', 'nis_lokal' => $nis, 'is_active_lembaga' => 'Ya',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $s->id, 'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'semester' => '1',
            'kelas_id' => $kelasId, 'tingkat' => $tingkat,
            'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => RiwayatBelajar::YA,
        ]);

        return $s;
    }

    private function kelas(string $nama, string $tingkat): Kelas
    {
        return Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => $nama, 'tingkat' => $tingkat,
        ]);
    }

    private function mapelPengampu(int $kelasId, string $namaMapel): array
    {
        $mapel = MataPelajaran::create(['jenjang' => 'MI', 'nama_mapel' => $namaMapel, 'kelompok' => 'formal']);
        $pengampu = PengampuMapel::create(['kelas_id' => $kelasId, 'mata_pelajaran_id' => $mapel->id]);

        return [$mapel, $pengampu];
    }

    public function test_01_bawaan_membuat_peristiwa_dengan_cakupan(): void
    {
        $this->lembaga('MI', 'Madrasah Ibtidaiyah');
        $this->tahunAjaran();
        $super = $this->superAdmin();

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/bawaan', ['jenjang' => 'MI', 'tahun_ajaran' => self::TA])
            ->assertStatus(200);

        $peristiwa = PeristiwaNilai::orderBy('urutan')->get();
        $this->assertSame(['PTS', 'ASAS', 'ASAT', 'UJIAN', 'UAP'], $peristiwa->pluck('kode')->all());
        $this->assertSame(
            ['semua', 'semua', 'kecuali_akhir', 'tingkat_akhir', 'tingkat_akhir'],
            $peristiwa->pluck('cakupan')->all(),
        );

        $this->assertSame(
            ['sementara', 'akhir', 'akhir', 'tidak_ada', 'tidak_ada'],
            $peristiwa->pluck('jenis_rapor')->all(),
        );

        $pts = $peristiwa->firstWhere('kode', 'PTS');
        $this->assertSame(100.0, (float) KomponenNilai::where('peristiwa_id', $pts->id)->sum('bobot'));

        $asas = $peristiwa->firstWhere('kode', 'ASAS');
        $this->assertSame(100.0, (float) KomponenNilai::where('peristiwa_id', $asas->id)->sum('bobot'));

        $komponenPts = KomponenNilai::where('peristiwa_id', $asas->id)->where('nama', 'PTS')->first();
        $this->assertNotNull($komponenPts);
        $this->assertSame(KomponenNilai::PERISTIWA, $komponenPts->sumber);
        $this->assertSame($pts->id, $komponenPts->peristiwa_sumber_id);

        $ujian = $peristiwa->firstWhere('kode', 'UJIAN');
        $rapor = KomponenNilai::where('peristiwa_id', $ujian->id)->where('nama', 'Rata-rata Rapor')->first();
        $this->assertNotNull($rapor);
        $this->assertSame(KomponenNilai::RAPOR_OTOMATIS, $rapor->sumber);
        $this->assertSame(2, $rapor->jumlah_tingkat_rapor);

        $this->assertDatabaseHas('kkm_kegiatan', ['peristiwa_id' => $asas->id, 'kegiatan' => 'AKHIR', 'kkm' => 75]);
        $this->assertSame(4, DB::table('rentang_predikat')->where('peristiwa_id', $asas->id)->count());
    }

    public function test_02_bawaan_m_d_tanpa_peristiwa_ujian_kemenag(): void
    {
        $this->lembaga('MD', 'Madrasah Diniyah');
        $this->tahunAjaran();
        $super = $this->superAdmin();

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/bawaan', ['jenjang' => 'MD', 'tahun_ajaran' => self::TA])
            ->assertStatus(200);

        $this->assertSame(
            ['PTS', 'ASAS', 'ASAT', 'UAP'],
            PeristiwaNilai::orderBy('urutan')->pluck('kode')->all(),
        );
    }

    public function test_03_leger_menyaring_cakupan_tingkat_akhir(): void
    {
        $this->lembaga('MI', 'Madrasah Ibtidaiyah');
        $this->tahunAjaran();
        $this->tingkat('MI', ['1', '2', '3', '4', '5', '6']);
        $super = $this->superAdmin();

        $kelasAkhir = $this->kelas('6A', '6');
        $kelasLima = $this->kelas('5A', '5');
        $this->santriDiKelas('Santri Akhir', '26001', $kelasAkhir->id, '6');
        $this->santriDiKelas('Santri Lima', '26002', $kelasLima->id, '5');
        $this->mapelPengampu($kelasAkhir->id, 'Fiqih');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/bawaan', ['jenjang' => 'MI', 'tahun_ajaran' => self::TA])
            ->assertStatus(200);

        $id = fn (string $kode) => PeristiwaNilai::where('kode', $kode)->value('id');

        $asas = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/penilaian/leger?jenjang=MI&tahun_ajaran='.urlencode(self::TA)."&semester=1&peristiwa_id={$id('ASAS')}")
            ->assertStatus(200)->json();
        $this->assertSame(2, $asas['total']);

        $asat = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/penilaian/leger?jenjang=MI&tahun_ajaran='.urlencode(self::TA)."&semester=1&peristiwa_id={$id('ASAT')}")
            ->assertStatus(200)->json();
        $this->assertSame(1, $asat['total']);
        $this->assertSame('5', $asat['baris'][0]['tingkat']);

        $ujian = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/penilaian/leger?jenjang=MI&tahun_ajaran='.urlencode(self::TA)."&semester=1&peristiwa_id={$id('UJIAN')}")
            ->assertStatus(200)->json();
        $this->assertSame(1, $ujian['total']);
        $this->assertSame('6', $ujian['baris'][0]['tingkat']);
    }

    public function test_04_hitung_mengisi_nilai_akhir_dan_predikat(): void
    {
        $this->lembaga('MI', 'Madrasah Ibtidaiyah');
        $this->tahunAjaran();
        $this->tingkat('MI', ['1', '2', '3', '4', '5', '6']);
        $super = $this->superAdmin();

        $kelas = $this->kelas('6A', '6');
        $santri = $this->santriDiKelas('Santri Uji', '26001', $kelas->id, '6');
        [$mapel, $pengampu] = $this->mapelPengampu($kelas->id, 'Fiqih');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/bawaan', ['jenjang' => 'MI', 'tahun_ajaran' => self::TA])
            ->assertStatus(200);

        $asas = PeristiwaNilai::where('kode', 'ASAS')->first();
        $skor = ['Harian' => 80, 'Tugas' => 90, 'PTS' => 70, 'Sumatif' => 100];
        foreach (KomponenNilai::where('peristiwa_id', $asas->id)->get() as $k) {
            NilaiKomponen::create([
                'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampu->id,
                'tahun_ajaran' => self::TA, 'semester' => '1',
                'komponen_nilai_id' => $k->id, 'skor' => $skor[$k->nama],
            ]);
        }

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/hitung', [
                'peristiwa_id' => $asas->id, 'semester' => '1', 'kelas_id' => $kelas->id,
            ])
            ->assertStatus(200)
            ->assertJsonPath('dihitung', 1)
            ->assertJsonPath('belum_lengkap', 0);

        $this->assertDatabaseHas('nilai_santri', [
            'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampu->id,
            'peristiwa_id' => $asas->id, 'semester' => '1', 'nilai_akhir' => 88, 'sumber' => 'hitung',
        ]);

        $this->assertSame('B', DB::table('nilai_santri')
            ->where('santri_id', $santri->id)->where('peristiwa_id', $asas->id)->value('predikat'));
    }

    public function test_05_hitung_melewati_baris_impor_kecuali_paksa(): void
    {
        $this->lembaga('MI', 'Madrasah Ibtidaiyah');
        $this->tahunAjaran();
        $this->tingkat('MI', ['1', '2', '3', '4', '5', '6']);
        $super = $this->superAdmin();

        $kelas = $this->kelas('6A', '6');
        $santri = $this->santriDiKelas('Santri Impor', '26001', $kelas->id, '6');
        [, $pengampu] = $this->mapelPengampu($kelas->id, 'Fiqih');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/bawaan', ['jenjang' => 'MI', 'tahun_ajaran' => self::TA])
            ->assertStatus(200);
        $asas = PeristiwaNilai::where('kode', 'ASAS')->first();

        DB::table('nilai_santri')->insert([
            'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampu->id,
            'tahun_ajaran' => self::TA, 'semester' => '1', 'peristiwa_id' => $asas->id,
            'nilai_akhir' => 95, 'sumber' => 'impor', 'predikat' => 'A',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        foreach (KomponenNilai::where('peristiwa_id', $asas->id)->get() as $k) {
            NilaiKomponen::create([
                'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampu->id,
                'tahun_ajaran' => self::TA, 'semester' => '1',
                'komponen_nilai_id' => $k->id, 'skor' => 88,
            ]);
        }

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/hitung', ['peristiwa_id' => $asas->id, 'semester' => '1'])
            ->assertStatus(200)
            ->assertJsonPath('dihitung', 0)
            ->assertJsonPath('dilewati_impor', 1);

        $this->assertSame(95.0, (float) DB::table('nilai_santri')
            ->where('santri_id', $santri->id)->where('peristiwa_id', $asas->id)->value('nilai_akhir'));

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/hitung', ['peristiwa_id' => $asas->id, 'semester' => '1', 'paksa' => true])
            ->assertStatus(200)
            ->assertJsonPath('dihitung', 1);
        $this->assertSame('hitung', DB::table('nilai_santri')
            ->where('santri_id', $santri->id)->where('peristiwa_id', $asas->id)->value('sumber'));
    }

    public function test_06_rapor_per_peristiwa_memuat_nilai_dan_terbilang(): void
    {
        $this->lembaga('MI', 'Madrasah Ibtidaiyah');
        $this->tahunAjaran();
        $this->tingkat('MI', ['1', '2', '3', '4', '5', '6']);
        $super = $this->superAdmin();

        $kelas = $this->kelas('6A', '6');
        $santri = $this->santriDiKelas('Santri Rapor', '26001', $kelas->id, '6');
        [$mapel, $pengampu] = $this->mapelPengampu($kelas->id, 'Fiqih');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/bawaan', ['jenjang' => 'MI', 'tahun_ajaran' => self::TA])
            ->assertStatus(200);
        $asas = PeristiwaNilai::where('kode', 'ASAS')->first();

        foreach (KomponenNilai::where('peristiwa_id', $asas->id)->get() as $k) {
            NilaiKomponen::create([
                'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampu->id,
                'tahun_ajaran' => self::TA, 'semester' => '1',
                'komponen_nilai_id' => $k->id, 'skor' => 88,
            ]);
        }
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/hitung', ['peristiwa_id' => $asas->id, 'semester' => '1'])
            ->assertStatus(200);

        $res = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/penilaian/rapor?santri_id={$santri->id}&peristiwa_id={$asas->id}&semester=1")
            ->assertStatus(200)->json();

        $this->assertSame('ASAS', $res['peristiwa']['kode']);
        $this->assertSame('Fiqih', $res['mapel'][0]['nama_mapel']);
        $this->assertSame(88.0, (float) $res['mapel'][0]['nilai_akhir']);
        $this->assertSame('delapan delapan', $res['mapel'][0]['terbilang']);
        $this->assertSame(1, $res['rekap']['peringkat']);
    }

    public function test_07_rapor_ditolak_untuk_peristiwa_tanpa_rapor(): void
    {
        $this->lembaga('MI', 'Madrasah Ibtidaiyah');
        $this->tahunAjaran();
        $this->tingkat('MI', ['1', '2', '3', '4', '5', '6']);
        $super = $this->superAdmin();

        $kelas = $this->kelas('6A', '6');
        $santri = $this->santriDiKelas('Santri Ujian', '26001', $kelas->id, '6');
        $this->mapelPengampu($kelas->id, 'Fiqih');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/bawaan', ['jenjang' => 'MI', 'tahun_ajaran' => self::TA])
            ->assertStatus(200);

        $ujian = PeristiwaNilai::where('kode', 'UJIAN')->first();
        $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/penilaian/rapor?santri_id={$santri->id}&peristiwa_id={$ujian->id}&semester=1")
            ->assertStatus(422)
            ->assertJsonValidationErrors('peristiwa_id');

        $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/penilaian/rapor-kelas?peristiwa_id={$ujian->id}&semester=1&kelas_id={$kelas->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('peristiwa_id');

        $asas = PeristiwaNilai::where('kode', 'ASAS')->first();
        $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/penilaian/rapor?santri_id={$santri->id}&peristiwa_id={$asas->id}&semester=1")
            ->assertStatus(200);
    }

    public function test_09_ekskul_crud_dan_lingkup_lembaga(): void
    {
        $this->lembaga('MI', 'Madrasah Ibtidaiyah');
        $this->tahunAjaran();
        $super = $this->superAdmin();

        $buat = $this->actingAs($super, 'sanctum')->postJson('/api/admin/penilaian/ekskul', [
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA,
            'nama' => 'Pramuka', 'pembimbing' => 'Ust. Ahmad',
        ])->assertCreated()->assertJsonPath('nama', 'Pramuka');

        $id = $buat->json('id');
        $this->actingAs($super, 'sanctum')->getJson('/api/admin/penilaian/ekskul?jenjang=MI&tahun_ajaran='.self::TA)
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $id);

        $this->actingAs($super, 'sanctum')->patchJson("/api/admin/penilaian/ekskul/{$id}", ['is_active' => false])
            ->assertOk()->assertJsonPath('is_active', false);

        $this->actingAs($super, 'sanctum')->deleteJson("/api/admin/penilaian/ekskul/{$id}")->assertOk();
        $this->assertDatabaseMissing('ekstrakurikuler', ['id' => $id]);
    }

    public function test_10_prestasi_crud_terikat_santri_dan_ta(): void
    {
        $this->lembaga('MI', 'Madrasah Ibtidaiyah');
        $this->tahunAjaran();
        $super = $this->superAdmin();
        $santri = Santri::create(['nama_lengkap' => 'Santri Prestasi', 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'is_active_lembaga' => 'Ya',
        ]);

        $buat = $this->actingAs($super, 'sanctum')->postJson('/api/admin/penilaian/prestasi', [
            'santri_id' => $santri->id, 'tahun_ajaran' => self::TA,
            'semester' => '1', 'prestasi' => 'Juara 1', 'level' => 'Kecamatan',
        ])->assertCreated()->assertJsonPath('prestasi', 'Juara 1');

        $id = $buat->json('id');
        $this->actingAs($super, 'sanctum')->getJson('/api/admin/penilaian/prestasi?tahun_ajaran='.self::TA.'&santri_id='.$santri->id)
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $id);

        $this->actingAs($super, 'sanctum')->deleteJson("/api/admin/penilaian/prestasi/{$id}")->assertOk();
        $this->assertDatabaseMissing('prestasi_santri', ['id' => $id]);
    }

    public function test_11_template_impor_empat_tipe_bisa_diunduh(): void
    {
        $this->lembaga('MI', 'Madrasah Ibtidaiyah');
        $this->tahunAjaran();
        $super = $this->superAdmin();

        foreach (['nilai', 'catatan_wali', 'prestasi', 'ekskul'] as $tipe) {
            $res = $this->actingAs($super, 'sanctum')->get(
                "/api/admin/penilaian/import-template?tipe={$tipe}&jenjang=MI&tahun_ajaran=".self::TA,
            );
            $res->assertOk();
            $this->assertStringContainsString(
                "template-import-penilaian-{$tipe}.xlsx",
                (string) $res->headers->get('content-disposition'),
            );
        }
    }

    public function test_08_komponen_pts_mengalir_dari_peristiwa_pts(): void
    {
        $this->lembaga('MI', 'Madrasah Ibtidaiyah');
        $this->tahunAjaran();
        $this->tingkat('MI', ['1', '2', '3', '4', '5', '6']);
        $super = $this->superAdmin();

        $kelas = $this->kelas('6A', '6');
        $santri = $this->santriDiKelas('Santri PTS', '26001', $kelas->id, '6');
        [, $pengampu] = $this->mapelPengampu($kelas->id, 'Fiqih');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/bawaan', ['jenjang' => 'MI', 'tahun_ajaran' => self::TA])
            ->assertStatus(200);

        $pts = PeristiwaNilai::where('kode', 'PTS')->first();
        $asas = PeristiwaNilai::where('kode', 'ASAS')->first();

        DB::table('nilai_santri')->insert([
            'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampu->id,
            'tahun_ajaran' => self::TA, 'semester' => '1', 'peristiwa_id' => $pts->id,
            'nilai_akhir' => 90, 'sumber' => 'impor', 'predikat' => 'B',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $skor = ['Harian' => 80, 'Tugas' => 90, 'Sumatif' => 100];
        foreach (KomponenNilai::where('peristiwa_id', $asas->id)->get() as $k) {
            if (! isset($skor[$k->nama])) {
                continue;
            }
            NilaiKomponen::create([
                'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampu->id,
                'tahun_ajaran' => self::TA, 'semester' => '1',
                'komponen_nilai_id' => $k->id, 'skor' => $skor[$k->nama],
            ]);
        }

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/hitung', ['peristiwa_id' => $asas->id, 'semester' => '1'])
            ->assertStatus(200)
            ->assertJsonPath('dihitung', 1)
            ->assertJsonPath('belum_lengkap', 0);

        $this->assertSame(92.0, (float) DB::table('nilai_santri')
            ->where('santri_id', $santri->id)->where('peristiwa_id', $asas->id)->value('nilai_akhir'));
    }
}

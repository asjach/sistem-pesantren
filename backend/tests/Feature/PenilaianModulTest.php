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

    // ---------- helpers ----------

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

    // ---------- 01. bawaan peristiwa ----------

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
        // Rapor: PTS = sementara, ASAS/ASAT = akhir; UJIAN/UAP nilai ujian saja.
        $this->assertSame(
            ['sementara', 'akhir', 'akhir', 'tidak_ada', 'tidak_ada'],
            $peristiwa->pluck('jenis_rapor')->all(),
        );

        // PTS: satu komponen bernilai penuh (rapor sementara).
        $pts = $peristiwa->firstWhere('kode', 'PTS');
        $this->assertSame(100.0, (float) KomponenNilai::where('peristiwa_id', $pts->id)->sum('bobot'));

        // ASAS/ASAT/UAP: komponen sumatif Harian 20 + Tugas 20 + PTS 20 + Sumatif 40.
        $asas = $peristiwa->firstWhere('kode', 'ASAS');
        $this->assertSame(100.0, (float) KomponenNilai::where('peristiwa_id', $asas->id)->sum('bobot'));

        // Komponen "PTS" di ASAS BERSUMBER dari peristiwa PTS → guru input sekali.
        $komponenPts = KomponenNilai::where('peristiwa_id', $asas->id)->where('nama', 'PTS')->first();
        $this->assertNotNull($komponenPts);
        $this->assertSame(KomponenNilai::PERISTIWA, $komponenPts->sumber);
        $this->assertSame($pts->id, $komponenPts->peristiwa_sumber_id);

        // UJIAN: UM manual + Rata-rata Rapor otomatis (2 tingkat sebelumnya).
        $ujian = $peristiwa->firstWhere('kode', 'UJIAN');
        $rapor = KomponenNilai::where('peristiwa_id', $ujian->id)->where('nama', 'Rata-rata Rapor')->first();
        $this->assertNotNull($rapor);
        $this->assertSame(KomponenNilai::RAPOR_OTOMATIS, $rapor->sumber);
        $this->assertSame(2, $rapor->jumlah_tingkat_rapor);

        // KKM AKHIR + predikat ikut dibuat per peristiwa.
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

    // ---------- 03. cakupan tingkat akhir di leger ----------

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

        // ASAS (semua) → kedua santri.
        $asas = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/penilaian/leger?jenjang=MI&tahun_ajaran='.urlencode(self::TA)."&semester=1&peristiwa_id={$id('ASAS')}")
            ->assertStatus(200)->json();
        $this->assertSame(2, $asas['total']);

        // ASAT (kecuali tingkat akhir) → hanya tingkat 5.
        $asat = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/penilaian/leger?jenjang=MI&tahun_ajaran='.urlencode(self::TA)."&semester=1&peristiwa_id={$id('ASAT')}")
            ->assertStatus(200)->json();
        $this->assertSame(1, $asat['total']);
        $this->assertSame('5', $asat['baris'][0]['tingkat']);

        // UJIAN (hanya tingkat akhir) → hanya tingkat 6.
        $ujian = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/penilaian/leger?jenjang=MI&tahun_ajaran='.urlencode(self::TA)."&semester=1&peristiwa_id={$id('UJIAN')}")
            ->assertStatus(200)->json();
        $this->assertSame(1, $ujian['total']);
        $this->assertSame('6', $ujian['baris'][0]['tingkat']);
    }

    // ---------- 04. hitung nilai akhir dari komponen ----------

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

        // 80×20% + 90×20% + 70×20% + 100×40% = 88
        $this->assertDatabaseHas('nilai_santri', [
            'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampu->id,
            'peristiwa_id' => $asas->id, 'semester' => '1', 'nilai_akhir' => 88, 'sumber' => 'hitung',
        ]);
        // KKM AKHIR 75: 88 ≥ 75+10 (offset B) tapi < 75+20 (offset A) → B.
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

        // Baris nilai akhir hasil impor.
        DB::table('nilai_santri')->insert([
            'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampu->id,
            'tahun_ajaran' => self::TA, 'semester' => '1', 'peristiwa_id' => $asas->id,
            'nilai_akhir' => 95, 'sumber' => 'impor', 'predikat' => 'A',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        // Semua komponen terisi → hitung akan menghasilkan 88 bila TIDAK dilewati.
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

        // Nilai impor tetap utuh.
        $this->assertSame(95.0, (float) DB::table('nilai_santri')
            ->where('santri_id', $santri->id)->where('peristiwa_id', $asas->id)->value('nilai_akhir'));

        // Dengan paksa=1, hitungan menimpa impor.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/penilaian/hitung', ['peristiwa_id' => $asas->id, 'semester' => '1', 'paksa' => true])
            ->assertStatus(200)
            ->assertJsonPath('dihitung', 1);
        $this->assertSame('hitung', DB::table('nilai_santri')
            ->where('santri_id', $santri->id)->where('peristiwa_id', $asas->id)->value('sumber'));
    }

    // ---------- 06. rapor per peristiwa ----------

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

    // ---------- 07. peristiwa tanpa rapor ditolak di endpoint rapor ----------

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

        // UJIAN = nilai ujian/ijazah, bukan rapor → 422 dengan pesan jelas.
        $ujian = PeristiwaNilai::where('kode', 'UJIAN')->first();
        $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/penilaian/rapor?santri_id={$santri->id}&peristiwa_id={$ujian->id}&semester=1")
            ->assertStatus(422)
            ->assertJsonValidationErrors('peristiwa_id');

        // raporKelas pun menolak peristiwa yang sama.
        $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/penilaian/rapor-kelas?peristiwa_id={$ujian->id}&semester=1&kelas_id={$kelas->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('peristiwa_id');

        // ASAS (rapor akhir) tetap boleh.
        $asas = PeristiwaNilai::where('kode', 'ASAS')->first();
        $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/penilaian/rapor?santri_id={$santri->id}&peristiwa_id={$asas->id}&semester=1")
            ->assertStatus(200);
    }

    // ---------- 08. komponen PTS mengalir dari peristiwa PTS ----------

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

        // Nilai PTS peristiwa untuk mapel Fiqih = 90 (diisi sekali, mis. impor).
        DB::table('nilai_santri')->insert([
            'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampu->id,
            'tahun_ajaran' => self::TA, 'semester' => '1', 'peristiwa_id' => $pts->id,
            'nilai_akhir' => 90, 'sumber' => 'impor', 'predikat' => 'B',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        // Komponen ASAS lain diisi; komponen "PTS" DIBIARKAN KOSONG → otomatis.
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

        // 80×20% + 90×20% + 90(PTS otomatis)×20% + 100×40% = 92
        $this->assertSame(92.0, (float) DB::table('nilai_santri')
            ->where('santri_id', $santri->id)->where('peristiwa_id', $asas->id)->value('nilai_akhir'));
    }
}

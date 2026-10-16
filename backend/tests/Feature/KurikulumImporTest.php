<?php

namespace Tests\Feature;

use App\Exports\MapelTemplateExport;
use App\Exports\PengampuTemplateExport;
use App\Models\KeaktifanPegawai;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\MataPelajaran;
use App\Models\Pegawai;
use App\Models\PengampuMapel;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Import bertahap mapel & pengampu (mesin import-potong): template kontrak
 * header, periksa kering tanpa menulis, eksekusi upsert + idempoten,
 * galat per baris + unduh CSV, izin per baris, resolusi guru NIP/nama.
 */
class KurikulumImporTest extends TestCase
{
    use RefreshDatabase;

    private const TA = '2026/2027';

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    private function superAdmin(): User
    {
        $this->seq++;
        $u = User::create([
            'name' => 'Super '.$this->seq,
            'email' => "kurimpor{$this->seq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9400000000 + $this->seq * 77), 10, '0', STR_PAD_LEFT),
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

    private function dasar(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
    }

    private function guru(string $nama, string $nip = ''): KeaktifanPegawai
    {
        $this->seq++;
        $p = Pegawai::create([
            'nama_lengkap' => $nama.' '.$this->seq, 'jenis_kelamin' => 'L',
            'nip' => $nip !== '' ? $nip : null,
        ]);

        return KeaktifanPegawai::create([
            'pegawai_id' => $p->id, 'jenjang' => 'MI', 'tahun_ajaran' => self::TA,
            'status_keaktifan' => KeaktifanPegawai::AKTIF,
        ]);
    }

    /** Kirim satu potongan (periksa/eksekusi) ke endpoint mapel. */
    private function potongMapel(User $auth, array $baris, string $mode, ?int $sesi = null): array
    {
        $payload = ['mode' => $mode, 'baris' => $baris, 'terakhir' => true];
        if ($sesi === null) {
            $payload['total'] = count($baris);
        } else {
            $payload['sesi_id'] = $sesi;
        }

        return $this->actingAs($auth, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel/import-potong', $payload)
            ->assertStatus(200)->json();
    }

    /** Kirim satu potongan (periksa/eksekusi) ke endpoint pengampu. */
    private function potongPengampu(User $auth, array $baris, string $mode, ?int $sesi = null): array
    {
        $payload = ['mode' => $mode, 'baris' => $baris, 'terakhir' => true];
        if ($sesi === null) {
            $payload['total'] = count($baris);
        } else {
            $payload['sesi_id'] = $sesi;
        }

        return $this->actingAs($auth, 'sanctum')
            ->postJson('/api/admin/kurikulum/pengampu/import-potong', $payload)
            ->assertStatus(200)->json();
    }

    // ---------- 01. kontrak header template ----------

    public function test_01_template_kolom_dan_heading_sejajar(): void
    {
        $this->assertSame(
            ['jenjang', 'nama_mapel', 'kelompok', 'kode_mapel', 'is_active'],
            MapelTemplateExport::kolom()
        );
        $this->assertSame(MapelTemplateExport::kolom(), (new MapelTemplateExport)->headings());
        foreach (MapelTemplateExport::WAJIB as $k) {
            $this->assertContains($k, MapelTemplateExport::kolom(), "mapel.{$k}");
        }

        $this->assertSame(
            ['jenjang', 'tahun_ajaran', 'nama_kelas', 'nama_mapel', 'guru'],
            PengampuTemplateExport::kolom()
        );
        $this->assertSame(PengampuTemplateExport::kolom(), (new PengampuTemplateExport)->headings());
        foreach (PengampuTemplateExport::WAJIB as $k) {
            $this->assertContains($k, PengampuTemplateExport::kolom(), "pengampu.{$k}");
        }
    }

    // ---------- 02. mapel: periksa kering + eksekusi upsert ----------

    public function test_02_mapel_periksa_kering_lalu_eksekusi_upsert_idempoten(): void
    {
        $this->dasar();
        $super = $this->superAdmin();
        $baris = [
            ['jenjang' => 'MI', 'nama_mapel' => 'Matematika', 'kelompok' => 'formal', 'kode_mapel' => 'MTK', 'is_active' => 'Ya'],
            ['jenjang' => 'MI', 'nama_mapel' => 'Fiqih', 'kelompok' => 'pesantren', 'kode_mapel' => '', 'is_active' => ''],
        ];

        $periksa = $this->potongMapel($super, $baris, 'periksa');
        $this->assertSame(2, $periksa['ringkasan']['dibuat']);
        $this->assertSame(0, MataPelajaran::count());

        $eksekusi = $this->potongMapel($super, $baris, 'eksekusi');
        $this->assertSame(2, $eksekusi['ringkasan']['dibuat']);
        $this->assertSame(2, MataPelajaran::count());
        $this->assertSame('MTK', MataPelajaran::where('nama_mapel', 'Matematika')->first()->kode_mapel);
        // Kosong = default aktif.
        $this->assertTrue(MataPelajaran::where('nama_mapel', 'Fiqih')->first()->is_active);

        // Sesi baru dengan baris sama: cocok semua, tanpa perubahan → dilewati.
        $ulang = $this->potongMapel($super, $baris, 'eksekusi');
        $this->assertSame(0, $ulang['ringkasan']['dibuat']);
        $this->assertSame(2, $ulang['ringkasan']['baris_dilewati']);
        $this->assertSame(2, MataPelajaran::count());

        // Update: kelompok berubah + nonaktifkan (kode kosong = pertahankan).
        $ubah = $this->potongMapel($super, [
            ['jenjang' => 'MI', 'nama_mapel' => 'Matematika', 'kelompok' => 'pesantren', 'kode_mapel' => '', 'is_active' => 'Tidak'],
        ], 'eksekusi');
        $this->assertSame(1, $ubah['ringkasan']['diperbarui']);
        $m = MataPelajaran::where('nama_mapel', 'Matematika')->first();
        $this->assertSame('pesantren', $m->kelompok);
        $this->assertFalse($m->is_active);
        $this->assertSame('MTK', $m->kode_mapel);
    }

    // ---------- 03. mapel: galat per baris + unduh CSV + izin ----------

    public function test_03_mapel_galat_per_baris_dan_unduh_csv(): void
    {
        $this->dasar();
        $this->lembaga('MD');
        $super = $this->superAdmin();
        $hasil = $this->potongMapel($super, [
            ['jenjang' => 'MI', 'nama_mapel' => 'Matematika', 'kelompok' => 'formal'],
            ['jenjang' => 'XXX', 'nama_mapel' => 'Salah', 'kelompok' => 'formal'],
            ['jenjang' => 'MI', 'nama_mapel' => 'Aneh', 'kelompok' => 'sains'],
            ['jenjang' => 'MI', 'nama_mapel' => '', 'kelompok' => 'formal'],
        ], 'eksekusi');

        $this->assertSame(1, $hasil['ringkasan']['dibuat']);
        $this->assertSame(2, $hasil['ringkasan']['baris_gagal']);
        $this->assertTrue($hasil['galat_unduh']);

        $csv = $this->actingAs($super, 'sanctum')
            ->get("/api/admin/kurikulum/mapel/import-potong/{$hasil['sesi_id']}/galat")
            ->assertStatus(200)->streamedContent() ?: '';
        $this->assertStringContainsString('Lembaga tidak valid', $csv);
        $this->assertStringContainsString('Kelompok harus formal/pesantren', $csv);
        // Nomor galat absolut selaras nomor file (heading = 1).
        $this->assertStringContainsString('3,', $csv);
        $this->assertStringContainsString('4,', $csv);
        $this->assertSame(1, MataPelajaran::count());
    }

    public function test_04_mapel_izin_per_baris_admin_scoped(): void
    {
        $this->dasar();
        // MD berpasangan dengan MI (tetap terlihat admin MI) — MTS di luar lingkup.
        $this->lembaga('MTS');
        $admin = User::create([
            'name' => 'Admin MI', 'email' => 'adminmi_'.uniqid().'@example.com',
            'phone' => '081200000001', 'password' => 'password',
        ]);
        $admin->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $admin->id, 'jenjang' => 'MI',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $hasil = $this->potongMapel($admin, [
            ['jenjang' => 'MI', 'nama_mapel' => 'Matematika', 'kelompok' => 'formal'],
            ['jenjang' => 'MTS', 'nama_mapel' => 'Fiqih', 'kelompok' => 'pesantren'],
        ], 'eksekusi');

        $this->assertSame(1, $hasil['ringkasan']['dibuat']);
        $this->assertSame(1, $hasil['ringkasan']['baris_gagal']);
        $this->assertSame('MI', MataPelajaran::first()->jenjang);
    }

    // ---------- 05. pengampu: resolusi nama + guru NIP/nama ----------

    public function test_05_pengampu_eksekusi_resolusi_kelas_mapel_guru(): void
    {
        $this->dasar();
        $super = $this->superAdmin();
        $kelas = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '1A', 'tingkat' => '1',
        ]);
        MataPelajaran::create(['jenjang' => 'MI', 'nama_mapel' => 'Matematika', 'kelompok' => 'formal']);
        MataPelajaran::create(['jenjang' => 'MI', 'nama_mapel' => 'Fiqih', 'kelompok' => 'pesantren']);
        $guru = $this->guru('Ust Ahmad', '198001012010011001');
        $namaGuru = $guru->pegawai->nama_lengkap;

        $periksa = $this->potongPengampu($super, [
            ['jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '1A', 'nama_mapel' => 'Matematika', 'guru' => '198001012010011001'],
            ['jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '1A', 'nama_mapel' => 'Fiqih', 'guru' => $namaGuru],
            ['jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '1A', 'nama_mapel' => 'Fiqih', 'guru' => $namaGuru],
        ], 'periksa');
        $this->assertSame(2, $periksa['ringkasan']['dibuat']);
        $this->assertSame(1, $periksa['ringkasan']['baris_dilewati']);
        $this->assertSame(0, PengampuMapel::count());

        $eksekusi = $this->potongPengampu($super, [
            ['jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '1A', 'nama_mapel' => 'Matematika', 'guru' => '198001012010011001'],
            ['jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '1A', 'nama_mapel' => 'Fiqih', 'guru' => $namaGuru],
        ], 'eksekusi');
        $this->assertSame(2, $eksekusi['ringkasan']['dibuat']);
        $this->assertSame(2, PengampuMapel::where('kelas_id', $kelas->id)->count());
        // NIP dan nama menyelesaikan ke keaktifan yang sama.
        $this->assertSame(
            [$guru->id],
            PengampuMapel::where('kelas_id', $kelas->id)->pluck('keaktifan_pegawai_id')->unique()->values()->all()
        );

        // Sesi idempoten: guru sama → dilewati.
        $ulang = $this->potongPengampu($super, [
            ['jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '1A', 'nama_mapel' => 'Matematika', 'guru' => '198001012010011001'],
        ], 'eksekusi');
        $this->assertSame(1, $ulang['ringkasan']['baris_dilewati']);

        // Ganti guru → diperbarui.
        $baru = $this->guru('Ust Baru', '198002022011022002');
        $ganti = $this->potongPengampu($super, [
            ['jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '1A', 'nama_mapel' => 'Matematika', 'guru' => '198002022011022002'],
        ], 'eksekusi');
        $this->assertSame(1, $ganti['ringkasan']['diperbarui']);
        $this->assertSame($baru->id, PengampuMapel::where('kelas_id', $kelas->id)
            ->whereHas('mataPelajaran', fn ($q) => $q->where('nama_mapel', 'Matematika'))
            ->first()->keaktifan_pegawai_id);
    }

    // ---------- 06. pengampu: galat resolusi ----------

    public function test_06_pengampu_galat_kelas_mapel_guru(): void
    {
        $this->dasar();
        $super = $this->superAdmin();
        Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '1A', 'tingkat' => '1',
        ]);
        MataPelajaran::create(['jenjang' => 'MI', 'nama_mapel' => 'Matematika', 'kelompok' => 'formal', 'is_active' => false]);

        $hasil = $this->potongPengampu($super, [
            ['jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '9Z', 'nama_mapel' => 'Matematika', 'guru' => ''],
            ['jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '1A', 'nama_mapel' => 'Biologi', 'guru' => ''],
            ['jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '1A', 'nama_mapel' => 'Matematika', 'guru' => ''],
            ['jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '1A', 'nama_mapel' => 'Matematika', 'guru' => 'Hantu Takada'],
        ], 'eksekusi', null);

        $this->assertSame(0, $hasil['ringkasan']['dibuat']);
        $this->assertSame(4, $hasil['ringkasan']['baris_gagal']);
        $contoh = collect($hasil['galat_contoh']);
        $this->assertTrue($contoh->contains(fn ($g) => str_contains($g['pesan'], 'Kelas')));
        $this->assertTrue($contoh->contains(fn ($g) => str_contains($g['pesan'], 'tidak ditemukan di MI')));
        $this->assertTrue($contoh->contains(fn ($g) => str_contains($g['pesan'], 'nonaktif')));
        $this->assertSame(0, PengampuMapel::count());
    }

    // ---------- 07. duplikat nama ditolak 422 (bukan 500) ----------

    public function test_07_mapel_duplikat_nama_ditolak(): void
    {
        $this->dasar();
        $super = $this->superAdmin();

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel', ['jenjang' => 'MI', 'nama_mapel' => 'Fiqih', 'kelompok' => 'formal'])
            ->assertStatus(201);
        // Nama sama (beda kapitalisasi ikut tertolak di collation ci).
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/mapel', ['jenjang' => 'MI', 'nama_mapel' => 'fiqih', 'kelompok' => 'pesantren'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('nama_mapel');

        $lain = MataPelajaran::create(['jenjang' => 'MI', 'nama_mapel' => 'Nahwu', 'kelompok' => 'pesantren']);
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$lain->id}", ['nama_mapel' => 'Fiqih'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('nama_mapel');
        // Nama sendiri (tak berubah) tetap lolos.
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/mapel/{$lain->id}", ['nama_mapel' => 'Nahwu'])
            ->assertStatus(200);
    }
}

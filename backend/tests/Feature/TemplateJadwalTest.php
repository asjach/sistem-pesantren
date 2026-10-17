<?php

namespace Tests\Feature;

use App\Models\JadwalPelajaran;
use App\Models\KeaktifanPegawai;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\MataPelajaran;
use App\Models\Pegawai;
use App\Models\PengampuMapel;
use App\Models\SlotJamPelajaran;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

/**
 * Template jadwal mingguan (tanpa mapel/guru) + generator jadwal per kelas:
 *  - baris template = hari + jam ke- + jam + jenis; hari null = semua hari;
 *  - lingkup template = jenjang / tingkat / kelas;
 *  - Terapkan memilih sasaran kelas/tingkat/jenjang, membuat slot dan
 *    mengisi pelajaran dari pengampu kelas sesuai `jp_per_minggu`
 *    (fallback bergilir merata);
 *  - istirahat/pembiasaan jadi slot non-pelajaran tanpa jadwal;
 *  - bentrok guru/kelas tetap ditolak dan dilaporkan.
 *
 * Hari libur mingguan diuji di kelas ini juga.
 */
class TemplateJadwalTest extends TestCase
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
            'email' => "template{$this->seq}_".uniqid().'@example.com',
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

    private function kelas(string $nama, string $tingkat, string $jenjang = 'MI'): Kelas
    {
        return Kelas::create([
            'jenjang' => $jenjang, 'tahun_ajaran' => self::TA, 'nama_kelas' => $nama, 'tingkat' => $tingkat,
        ]);
    }

    private function mapel(string $nama): MataPelajaran
    {
        return MataPelajaran::create(['jenjang' => 'MI', 'nama_mapel' => $nama, 'kelompok' => 'formal']);
    }

    private function guru(): int
    {
        $p = Pegawai::create([
            'nama_lengkap' => 'Guru '.$this->seq++,
            'jenis_kelamin' => 'L',
        ]);

        return KeaktifanPegawai::create([
            'pegawai_id' => $p->id, 'jenjang' => 'MI', 'tahun_ajaran' => self::TA,
            'status_keaktifan' => KeaktifanPegawai::AKTIF,
        ])->id;
    }

    /** Tambah pengampu tanpa menghapus pengampu kelas yang sudah ada. */
    private function pengampu(User $super, Kelas $kelas, MataPelajaran $mapel, ?int $jp = null, ?int $guru = null): int
    {
        $baris = PengampuMapel::where('kelas_id', $kelas->id)
            ->get()
            ->map(fn (PengampuMapel $p) => [
                'mata_pelajaran_id' => $p->mata_pelajaran_id,
                'keaktifan_pegawai_id' => $p->keaktifan_pegawai_id,
                'jp_per_minggu' => $p->jp_per_minggu,
            ])->all();
        $baris[] = [
            'mata_pelajaran_id' => $mapel->id,
            'keaktifan_pegawai_id' => $guru,
            'jp_per_minggu' => $jp,
        ];
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/kurikulum/pengampu', [
            'kelas_id' => $kelas->id,
            'baris' => $baris,
        ])->assertStatus(200);

        return (int) PengampuMapel::where('kelas_id', $kelas->id)
            ->where('mata_pelajaran_id', $mapel->id)->value('id');
    }

    /** Buat template + baris; mengembalikan id template. */
    private function template(User $super, string $nama, array $jam, array $scope = []): int
    {
        $t = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/template-jadwal', ['jenjang' => 'MI', 'nama' => $nama] + $scope)
            ->assertStatus(201)->json();

        foreach ($jam as $i => $b) {
            $this->actingAs($super, 'sanctum')
                ->postJson("/api/admin/kurikulum/template-jadwal/{$t['id']}/baris", $b + ['urutan_slot' => $i + 1])
                ->assertStatus(201);
        }

        return $t['id'];
    }

    private function terapkan(User $super, int $id, array $payload): array
    {
        return $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", $payload)
            ->assertStatus(200)->json();
    }

    public function test_crud_kerangka_mingguan_dan_lingkup(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $id = $this->template($super, 'Pola Tingkat 1', [
            ['hari' => 'senin', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
            ['hari' => 'senin', 'nama_slot' => 'Istirahat', 'jam_mulai' => '07:45', 'jam_selesai' => '08:00', 'jenis' => 'istirahat'],
            ['hari' => 'selasa', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
        ], ['tingkat' => '1']);

        // Nama unik per lingkup; lingkup berbeda boleh memakai nama yang sama.
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/template-jadwal', ['jenjang' => 'MI', 'tingkat' => '1', 'nama' => 'pola TINGKAT 1'])
            ->assertStatus(422)->assertJsonValidationErrors('nama');
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/template-jadwal', ['jenjang' => 'MI', 'nama' => 'Pola Tingkat 1'])
            ->assertStatus(201);

        $detail = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/template-jadwal/{$id}")
            ->assertStatus(200)->json();
        $this->assertCount(3, $detail['baris']);
        $this->assertSame('senin', $detail['baris'][0]['hari']);
        $this->assertContains('istirahat', array_column($detail['baris'], 'jenis'));

        // Jam selesai harus setelah jam mulai.
        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/baris", [
                'hari' => 'senin', 'urutan_slot' => 9, 'jam_mulai' => '08:00', 'jam_selesai' => '07:00',
            ])->assertStatus(422)->assertJsonValidationErrors('jam_selesai');

        // Jam ke- unik per hari; hari berbeda boleh nomor sama.
        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/baris", ['hari' => 'senin', 'urutan_slot' => 1])
            ->assertStatus(422)->assertJsonValidationErrors('urutan_slot');
        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/baris", ['hari' => 'rabu', 'urutan_slot' => 1])
            ->assertStatus(201);

        // Pindah hari baris tidak boleh menabrak pasangan (hari, urutan) lain.
        $barisId = $detail['baris'][1]['id'];
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/template-jadwal/baris/{$barisId}", ['hari' => 'kamis'])
            ->assertStatus(200)->assertJsonPath('hari', 'kamis');

        $this->actingAs($super, 'sanctum')
            ->deleteJson("/api/admin/kurikulum/template-jadwal/{$id}")->assertStatus(200);
        $this->assertDatabaseMissing('template_jadwal', ['id' => $id]);
    }

    public function test_terapkan_ke_kelas_membuat_jadwal_sesuai_kuota(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelas = $this->kelas('1A', '1');
        $this->pengampu($super, $kelas, $this->mapel('Fiqih'), 2);
        $this->pengampu($super, $kelas, $this->mapel('Matematika'), 1);

        $id = $this->template($super, 'Pola Senin', [
            ['hari' => 'senin', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
            ['hari' => 'senin', 'nama_slot' => 'Jam 2', 'jam_mulai' => '07:45', 'jam_selesai' => '08:30'],
            ['hari' => 'senin', 'nama_slot' => 'Jam 3', 'jam_mulai' => '08:30', 'jam_selesai' => '09:15'],
            ['hari' => 'senin', 'nama_slot' => 'Istirahat', 'jam_mulai' => '09:15', 'jam_selesai' => '09:30', 'jenis' => 'istirahat'],
        ]);

        $hasil = $this->terapkan($super, $id, ['sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id]);
        $this->assertSame(3, $hasil['dibuat']);
        $this->assertSame(4, $hasil['slot_dibuat']);
        $this->assertDatabaseCount('slot_jam_pelajaran', 4);
        $this->assertDatabaseCount('jadwal_pelajaran', 3);
        $this->assertSame('istirahat', SlotJamPelajaran::where('urutan', 4)->value('jenis'));

        $mapelPerUrutan = JadwalPelajaran::with('pengampuMapel.mataPelajaran:id,nama_mapel')
            ->whereIn('pengampu_mapel_id', PengampuMapel::where('kelas_id', $kelas->id)->pluck('id'))
            ->get()
            ->mapWithKeys(fn (JadwalPelajaran $j) => [
                SlotJamPelajaran::whereKey($j->slot_jam_id)->value('urutan') => $j->pengampuMapel?->mataPelajaran?->nama_mapel,
            ]);
        $this->assertSame('Fiqih', $mapelPerUrutan[1]);
        $this->assertSame('Fiqih', $mapelPerUrutan[2]);
        $this->assertSame('Matematika', $mapelPerUrutan[3]);

        // Tanpa timpa, kelas yang sudah berjadwal dilewati.
        $kedua = $this->terapkan($super, $id, ['sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id]);
        $this->assertSame(0, $kedua['dibuat']);
        $this->assertStringContainsString('sudah punya jadwal', $kedua['dilewati'][0]['alasan']);
        $this->assertDatabaseCount('jadwal_pelajaran', 3);

        // Timpa = ganti jadwal kelas, jumlah tetap 3.
        $ganti = $this->terapkan($super, $id, [
            'sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id, 'timpa' => true,
        ]);
        $this->assertSame(3, $ganti['dibuat']);
        $this->assertDatabaseCount('jadwal_pelajaran', 3);
    }

    public function test_tanpa_kuota_mapel_dibagi_bergilir(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();
        $kelas = $this->kelas('1A', '1');
        $this->pengampu($super, $kelas, $this->mapel('Fiqih'));
        $this->pengampu($super, $kelas, $this->mapel('Matematika'));

        $id = $this->template($super, 'Dua JP', [
            ['hari' => 'senin', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
            ['hari' => 'senin', 'nama_slot' => 'Jam 2', 'jam_mulai' => '07:45', 'jam_selesai' => '08:30'],
        ]);
        $hasil = $this->terapkan($super, $id, [
            'sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id,
        ]);
        $this->assertSame(2, $hasil['dibuat']);

        $mapel = JadwalPelajaran::with('pengampuMapel.mataPelajaran:id,nama_mapel')
            ->get()
            ->map(fn (JadwalPelajaran $j) => $j->pengampuMapel?->mataPelajaran?->nama_mapel)
            ->sort()->values()->all();
        $this->assertSame(['Fiqih', 'Matematika'], $mapel);
    }

    public function test_timpa_menghapus_slot_lama_yang_tidak_ada_di_template(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();
        $kelas = $this->kelas('1A', '1');
        $this->pengampu($super, $kelas, $this->mapel('Fiqih'));

        $id = $this->template($super, 'Satu Jam', [
            ['hari' => 'senin', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
        ]);
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/slot', [
            'jenjang' => 'MI', 'nama_slot' => 'Jam Lama',
            'jam_mulai' => '10:00', 'jam_selesai' => '10:45', 'urutan' => 9,
        ])->assertStatus(201);

        $hasil = $this->terapkan($super, $id, [
            'sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id, 'timpa' => true,
        ]);
        $this->assertSame(1, $hasil['slot_dihapus']);
        $this->assertDatabaseCount('slot_jam_pelajaran', 1);
        $this->assertDatabaseMissing('slot_jam_pelajaran', ['urutan' => 9]);
    }

    public function test_terapkan_ke_tingkat_dan_jenjang_banyak_kelas(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $a = $this->kelas('1A', '1');
        $b = $this->kelas('1B', '1');
        $this->pengampu($super, $a, $this->mapel('Fiqih'));
        $this->pengampu($super, $b, $this->mapel('Matematika'));

        $id = $this->template($super, 'Pola Satu JP', [
            ['hari' => 'senin', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
        ]);

        $tingkat = $this->terapkan($super, $id, [
            'sasaran' => 'tingkat', 'sasaran_id' => '1', 'tahun_ajaran' => self::TA,
        ]);
        $this->assertSame(2, $tingkat['kelas']);
        $this->assertSame(2, $tingkat['dibuat']);
        $this->assertDatabaseCount('jadwal_pelajaran', 2);

        $jenjang = $this->terapkan($super, $id, [
            'sasaran' => 'jenjang', 'sasaran_id' => 'MI', 'tahun_ajaran' => self::TA, 'timpa' => true,
        ]);
        $this->assertSame(2, $jenjang['kelas']);
        $this->assertSame(2, $jenjang['dibuat']);
        $this->assertDatabaseCount('jadwal_pelajaran', 2);
    }

    public function test_lingkup_template_menolak_sasaran_yang_tidak_cocok(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $a = $this->kelas('1A', '1');
        $b = $this->kelas('1B', '1');
        $id = $this->template($super, 'Khusus 1A', [
            ['hari' => 'senin', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
        ], ['kelas_id' => $a->id]);

        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", [
                'sasaran' => 'kelas', 'sasaran_id' => (string) $b->id,
            ])->assertStatus(422)->assertJsonValidationErrors('sasaran_id');
        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", [
                'sasaran' => 'tingkat', 'sasaran_id' => '1', 'tahun_ajaran' => self::TA,
            ])->assertStatus(422)->assertJsonValidationErrors('sasaran');
    }

    public function test_terapkan_menolak_slot_tidak_konsisten_antar_hari(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();
        $kelas = $this->kelas('1A', '1');
        $this->pengampu($super, $kelas, $this->mapel('Fiqih'));

        $id = $this->template($super, 'Tidak Konsisten', [
            ['hari' => 'senin', 'urutan_slot' => 1, 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
            ['hari' => 'selasa', 'urutan_slot' => 1, 'nama_slot' => 'Jam 1', 'jam_mulai' => '08:00', 'jam_selesai' => '08:45'],
        ]);

        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", [
                'sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id,
            ])->assertStatus(422)->assertJsonValidationErrors('template');
    }

    public function test_bentrok_guru_dilaporkan_saat_terapkan_banyak_kelas(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $guru = $this->guru();
        $mapel = $this->mapel('Fiqih');
        $a = $this->kelas('1A', '1');
        $b = $this->kelas('1B', '1');
        $this->pengampu($super, $a, $mapel, null, $guru);
        $this->pengampu($super, $b, $mapel, null, $guru);

        $id = $this->template($super, 'Pola Bentrok', [
            ['hari' => 'senin', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
        ]);

        $hasil = $this->terapkan($super, $id, [
            'sasaran' => 'tingkat', 'sasaran_id' => '1', 'tahun_ajaran' => self::TA,
        ]);
        $this->assertSame(1, $hasil['dibuat']);
        $this->assertCount(1, $hasil['dilewati']);
        $this->assertStringContainsString('sudah mengajar', $hasil['dilewati'][0]['alasan']);
    }

    public function test_template_nonaktif_tidak_bisa_diterapkan(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();
        $kelas = $this->kelas('1A', '1');

        $id = $this->template($super, 'Pola Pagi', [
            ['hari' => 'senin', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
        ]);

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/template-jadwal/{$id}", ['is_active' => false])
            ->assertStatus(200);
        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", [
                'sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id,
            ])->assertStatus(422)->assertJsonValidationErrors('template');
        $this->assertDatabaseCount('slot_jam_pelajaran', 0);

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/template-jadwal/{$id}", ['is_active' => true])
            ->assertStatus(200);
        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", [
                'sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id,
            ])->assertStatus(200);
        $this->assertDatabaseCount('slot_jam_pelajaran', 1);
    }

    public function test_hari_libur_disembunyikan_dan_ditolak_bila_terisi(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelas = $this->kelas('1A', '1');
        $pengampuId = $this->pengampu($super, $kelas, $this->mapel('Fiqih'));
        $slot = $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/slot', [
            'jenjang' => 'MI', 'nama_slot' => 'Jam 1',
            'jam_mulai' => '07:00', 'jam_selesai' => '07:45', 'urutan' => 1,
        ])->assertStatus(201)->json();

        // Isi Jumat dulu -> Jumat tak boleh dijadikan libur.
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/jadwal', [
            'pengampu_mapel_id' => $pengampuId, 'slot_jam_id' => $slot['id'], 'hari' => 'jumat',
        ])->assertStatus(201);
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/hari-libur', ['jenjang' => 'MI', 'hari_libur' => ['jumat']])
            ->assertStatus(422)->assertJsonValidationErrors('hari_libur');

        // Hapus jadwalnya -> Jumat bisa jadi libur & hilang dari matriks.
        $this->actingAs($super, 'sanctum')
            ->deleteJson('/api/admin/kurikulum/jadwal/'.JadwalPelajaran::value('id'))->assertStatus(200);
        $simpan = $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/hari-libur', ['jenjang' => 'MI', 'hari_libur' => ['jumat']])
            ->assertStatus(200)->json();
        $this->assertSame(['jumat'], $simpan['hari_libur']);
        $this->assertNotContains('jumat', $simpan['hari_aktif']);

        $jadwal = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/jadwal?kelas_id={$kelas->id}")
            ->assertStatus(200)->json();
        $this->assertNotContains('jumat', $jadwal['hari']);
        $this->assertSame(['jumat'], $jadwal['hari_libur']);

        // Jadwal baru di hari libur ditolak; semua hari libur juga ditolak.
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/jadwal', [
            'pengampu_mapel_id' => $pengampuId, 'slot_jam_id' => $slot['id'], 'hari' => 'jumat',
        ])->assertStatus(422)->assertJsonValidationErrors('hari');
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/hari-libur', [
                'jenjang' => 'MI',
                'hari_libur' => JadwalPelajaran::HARI,
            ])->assertStatus(422)->assertJsonValidationErrors('hari_libur');
    }

    public function test_mapel_sama_bisa_dipakai_di_dua_slot(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelas = $this->kelas('1A', '1');
        $pengampuId = $this->pengampu($super, $kelas, $this->mapel('Fiqih'));

        $slot1 = $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/slot', [
            'jenjang' => 'MI', 'nama_slot' => 'Jam 1',
            'jam_mulai' => '07:00', 'jam_selesai' => '07:45', 'urutan' => 1,
        ])->assertStatus(201)->json();
        $slot2 = $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/slot', [
            'jenjang' => 'MI', 'nama_slot' => 'Jam 2',
            'jam_mulai' => '07:45', 'jam_selesai' => '08:30', 'urutan' => 2,
        ])->assertStatus(201)->json();

        foreach ([$slot1, $slot2] as $slot) {
            $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/jadwal', [
                'pengampu_mapel_id' => $pengampuId, 'slot_jam_id' => $slot['id'], 'hari' => 'senin',
            ])->assertStatus(201);
        }

        $jadwal = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/jadwal?kelas_id={$kelas->id}")
            ->assertStatus(200)->json();
        $this->assertCount(2, $jadwal['baris']);
        $this->assertSame(['Fiqih', 'Fiqih'], array_column($jadwal['baris'], 'nama_mapel'));

        // Slot + hari yang sama tetap tidak boleh dobel.
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/jadwal', [
            'pengampu_mapel_id' => $pengampuId, 'slot_jam_id' => $slot1['id'], 'hari' => 'senin',
        ])->assertStatus(422)->assertJsonValidationErrors('slot_jam_id');
    }

    public function test_slot_non_pelajaran_tidak_bisa_diisi_jadwal(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelas = $this->kelas('1A', '1');
        $pengampuId = $this->pengampu($super, $kelas, $this->mapel('Fiqih'));

        $pembiasaan = $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/slot', [
            'jenjang' => 'MI', 'nama_slot' => 'Pembiasaan', 'jenis' => 'pembiasaan',
            'jam_mulai' => '07:45', 'jam_selesai' => '08:00', 'urutan' => 2,
        ])->assertStatus(201)->json();
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/jadwal', [
            'pengampu_mapel_id' => $pengampuId, 'slot_jam_id' => $pembiasaan['id'], 'hari' => 'senin',
        ])->assertStatus(422)->assertJsonValidationErrors('slot_jam_id');

        // Slot pelajaran yang sudah dipakai tidak boleh diubah jadi non-pelajaran.
        $pelajaran = $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/slot', [
            'jenjang' => 'MI', 'nama_slot' => 'Jam 1', 'jenis' => 'pelajaran',
            'jam_mulai' => '07:00', 'jam_selesai' => '07:45', 'urutan' => 1,
        ])->assertStatus(201)->json();
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/jadwal', [
            'pengampu_mapel_id' => $pengampuId, 'slot_jam_id' => $pelajaran['id'], 'hari' => 'senin',
        ])->assertStatus(201);
        $this->actingAs($super, 'sanctum')->putJson("/api/admin/kurikulum/slot/{$pelajaran['id']}", [
            'jenis' => 'istirahat',
        ])->assertStatus(422)->assertJsonValidationErrors('jenis');
    }
}

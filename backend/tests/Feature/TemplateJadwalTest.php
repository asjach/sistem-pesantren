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
 * Template jadwal mingguan = frame JP kosong per kelas:
 *  - baris template = hari + jam ke- + jam + jenis; hari null = semua hari;
 *  - lingkup template = jenjang / tingkat / kelas;
 *  - Terapkan memilih sasaran kelas/tingkat/jenjang dan membuat slot milik
 *    tiap kelas; mapel/guru diisi manual di matriks (tanpa auto-fill);
 *  - jam, jenis, dan jumlah JP boleh berbeda per hari/kelas;
 *  - istirahat/pembiasaan jadi slot non-pelajaran tanpa jadwal.
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
    private function pengampu(User $super, Kelas $kelas, MataPelajaran $mapel): int
    {
        $baris = PengampuMapel::where('kelas_id', $kelas->id)
            ->get()
            ->map(fn (PengampuMapel $p) => [
                'mata_pelajaran_id' => $p->mata_pelajaran_id,
                'keaktifan_pegawai_id' => $p->keaktifan_pegawai_id,
            ])->all();
        $baris[] = [
            'mata_pelajaran_id' => $mapel->id,
            'keaktifan_pegawai_id' => null,
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

    public function test_terapkan_ke_kelas_membuat_frame_kosong_per_hari(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $kelas = $this->kelas('1A', '1');
        $lain = $this->kelas('1B', '1');
        $pengampuId = $this->pengampu($super, $kelas, $this->mapel('Fiqih'));
        $pengampuLain = $this->pengampu($super, $lain, $this->mapel('Matematika'));

        $id = $this->template($super, 'Pola Mingguan', [
            ['hari' => 'senin', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
            ['hari' => 'senin', 'nama_slot' => 'Jam 2', 'jam_mulai' => '07:45', 'jam_selesai' => '08:30'],
            ['hari' => 'senin', 'nama_slot' => 'Istirahat', 'jam_mulai' => '08:30', 'jam_selesai' => '08:45', 'jenis' => 'istirahat'],
            ['hari' => 'sabtu', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
        ]);

        $hasil = $this->terapkan($super, $id, ['sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id]);
        $this->assertSame(4, $hasil['slot_dibuat']);
        $this->assertSame(0, $hasil['dibuat']);
        $this->assertDatabaseCount('slot_jam_pelajaran', 4);
        $this->assertDatabaseCount('jadwal_pelajaran', 0);
        $this->assertSame(3, SlotJamPelajaran::where('kelas_id', $kelas->id)->where('hari', 'senin')->count());
        $this->assertSame(1, SlotJamPelajaran::where('kelas_id', $kelas->id)->where('hari', 'sabtu')->count());

        // Matriks kelas 1A memakai frame miliknya sendiri dan masih kosong.
        $resp = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/jadwal?kelas_id={$kelas->id}")
            ->assertStatus(200)->json();
        $this->assertCount(4, $resp['slot']);
        $this->assertCount(0, $resp['baris']);
        $this->assertSame(['senin', 'senin', 'senin', 'sabtu'], array_column($resp['slot'], 'hari'));

        // Isi satu sel manual dengan pengampu (mapel + guru).
        $slotSenin = SlotJamPelajaran::where('kelas_id', $kelas->id)
            ->where('hari', 'senin')->where('urutan', 1)->firstOrFail();
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/jadwal', [
            'pengampu_mapel_id' => $pengampuId, 'slot_jam_id' => $slotSenin->id, 'hari' => 'senin',
        ])->assertStatus(201);
        $resp2 = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/jadwal?kelas_id={$kelas->id}")
            ->assertStatus(200)->json();
        $this->assertCount(1, $resp2['baris']);
        $this->assertSame('Fiqih', $resp2['baris'][0]['nama_mapel']);

        // Kelas lain tidak melihat frame 1A dan tidak boleh memakai slotnya.
        $respB = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/jadwal?kelas_id={$lain->id}")
            ->assertStatus(200)->json();
        $this->assertCount(0, $respB['slot']);
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/jadwal', [
            'pengampu_mapel_id' => $pengampuLain, 'slot_jam_id' => $slotSenin->id, 'hari' => 'senin',
        ])->assertStatus(422)->assertJsonValidationErrors('slot_jam_id');
    }

    public function test_terapkan_menghormati_jumlah_dan_jam_berbeda_per_hari(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();
        $kelas = $this->kelas('1A', '1');
        $this->pengampu($super, $kelas, $this->mapel('Fiqih'));

        $id = $this->template($super, 'Beda Hari', [
            ['hari' => 'senin', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
            ['hari' => 'senin', 'nama_slot' => 'Jam 2', 'jam_mulai' => '07:45', 'jam_selesai' => '08:30'],
            ['hari' => 'senin', 'nama_slot' => 'Jam 3', 'jam_mulai' => '08:30', 'jam_selesai' => '09:15'],
            ['hari' => 'selasa', 'nama_slot' => 'Jam 1', 'jam_mulai' => '08:00', 'jam_selesai' => '08:45'],
            ['hari' => 'sabtu', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
            ['hari' => 'sabtu', 'nama_slot' => 'Jam 2', 'jam_mulai' => '07:45', 'jam_selesai' => '08:30'],
        ]);

        $hasil = $this->terapkan($super, $id, ['sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id]);
        $this->assertSame(6, $hasil['slot_dibuat']);
        $this->assertSame(3, SlotJamPelajaran::where('kelas_id', $kelas->id)->where('hari', 'senin')->count());
        $this->assertSame(1, SlotJamPelajaran::where('kelas_id', $kelas->id)->where('hari', 'selasa')->count());
        $this->assertSame(2, SlotJamPelajaran::where('kelas_id', $kelas->id)->where('hari', 'sabtu')->count());

        // Jam boleh berbeda antar hari (frame per kelas/hari).
        $selasa = SlotJamPelajaran::where('kelas_id', $kelas->id)->where('hari', 'selasa')->firstOrFail();
        $this->assertSame('08:00', substr((string) $selasa->jam_mulai, 0, 5));
    }

    public function test_timpa_mengosongkan_jadwal_dan_mengganti_frame(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();
        $kelas = $this->kelas('1A', '1');
        $pengampuId = $this->pengampu($super, $kelas, $this->mapel('Fiqih'));

        $id = $this->template($super, 'Dua Jam', [
            ['hari' => 'senin', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
            ['hari' => 'senin', 'nama_slot' => 'Jam 2', 'jam_mulai' => '07:45', 'jam_selesai' => '08:30'],
        ]);
        $this->terapkan($super, $id, ['sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id]);

        $slot = SlotJamPelajaran::where('kelas_id', $kelas->id)->where('urutan', 1)->firstOrFail();
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/jadwal', [
            'pengampu_mapel_id' => $pengampuId, 'slot_jam_id' => $slot->id, 'hari' => 'senin',
        ])->assertStatus(201);
        SlotJamPelajaran::create([
            'jenjang' => 'MI', 'kelas_id' => $kelas->id, 'hari' => 'senin',
            'nama_slot' => 'Slot Lama', 'urutan' => 9,
        ]);

        $tanpaTimpa = $this->terapkan($super, $id, ['sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id]);
        $this->assertCount(1, $tanpaTimpa['dilewati']);
        $this->assertDatabaseCount('jadwal_pelajaran', 1);

        $ganti = $this->terapkan($super, $id, [
            'sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id, 'timpa' => true,
        ]);
        $this->assertSame(2, $ganti['slot_dibuat']);
        $this->assertSame(3, $ganti['slot_dihapus']);
        $this->assertDatabaseCount('jadwal_pelajaran', 0);
        $this->assertDatabaseCount('slot_jam_pelajaran', 2);
    }

    public function test_terapkan_ke_tingkat_dan_jenjang_membuat_frame_banyak_kelas(): void
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
        $this->assertSame(2, $tingkat['slot_dibuat']);
        $this->assertDatabaseCount('jadwal_pelajaran', 0);
        $this->assertSame(2, SlotJamPelajaran::whereNotNull('kelas_id')->count());

        $jenjang = $this->terapkan($super, $id, [
            'sasaran' => 'jenjang', 'sasaran_id' => 'MI', 'tahun_ajaran' => self::TA, 'timpa' => true,
        ]);
        $this->assertSame(2, $jenjang['kelas']);
        $this->assertSame(2, $jenjang['slot_dibuat']);
        $this->assertSame(2, $jenjang['slot_dihapus']);
        $this->assertSame(2, SlotJamPelajaran::whereNotNull('kelas_id')->count());
    }

    public function test_simpan_sel_jadwal_membuat_pengampu_dan_mencegah_bentrok(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();
        $guruId = $this->guru();

        $a = $this->kelas('1A', '1');
        $b = $this->kelas('1B', '1');
        $fiqih = $this->mapel('Fiqih');
        $matematika = $this->mapel('Matematika');
        $id = $this->template($super, 'Satu Jam', [
            ['hari' => 'senin', 'nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
        ]);
        $this->terapkan($super, $id, ['sasaran' => 'kelas', 'sasaran_id' => (string) $a->id]);
        $this->terapkan($super, $id, ['sasaran' => 'kelas', 'sasaran_id' => (string) $b->id]);
        $slotA = SlotJamPelajaran::where('kelas_id', $a->id)->firstOrFail();
        $slotB = SlotJamPelajaran::where('kelas_id', $b->id)->firstOrFail();

        // Isi mapel tanpa guru: pengampu dibuat otomatis.
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/kurikulum/jadwal/sel', [
            'kelas_id' => $a->id, 'slot_jam_id' => $slotA->id, 'hari' => 'senin',
            'mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => null,
        ])->assertStatus(200);
        $pengampu = PengampuMapel::where('kelas_id', $a->id)->where('mata_pelajaran_id', $fiqih->id)->firstOrFail();
        $this->assertNull($pengampu->keaktifan_pegawai_id);
        $this->assertDatabaseCount('jadwal_pelajaran', 1);

        // Guru boleh dipilih belakangan; pengampu diperbarui.
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/kurikulum/jadwal/sel', [
            'kelas_id' => $a->id, 'slot_jam_id' => $slotA->id, 'hari' => 'senin',
            'mata_pelajaran_id' => $fiqih->id, 'keaktifan_pegawai_id' => $guruId,
        ])->assertStatus(200);
        $this->assertSame($guruId, (int) $pengampu->fresh()->keaktifan_pegawai_id);

        // Guru yang sama tidak boleh dipakai kelas lain pada waktu yang sama.
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/kurikulum/jadwal/sel', [
            'kelas_id' => $b->id, 'slot_jam_id' => $slotB->id, 'hari' => 'senin',
            'mata_pelajaran_id' => $matematika->id, 'keaktifan_pegawai_id' => $guruId,
        ])->assertStatus(422)->assertJsonValidationErrors('keaktifan_pegawai_id');
        $this->assertDatabaseCount('jadwal_pelajaran', 1);
        $this->assertDatabaseMissing('pengampu_mapel', [
            'kelas_id' => $b->id, 'mata_pelajaran_id' => $matematika->id,
        ]);

        // Kosongkan mapel = hapus jadwal, pengampu tetap ada.
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/kurikulum/jadwal/sel', [
            'kelas_id' => $a->id, 'slot_jam_id' => $slotA->id, 'hari' => 'senin',
            'mata_pelajaran_id' => null, 'keaktifan_pegawai_id' => null,
        ])->assertStatus(200);
        $this->assertDatabaseCount('jadwal_pelajaran', 0);
        $this->assertDatabaseHas('pengampu_mapel', ['id' => $pengampu->id]);
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
        $hasil = $this->terapkan($super, $id, [
            'sasaran' => 'kelas', 'sasaran_id' => (string) $kelas->id,
        ]);
        $this->assertSame(1, $hasil['slot_dibuat']);
        $this->assertDatabaseCount('slot_jam_pelajaran', 1);
        $this->assertDatabaseCount('jadwal_pelajaran', 0);
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

<?php

namespace Tests\Feature;

use App\Models\JadwalPelajaran;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\MataPelajaran;
use App\Models\PengampuMapel;
use App\Models\SlotJamPelajaran;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

/**
 * Template jadwal = kerangka jam murni per jenjang (tanpa mapel/pengampu) +
 * hari libur mingguan per lembaga.
 *
 *  - CRUD template & baris jam (nama, jam mulai-selesai, jenis kegiatan).
 *  - Terapkan = membuat `slot_jam_pelajaran` nyata untuk semua baris; slot
 *    istirahat/pembiasaan tidak bisa diisi pelajaran, slot yang sudah ada
 *    dilewati kecuali `timpa`, slot terpakai jadwal tak boleh ditimpa.
 *  - Hari libur: disimpan di `lembaga.hari_libur`, tak boleh menyalakan hari
 *    yang masih punya jadwal terisi, dan hari itu lenyap dari matriks jadwal.
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

    /** Isi pengampu satu kelas dengan satu mapel tanpa guru; kembalikan id pengampu. */
    private function pengampu(User $super, Kelas $kelas, MataPelajaran $mapel): int
    {
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/kurikulum/pengampu', [
            'kelas_id' => $kelas->id,
            'baris' => [['mata_pelajaran_id' => $mapel->id, 'keaktifan_pegawai_id' => null]],
        ])->assertStatus(200);

        return (int) PengampuMapel::where('kelas_id', $kelas->id)->value('id');
    }

    /** Buat template + kerangka jam; mengembalikan id template. */
    private function template(User $super, string $nama, array $jam): int
    {
        $t = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/template-jadwal', ['jenjang' => 'MI', 'nama' => $nama])
            ->assertStatus(201)->json();

        foreach ($jam as $i => $b) {
            $this->actingAs($super, 'sanctum')
                ->postJson("/api/admin/kurikulum/template-jadwal/{$t['id']}/baris", $b + ['urutan_slot' => $i + 1])
                ->assertStatus(201);
        }

        return $t['id'];
    }

    public function test_crud_kerangka_jam_dan_validasi_baris(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $id = $this->template($super, '8 JP + istirahat', [
            ['nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
            ['nama_slot' => 'Istirahat', 'jam_mulai' => '09:30', 'jam_selesai' => '10:00', 'jenis' => 'istirahat'],
        ]);

        // Nama template unik per jenjang (case-insensitive).
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/kurikulum/template-jadwal', ['jenjang' => 'MI', 'nama' => '8 jp + ISTIRAHAT'])
            ->assertStatus(422)->assertJsonValidationErrors('nama');

        // Detail memuat jam ke-n (urutan), nama, jam, dan penanda istirahat.
        $detail = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/template-jadwal/{$id}")
            ->assertStatus(200)->json();
        $this->assertCount(2, $detail['baris']);
        $this->assertSame('07:00', $detail['baris'][0]['jam_mulai']);
        $this->assertSame('istirahat', $detail['baris'][1]['jenis']);

        // Jam selesai harus setelah jam mulai.
        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/baris", [
                'urutan_slot' => 3, 'jam_mulai' => '08:00', 'jam_selesai' => '07:00',
            ])->assertStatus(422)->assertJsonValidationErrors('jam_selesai');

        // "Jam ke-" bentrok ditolak (cek-then-insert).
        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/baris", ['urutan_slot' => 1])
            ->assertStatus(422)->assertJsonValidationErrors('urutan_slot');

        // Ubah baris ke urutan yang sudah dipakai -> ditolak; ke urutan bebas
        // -> tersimpan (regresi: klien dulu mengirim kunci `urutan` sehingga
        // perubahan "Jam ke-" hilang tanpa galat).
        $barisId = $detail['baris'][1]['id'];
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/template-jadwal/baris/{$barisId}", ['urutan_slot' => 1])
            ->assertStatus(422)->assertJsonValidationErrors('urutan_slot');

        // Ubah hanya jam selesai -> tetap dibandingkan dengan jam mulai lama.
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/template-jadwal/baris/{$barisId}", ['jam_selesai' => '09:00'])
            ->assertStatus(422)->assertJsonValidationErrors('jam_selesai');

        $baris = $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/template-jadwal/baris/{$barisId}", [
                'urutan_slot' => 3, 'nama_slot' => 'Istirahat siang',
            ])->assertStatus(200)->json();
        $this->assertSame(3, $baris['urutan_slot']);
        $this->assertSame('Istirahat siang', $baris['nama_slot']);

        // Hapus baris lalu template.
        $this->actingAs($super, 'sanctum')
            ->deleteJson("/api/admin/kurikulum/template-jadwal/baris/{$barisId}")->assertStatus(200);
        $this->assertCount(1, $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/kurikulum/template-jadwal/{$id}")->json('baris'));

        $this->actingAs($super, 'sanctum')
            ->deleteJson("/api/admin/kurikulum/template-jadwal/{$id}")->assertStatus(200);
        $this->assertDatabaseMissing('template_jadwal', ['id' => $id]);
        $this->assertDatabaseCount('template_jadwal_baris', 0);
    }

    public function test_terapkan_membuat_slot_nyata_termasuk_istirahat(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $id = $this->template($super, 'Pola Pagi', [
            ['nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
            ['nama_slot' => 'Istirahat', 'jam_mulai' => '07:45', 'jam_selesai' => '08:00', 'jenis' => 'istirahat'],
            ['nama_slot' => 'Jam 2', 'jam_mulai' => '08:00', 'jam_selesai' => '08:45'],
        ]);

        // Pratinjau: 3 slot bisa dibuat (istirahat ikut jadi slot non-pelajaran).
        $pratinjau = $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", ['mode' => 'pratinjau'])
            ->assertStatus(200)->json();
        $this->assertSame(3, $pratinjau['bisa_dipasang']);
        $this->assertSame(0, $pratinjau['dibuat']);
        $this->assertDatabaseCount('slot_jam_pelajaran', 0);
        $this->assertCount(0, $pratinjau['dilewati']);

        // Eksekusi: 3 slot nyata tertulis, istirahat membawa jenisnya.
        $hasil = $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", ['mode' => 'eksekusi'])
            ->assertStatus(200)->json();
        $this->assertSame(3, $hasil['dibuat']);
        $this->assertSame('07:00', substr((string) SlotJamPelajaran::where('urutan', 1)->value('jam_mulai'), 0, 5));
        $this->assertSame('Jam 2', SlotJamPelajaran::where('urutan', 3)->value('nama_slot'));
        $this->assertSame('istirahat', SlotJamPelajaran::where('urutan', 2)->value('jenis'));

        // Terapkan ulang tanpa timpa -> semua dilewati.
        $kedua = $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", ['mode' => 'eksekusi'])
            ->assertStatus(200)->json();
        $this->assertSame(0, $kedua['dibuat']);
        $this->assertDatabaseCount('slot_jam_pelajaran', 3);

        // Timpa -> slot yang sama ditulis ulang, jumlahnya tetap 3.
        $ganti = $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", ['mode' => 'eksekusi', 'timpa' => true])
            ->assertStatus(200)->json();
        $this->assertSame(3, $ganti['dibuat']);
        $this->assertDatabaseCount('slot_jam_pelajaran', 3);
    }

    public function test_slot_terpakai_jadwal_tidak_boleh_ditimpa(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $id = $this->template($super, 'Pola Pagi', [
            ['nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
        ]);
        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", ['mode' => 'eksekusi'])
            ->assertStatus(200);

        // Pakai slot itu di jadwal kelas (butuh pengampu mapel).
        $kelas = $this->kelas('1A', '1');
        $pengampuId = $this->pengampu($super, $kelas, $this->mapel('Fiqih'));
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/jadwal', [
            'pengampu_mapel_id' => $pengampuId,
            'slot_jam_id' => SlotJamPelajaran::value('id'),
            'hari' => 'senin',
        ])->assertStatus(201);

        $hasil = $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", ['mode' => 'eksekusi', 'timpa' => true])
            ->assertStatus(200)->json();
        $this->assertSame(0, $hasil['dibuat']);
        $this->assertStringContainsString('masih dipakai jadwal', $hasil['dilewati'][0]['alasan']);
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

        // Jadwal baru di hari libur ditolak.
        $this->actingAs($super, 'sanctum')->postJson('/api/admin/kurikulum/jadwal', [
            'pengampu_mapel_id' => $pengampuId, 'slot_jam_id' => $slot['id'], 'hari' => 'jumat',
        ])->assertStatus(422)->assertJsonValidationErrors('hari');

        // Semua hari libur ditolak agar matriks tak kosong.
        $this->actingAs($super, 'sanctum')
            ->putJson('/api/admin/kurikulum/hari-libur', [
                'jenjang' => 'MI',
                'hari_libur' => JadwalPelajaran::HARI,
            ])->assertStatus(422)->assertJsonValidationErrors('hari_libur');
    }

    public function test_template_nonaktif_tidak_bisa_diterapkan(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $id = $this->template($super, 'Pola Pagi', [
            ['nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
        ]);

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/template-jadwal/{$id}", ['is_active' => false])
            ->assertStatus(200);

        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", ['mode' => 'eksekusi'])
            ->assertStatus(422)->assertJsonValidationErrors('template');
        $this->assertDatabaseCount('slot_jam_pelajaran', 0);

        // Aktifkan kembali -> boleh diterapkan.
        $this->actingAs($super, 'sanctum')
            ->putJson("/api/admin/kurikulum/template-jadwal/{$id}", ['is_active' => true])
            ->assertStatus(200);
        $this->actingAs($super, 'sanctum')
            ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", ['mode' => 'eksekusi'])
            ->assertStatus(200)->assertJsonPath('dibuat', 1);
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

        // Mapel yang sama di dua slot berbeda = pelajaran 2 JP.
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
        $this->assertCount(1, $jadwal['pengampu']);
        $this->assertSame('Fiqih', $jadwal['pengampu'][0]['nama_mapel']);
        $this->assertCount(0, $jadwal['belum_terjadwal']);

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

    /**
     * Regresi: pencocokan slot nyata memakai POSISI daftar (bukan nomor jam)
     * membuat baris kerangka tak ketemu dan dibuat ulang TIAP kali Terapkan
     * ditekan — slot menumpuk tanpa batas. Sekarang dikunci nomor jam.
     */
    public function test_terapkan_berulang_tidak_menumpuk_slot(): void
    {
        $this->lembaga('MI');
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $super = $this->superAdmin();

        $id = $this->template($super, 'Pola Istirahat', [
            ['nama_slot' => 'Jam 1', 'jam_mulai' => '07:00', 'jam_selesai' => '07:45'],
            ['nama_slot' => 'Istirahat', 'jam_mulai' => '07:45', 'jam_selesai' => '08:00', 'jenis' => 'istirahat'],
            ['nama_slot' => 'Jam 2', 'jam_mulai' => '08:00', 'jam_selesai' => '08:45'],
        ]);

        foreach ([1, 2, 3] as $putaran) {
            $this->actingAs($super, 'sanctum')
                ->postJson("/api/admin/kurikulum/template-jadwal/{$id}/terapkan", ['mode' => 'eksekusi'])
                ->assertStatus(200);
            // Tiga slot (jam 1, istirahat, jam 2) — tak bertambah walau berulang.
            $this->assertDatabaseCount('slot_jam_pelajaran', 3);
        }

        $this->assertSame([1, 2, 3], SlotJamPelajaran::orderBy('urutan')->pluck('urutan')->all());
    }
}

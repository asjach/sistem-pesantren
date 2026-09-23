<?php

namespace Tests\Feature;

use App\Models\KeaktifanPegawai;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\Pegawai;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\ReferensiSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

// Wali kelas inline (`kelas.walas_id`): 3 lapis — pegawai ada, aktif global,
// keaktifan aktif di lembaga + TA kelas.
class KelasWalasTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(ReferensiSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function baseFixture(): array
    {
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $super = User::create([
            'name' => 'Super', 'email' => 'super-walas@example.com',
            'phone' => '081000000021', 'password' => 'password',
        ]);
        $super->assignRole('super_admin');
        $kelas = Kelas::create([
            'jenjang' => $mi->jenjang, 'tahun_ajaran' => $ta->nama,
            'nama_kelas' => '1A', 'tingkat' => '1', 'urutan' => 1,
        ]);

        return compact('mi', 'mts', 'ta', 'super', 'kelas');
    }

    protected function makePegawai(string $nama, ?string $nip = null, string $status = 'aktif'): Pegawai
    {
        return Pegawai::create([
            'nama_lengkap' => $nama, 'jenis_kelamin' => 'L',
            'nip' => $nip, 'status_aktif' => $status,
        ]);
    }

    protected function tugaskan(Pegawai $p, string $jenjang, string $ta, string $status = 'aktif'): void
    {
        KeaktifanPegawai::create([
            'pegawai_id' => $p->id, 'jenjang' => $jenjang,
            'tahun_ajaran' => $ta, 'status_keaktifan' => $status,
        ]);
    }

    public function test_01_set_dan_lepas_walas(): void
    {
        $f = $this->baseFixture();
        $guru = $this->makePegawai('Guru Wali', 'NIP001');
        $this->tugaskan($guru, $f['mi']->jenjang, $f['ta']->nama);

        $res = $this->actingAs($f['super'], 'sanctum')
            ->postJson("/api/admin/kelas/{$f['kelas']->id}/set-walas", ['pegawai_id' => $guru->id])
            ->assertStatus(200);
        $this->assertSame('Wali kelas ditetapkan.', $res->json('pesan'));
        $this->assertSame($guru->id, $f['kelas']->fresh()->walas_id);

        // Daftar kelas memuat nama wali.
        $daftar = $this->actingAs($f['super'], 'sanctum')
            ->getJson('/api/admin/kelas?jenjang=MI&tahun_ajaran='.urlencode($f['ta']->nama))
            ->assertStatus(200);
        $baris = collect($daftar->json('data'))->firstWhere('id', $f['kelas']->id);
        $this->assertSame('Guru Wali', $baris['walas']['nama_lengkap']);
        // Regresi: `tahun_ajaran` harus string (relasi `tahunAjaran` yang di-snake
        // Laravel pernah menimpanya jadi objek → "[object Object]" di grid).
        $this->assertIsString($baris['tahun_ajaran']);
        $this->assertArrayNotHasKey('tahunAjaran', $baris);

        // Lepas wali (null).
        $this->actingAs($f['super'], 'sanctum')
            ->postJson("/api/admin/kelas/{$f['kelas']->id}/set-walas", ['pegawai_id' => null])
            ->assertStatus(200)
            ->assertJsonPath('pesan', 'Wali kelas dilepas.');
        $this->assertNull($f['kelas']->fresh()->walas_id);
    }

    public function test_02_tiga_lapis_ditolak(): void
    {
        $f = $this->baseFixture();
        $cuti = $this->makePegawai('Guru Cuti', 'NIP002', 'cuti');
        $this->tugaskan($cuti, $f['mi']->jenjang, $f['ta']->nama);
        $tanpaTugas = $this->makePegawai('Guru Tanpa Tugas', 'NIP003');
        $bedaLembaga = $this->makePegawai('Guru MTS', 'NIP004');
        $this->tugaskan($bedaLembaga, $f['mts']->jenjang, $f['ta']->nama);

        foreach ([$cuti, $tanpaTugas, $bedaLembaga] as $p) {
            $this->actingAs($f['super'], 'sanctum')
                ->postJson("/api/admin/kelas/{$f['kelas']->id}/set-walas", ['pegawai_id' => $p->id])
                ->assertStatus(422);
        }
        $this->assertNull($f['kelas']->fresh()->walas_id);

        // Pegawai tak dikenal: 422 validasi.
        $this->actingAs($f['super'], 'sanctum')
            ->postJson("/api/admin/kelas/{$f['kelas']->id}/set-walas", ['pegawai_id' => 999999])
            ->assertStatus(422);
    }

    public function test_03_update_dan_daftar_opsi_aktif(): void
    {
        $f = $this->baseFixture();
        $guru = $this->makePegawai('Guru Update', 'NIP005');
        $this->tugaskan($guru, $f['mi']->jenjang, $f['ta']->nama);
        $asing = $this->makePegawai('Guru Asing', 'NIP006');
        $this->tugaskan($asing, $f['mts']->jenjang, $f['ta']->nama);

        // Update generik ikut menetapkan wali.
        $this->actingAs($f['super'], 'sanctum')
            ->putJson("/api/admin/kelas/{$f['kelas']->id}", ['walas_id' => $guru->id])
            ->assertStatus(200);
        $this->assertSame($guru->id, $f['kelas']->fresh()->walas_id);

        // Opsi dropdown: hanya yang aktif di MI + TA (bukan MTS).
        $res = $this->actingAs($f['super'], 'sanctum')
            ->getJson('/api/admin/pegawai/aktif?jenjang=MI&tahun_ajaran='.urlencode($f['ta']->nama))
            ->assertStatus(200);
        $nama = collect($res->json())->pluck('nama_lengkap')->all();
        $this->assertContains('Guru Update', $nama);
        $this->assertNotContains('Guru Asing', $nama);
    }
}

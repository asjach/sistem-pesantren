<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\LembagaTahunAjaran;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Halaman Riwayat Belajar dua panel (khusus semester ganjil):
 * - GET belum-masuk: anggota aktif tanpa riwayat aktif + tanpa baris ganjil TA aktif.
 * - Aksi panah: POST minimal (santri+lembaga+TA) → baris semester 1 tanpa kelas.
 * - Aksi batal: DELETE hard delete baris aktif (arsip ditolak).
 */
class RiwayatBelajarGanjilTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
    }

    protected function baseFixture(): array
    {
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI', 'nsm' => '123456789012',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $taLama = TahunAjaran::create([
            'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01', 'tanggal_selesai' => '2026-06-30', 'is_aktif' => false,
        ]);
        // TA lama disembunyikan untuk MI → tidak berlaku di lembaga itu.
        LembagaTahunAjaran::create([
            'jenjang' => $mi->jenjang, 'tahun_ajaran' => $taLama->nama, 'is_active' => false,
        ]);
        $kelas = Kelas::create([
            'jenjang' => $mi->jenjang, 'tahun_ajaran' => $ta->nama, 'nama_kelas' => '1A', 'tingkat' => '1',
        ]);

        return compact('mi', 'ta', 'taLama', 'kelas');
    }

    protected int $seq = 0;

    protected function makeUser(string $role = 'super_admin'): User
    {
        $this->seq++;
        $u = User::create([
            'name' => 'User Ganjil '.$this->seq,
            'email' => "ganjil_u{$this->seq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9400000000 + $this->seq * 37), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);

        return $u;
    }

    protected function makeAnggota(string $nama, string $jenjang, ?string $nis = null): Santri
    {
        $this->seq++;
        $santri = Santri::create(['nama_lengkap' => $nama.' '.$this->seq, 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => $jenjang,
            'nis_lokal' => $nis ?? 'G'.$this->seq, 'is_active_lembaga' => 'Ya',
        ]);

        return $santri;
    }

    protected function belumMasuk(User $admin, array $params)
    {
        return $this->actingAs($admin, 'sanctum')->getJson('/api/admin/riwayat-belajar/belum-masuk?'.http_build_query($params));
    }

    // ---------- 01. belum-masuk: saring anggota ----------

    public function test_01_belum_masuk_hanya_anggota_tanpa_riwayat(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();

        $baru = $this->makeAnggota('Baru Masuk', $f['mi']->jenjang);
        $punyaAktif = $this->makeAnggota('Punya Aktif', $f['mi']->jenjang);
        RiwayatBelajar::create([
            'santri_id' => $punyaAktif->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => $f['mi']->jenjang,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);
        // Arsip ganjil TA aktif (mis. salah input lalu dinonaktifkan manual): tetap disaring.
        $arsipGanjil = $this->makeAnggota('Arsip Ganjil', $f['mi']->jenjang);
        RiwayatBelajar::create([
            'santri_id' => $arsipGanjil->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => $f['mi']->jenjang,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'naik', 'is_active_riwayat' => 'Tidak',
        ]);
        // Arsip ganjil TA LAMA tanpa riwayat aktif: boleh masuk lagi di TA aktif.
        $lulusanLama = $this->makeAnggota('Arsip Lama', $f['mi']->jenjang);
        RiwayatBelajar::create([
            'santri_id' => $lulusanLama->id, 'tahun_ajaran' => $f['taLama']->nama, 'jenjang' => $f['mi']->jenjang,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'naik', 'is_active_riwayat' => 'Tidak',
        ]);
        // Anggota nonaktif: tidak ikut.
        $this->seq++;
        $keluar = Santri::create(['nama_lengkap' => 'Keluar '.$this->seq, 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $keluar->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => 'GX', 'is_active_lembaga' => 'Tidak',
        ]);

        $ids = fn ($res) => collect($res->json('data'))->pluck('santri_id')->sort()->values()->all();

        $res = $this->belumMasuk($admin, ['jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['ta']->nama])
            ->assertStatus(200);
        $this->assertSame(
            collect([$baru->id, $lulusanLama->id])->sort()->values()->all(),
            $ids($res)
        );

        // Pencarian nama.
        $res = $this->belumMasuk($admin, ['jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['ta']->nama, 'q' => 'Baru Masuk'])
            ->assertStatus(200);
        $this->assertSame([$baru->id], $ids($res));
    }

    public function test_02_belum_masuk_validasi_parameter(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();

        // Wajib lembaga + TA.
        $this->belumMasuk($admin, [])->assertStatus(422);
        // Lembaga tak dikenal ditolak.
        $this->belumMasuk($admin, ['jenjang' => 'ZZ', 'tahun_ajaran' => $f['ta']->nama])->assertStatus(422);
        // TA disembunyikan untuk lembaga ini ditolak.
        $this->belumMasuk($admin, ['jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taLama']->nama])->assertStatus(422);
    }

    // ---------- 02. aksi panah: satu klik ----------

    public function test_03_panah_membuat_baris_ganjil_tanpa_kelas(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeAnggota('Panah Klik', $f['mi']->jenjang);

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $santri->id,
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['ta']->nama,
        ])->assertStatus(201);

        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => $f['mi']->jenjang,
            'kelas_id' => null, 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);

        // Hilang dari panel kiri, muncul di panel kanan (index semester=1).
        $kiri = $this->belumMasuk($admin, ['jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['ta']->nama])->assertStatus(200);
        $this->assertNotContains($santri->id, collect($kiri->json('data'))->pluck('santri_id')->all());

        $kanan = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/riwayat-belajar?'.http_build_query([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['ta']->nama, 'semester' => '1',
        ]))->assertStatus(200);
        $this->assertContains($santri->id, collect($kanan->json('data'))->pluck('santri_id')->all());

        // Klik dua kali = 422 (guard terima), bukan baris ganda.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $santri->id,
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['ta']->nama,
        ])->assertStatus(422);
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $santri->id)->count());
    }

    // ---------- 03. aksi batal: hard delete ----------

    public function test_04_batal_hapus_fisik_dan_kembalikan_ke_kiri(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeAnggota('Batal Hapus', $f['mi']->jenjang);
        $riwayat = RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => $f['mi']->jenjang,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);
        $santri->hitungUlangStatusGlobal();
        $this->assertSame('Ya', $santri->fresh()->is_active_pst);

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/admin/riwayat-belajar/{$riwayat->id}")
            ->assertStatus(200)
            ->assertJsonPath('pesan', 'Riwayat belajar dibatalkan.');

        $this->assertDatabaseMissing('riwayat_belajar', ['id' => $riwayat->id]);
        $this->assertSame('Tidak', $santri->fresh()->is_active_pst);

        // Kembali muncul di panel kiri.
        $kiri = $this->belumMasuk($admin, ['jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['ta']->nama])->assertStatus(200);
        $this->assertContains($santri->id, collect($kiri->json('data'))->pluck('santri_id')->all());
    }

    public function test_05_batal_arsip_ditolak(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeAnggota('Arsip Tolak', $f['mi']->jenjang);
        $arsip = RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => $f['mi']->jenjang,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'naik', 'is_active_riwayat' => 'Tidak',
        ]);

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/admin/riwayat-belajar/{$arsip->id}")
            ->assertStatus(422);
        $this->assertDatabaseHas('riwayat_belajar', ['id' => $arsip->id]);
    }

    public function test_06_batal_butuh_izin_hapus(): void
    {
        $f = $this->baseFixture();
        $guru = $this->makeUser('guru');
        $santri = $this->makeAnggota('Izin Hapus', $f['mi']->jenjang);
        $riwayat = RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => $f['mi']->jenjang,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);

        $this->actingAs($guru, 'sanctum')->deleteJson("/api/admin/riwayat-belajar/{$riwayat->id}")
            ->assertStatus(403);
        $this->assertDatabaseHas('riwayat_belajar', ['id' => $riwayat->id]);
    }

    // ---------- 04. tabel kanan hanya ganjil ----------

    public function test_07_index_genap_tidak_masuk_panel_kanan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeAnggota('Genap Filter', $f['mi']->jenjang);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => $f['mi']->jenjang,
            'semester' => '2', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/riwayat-belajar?'.http_build_query([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['ta']->nama, 'semester' => '1',
        ]))->assertStatus(200);
        $this->assertNotContains($santri->id, collect($res->json('data'))->pluck('santri_id')->all());
    }
}

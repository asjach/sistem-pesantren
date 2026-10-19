<?php

namespace Tests\Feature;

use App\Models\KeaktifanPegawai;
use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Models\TahunAjaran;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AktifkanMassalKeaktifanTest extends TestCase
{
    use RefreshDatabase;

    protected int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);

        Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        Lembaga::create([
            'nama' => 'Madrasah Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        TahunAjaran::create([
            'nama' => '2026/2027', 'tanggal_mulai' => '2026-07-01',
            'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
    }

    protected function makeUser(array $jenjangs, string $role = 'admin'): User
    {
        $this->seq++;
        $user = User::create([
            'name' => 'Admin '.$this->seq,
            'email' => "aktifkan_{$this->seq}_".uniqid().'@example.com',
            'password' => 'password',
        ]);
        $user->assignRole($role);
        foreach ($jenjangs as $jenjang) {
            DB::table('user_lembaga')->insert([
                'user_id' => $user->id, 'jenjang' => $jenjang,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $user;
    }

    protected function makePegawai(string $nama, string $jenjang, string $aktif = LembagaPegawai::YA): Pegawai
    {
        $this->seq++;
        $pegawai = Pegawai::create([
            'nama_lengkap' => $nama,
            'jenis_kelamin' => 'L',
            'nipp' => 'PST-'.str_pad((string) $this->seq, 4, '0', STR_PAD_LEFT),
        ]);
        LembagaPegawai::create([
            'pegawai_id' => $pegawai->id,
            'jenjang' => $jenjang,
            'is_active_lembaga' => $aktif,
        ]);

        return $pegawai;
    }

    protected function payload(array $tambahan = []): array
    {
        return array_merge(['jenjang' => 'MI', 'tahun_ajaran' => '2026/2027'], $tambahan);
    }

    public function test_aktifkan_massal_hanya_penempatan_aktif_di_lembaga_itu(): void
    {
        $admin = $this->makeUser([], 'super_admin');
        $satu = $this->makePegawai('Guru Satu', 'MI');
        $dua = $this->makePegawai('Guru Dua', 'MI');
        $lain = $this->makePegawai('Guru MTS', 'MTS');
        $nonaktif = $this->makePegawai('Guru Lama', 'MI', LembagaPegawai::TIDAK);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/pegawai-keaktifan/aktifkan-massal', $this->payload())
            ->assertOk()
            ->assertJsonPath('data.dibuat', 2);

        $this->assertDatabaseHas('keaktifan_pegawai', [
            'pegawai_id' => $satu->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
            'status_keaktifan' => KeaktifanPegawai::AKTIF,
        ]);
        $this->assertDatabaseHas('keaktifan_pegawai', [
            'pegawai_id' => $dua->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
        ]);
        $this->assertDatabaseMissing('keaktifan_pegawai', ['pegawai_id' => $lain->id]);
        $this->assertDatabaseMissing('keaktifan_pegawai', ['pegawai_id' => $nonaktif->id]);
    }

    public function test_aktifkan_massal_idempoten_dan_bisa_dibatasi_pegawai(): void
    {
        $admin = $this->makeUser([], 'super_admin');
        $satu = $this->makePegawai('Guru Satu', 'MI');
        $dua = $this->makePegawai('Guru Dua', 'MI');

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/pegawai-keaktifan/aktifkan-massal', $this->payload(['pegawai_id' => [$satu->id]]))
            ->assertOk()
            ->assertJsonPath('data.dibuat', 1);

        $this->assertSame(1, KeaktifanPegawai::where('jenjang', 'MI')->count());
        $this->assertDatabaseMissing('keaktifan_pegawai', ['pegawai_id' => $dua->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/pegawai-keaktifan/aktifkan-massal', $this->payload())
            ->assertOk()
            ->assertJsonPath('data.dibuat', 2);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/pegawai-keaktifan/aktifkan-massal', $this->payload())
            ->assertOk()
            ->assertJsonPath('data.dibuat', 2);

        $this->assertSame(2, KeaktifanPegawai::where('jenjang', 'MI')->count());
    }

    public function test_admin_lembaga_lain_tidak_boleh_mengaktifkan(): void
    {
        $admin = $this->makeUser(['MTS']);
        $this->makePegawai('Guru MI', 'MI');

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/pegawai-keaktifan/aktifkan-massal', $this->payload())
            ->assertForbidden();
    }
}

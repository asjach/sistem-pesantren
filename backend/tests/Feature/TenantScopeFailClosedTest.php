<?php

namespace Tests\Feature;

use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\Pegawai;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Kontrak KEAMANAN tenant: tenantScope() harus gagal-tertutup (fail-closed).
 * Bila tidak, halaman ber-scope menampilkan data lembaga lain — atau seluruh
 * data saat lingkupnya kosong. Peran non-admin wajib nol, bukan semua.
 *
 * MTS dipakai sebagai lembaga "lain" karena pasangan MI↔MD sengaja saling
 * terlihat (lembagaIdsDenganPasangan) — dipisah di test tersendiri.
 */
class TenantScopeFailClosedTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Lembaga::create(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true]);
        Lembaga::create(['nama' => 'MD', 'jenjang' => 'MD', 'is_active' => true]);
        Lembaga::create(['nama' => 'MTS', 'jenjang' => 'MTS', 'is_active' => true]);
        TahunAjaran::create(['nama' => '2025/2026', 'tanggal_mulai' => '2025-07-01']);
    }

    private function user(string $role, array $jenjangs = []): User
    {
        $u = User::create([
            'name' => ucfirst($role).' '.uniqid(), 'email' => 'tenant_'.uniqid().'@example.com',
            'phone' => '08'.random_int(1000000000, 9999999999), 'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($jenjangs as $j) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $j,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    /** Santri + keanggotaan di satu jenjang. */
    private function santri(string $jenjang): Santri
    {
        $s = Santri::create(['nama_lengkap' => 'Santri '.uniqid(), 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $s->id, 'jenjang' => $jenjang, 'is_active_lembaga' => 'Ya',
        ]);

        return $s;
    }

    public function test_peran_non_admin_selalu_nol_di_empat_model(): void
    {
        Kelas::create(['nama_kelas' => 'MI 1A', 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'tingkat' => '1']);
        Alumni::create([
            'santri_id' => $this->santri('MI')->id, 'lembaga_lulus' => 'MI', 'tahun_lulus' => '2025/2026',
            'tahun_ajaran_lulus' => '2025/2026',
        ]);
        MutasiKeluar::create([
            'santri_id' => $this->santri('MTS')->id, 'jenjang' => 'MTS', 'tanggal_mutasi' => '2025-08-01',
        ]);

        foreach (['guru', 'orang_tua', 'santri'] as $role) {
            $this->actingAs($this->user($role, ['MI']), 'sanctum');
            $this->assertSame(0, Lembaga::tenantScope()->count(), "$role lembaga");
            $this->assertSame(0, Kelas::tenantScope()->count(), "$role kelas");
            $this->assertSame(0, Alumni::tenantScope()->count(), "$role alumni");
            $this->assertSame(0, MutasiKeluar::tenantScope()->count(), "$role mutasi");
        }
    }

    /** Admin scoped hanya melihat jenjangnya (MTS bukan miliknya). */
    public function test_admin_scoped_tidak_melihat_lembaga_lain(): void
    {
        Kelas::create(['nama_kelas' => 'MI 1A', 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'tingkat' => '1']);
        Kelas::create(['nama_kelas' => 'MTS 1A', 'jenjang' => 'MTS', 'tahun_ajaran' => '2025/2026', 'tingkat' => '1']);

        $this->actingAs($this->user('admin', ['MI']), 'sanctum');

        $this->assertSame(1, Kelas::tenantScope()->count());
        $this->assertSame(['MI'], Kelas::tenantScope()->pluck('jenjang')->unique()->values()->all());
    }

    /** Pasangan MI↔MD sengaja saling terlihat (counterpart ikut tampil). */
    public function test_admin_mi_juga_melihat_md_pasangannya(): void
    {
        Kelas::create(['nama_kelas' => 'MI 1A', 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'tingkat' => '1']);
        Kelas::create(['nama_kelas' => 'MD 1A', 'jenjang' => 'MD', 'tahun_ajaran' => '2025/2026', 'tingkat' => '1']);
        Kelas::create(['nama_kelas' => 'MTS 1A', 'jenjang' => 'MTS', 'tahun_ajaran' => '2025/2026', 'tingkat' => '1']);

        $this->actingAs($this->user('admin', ['MI']), 'sanctum');

        $jenjang = Kelas::tenantScope()->pluck('jenjang')->unique()->sort()->values()->all();
        $this->assertSame(['MD', 'MI'], $jenjang); // MTS tetap di luar
    }

    /** Admin yang lembaganya tidak punya data → nol, bukan semua. */
    public function test_admin_dengan_lembaga_tak_berdata_melihat_nol(): void
    {
        Kelas::create(['nama_kelas' => 'MI 1A', 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'tingkat' => '1']);
        $this->actingAs($this->user('admin', ['MTS']), 'sanctum');
        $this->assertSame(0, Kelas::tenantScope()->count());
    }

    /** Super admin (bolehPesantren) melihat lintas lembaga. */
    public function test_super_admin_melihat_semua(): void
    {
        Kelas::create(['nama_kelas' => 'MI 1A', 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'tingkat' => '1']);
        Kelas::create(['nama_kelas' => 'MTS 1A', 'jenjang' => 'MTS', 'tahun_ajaran' => '2025/2026', 'tingkat' => '1']);
        $this->actingAs($this->user('super_admin'), 'sanctum');
        $this->assertSame(2, Kelas::tenantScope()->count());
    }

    /**
     * Santri: admin scoped melihat keanggotaan jenjangnya + santri TANPA
     * keanggotaan (arsip pusat) — aturan sengaja lebih longgar dari model lain.
     */
    public function test_santri_menyertakan_arsip_pusat_tapi_bukan_lembaga_lain(): void
    {
        $mi = $this->santri('MI');
        $mts = $this->santri('MTS');
        $pusat = Santri::create(['nama_lengkap' => 'Arsip Pusat', 'jk' => 'L']);

        $this->actingAs($this->user('admin', ['MI']), 'sanctum');
        $ids = Santri::tenantScope()->pluck('id')->all();

        $this->assertContains($mi->id, $ids);
        $this->assertContains($pusat->id, $ids);
        $this->assertNotContains($mts->id, $ids);
    }

    public function test_santri_non_admin_nol(): void
    {
        $this->santri('MI');
        $this->actingAs($this->user('orang_tua', ['MI']), 'sanctum');
        $this->assertSame(0, Santri::tenantScope()->count());
    }

    /** Keanggotaan: murni whereIn jenjang (tanpa pengecualian arsip pusat). */
    public function test_keanggotaan_hanya_jenjang_sendiri(): void
    {
        $this->santri('MI');
        $this->santri('MTS');
        $this->actingAs($this->user('admin', ['MTS']), 'sanctum');

        $this->assertSame(1, LembagaSantri::tenantScope()->count());
        $this->assertSame('MTS', LembagaSantri::tenantScope()->value('jenjang'));
    }

    /**
     * Penempatan pegawai: dibatasi jenjang pengguna. Berbeda dari model lain,
     * peran non-admin TIDAK dipaksa nol — penempatan adalah data dirinya
     * sendiri, dan tetap tersaring ke jenjangnya (tak ada kebocoran lintas
     * lembaga). Kontrak endpoint-nya yang menggerbang akses.
     */
    public function test_penempatan_pegawai_dibatasi_jenjang(): void
    {
        $p = Pegawai::create(['nama_lengkap' => 'Guru', 'jenis_kelamin' => 'L', 'status_aktif' => 'Ya']);
        LembagaPegawai::create(['pegawai_id' => $p->id, 'jenjang' => 'MI', 'is_active_lembaga' => 'Ya']);
        LembagaPegawai::create(['pegawai_id' => $p->id, 'jenjang' => 'MTS', 'is_active_lembaga' => 'Ya']);

        $this->actingAs($this->user('admin', ['MI']), 'sanctum');
        $this->assertSame(1, LembagaPegawai::tenantScope()->count());
        $this->assertSame('MI', LembagaPegawai::tenantScope()->value('jenjang'));

        // Guru MI: hanya baris MI miliknya (MTS tetap tak terlihat).
        $this->actingAs($this->user('guru', ['MI']), 'sanctum');
        $this->assertSame(1, LembagaPegawai::tenantScope()->count());
        $this->assertSame('MI', LembagaPegawai::tenantScope()->value('jenjang'));
    }

    /** User management: admin scoped hanya melihat users beririsan pivot. */
    public function test_user_scope_hanya_pivot_beririsan(): void
    {
        $mi = $this->user('admin', ['MI']);
        $mts = $this->user('admin', ['MTS']);

        $this->actingAs($mi, 'sanctum');
        $ids = User::tenantScope()->pluck('id')->all();

        $this->assertContains($mi->id, $ids);
        $this->assertNotContains($mts->id, $ids);
    }

    /**
     * Non-admin tak boleh mengelola pengguna — dijaga middleware izin
     * pengguna.lihat (scope saja tak menutup karena guru punya pivot di
     * lembaganya sendiri; gerbang sebenarnya ada di lapisan izin).
     */
    public function test_daftar_pengguna_ditolak_untuk_non_admin(): void
    {
        $this->user('admin', ['MI']);
        $this->actingAs($this->user('guru', ['MI']), 'sanctum');
        $this->getJson('/api/admin/users')->assertStatus(403);
    }

    /** Admin scoped hanya melihat pengguna yang pivot-nya beririsan. */
    public function test_daftar_pengguna_dibatasi_tenant_untuk_admin_scoped(): void
    {
        $mi = $this->user('admin', ['MI']);
        $mts = $this->user('admin', ['MTS']);

        $res = $this->actingAs($mi, 'sanctum')->getJson('/api/admin/users')->assertStatus(200);
        $email = $res->json('data.*.email') ?? [];
        $this->assertContains($mi->email, $email);
        $this->assertNotContains($mts->email, $email);
    }
}

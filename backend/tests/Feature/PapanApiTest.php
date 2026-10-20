<?php

namespace Tests\Feature;

use App\Models\Papan\PapanButir;
use App\Models\Papan\PapanItem;
use App\Models\Papan\PapanModul;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * API papan perkembangan proyek (/api/papan).
 *
 * Yang dijaga di sini: pagar izin (lihat vs ubah), bentuk respons, dan yang
 * paling mudah terlewat — endpoint papan berjalan TANPA lembaga aktif karena
 * papan bukan data pesantren.
 */
class PapanApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);

        config()->set('database.connections.papan.database', ':memory:');

        $this->artisan('migrate', [
            '--path' => 'database/migrations/papan',
            '--database' => 'papan',
            '--force' => true,
        ])->run();

        $this->buatPapan();
    }

    public function test_tanpa_token_menjawab_401(): void
    {
        $this->getJson('/api/papan')->assertStatus(401);
    }

    public function test_index_mengembalikan_modul_ringkasan_dan_daftar_status(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->getJson('/api/papan')
            ->assertOk()
            ->assertJsonPath('modul.0.kode', 'E')
            ->assertJsonPath('modul.0.sub.0.kode', 'E.3')
            // Ringkasan dipisah: poin (yang bergerak) dan sub-modul (turunan).
            ->assertJsonPath('ringkasan.butir.akan', 1)
            ->assertJsonPath('ringkasan.butir.sudah', 1)
            ->assertJsonPath('ringkasan.sub.akan', 1)
            ->assertJsonPath('status', ['sudah', 'sedang', 'akan', 'ditunda']);
    }

    public function test_pengguna_tanpa_izin_papan_ditolak(): void
    {
        Sanctum::actingAs($this->pengguna(['guru']));

        $this->getJson('/api/papan')->assertStatus(403);
    }

    public function test_pindah_status_poin_mengubah_dan_mencatat_riwayat(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $poin = PapanButir::query()->where('status', 'akan')->firstOrFail();

        $this->patchJson("/api/papan/E.3/butir/{$poin->id}/status", ['status' => 'sedang', 'catatan' => 'Mulai'])
            ->assertOk()
            ->assertJsonPath('status', 'sedang')
            // Sub-modul ikut jadi "sedang" karena ada poin yang sedang.
            ->assertJsonPath('status_sub_modul', 'sedang');

        $this->getJson('/api/papan/riwayat')
            ->assertOk()
            ->assertJsonPath('riwayat.0.kode', 'E.3')
            ->assertJsonPath('riwayat.0.ke', 'sedang')
            ->assertJsonPath('riwayat.0.oleh', 'pengguna');
    }

    /**
     * Inti model baru: sub-modul baru dianggap "sudah" kalau SEMUA poinnya
     * sudah. Satu poin yang masih "akan" sudah cukup menahannya.
     */
    public function test_status_sub_modul_baru_sudah_bila_semua_poin_sudah(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->getJson('/api/papan/E.3')->assertJsonPath('status', 'akan');

        $sisa = PapanButir::query()->where('status', 'akan')->firstOrFail();

        $this->patchJson("/api/papan/E.3/butir/{$sisa->id}/status", ['status' => 'sudah'])
            ->assertOk()
            ->assertJsonPath('status_sub_modul', 'sudah');

        $this->getJson('/api/papan/E.3')->assertJsonPath('status', 'sudah');
    }

    public function test_pindah_dengan_status_tidak_sah_ditolak_validasi(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $poin = PapanButir::query()->firstOrFail();

        $this->patchJson("/api/papan/E.3/butir/{$poin->id}/status", ['status' => 'ngarang'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_pindah_kode_tidak_dikenal_menjawab_404(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->patchJson('/api/papan/Z.9/butir/1/status', ['status' => 'sedang'])->assertStatus(404);
    }

    public function test_pindah_poin_yang_tidak_ada_menjawab_404(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->patchJson('/api/papan/E.3/butir/99999/status', ['status' => 'sedang'])->assertStatus(404);
    }

    public function test_tambah_dan_hapus_butir(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $id = $this->postJson('/api/papan/E.3/butir', [
            'status' => 'akan',
            'deskripsi' => 'Butir baru lewat API.',
        ])->assertStatus(201)->json('id');

        $this->deleteJson("/api/papan/E.3/butir/{$id}")->assertOk();

        $this->deleteJson("/api/papan/E.3/butir/{$id}")->assertStatus(404);
    }

    public function test_peran_admin_lembaga_boleh_mengubah(): void
    {
        Sanctum::actingAs($this->pengguna(['admin']));

        $poin = PapanButir::query()->where('status', 'akan')->firstOrFail();

        $this->patchJson("/api/papan/E.3/butir/{$poin->id}/status", ['status' => 'sedang'])->assertOk();
    }

    /**
     * Papan bukan data pesantren: akses tidak boleh mensyaratkan lembaga aktif,
     * supaya tetap terbaca walau lembaga aktif belum dipilih.
     */
    public function test_tidak_mensyaratkan_lembaga_aktif(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->getJson('/api/papan')->assertOk();
    }

    /** @param array<int, string> $peran */
    public function test_ubah_butir_mengganti_deskripsi_lewat_api(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->orderBy('urutan')->firstOrFail();

        $this->patchJson("/api/papan/E.3/butir/{$butir->id}", ['deskripsi' => 'Rekap harian per kas.'])
            ->assertOk()
            ->assertJsonPath('deskripsi', 'Rekap harian per kas.');

        $this->assertSame('Rekap harian per kas.', $butir->refresh()->deskripsi);
    }

    public function test_subpoin_bisa_disimpan_ditampilkan_dan_dihapus_tanpa_mengubah_status(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->where('status', 'akan')->firstOrFail();

        $this->patchJson("/api/papan/E.3/butir/{$butir->id}", [
            'subpoin' => ['Periksa saldo kas.', 'Unduh rekap bulanan.'],
        ])->assertOk()->assertJsonPath('subpoin.1', 'Unduh rekap bulanan.');

        $this->getJson('/api/papan')
            ->assertOk()
            ->assertJsonFragment(['subpoin' => ['Periksa saldo kas.', 'Unduh rekap bulanan.']]);
        $this->assertSame('akan', $butir->refresh()->status);

        $this->patchJson("/api/papan/E.3/butir/{$butir->id}", ['subpoin' => []])
            ->assertOk()
            ->assertJsonPath('subpoin', []);
    }

    public function test_subpoin_kosong_ditolak_validasi(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->firstOrFail();

        $this->patchJson("/api/papan/E.3/butir/{$butir->id}", ['subpoin' => ['']])
            ->assertStatus(422)
            ->assertJsonValidationErrors('subpoin.0');
    }

    public function test_ubah_butir_tanpa_apa_pun_dijawab_422(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->orderBy('urutan')->firstOrFail();

        // Tanpa deskripsi DAN tanpa status: tidak ada yang berubah, jadi
        // ini kekeliruan pemanggil - bukan sukses diam-diam.
        $this->patchJson("/api/papan/E.3/butir/{$butir->id}", [])->assertStatus(422);
    }

    public function test_ubah_butir_dengan_status_ikut_mengembalikan_status_sub_modul(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->where('status', 'akan')->firstOrFail();

        $this->patchJson("/api/papan/E.3/butir/{$butir->id}", ['status' => 'sudah'])
            ->assertOk()
            ->assertJsonPath('status', 'sudah')
            // Semua poin E.3 kini sudah, jadi sub-modul turunannya ikut sudah.
            ->assertJsonPath('status_sub_modul', 'sudah');
    }

    public function test_geser_butir_di_ujung_dijawab_409(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $teratas = PapanButir::query()->orderBy('urutan')->firstOrFail();

        $this->patchJson("/api/papan/E.3/butir/{$teratas->id}/urutan", ['arah' => -1])
            ->assertStatus(409);
    }

    public function test_geser_butir_menukar_urutan(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $id = PapanButir::query()->orderBy('urutan')->pluck('id')->all();

        $this->patchJson("/api/papan/E.3/butir/{$id[1]}/urutan", ['arah' => -1])->assertOk();

        $this->assertSame([$id[1], $id[0]], PapanButir::query()->orderBy('urutan')->pluck('id')->all());
    }

    public function test_ubah_item_mengganti_nama_dan_kode(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->patchJson('/api/papan/item/E.3', ['nama' => 'Kas & Bank', 'kode_baru' => 'E.8'])
            ->assertOk()
            ->assertJsonPath('kode', 'E.8')
            ->assertJsonPath('nama', 'Kas & Bank');

        // Poin tidak boleh ikut hilang saat sub-modul dinamai ulang.
        $this->assertSame(2, PapanButir::query()->count());
    }

    public function test_tambah_dan_hapus_sub_modul_lewat_api(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->postJson('/api/papan/modul/E/item', ['kode' => 'E.7', 'nama' => 'Laporan Kas'])
            ->assertStatus(201)
            ->assertJsonPath('kode', 'E.7');

        $this->deleteJson('/api/papan/item/E.7')->assertOk();

        $this->assertSame(0, PapanItem::query()->where('kode', 'E.7')->count());
    }

    public function test_kode_sub_modul_kembar_dijawab_422(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->postJson('/api/papan/modul/E/item', ['kode' => 'E.3', 'nama' => 'Kembar'])
            ->assertStatus(422);
    }

    public function test_izin_ubah_dibutuhkan_untuk_menyunting(): void
    {
        // Izin lihat saja TIDAK cukup untuk mengubah: pagar papan.ubah
        // harus benar-benar berlaku, bukan sekadar ada di rute.
        Sanctum::actingAs($this->pengguna(['guru']));
        $butir = PapanButir::query()->orderBy('urutan')->firstOrFail();

        $this->patchJson("/api/papan/E.3/butir/{$butir->id}", ['deskripsi' => 'Nakal.'])
            ->assertStatus(403);
    }

    private function pengguna(array $peran): User
    {
        $user = User::create([
            'name' => 'Uji Papan '.uniqid(),
            'email' => 'papan_'.uniqid().'@example.com',
            'password' => 'password123',
        ]);
        $user->assignRole($peran);

        return $user;
    }

    /** Satu modul + satu sub-modul + satu butir sebagai bahan uji. */
    private function buatPapan(): void
    {
        $modul = PapanModul::create(['kode' => 'E', 'nama' => 'Keuangan', 'urutan' => 1]);

        $item = PapanItem::create([
            'modul_id' => $modul->id,
            'kode' => 'E.3',
            'nama' => 'Rekap & Tutup Buku Kas',
            'urutan' => 1,
        ]);

        // Dua poin: satu sudah, satu akan. Status sub-modulnya turunan, jadi
        // fixture ini sekaligus membuktikan E.3 dianggap "akan" (masih ada
        // sisa), bukan "sudah" walau ada poin yang selesai.
        $item->butir()->create(['status' => 'sudah', 'deskripsi' => 'Rekap per kas.', 'urutan' => 1]);
        $item->butir()->create(['status' => 'akan', 'deskripsi' => 'Ekspor rekap.', 'urutan' => 2]);
    }
}

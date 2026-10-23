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
 * API papan perkembangan proyek (/api/board).
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
        $this->getJson('/api/board')->assertStatus(401);
    }

    public function test_index_mengembalikan_modul_ringkasan_dan_daftar_status(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->getJson('/api/board')
            ->assertOk()
            ->assertJsonPath('aplikasi.0.kode', 'desktop-admin')
            ->assertJsonPath('aplikasi.0.modul.0.kode', 'E')
            ->assertJsonPath('aplikasi.0.modul.0.sub.0.kode', 'E.3')
            // Ringkasan dipisah: poin (yang bergerak) dan sub-modul (turunan).
            ->assertJsonPath('ringkasan.butir.todo', 1)
            ->assertJsonPath('ringkasan.butir.done', 1)
            ->assertJsonPath('ringkasan.sub.todo', 1)
            ->assertJsonPath('status', ['backlog', 'todo', 'in_progress', 'for_review', 'done']);
    }

    public function test_tambah_modul_membuat_modul_baru_di_papan(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->postJson('/api/board/modul', ['aplikasi' => 'desktop-admin', 'kode' => 'h', 'nama' => 'Laporan'])
            ->assertStatus(201)
            ->assertJsonPath('kode', 'H')
            ->assertJsonPath('nama', 'Laporan');

        $this->getJson('/api/board')
            ->assertOk()
            ->assertJsonFragment(['kode' => 'H', 'nama' => 'Laporan']);
    }

    public function test_tambah_modul_menolak_kode_kembar(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->postJson('/api/board/modul', ['aplikasi' => 'desktop-admin', 'kode' => 'e', 'nama' => 'Kembar'])
            ->assertStatus(422);
    }

    public function test_tambah_modul_butuh_izin_ubah(): void
    {
        Sanctum::actingAs($this->pengguna(['guru']));

        $this->postJson('/api/board/modul', ['aplikasi' => 'desktop-admin', 'kode' => 'H', 'nama' => 'Laporan'])
            ->assertStatus(403);
    }

    public function test_workflow_master_dan_status_per_aplikasi(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->getJson('/api/board')
            ->assertOk()
            ->assertJsonPath('workflow_master_aktif', false)
            ->assertJsonPath('aplikasi.0.workflow_aktif', false)
            ->assertJsonPath('aplikasi.0.workflow_efektif', false);

        $this->patchJson('/api/board/workflow', ['aktif' => true])
            ->assertOk()
            ->assertJsonPath('workflow_master_aktif', true)
            ->assertJsonPath('aplikasi.desktop-admin.workflow_efektif', false);

        $this->patchJson('/api/board/workflow', [
            'aplikasi' => 'desktop-admin',
            'aktif' => true,
        ])
            ->assertOk()
            ->assertJsonPath('aplikasi.desktop-admin.workflow_aktif', true)
            ->assertJsonPath('aplikasi.desktop-admin.workflow_efektif', true)
            ->assertJsonPath('aplikasi.mobile-guru.workflow_efektif', false);

        $this->patchJson('/api/board/workflow', [
            'aplikasi' => 'mobile-guru',
            'aktif' => true,
        ])
            ->assertOk()
            ->assertJsonPath('aplikasi.desktop-admin.workflow_efektif', true)
            ->assertJsonPath('aplikasi.mobile-guru.workflow_efektif', true);

        $this->patchJson('/api/board/workflow', ['aktif' => false])
            ->assertOk()
            ->assertJsonPath('workflow_master_aktif', false)
            ->assertJsonPath('aplikasi.desktop-admin.workflow_aktif', true)
            ->assertJsonPath('aplikasi.desktop-admin.workflow_efektif', false);
    }

    public function test_pengguna_tanpa_izin_papan_ditolak(): void
    {
        Sanctum::actingAs($this->pengguna(['guru']));

        $this->getJson('/api/board')->assertStatus(403);
    }

    public function test_pindah_status_poin_mengubah_dan_mencatat_riwayat(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $poin = PapanButir::query()->where('status', 'todo')->firstOrFail();

        $this->patchJson("/api/board/E.3/butir/{$poin->id}/status", ['status' => 'in_progress', 'catatan' => 'Mulai'])
            ->assertOk()
            ->assertExactJson([
                'kode' => 'E.3',
                'id' => $poin->id,
                'status' => 'in_progress',
                'status_sub_modul' => 'in_progress',
            ]);

        $this->assertDatabaseHas('papan_butir', [
            'id' => $poin->id,
            'status' => 'in_progress',
        ], 'papan');

        $this->getJson('/api/board/riwayat')
            ->assertOk()
            ->assertJsonPath('riwayat.0.kode', 'E.3')
            ->assertJsonPath('riwayat.0.ke', 'in_progress')
            ->assertJsonPath('riwayat.0.oleh', 'pengguna');
    }

    /**
     * Sub-modul baru menjadi Done kalau SEMUA poinnya Done. Satu poin yang
     * masih To Do cukup menahannya.
     */
    public function test_status_sub_modul_melewati_review_sebelum_done(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->getJson('/api/board/E.3')->assertJsonPath('status', 'todo');

        $sisa = PapanButir::query()->where('status', 'todo')->firstOrFail();

        $this->patchJson("/api/board/E.3/butir/{$sisa->id}/status", ['status' => 'for_review'])
            ->assertOk()
            ->assertJsonPath('status_sub_modul', 'for_review');

        $this->getJson('/api/board/E.3')->assertJsonPath('status', 'for_review');

        $this->patchJson("/api/board/E.3/butir/{$sisa->id}/status", ['status' => 'done'])
            ->assertOk()
            ->assertJsonPath('status_sub_modul', 'done');

        $this->getJson('/api/board/E.3')->assertJsonPath('status', 'done');
    }

    public function test_pindah_dengan_status_tidak_sah_ditolak_validasi(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $poin = PapanButir::query()->firstOrFail();

        $this->patchJson("/api/board/E.3/butir/{$poin->id}/status", ['status' => 'ngarang'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_pindah_kode_tidak_dikenal_menjawab_404(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->patchJson('/api/board/Z.9/butir/1/status', ['status' => 'in_progress'])->assertStatus(404);
    }

    public function test_pindah_poin_yang_tidak_ada_menjawab_404(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->patchJson('/api/board/E.3/butir/99999/status', ['status' => 'in_progress'])->assertStatus(404);
    }

    public function test_tambah_dan_hapus_butir(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $id = $this->postJson('/api/board/E.3/butir', [
            'status' => 'todo',
            'deskripsi' => 'Butir baru lewat API.',
        ])->assertStatus(201)->json('id');

        $this->deleteJson("/api/board/E.3/butir/{$id}")->assertOk();

        $this->deleteJson("/api/board/E.3/butir/{$id}")->assertStatus(404);
    }

    public function test_peran_admin_tidak_boleh_membaca_atau_mengubah(): void
    {
        Sanctum::actingAs($this->pengguna(['admin']));

        $poin = PapanButir::query()->where('status', 'todo')->firstOrFail();

        $this->getJson('/api/board')->assertStatus(403);
        $this->patchJson("/api/board/E.3/butir/{$poin->id}/status", ['status' => 'in_progress'])->assertStatus(403);
    }

    /**
     * Papan bukan data pesantren: akses tidak boleh mensyaratkan lembaga aktif,
     * supaya tetap terbaca walau lembaga aktif belum dipilih.
     */
    public function test_tidak_mensyaratkan_lembaga_aktif(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->getJson('/api/board')->assertOk();
    }

    /** @param array<int, string> $peran */
    public function test_ubah_butir_mengganti_deskripsi_lewat_api(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->orderBy('urutan')->firstOrFail();

        $this->patchJson("/api/board/E.3/butir/{$butir->id}", [
            'deskripsi' => 'Rekap harian per kas.',
            'jenis_perubahan' => 'scope',
            'persetujuan_scope' => 'Persetujuan fixture tes untuk perubahan hasil rekap.',
        ])
            ->assertOk()
            ->assertJsonPath('deskripsi', 'Rekap harian per kas.');

        $this->assertSame('Rekap harian per kas.', $butir->refresh()->deskripsi);
    }

    public function test_keterangan_bisa_disimpan_ditampilkan_dan_dikosongkan(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->where('status', 'todo')->firstOrFail();

        $this->patchJson("/api/board/E.3/butir/{$butir->id}", ['keterangan' => 'Catatan rinci per kas.'])
            ->assertOk()
            ->assertJsonPath('keterangan', 'Catatan rinci per kas.');

        $this->getJson('/api/board')
            ->assertOk()
            ->assertJsonFragment(['keterangan' => 'Catatan rinci per kas.']);

        $this->patchJson("/api/board/E.3/butir/{$butir->id}", ['keterangan' => ''])
            ->assertOk()
            ->assertJsonPath('keterangan', null);

        $this->assertNull($butir->refresh()->keterangan);
    }

    public function test_tambah_butir_dengan_keterangan(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->postJson('/api/board/E.3/butir', [
            'status' => 'todo',
            'deskripsi' => 'Poin berketerangan.',
            'keterangan' => 'Rincian singkat.',
        ])
            ->assertCreated()
            ->assertJsonPath('deskripsi', 'Poin berketerangan.')
            ->assertJsonPath('keterangan', 'Rincian singkat.');
    }

    public function test_subpoin_bisa_disimpan_ditampilkan_dan_dihapus_tanpa_mengubah_status(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->where('status', 'todo')->firstOrFail();

        $subpoin = [
            ['teks' => 'Periksa saldo kas.', 'selesai' => false],
            ['teks' => 'Unduh rekap bulanan.', 'selesai' => true],
        ];

        $this->patchJson("/api/board/E.3/butir/{$butir->id}", ['subpoin' => $subpoin])
            ->assertOk()
            ->assertJsonPath('subpoin.1.teks', 'Unduh rekap bulanan.')
            ->assertJsonPath('subpoin.1.selesai', true);

        $this->getJson('/api/board')
            ->assertOk()
            ->assertJsonFragment(['subpoin' => $subpoin]);
        $this->assertSame('todo', $butir->refresh()->status);

        $this->patchJson("/api/board/E.3/butir/{$butir->id}", ['subpoin' => []])
            ->assertOk()
            ->assertJsonPath('subpoin', []);
    }

    public function test_subpoin_kosong_ditolak_validasi(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->firstOrFail();

        $this->patchJson("/api/board/E.3/butir/{$butir->id}", [
            'subpoin' => [['teks' => '', 'selesai' => false]],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('subpoin.0.teks');
    }

    public function test_status_done_ditolak_bila_ada_subpoin_belum_selesai(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->where('status', 'todo')->firstOrFail();
        $butir->update(['subpoin' => [
            ['teks' => 'Satu.', 'selesai' => true],
            ['teks' => 'Dua.', 'selesai' => false],
        ]]);

        $this->patchJson("/api/board/E.3/butir/{$butir->id}/status", ['status' => 'done'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $this->assertSame('todo', $butir->refresh()->status);
    }

    public function test_status_done_boleh_bila_semua_subpoin_selesai(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->where('status', 'todo')->firstOrFail();
        $butir->update(['subpoin' => [
            ['teks' => 'Satu.', 'selesai' => true],
            ['teks' => 'Dua.', 'selesai' => true],
        ]]);

        $this->patchJson("/api/board/E.3/butir/{$butir->id}/status", ['status' => 'done'])
            ->assertOk()
            ->assertJsonPath('status', 'done');

        $this->assertSame('done', $butir->refresh()->status);
    }

    public function test_uncheck_subpoin_dengan_konfirmasi_menurunkan_done_ke_in_progress(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->where('status', 'done')->firstOrFail();
        $butir->update(['subpoin' => [
            ['teks' => 'Satu.', 'selesai' => true],
            ['teks' => 'Dua.', 'selesai' => true],
        ]]);

        $this->patchJson("/api/board/E.3/butir/{$butir->id}", ['konfirmasi_reopen' => true, 'subpoin' => [
            ['teks' => 'Satu.', 'selesai' => true],
            ['teks' => 'Dua.', 'selesai' => false],
        ]])
            ->assertOk()
            ->assertJsonPath('status', 'in_progress');

        $this->assertSame('in_progress', $butir->refresh()->status);
        $this->assertDatabaseHas('papan_riwayat', [
            'butir_id' => $butir->id,
            'dari_status' => 'done',
            'ke_status' => 'in_progress',
        ], 'papan');
    }

    public function test_subpoin_baru_pada_done_memerlukan_scope_disetujui_dan_konfirmasi_reopen(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->where('status', 'done')->firstOrFail();
        $butir->update(['subpoin' => [['teks' => 'Satu.', 'selesai' => true]]]);

        $this->patchJson("/api/board/E.3/butir/{$butir->id}", [
            'konfirmasi_reopen' => true,
            'jenis_perubahan' => 'scope',
            'persetujuan_scope' => 'Persetujuan fixture tes untuk menambah syarat hasil.',
            'subpoin' => [
                ['teks' => 'Satu.', 'selesai' => true],
                ['teks' => 'Dua.', 'selesai' => false],
            ]])
            ->assertOk()
            ->assertJsonPath('status', 'in_progress');

        $this->assertSame('in_progress', $butir->refresh()->status);
    }

    public function test_ubah_butir_tanpa_apa_pun_dijawab_422(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->orderBy('urutan')->firstOrFail();

        // Tanpa deskripsi DAN tanpa status: tidak ada yang berubah, jadi
        // ini kekeliruan pemanggil - bukan sukses diam-diam.
        $this->patchJson("/api/board/E.3/butir/{$butir->id}", [])->assertStatus(422);
    }

    public function test_ubah_butir_dengan_status_ikut_mengembalikan_status_sub_modul(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $butir = PapanButir::query()->where('status', 'todo')->firstOrFail();

        $this->patchJson("/api/board/E.3/butir/{$butir->id}", ['status' => 'done'])
            ->assertOk()
            ->assertJsonPath('status', 'done')
            // Semua poin E.3 kini Done, jadi sub-modul turunannya ikut Done.
            ->assertJsonPath('status_sub_modul', 'done');
    }

    public function test_geser_butir_di_ujung_dijawab_409(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $teratas = PapanButir::query()->orderBy('urutan')->firstOrFail();

        $this->patchJson("/api/board/E.3/butir/{$teratas->id}/urutan", ['arah' => -1])
            ->assertStatus(409);
    }

    public function test_geser_butir_menukar_urutan(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $id = PapanButir::query()->orderBy('urutan')->pluck('id')->all();

        $this->patchJson("/api/board/E.3/butir/{$id[1]}/urutan", ['arah' => -1])->assertOk();

        $this->assertSame([$id[1], $id[0]], PapanButir::query()->orderBy('urutan')->pluck('id')->all());
    }

    public function test_ubah_item_mengganti_nama_dan_kode(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->patchJson('/api/board/item/E.3', ['nama' => 'Kas & Bank', 'kode_baru' => 'E.8'])
            ->assertOk()
            ->assertJsonPath('kode', 'E.8')
            ->assertJsonPath('nama', 'Kas & Bank');

        // Poin tidak boleh ikut hilang saat sub-modul dinamai ulang.
        $this->assertSame(2, PapanButir::query()->count());
    }

    public function test_tambah_dan_hapus_sub_modul_lewat_api(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->postJson('/api/board/modul/E/item', ['kode' => 'E.7', 'nama' => 'Laporan Kas'])
            ->assertStatus(201)
            ->assertJsonPath('kode', 'E.7');

        $this->deleteJson('/api/board/item/E.7')->assertOk();

        $this->assertSame(0, PapanItem::query()->where('kode', 'E.7')->count());
    }

    public function test_kode_sub_modul_kembar_dijawab_422(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->postJson('/api/board/modul/E/item', ['kode' => 'E.3', 'nama' => 'Kembar'])
            ->assertStatus(422);
    }

    public function test_izin_ubah_dibutuhkan_untuk_menyunting(): void
    {
        // Izin lihat saja TIDAK cukup untuk mengubah: pagar papan.ubah
        // harus benar-benar berlaku, bukan sekadar ada di rute.
        Sanctum::actingAs($this->pengguna(['guru']));
        $butir = PapanButir::query()->orderBy('urutan')->firstOrFail();

        $this->patchJson("/api/board/E.3/butir/{$butir->id}", ['deskripsi' => 'Nakal.'])
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

        // Dua poin: satu Done, satu To Do. Status sub-modulnya turunan, jadi
        // fixture ini membuktikan E.3 tetap To Do selama masih ada sisa.
        $item->butir()->create(['status' => 'done', 'deskripsi' => 'Rekap per kas.', 'urutan' => 1]);
        $item->butir()->create(['status' => 'todo', 'deskripsi' => 'Ekspor rekap.', 'urutan' => 2]);
    }
}

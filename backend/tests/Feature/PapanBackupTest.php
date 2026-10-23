<?php

namespace Tests\Feature;

use App\Models\Papan\PapanButir;
use App\Models\Papan\PapanItem;
use App\Models\Papan\PapanModul;
use App\Models\Papan\PapanRiwayat;
use App\Models\User;
use App\Services\PapanBackupService;
use App\Services\PapanService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PapanBackupTest extends TestCase
{
    use RefreshDatabase;

    private PapanBackupService $backup;

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

        Storage::fake('local');
        $this->backup = app(PapanBackupService::class);
        $this->buatPapan();
    }

    public function test_round_trip_mempertahankan_id_status_catatan_scope_dan_riwayat(): void
    {
        $awal = $this->backup->ekspor();
        $json = $this->backup->eksporJson();

        DB::connection('papan')->table('papan_butir')->update(['status' => 'todo', 'deskripsi' => 'Berubah.']);
        DB::connection('papan')->table('papan_pengaturan')->update(['nilai' => '0']);
        DB::connection('papan')->table('papan_butir')->insert([
            'id' => 99, 'item_id' => (int) $awal['item'][0]['id'], 'status' => 'backlog',
            'deskripsi' => 'Poin tambahan.', 'urutan' => 99, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $hasil = $this->backup->pulihkan($json);
        $akhir = $this->backup->ekspor();

        $this->assertSame($awal['pengaturan'], $akhir['pengaturan']);
        $this->assertSame($awal['modul'], $akhir['modul']);
        $this->assertSame($awal['item'], $akhir['item']);
        $this->assertSame($awal['butir'], $akhir['butir']);
        $this->assertSame($awal['riwayat'], $akhir['riwayat']);
        $this->assertSame(1, $hasil['ringkasan']['butir']);
        $this->assertSame(1, $hasil['ringkasan']['riwayat']);
        $this->assertTrue(Storage::disk('local')->exists(PapanBackupService::DIREKTORI.'/'.$hasil['backup_keamanan']));
    }

    public function test_restore_mengembalikan_pengaturan_workflow(): void
    {
        $json = $this->backup->eksporJson();

        DB::connection('papan')->table('papan_pengaturan')->update(['nilai' => '0']);
        $papan = app(PapanService::class);
        $this->assertFalse($papan->workflowMasterAktif());
        $this->assertFalse($papan->workflowAplikasiAktif('desktop-admin'));

        $this->backup->pulihkan($json);

        $this->assertTrue($papan->workflowMasterAktif());
        $this->assertTrue($papan->workflowAplikasiAktif('desktop-admin'));
    }

    public function test_snapshot_legacy_dengan_subpoin_kosong_tetap_bisa_dipulihkan(): void
    {
        DB::connection('papan')->table('papan_butir')->update([
            'scope_versi' => json_encode([[
                'versi' => 1, 'jenis' => 'legacy', 'deskripsi' => 'Poin lama.', 'subpoin' => [],
                'persetujuan' => null, 'alasan' => null, 'oleh' => 'pengguna', 'waktu' => '2026-10-23T00:00:00+07:00',
            ]], JSON_THROW_ON_ERROR),
        ]);

        $json = $this->backup->eksporJson();
        $this->backup->pulihkan($json);

        $this->assertSame(
            [],
            PapanButir::query()->orderBy('id')->firstOrFail()->scope_versi[0]['subpoin'],
        );
    }

    public function test_file_tidak_sah_ditolak_tanpa_mengubah_data(): void
    {
        $awal = $this->backup->ekspor();
        $sah = json_decode($this->backup->eksporJson(), true, flags: JSON_THROW_ON_ERROR);

        $kasus = [
            'JSON rusak' => ['{', 'bukan JSON'],
            'format salah' => [json_encode(['format' => 'lain'] + $sah), 'tidak sah'],
            'versi salah' => [json_encode(['versi' => 99] + $sah), 'tidak sah'],
            'relasi item rusak' => [json_encode(['item' => [['id' => 1, 'modul_id' => 999, 'kode' => 'X.1', 'nama' => 'X', 'rujukan' => null, 'urutan' => 1, 'created_at' => '2026-10-23 00:00:00', 'updated_at' => '2026-10-23 00:00:00']]] + $sah), 'merujuk modul'],
            'relasi riwayat rusak' => [json_encode(['riwayat' => [['id' => 1, 'item_id' => 999, 'butir_id' => null, 'dari_status' => null, 'ke_status' => 'backlog', 'catatan' => null, 'diubah_oleh' => 'agent', 'waktu' => '2026-10-23 00:00:00']]] + $sah), 'merujuk sub-modul'],
        ];

        foreach ($kasus as $nama => [$isi, $harapan]) {
            try {
                $this->backup->pulihkan($isi);
                $this->fail("Kasus {$nama} seharusnya ditolak.");
            } catch (ValidationException $e) {
                $this->assertStringContainsString($harapan, $e->getMessage(), "Pesan kasus {$nama} tidak sesuai.");
            }

            $this->assertSame($awal['butir'], $this->backup->ekspor()['butir'], "Data berubah pada kasus {$nama}.");
            $this->assertSame($awal['riwayat'], $this->backup->ekspor()['riwayat'], "Riwayat berubah pada kasus {$nama}.");
        }
    }

    public function test_endpoint_backup_mengunduh_json_dan_pratinjau_tidak_menulis(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $awal = $this->backup->ekspor();

        $unduh = $this->get('/api/board/backup')->assertOk();
        $this->assertStringContainsString('papan-backup-', (string) $unduh->headers->get('content-disposition'));
        $data = json_decode($unduh->streamedContent(), true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame(PapanBackupService::FORMAT, $data['format']);
        $this->assertCount(1, $data['butir']);

        $berkas = UploadedFile::fake()->createWithContent('papan.json', json_encode($data, JSON_THROW_ON_ERROR));
        $this->post('/api/board/backup/pratinjau', ['berkas' => $berkas])
            ->assertOk()
            ->assertJsonPath('ringkasan.butir', 1)
            ->assertJsonPath('ringkasan.workflow.master', true);

        $this->assertSame($awal['butir'], $this->backup->ekspor()['butir']);
    }

    public function test_endpoint_restore_mengganti_isi_dan_menyediakan_backup_keamanan(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $json = $this->backup->eksporJson();
        DB::connection('papan')->table('papan_butir')->update(['deskripsi' => 'Berubah.']);

        $berkas = UploadedFile::fake()->createWithContent('papan.json', $json);
        $respons = $this->post('/api/board/backup/restore', ['berkas' => $berkas])
            ->assertOk()
            ->assertJsonPath('pesan', 'Restore Board selesai.')
            ->assertJsonStructure(['backup_keamanan']);

        $nama = (string) $respons->json('backup_keamanan');
        $this->assertTrue(Storage::disk('local')->exists(PapanBackupService::DIREKTORI.'/'.$nama));
        $this->assertSame('Rekap per kas.', PapanButir::query()->orderBy('id')->firstOrFail()->deskripsi);

        $this->get('/api/board/backup/keamanan/'.$nama)->assertOk();
        $this->get('/api/board/backup/keamanan/../../.env')->assertNotFound();
    }

    public function test_backup_dan_restore_butuh_izin_yang_sesuai(): void
    {
        Sanctum::actingAs($this->pengguna(['guru']));
        $this->get('/api/board/backup')->assertForbidden();
        $this->post('/api/board/backup/restore', [])->assertForbidden();
    }

    public function test_restore_menolak_file_rusak_lewat_endpoint_tanpa_mengubah_data(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $awal = $this->backup->ekspor();
        $berkas = UploadedFile::fake()->createWithContent('papan.json', '{bukan json');

        $this->post('/api/board/backup/restore', ['berkas' => $berkas])
            ->assertStatus(422)
            ->assertJsonValidationErrors('berkas');

        $this->assertSame($awal['butir'], $this->backup->ekspor()['butir']);
    }

    private function pengguna(array $peran): User
    {
        $user = User::create([
            'name' => 'Uji Backup '.uniqid(),
            'email' => 'backup_'.uniqid().'@example.com',
            'password' => 'password123',
        ]);
        $user->assignRole($peran);

        return $user;
    }

    private function buatPapan(): void
    {
        DB::connection('papan')->table('papan_pengaturan')->insert([
            ['kunci' => 'workflow_aktif', 'nilai' => '1'],
            ['kunci' => 'workflow_aktif:desktop-admin', 'nilai' => '1'],
        ]);

        $modul = PapanModul::create([
            'aplikasi' => 'desktop-admin', 'kode' => 'E', 'nama' => 'Keuangan', 'urutan' => 1,
        ]);
        $item = PapanItem::create([
            'modul_id' => $modul->id, 'kode' => 'E.3', 'nama' => 'Rekap Kas', 'urutan' => 1,
        ]);
        $butir = PapanButir::create([
            'item_id' => $item->id, 'status' => 'done', 'deskripsi' => 'Rekap per kas.', 'urutan' => 1,
            'keterangan' => 'Requirement kas.',
            'subpoin' => [['teks' => 'Saldo cocok.', 'selesai' => true]],
            'catatan' => [[
                'jenis' => 'verifikasi', 'teks' => 'Sudah diperiksa.', 'oleh' => 'agent', 'versi_scope' => 1,
                'scope' => ['deskripsi' => 'Rekap per kas.', 'subpoin' => ['Saldo cocok.']],
                'waktu' => '2026-10-23T01:00:00+00:00',
            ]],
            'scope_versi' => [[
                'versi' => 1, 'jenis' => 'awal', 'deskripsi' => 'Rekap per kas.',
                'subpoin' => ['Saldo cocok.'], 'persetujuan' => null, 'alasan' => null,
                'oleh' => 'agent', 'waktu' => '2026-10-23T01:00:00+00:00',
            ]],
        ]);
        PapanRiwayat::create([
            'item_id' => $item->id, 'butir_id' => $butir->id, 'dari_status' => 'for_review',
            'ke_status' => 'done', 'catatan' => 'Selesai.', 'diubah_oleh' => 'pengguna',
            'waktu' => '2026-10-23 01:00:00',
        ]);
    }
}

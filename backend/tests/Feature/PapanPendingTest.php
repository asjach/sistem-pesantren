<?php

namespace Tests\Feature;

use App\Models\Papan\PapanButir;
use App\Models\Papan\PapanItem;
use App\Models\Papan\PapanModul;
use App\Models\Papan\PapanRiwayat;
use App\Services\PapanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PapanPendingTest extends TestCase
{
    use RefreshDatabase;

    private PapanService $papan;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('database.connections.papan.database', ':memory:');
        $this->artisan('migrate', ['--path' => 'database/migrations/papan', '--database' => 'papan', '--force' => true])->run();
        $this->papan = app(PapanService::class);
        $modul = PapanModul::create(['kode' => 'T', 'nama' => 'Fixture', 'aplikasi' => 'desktop-admin']);
        PapanItem::create(['modul_id' => $modul->id, 'kode' => 'T.1', 'nama' => 'Fixture']);
    }

    private function poin(string $status): PapanButir
    {
        return PapanButir::create(['item_id' => PapanItem::firstOrFail()->id,
            'status' => $status, 'deskripsi' => 'Hasil fixture.', 'subpoin' => [], 'urutan' => 1]);
    }

    /** @return array<string, array{string, string}> */
    public static function perpindahan(): array
    {
        return ['masuk Pending' => ['todo', 'pending'], 'keluar Pending' => ['pending', 'backlog'],
            'mulai dari Pending' => ['pending', 'in_progress']];
    }

    #[DataProvider('perpindahan')]
    public function test_agen_tanpa_instruksi_tidak_dapat_memindahkan_pending_dan_tidak_meninggalkan_write_parsial(string $asal, string $tujuan): void
    {
        $poin = $this->poin($asal);
        $awal = $poin->refresh()->getAttributes();
        try {
            $this->papan->ubahButir('T.1', $poin->id, status: $tujuan, keterangan: 'Jangan tersimpan.');
            $this->fail('Perpindahan harus memerlukan instruksi langsung.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('instruksi_pending', $e->errors());
        }
        $this->assertSame($awal, $poin->refresh()->getAttributes());
        $this->assertSame(0, PapanRiwayat::count());
    }

    public function test_agen_dengan_instruksi_langsung_dapat_masuk_dan_keluar_pending_dengan_catatan(): void
    {
        $poin = $this->poin('todo');
        $this->papan->pindahButir('T.1', $poin->id, 'pending', instruksiPending: 'Simpan poin fixture ke Pending.');
        $this->assertSame('pending', $poin->refresh()->status);
        $this->assertStringContainsString('Simpan poin fixture ke Pending.', $poin->catatan[0]['teks']);
        $this->papan->ubahButir('T.1', $poin->id, status: 'backlog', instruksiPending: 'Keluarkan poin fixture ke Backlog.');
        $this->assertSame('backlog', $poin->refresh()->status);
        $this->assertCount(2, $poin->catatan);
        $this->assertSame(['pending', 'backlog'], PapanRiwayat::orderBy('id')->pluck('ke_status')->all());
    }

    public function test_edit_teks_pending_tidak_memerlukan_instruksi_perpindahan(): void
    {
        $poin = $this->poin('pending');
        $this->papan->ubahButir('T.1', $poin->id, keterangan: 'Requirement baru.');
        $this->assertSame('pending', $poin->refresh()->status);
        $this->assertSame('Requirement baru.', $poin->keterangan);
        $this->assertSame(0, PapanRiwayat::count());
    }

    public function test_pembuatan_pending_oleh_agen_memerlukan_instruksi_yang_tidak_kosong(): void
    {
        foreach ([null, '   '] as $instruksi) {
            try {
                $this->papan->tambahButir('T.1', 'pending', 'Belum diizinkan.', instruksiPending: $instruksi);
                $this->fail('Pending tanpa instruksi harus ditolak.');
            } catch (ValidationException $e) {
                $this->assertArrayHasKey('instruksi_pending', $e->errors());
            }
        }
        $this->assertSame(0, PapanButir::count());
        $poin = $this->papan->tambahButir('T.1', 'pending', 'Diminta pengguna.', instruksiPending: 'Tambahkan fixture ke Pending.');
        $this->assertSame('pending', $poin->status);
        $this->assertStringContainsString('Tambahkan fixture ke Pending.', $poin->catatan[0]['teks']);
    }

    public function test_cli_menolak_pending_tanpa_instruksi_dan_menerima_instruksi_langsung(): void
    {
        $poin = $this->poin('todo');
        $arg = ['kode' => 'T.1', 'id' => $poin->id, 'status' => 'pending'];
        $this->artisan('papan:tandai', $arg)->assertExitCode(1);
        $this->assertSame('todo', $poin->refresh()->status);
        $this->artisan('papan:tandai', [...$arg, '--instruksi-pending' => 'Pindahkan fixture ke Pending.'])->assertExitCode(0);
        $this->assertSame('pending', $poin->refresh()->status);

        $arg = ['aksi' => 'ubah', 'kode' => 'T.1', '--id' => $poin->id, '--status' => 'backlog'];
        $this->artisan('papan:butir', $arg)->assertExitCode(1);
        $this->assertSame('pending', $poin->refresh()->status);
        $this->artisan('papan:butir', [...$arg, '--instruksi-pending' => 'Pindahkan fixture ke Backlog.'])->assertExitCode(0);
        $this->assertSame('backlog', $poin->refresh()->status);
    }

    public function test_cli_payload_json_pending_memerlukan_instruksi(): void
    {
        $poin = $this->poin('todo');
        $file = tempnam(sys_get_temp_dir(), 'papan_pending_');
        try {
            $arg = ['aksi' => 'ubah', 'kode' => 'T.1', '--id' => $poin->id, '--file' => $file];
            file_put_contents($file, json_encode(['status' => 'pending'], JSON_THROW_ON_ERROR));
            $this->artisan('papan:butir', $arg)->assertExitCode(1);
            $this->assertSame('todo', $poin->refresh()->status);
            file_put_contents($file, json_encode(['status' => 'pending', 'instruksi_pending' => 'Masukkan fixture ke Pending.'], JSON_THROW_ON_ERROR));
            $this->artisan('papan:butir', $arg)->assertExitCode(0);
            $this->assertSame('pending', $poin->refresh()->status);
        } finally {
            unlink($file);
        }
    }

    public function test_instruksi_pending_tidak_memberi_izin_agen_menetapkan_done(): void
    {
        $poin = $this->poin('pending');
        $this->expectException(ValidationException::class);
        $this->papan->pindahButir('T.1', $poin->id, 'done', instruksiPending: 'Instruksi fixture.');
    }
}

<?php

namespace Tests\Feature;

use App\Models\Papan\PapanButir;
use App\Models\Papan\PapanItem;
use App\Models\Papan\PapanModul;
use App\Models\Papan\PapanRiwayat;
use App\Services\PapanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PapanAdaptasiTest extends TestCase
{
    use RefreshDatabase;

    private PapanService $papan;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('database.connections.papan.database', ':memory:');
        $this->artisan('migrate', ['--path' => 'database/migrations/papan', '--database' => 'papan', '--force' => true])->run();
        $this->papan = app(PapanService::class);
        $modul = PapanModul::create(['kode' => 'T', 'nama' => 'Fixture', 'aplikasi' => 'desktop-admin', 'urutan' => 1]);
        PapanItem::create(['modul_id' => $modul->id, 'kode' => 'T.1', 'nama' => 'Fixture', 'urutan' => 1]);
    }

    private function poin(string $status = 'todo'): PapanButir
    {
        return PapanButir::create(['item_id' => PapanItem::firstOrFail()->id,
            'status' => $status, 'deskripsi' => 'Hasil fixture.', 'keterangan' => 'Requirement fixture.',
            'subpoin' => [['teks' => 'Hasil dapat diperiksa.', 'selesai' => $status === 'done']], 'urutan' => 1]);
    }

    public function test_cli_baca_json_tidak_membuat_snapshot_legacy(): void
    {
        $poin = $this->poin();
        $this->papan->setWorkflowMasterAktif(true);
        $this->papan->setWorkflowAplikasiAktif('desktop-admin', true);
        $this->assertSame(0, Artisan::call('papan:lihat', ['kode' => 'T.1', '--json' => true]));
        $data = json_decode(Artisan::output(), true, flags: JSON_THROW_ON_ERROR);
        $this->assertTrue($data['workflow_master_aktif']);
        $this->assertTrue($data['aplikasi'][0]['workflow_efektif']);
        $butir = $data['aplikasi'][0]['modul'][0]['sub'][0]['butir'][0];
        $this->assertTrue($butir['legacy']);
        $this->assertSame('Requirement fixture.', $butir['keterangan']);
        $this->assertCount(1, $butir['subpoin']);
        $this->assertNull($poin->refresh()->scope_versi);
    }

    public function test_catatan_legacy_terpisah_dan_tidak_mengarang_persetujuan_lama(): void
    {
        $poin = $this->poin('for_review');
        $this->papan->catatButir('T.1', $poin->id, 'catatan', 'Pemeriksaan saat ini, bukan bukti historis.');
        $poin->refresh();
        $this->assertSame('for_review', $poin->status);
        $this->assertCount(1, $poin->scope_versi);
        $this->assertSame('legacy', $poin->scope_versi[0]['jenis']);
        $this->assertNull($poin->scope_versi[0]['persetujuan']);
        $this->assertSame('agent', $poin->catatan[0]['oleh']);
        $this->assertSame('catatan', $poin->catatan[0]['jenis']);
        $this->assertSame('Hasil dapat diperiksa.', $poin->subpoin[0]['teks']);
        $this->assertSame(0, PapanRiwayat::count());
    }

    public function test_scope_substantif_perlu_persetujuan_dan_snapshot_baru(): void
    {
        $poin = $this->poin('in_progress');
        $this->papan->ubahButir('T.1', $poin->id, deskripsi: 'Hasil baru disetujui.', catatan: 'Alasan fixture.',
            jenisPerubahan: 'scope', persetujuanScope: 'Persetujuan pengguna pada fixture tes.');
        $poin->refresh();
        $this->assertCount(2, $poin->scope_versi);
        $this->assertSame('Hasil fixture.', $poin->scope_versi[0]['deskripsi']);
        $this->assertSame('Hasil baru disetujui.', $poin->scope_versi[1]['deskripsi']);
        $this->assertSame('Persetujuan pengguna pada fixture tes.', $poin->scope_versi[1]['persetujuan']);
        $this->assertSame('in_progress', $poin->status);
    }

    public function test_scope_tanpa_persetujuan_gagal_tanpa_perubahan_parsial(): void
    {
        $poin = $this->poin('in_progress');
        try {
            $this->papan->ubahButir('T.1', $poin->id, deskripsi: 'Belum disetujui.', keterangan: 'Jangan tersimpan.');
            $this->fail('Scope tanpa persetujuan harus ditolak.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('scope', $e->errors());
        }
        $poin->refresh();
        $this->assertSame('Hasil fixture.', $poin->deskripsi);
        $this->assertSame('Requirement fixture.', $poin->keterangan);
        $this->assertNull($poin->scope_versi);
        $this->assertNull($poin->catatan);
    }

    public function test_typo_dan_checkbox_tidak_menambah_versi_scope(): void
    {
        $poin = $this->poin('in_progress');
        $this->papan->catatButir('T.1', $poin->id, 'catatan', 'Baseline fixture.');
        $this->papan->ubahButir('T.1', $poin->id, deskripsi: 'Hasil fixture!', catatan: 'Tanda baca saja.', jenisPerubahan: 'typo');
        $this->papan->ubahButir('T.1', $poin->id, subpoin: [['teks' => 'Hasil dapat diperiksa.', 'selesai' => true]]);
        $poin->refresh();
        $this->assertCount(1, $poin->scope_versi);
        $this->assertCount(2, $poin->catatan);
        $this->assertStringContainsString('Koreksi typo', $poin->catatan[1]['teks']);
        $this->assertTrue($poin->subpoin[0]['selesai']);
    }

    public function test_reopen_tanpa_konfirmasi_tidak_mengubah_checklist_atau_riwayat(): void
    {
        $poin = $this->poin('done');
        try {
            $this->papan->ubahButir('T.1', $poin->id, subpoin: [['teks' => 'Hasil dapat diperiksa.', 'selesai' => false]]);
            $this->fail('Reopen harus meminta konfirmasi.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('konfirmasi_reopen', $e->errors());
        }
        $this->assertSame('done', $poin->refresh()->status);
        $this->assertTrue($poin->subpoin[0]['selesai']);
        $this->assertNull($poin->scope_versi);
        $this->assertSame(0, PapanRiwayat::count());
    }

    public function test_reopen_dikonfirmasi_tetap_ditolak_jika_ada_poin_aktif_satu_aplikasi(): void
    {
        $poin = $this->poin('done');
        $this->poin('in_progress');
        try {
            $this->papan->ubahButir('T.1', $poin->id, subpoin: [['teks' => 'Hasil dapat diperiksa.', 'selesai' => false]], konfirmasiReopen: true);
            $this->fail('Poin aktif lain harus menghalangi Reopen.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('status', $e->errors());
        }
        $this->assertSame('done', $poin->refresh()->status);
        $this->assertTrue($poin->subpoin[0]['selesai']);
        $this->assertNull($poin->scope_versi);
        $this->assertSame(0, PapanRiwayat::count());
    }

    public function test_reopen_eksplisit_juga_memerlukan_konfirmasi(): void
    {
        $poin = $this->poin('done');
        $this->expectException(ValidationException::class);
        $this->papan->pindahButir('T.1', $poin->id, 'in_progress', 'pengguna');
    }

    public function test_cli_done_tidak_bisa_dilewati_dengan_label_pengguna(): void
    {
        $poin = $this->poin('for_review');
        $this->artisan('papan:tandai', ['kode' => 'T.1', 'id' => $poin->id, 'status' => 'done', '--oleh' => 'pengguna'])->assertExitCode(1);
        $this->artisan('papan:butir', ['aksi' => 'ubah', 'kode' => 'T.1', '--id' => $poin->id, '--status' => 'done', '--oleh' => 'pengguna'])->assertExitCode(1);
        $this->assertSame('for_review', $poin->refresh()->status);
    }

    public function test_cli_catat_tidak_mengubah_scope_dan_status(): void
    {
        $poin = $this->poin('in_progress');
        $this->artisan('papan:catat', ['kode' => 'T.1', 'id' => $poin->id, 'jenis' => 'persetujuan', '--teks' => 'Persetujuan fixture tes.'])->assertExitCode(0);
        $this->assertSame('persetujuan', $poin->refresh()->catatan[0]['jenis']);
        $this->assertSame('in_progress', $poin->status);
        $this->assertSame('Hasil fixture.', $poin->deskripsi);
    }

    public function test_cli_payload_memperbarui_checklist_dan_requirement_saja(): void
    {
        $poin = $this->poin();
        $file = tempnam(sys_get_temp_dir(), 'papan_test_');
        try {
            file_put_contents($file, json_encode(['subpoin' => [['teks' => 'Kriteria disetujui.', 'selesai' => false]], 'keterangan' => '']));
            $this->artisan('papan:butir', ['aksi' => 'ubah', 'kode' => 'T.1', '--id' => $poin->id, '--file' => $file])->assertExitCode(0);
            $poin->refresh();
            $this->assertNull($poin->keterangan);
            $this->assertSame('Hasil fixture.', $poin->deskripsi);
            $this->assertSame('Kriteria disetujui.', $poin->subpoin[0]['teks']);
            $this->assertSame('todo', $poin->status);
        } finally {
            unlink($file);
        }
    }

    public function test_cli_payload_invalid_tidak_menimpa_data(): void
    {
        $poin = $this->poin();
        $file = tempnam(sys_get_temp_dir(), 'papan_test_');
        try {
            file_put_contents($file, '{"deskripsi":"Baru","subpoin":[{"teks":"","selesai":false}]}');
            $this->artisan('papan:butir', ['aksi' => 'ubah', 'kode' => 'T.1', '--id' => $poin->id, '--file' => $file])->assertExitCode(1);
            $this->assertSame('Hasil fixture.', $poin->refresh()->deskripsi);
            $this->assertNull($poin->scope_versi);
        } finally {
            unlink($file);
        }
    }

    public function test_catatan_invalid_tidak_membuat_baseline(): void
    {
        $poin = $this->poin();
        $this->expectException(ValidationException::class);
        try {
            $this->papan->catatButir('T.1', $poin->id, 'catatan', '   ');
        } finally {
            $this->assertNull($poin->refresh()->scope_versi);
        }
    }
}

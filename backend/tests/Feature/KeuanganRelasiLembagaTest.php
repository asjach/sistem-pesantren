<?php

namespace Tests\Feature;

use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Feature\Concerns\VerifikasiFkKeuangan;
use Tests\TestCase;

class KeuanganRelasiLembagaTest extends TestCase
{
    use VerifikasiFkKeuangan;

    protected bool $seedIzinBawaan = false;

    private string $koneksiAwal;

    protected function setUp(): void
    {
        parent::setUp();
        $this->koneksiAwal = DB::getDefaultConnection();
        config()->set('database.connections.keuangan_fk_651', [
            'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
        ]);
        DB::setDefaultConnection('keuangan_fk_651');
        Storage::fake('local');
        $this->artisan('migrate', ['--database' => 'keuangan_fk_651', '--force' => true])->assertExitCode(0);
    }

    protected function tearDown(): void
    {
        DB::purge('keuangan_fk_651');
        DB::setDefaultConnection($this->koneksiAwal);
        parent::tearDown();
    }

    private function migration(): Migration
    {
        return require database_path('migrations/2026_10_24_090614_enforce_lembaga_foreign_keys_on_keuangan_tables.php');
    }

    public function test_upgrade_dan_rollback_mempertahankan_data_child_dan_metadata(): void
    {
        $this->migration()->down();
        $data = $this->buatDataRelasiKeuangan();
        DB::statement('CREATE INDEX indeks_fk_651_khusus ON tarif_tagihan (nominal DESC) WHERE is_active = 1');
        DB::statement('CREATE INDEX indeks_fk_651_ekspresi ON jenis_tagihan (lower(nama))');
        DB::statement('CREATE TRIGGER trigger_fk_651 AFTER UPDATE OF nominal ON tarif_tagihan BEGIN UPDATE jenis_tagihan SET keterangan = \'trigger aktif\' WHERE id = NEW.jenis_id; END');
        DB::statement('CREATE VIEW view_fk_651 AS SELECT id, nama FROM jenis_tagihan');
        $sementara = DB::table('jenis_tagihan')->insertGetId(['id' => 9000, 'nama' => 'Terhapus', 'tipe' => 'non_bulanan']);
        DB::table('jenis_tagihan')->where('id', $sementara)->delete();
        $sebelum = $this->snapshotData();
        $metadata = $this->metadata();
        $ddl = DB::table('sqlite_schema')->where('type', 'table')->whereIn('name', ['jenis_tagihan', 'tarif_tagihan', 'tagihan'])->orderBy('name')->pluck('sql', 'name')->all();

        foreach (['up', 'up', 'down', 'up'] as $aksi) {
            $this->migration()->{$aksi}();
            $this->assertSame($sebelum, $this->snapshotData());
            $this->assertSame($metadata, $this->metadata());
            $this->assertSame(9000, (int) DB::table('sqlite_sequence')->where('name', 'jenis_tagihan')->value('seq'));
            foreach ($ddl as $tabel => $sql) {
                // Menghapus FK baru dari SQL cukup untuk membandingkan seluruh
                // definisi asli, termasuk CHECK dan UNIQUE yang lama.
                $akhir = (string) DB::table('sqlite_schema')->where('name', $tabel)->value('sql');
                $akhir = preg_replace('/, constraint "fk_651_[^"]+" foreign key \("jenjang"\) references "lembaga" \("jenjang"\) on update cascade on delete restrict/', '', $akhir);
                $this->assertSame($sql, $akhir);
            }
            $this->assertSame([], DB::select('PRAGMA foreign_key_check'));
            $this->assertSame(1, (int) DB::scalar('PRAGMA foreign_keys'));
            $this->assertSame(0, (int) DB::scalar('PRAGMA legacy_alter_table'));
            $this->assertSame('Jenis FK 651', DB::table('view_fk_651')->where('id', $data['jenis_tagihan'])->value('nama'));
        }
        DB::table('tarif_tagihan')->where('id', $data['tarif_tagihan'])->update(['nominal' => 110000]);
        $this->assertSame('trigger aktif', DB::table('jenis_tagihan')->where('id', $data['jenis_tagihan'])->value('keterangan'));
        $this->assertGreaterThan(9000, DB::table('jenis_tagihan')->insertGetId(['nama' => 'Setelah upgrade', 'tipe' => 'non_bulanan']));
        $this->harusDitolakFk(fn () => DB::table('tarif_tagihan')->insert([
            'jenjang' => 'FK651', 'tahun_ajaran' => '2026/2027', 'jenis_id' => $data['jenis_tagihan'], 'nominal' => 1,
        ]));
    }

    #[DataProvider('tabelOrphan')]
    public function test_orphan_menghentikan_semua_perubahan_sebelum_rebuild(string $tabel): void
    {
        $this->migration()->down();
        $this->buatDataRelasiKeuangan();
        DB::table($tabel)->update(['jenjang' => 'ORPHAN']);
        $sebelum = $this->snapshotData();
        $schema = DB::select('SELECT * FROM sqlite_schema ORDER BY name');
        try {
            $this->migration()->up();
            $this->fail('Upgrade orphan harus ditolak.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString($tabel.': 1 baris', $e->getMessage());
        }
        $this->assertSame($sebelum, $this->snapshotData());
        $this->assertEquals($schema, DB::select('SELECT * FROM sqlite_schema ORDER BY name'));
        $this->assertSame(1, (int) DB::scalar('PRAGMA foreign_keys'));
    }

    public static function tabelOrphan(): array
    {
        return [['jenis_tagihan'], ['tarif_tagihan'], ['tagihan']];
    }

    public function test_kegagalan_di_tabel_kedua_membatalkan_rebuild_tabel_pertama(): void
    {
        $this->migration()->down();
        $this->buatDataRelasiKeuangan();
        $sebelum = $this->snapshotData();
        $schema = DB::select('SELECT * FROM sqlite_schema ORDER BY name');
        DB::listen(function (QueryExecuted $event): void {
            if ($event->connectionName === 'keuangan_fk_651' && $event->sql === 'DROP TABLE "tarif_tagihan"') {
                throw new RuntimeException('Simulasi gagal setelah DDL tabel kedua.');
            }
        });
        try {
            $this->migration()->up();
            $this->fail('Kegagalan DDL harus membatalkan transaction.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('Simulasi gagal', $e->getMessage());
        }
        $this->assertSame($sebelum, $this->snapshotData());
        $this->assertEquals($schema, DB::select('SELECT * FROM sqlite_schema ORDER BY name'));
        $this->assertSame(1, (int) DB::scalar('PRAGMA foreign_keys'));
    }

    public function test_outer_transaction_ditolak_tanpa_menonaktifkan_fk(): void
    {
        $this->migration()->down();
        DB::beginTransaction();
        try {
            $this->migration()->up();
            $this->fail('Outer transaction harus ditolak.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('di luar transaction', $e->getMessage());
            $this->assertSame(1, (int) DB::scalar('PRAGMA foreign_keys'));
        } finally {
            DB::rollBack();
        }
        $this->assertCount(0, array_filter(Schema::getForeignKeys('jenis_tagihan'), fn (array $fk): bool => $fk['columns'] === ['jenjang']));
    }

    public function test_pengaturan_fk_awalnya_mati_dipulihkan_setelah_upgrade(): void
    {
        $this->migration()->down();
        DB::statement('PRAGMA foreign_keys = OFF');
        $this->migration()->up();
        $this->assertSame(0, (int) DB::scalar('PRAGMA foreign_keys'));
        $this->assertCount(1, Schema::getForeignKeys('jenis_tagihan'));
    }

    private function snapshotData(): array
    {
        $hasil = [];
        foreach (['lembaga', 'jenis_tagihan', 'tarif_tagihan', 'tagihan', 'pembayaran', 'transaksi_pembayaran', 'dispensasi', 'dispensasi_aturan'] as $tabel) {
            $hasil[$tabel] = DB::table($tabel)->orderBy($tabel === 'lembaga' ? 'jenjang' : 'id')->get()->map(fn (object $row): array => (array) $row)->all();
        }

        return $hasil;
    }

    private function metadata(): array
    {
        return DB::table('sqlite_schema')->whereIn('tbl_name', ['jenis_tagihan', 'tarif_tagihan', 'tagihan'])->whereIn('type', ['index', 'trigger'])->whereNotNull('sql')->orderBy('name')->pluck('sql', 'name')->all();
    }
}

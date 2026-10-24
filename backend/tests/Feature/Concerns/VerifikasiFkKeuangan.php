<?php

namespace Tests\Feature\Concerns;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

trait VerifikasiFkKeuangan
{
    public function test_relasi_lembaga_keuangan_menolak_orphan_dan_delete_serta_meneruskan_update(): void
    {
        DB::beginTransaction();
        try {
            $data = $this->buatDataRelasiKeuangan();
            foreach (['jenis_tagihan', 'tarif_tagihan', 'tagihan'] as $tabel) {
                $fk = array_values(array_filter(Schema::getForeignKeys($tabel), fn (array $fk): bool => $fk['columns'] === ['jenjang']));
                $this->assertCount(1, $fk);
                $this->assertSame('lembaga', $fk[0]['foreign_table']);
                $this->assertSame('cascade', strtolower($fk[0]['on_update']));
                $this->assertSame('restrict', strtolower($fk[0]['on_delete']));
                $id = $data[$tabel];
                $this->harusDitolakFk(fn () => DB::table($tabel)->where('id', $id)->update(['jenjang' => 'TIDAK_ADA']));

                // Masing-masing parent dipakai hanya satu tabel agar setiap
                // restrict-delete diuji, bukan selalu FK pertama yang menolak.
                $jenjang = 'FK_'.$tabel;
                DB::table('lembaga')->insert(['jenjang' => $jenjang, 'nama' => $jenjang]);
                DB::table($tabel)->where('id', $id)->update(['jenjang' => $jenjang]);
                $this->harusDitolakFk(fn () => DB::table('lembaga')->where('jenjang', $jenjang)->delete());
                DB::table('lembaga')->where('jenjang', $jenjang)->update(['jenjang' => $jenjang.'_2']);
                $this->assertSame($jenjang.'_2', DB::table($tabel)->where('id', $id)->value('jenjang'));
            }
            $global = DB::table('jenis_tagihan')->insertGetId(['nama' => 'Global FK 651', 'tipe' => 'non_bulanan', 'jenjang' => null]);
            $this->assertNull(DB::table('jenis_tagihan')->where('id', $global)->value('jenjang'));
        } finally {
            DB::rollBack();
        }
    }

    /** @return array<string, int> */
    private function buatDataRelasiKeuangan(): array
    {
        DB::table('lembaga')->insert(['jenjang' => 'FK651', 'nama' => 'Lembaga FK 651']);
        DB::table('tahun_ajaran')->insert(['nama' => '2026/2027']);
        $santri = DB::table('santri')->insertGetId(['nama_lengkap' => 'Santri FK 651', 'jk' => 'L']);
        $jenis = DB::table('jenis_tagihan')->insertGetId(['nama' => 'Jenis FK 651', 'tipe' => 'non_bulanan', 'jenjang' => 'FK651']);
        $tarif = DB::table('tarif_tagihan')->insertGetId(['jenjang' => 'FK651', 'tahun_ajaran' => '2026/2027', 'jenis_id' => $jenis, 'nominal' => 100000]);
        $tagihan = DB::table('tagihan')->insertGetId([
            'santri_id' => $santri, 'jenjang' => 'FK651', 'tahun_ajaran' => '2026/2027', 'jenis_id' => $jenis,
            'periode' => '2026-07', 'nominal' => 90000, 'terbayar' => 20000, 'potongan' => 10000, 'status' => 'sebagian',
        ]);
        $transaksi = DB::table('transaksi_pembayaran')->insertGetId(['no_kwitansi' => 'KW-FK-651', 'total' => 20000]);
        $pembayaran = DB::table('pembayaran')->insertGetId(['tagihan_id' => $tagihan, 'transaksi_id' => $transaksi, 'jumlah' => 20000]);
        $dispensasi = DB::table('dispensasi')->insertGetId(['nama' => 'Paket FK 651', 'tahun_ajaran' => '2026/2027', 'jenjang' => 'FK651']);
        $aturan = DB::table('dispensasi_aturan')->insertGetId(['dispensasi_id' => $dispensasi, 'jenis_id' => $jenis, 'tipe' => 'nominal', 'nilai' => 10000]);

        return ['jenis_tagihan' => $jenis, 'tarif_tagihan' => $tarif, 'tagihan' => $tagihan, 'pembayaran' => $pembayaran, 'transaksi_pembayaran' => $transaksi, 'dispensasi_aturan' => $aturan];
    }

    private function harusDitolakFk(callable $aksi): void
    {
        try {
            $aksi();
            $this->fail('Operasi seharusnya ditolak oleh foreign key.');
        } catch (QueryException $e) {
            $this->assertSame('23000', (string) $e->getCode());
        }
    }
}

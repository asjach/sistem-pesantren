<?php

namespace Tests\Unit;

use App\Services\ImporPotongan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Subkelas nyata untuk menguji `ImporPotongan`: helper `protected` hanya bisa
 * dijangkau turunan, jadi tes memakai turunan minimal yang merekam tiap baris
 * yang masuk `prosesBaris()`.
 */
class ImporPotonganUji extends ImporPotongan
{
    /** @var list<array{no: int, kering: bool, baris: array<string, mixed>}> */
    public array $rekaman = [];

    /** Dipakai tes untuk memanggil helper `protected` dari luar. */
    public array $kolomTeks = [];

    public int $lemparDiBaris = 0;

    public bool $paksaKunci = true;

    public function normalisasiBaris(array $baris): array
    {
        return $this->castTeks($this->castTanggal($baris), $this->kolomTeks);
    }

    protected function prosesBaris(array $baris, int $no, bool $kering): void
    {
        if ($this->paksaKunci) {
            $this->kunciAktif = $this->teks($baris, 'nis');
        }
        if ($this->lemparDiBaris === $no) {
            throw new \RuntimeException('gagal di baris '.$no);
        }
        $this->rekaman[] = ['no' => $no, 'kering' => $kering, 'baris' => $baris];
        $this->valid++;
    }

    // --- jembatan ke helper protected ---
    public function pTeks(array $b, string $k): ?string
    {
        return $this->teks($b, $k);
    }

    public function pNilai(array $b, string $k, array $p): ?string
    {
        return $this->nilai($b, $k, $p);
    }

    public function pFail(int $no, string $kolom, string $pesan): void
    {
        $this->fail($no, $kolom, $pesan);
    }

    public function pCastTeks(array $b, array $k): array
    {
        return $this->castTeks($b, $k);
    }

    public function pCastTanggal(array $b): array
    {
        return $this->castTanggal($b);
    }
}

class ImporPotonganTest extends TestCase
{
    private function uji(array $kolomTeks = []): ImporPotonganUji
    {
        $u = new ImporPotonganUji;
        $u->kolomTeks = $kolomTeks;

        return $u;
    }

    // ---------- ringkasan ----------

    public function test_ringkasan_menghitung_baris_diproses(): void
    {
        $u = $this->uji();
        $u->valid = 5;
        $u->dibuat = 3;
        $u->diperbarui = 2;
        $u->dilewati = 1;
        $u->pFail(2, 'nis', 'duplikat');
        $u->pFail(4, 'nama', 'kosong');

        $this->assertSame([
            'baris_diproses' => 7, // valid + gagal
            'baris_valid' => 5,
            'baris_gagal' => 2,
            'dibuat' => 3,
            'diperbarui' => 2,
            'dilewati' => 1,
        ], $u->ringkasan());
    }

    public function test_ringkasan_awal_semua_nol(): void
    {
        $this->assertSame([
            'baris_diproses' => 0, 'baris_valid' => 0, 'baris_gagal' => 0,
            'dibuat' => 0, 'diperbarui' => 0, 'dilewati' => 0,
        ], $this->uji()->ringkasan());
    }

    // ---------- prosesPotongan: penomoran ----------

    public function test_proses_potongan_memberi_nomor_absolut(): void
    {
        $u = $this->uji();
        $u->prosesPotongan([['nis' => 'a'], ['nis' => 'b']], 10, true);

        // nomorAwal 10 = data pertama ada di baris file ke-11 (baris 10 = heading).
        $this->assertSame([11, 12], array_column($u->rekaman, 'no'));
    }

    public function test_proses_potongan_kosong_tidak_menyentuh_apa_pun(): void
    {
        $u = $this->uji();
        $u->prosesPotongan([], 0, true);
        $this->assertSame([], $u->rekaman);
    }

    /** Kunci array tak harus berurutan; `array_values` yang menormalkan. */
    public function test_proses_potongan_menormalkan_kunci_array(): void
    {
        $u = $this->uji();
        $u->prosesPotongan([7 => ['nis' => 'a'], 3 => ['nis' => 'b']], 0, true);
        $this->assertSame([1, 2], array_column($u->rekaman, 'no'));
    }

    /** Baris non-array diganti array kosong, bukan memicu error tipe. */
    public function test_proses_potongan_menoleransi_baris_non_array(): void
    {
        $u = $this->uji();
        $u->paksaKunci = false;
        $u->prosesPotongan(['bukan array', ['nis' => 'a']], 0, true);
        $this->assertCount(2, $u->rekaman);
        $this->assertSame([], $u->rekaman[0]['baris']);
    }

    // ---------- prosesPotongan: mode kering ----------

    public function test_mode_kering_tidak_membuka_transaksi(): void
    {
        $u = $this->uji();
        $u->prosesPotongan([['nis' => 'a']], 0, true);
        $this->assertTrue($u->rekaman[0]['kering']);
    }

    /** Mode kering TIDAK menulis, jadi galat tak boleh menggulung apa pun. */
    public function test_mode_kering_meneruskan_galat_tanpa_menggulung(): void
    {
        $u = $this->uji();
        $u->lemparDiBaris = 2;

        try {
            $u->prosesPotongan([['nis' => 'a'], ['nis' => 'b']], 0, true);
            $this->fail('exception seharusnya dilempar di mode kering');
        } catch (\RuntimeException $e) {
            // Mode kering: baris pertama TETAP tercatat (tak ada rollback).
            $this->assertCount(1, $u->rekaman);
            $this->assertSame(1, $u->rekaman[0]['no']);
        }
    }

    /** Mode tulis memakai transaksi: galat di tengah menggulung seluruh potongan. */
    public function test_mode_tulis_menggulung_seluruh_potongan_saat_galat(): void
    {
        $u = $this->uji();
        $u->lemparDiBaris = 2;

        $this->expectException(\RuntimeException::class);
        try {
            $u->prosesPotongan([['nis' => 'a'], ['nis' => 'b']], 0, false);
        } finally {
            // Nomor transaksi tak pernah naik -> tak ada transaksi menggantung.
            $this->assertSame(0, DB::transactionLevel());
        }
    }

    public function test_mode_tulis_bersih_tidak_meninggalkan_transaksi(): void
    {
        $u = $this->uji();
        $u->prosesPotongan([['nis' => 'a'], ['nis' => 'b']], 0, false);
        $this->assertSame(0, DB::transactionLevel());
        $this->assertCount(2, $u->rekaman);
    }
}

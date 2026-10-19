<?php

namespace Tests\Feature;

use App\Models\JenisTagihan;
use App\Models\Pembayaran;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TransaksiPembayaran;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Satu transaksi = satu kwitansi untuk banyak tagihan (satu santri).
 *
 * Invarian: tiap `tagihan.terbayar` harus sama dengan jumlah baris pembayaran
 * aktifnya, dan `transaksi.total` harus sama dengan jumlah seluruh barisnya.
 */
class TransaksiPembayaranTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'phone' => '081234567890', 'password' => 'password']);
        $u->assignRole('super_admin');

        return $u;
    }

    private function santri(): Santri
    {
        return Santri::create(['nama_lengkap' => 'Santri Transaksi', 'jk' => 'L']);
    }

    private function tagihan(Santri $santri, int $nominal, string $nama = 'Infaq'): Tagihan
    {
        $jenis = JenisTagihan::create(['nama' => $nama.'-'.uniqid(), 'tipe' => 'bulanan']);

        return Tagihan::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
            'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => $nominal, 'terbayar' => 0, 'status' => 'belum',
        ]);
    }

    public function test_hapus_transaksi_rollback_seluruh_baris_jika_salah_satu_gagal(): void
    {
        $admin = $this->admin();
        $santri = $this->santri();
        $a = $this->tagihan($santri, 100);
        $b = $this->tagihan($santri, 100);
        $trx = $this->actingAs($admin)->postJson('/api/admin/keuangan/transaksi', ['items' => [
            ['tagihan_id' => $a->id, 'jumlah' => 40], ['tagihan_id' => $b->id, 'jumlah' => 30],
        ]])->assertCreated()->json('id');
        $kedua = Pembayaran::where('transaksi_id', $trx)->orderByDesc('id')->firstOrFail()->id;
        Pembayaran::deleting(function (Pembayaran $p) use ($kedua) {
            if ($p->id === $kedua) {
                throw new \RuntimeException('Gagal pada baris kedua');
            }
        });
        try {
            $this->deleteJson('/api/admin/keuangan/transaksi/'.$trx)->assertStatus(500);
        } finally {
            Pembayaran::flushEventListeners();
        }
        $this->assertSame(2, Pembayaran::where('transaksi_id', $trx)->count());
        $this->assertSame(40, $a->fresh()->terbayar);
        $this->assertSame(30, $b->fresh()->terbayar);
        $this->assertSame(70, TransaksiPembayaran::findOrFail($trx)->total);
    }

    public function test_bayar_multi_tagihan_satu_kwitansi(): void
    {
        $admin = $this->admin();
        $santri = $this->santri();
        $a = $this->tagihan($santri, 100000);
        $b = $this->tagihan($santri, 50000);

        $res = $this->actingAs($admin)->postJson('/api/admin/keuangan/transaksi', [
            'items' => [
                ['tagihan_id' => $a->id, 'jumlah' => 100000],
                ['tagihan_id' => $b->id, 'jumlah' => 20000],
            ],
            'metode' => 'tunai', 'kas' => 'tunai_tu',
        ])->assertStatus(201);

        $trxId = $res->json('id');
        $this->assertNotNull($res->json('no_kwitansi'));
        $this->assertSame(120000, $res->json('total'));
        $this->assertSame(2, $res->json('jumlah_baris'));

        $this->assertSame('lunas', $a->fresh()->status);
        $this->assertSame(100000, $a->fresh()->terbayar);
        $this->assertSame('sebagian', $b->fresh()->status);
        $this->assertSame(20000, $b->fresh()->terbayar);

        $this->assertSame(2, Pembayaran::where('transaksi_id', $trxId)->count());
        $this->assertSame(
            120000,
            (int) TransaksiPembayaran::find($trxId)->total,
        );
    }

    public function test_satu_baris_melebihi_sisa_menggagalkan_seluruh_transaksi(): void
    {
        $admin = $this->admin();
        $santri = $this->santri();
        $a = $this->tagihan($santri, 100000);
        $b = $this->tagihan($santri, 50000);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/transaksi', [
            'items' => [
                ['tagihan_id' => $a->id, 'jumlah' => 100000],
                ['tagihan_id' => $b->id, 'jumlah' => 50001],
            ],
        ])->assertStatus(422);

        $this->assertSame(0, Pembayaran::count(), 'tak ada baris tersimpan');
        $this->assertSame(0, TransaksiPembayaran::count(), 'tak ada header tersimpan');
        $this->assertSame(0, $a->fresh()->terbayar);
        $this->assertSame(0, $b->fresh()->terbayar);
    }

    public function test_beda_santri_dan_tagihan_ganda_ditolak(): void
    {
        $admin = $this->admin();
        $a = $this->tagihan($this->santri(), 100000);
        $b = $this->tagihan($this->santri(), 50000);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/transaksi', [
            'items' => [
                ['tagihan_id' => $a->id, 'jumlah' => 10000],
                ['tagihan_id' => $b->id, 'jumlah' => 10000],
            ],
        ])->assertStatus(422);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/transaksi', [
            'items' => [
                ['tagihan_id' => $a->id, 'jumlah' => 10000],
                ['tagihan_id' => $a->id, 'jumlah' => 10000],
            ],
        ])->assertStatus(422);

        $this->assertSame(0, Pembayaran::count());
    }

    public function test_batal_transaksi_mengembalikan_semua_tagihan(): void
    {
        $admin = $this->admin();
        $santri = $this->santri();
        $a = $this->tagihan($santri, 100000);
        $b = $this->tagihan($santri, 50000);

        $trxId = $this->actingAs($admin)->postJson('/api/admin/keuangan/transaksi', [
            'items' => [
                ['tagihan_id' => $a->id, 'jumlah' => 60000],
                ['tagihan_id' => $b->id, 'jumlah' => 20000],
            ],
        ])->assertStatus(201)->json('id');

        $barisId = Pembayaran::where('transaksi_id', $trxId)->first()->id;
        $this->actingAs($admin)
            ->postJson("/api/admin/keuangan/pembayaran/{$barisId}/batal")
            ->assertStatus(200)
            ->assertJsonPath('dibatalkan', 2);

        $this->assertSame(0, $a->fresh()->terbayar);
        $this->assertSame('belum', $a->fresh()->status);
        $this->assertSame(0, $b->fresh()->terbayar);
        $this->assertSame('batal', TransaksiPembayaran::find($trxId)->status);
        $this->assertSame(0, Pembayaran::where('transaksi_id', $trxId)->where('status', 'aktif')->count());
    }

    public function test_hapus_satu_baris_menghitung_ulang_total_header(): void
    {
        $admin = $this->admin();
        $santri = $this->santri();
        $a = $this->tagihan($santri, 100000);
        $b = $this->tagihan($santri, 50000);

        $trxId = $this->actingAs($admin)->postJson('/api/admin/keuangan/transaksi', [
            'items' => [
                ['tagihan_id' => $a->id, 'jumlah' => 60000],
                ['tagihan_id' => $b->id, 'jumlah' => 20000],
            ],
        ])->assertStatus(201)->json('id');

        $barisA = Pembayaran::where('transaksi_id', $trxId)->where('tagihan_id', $a->id)->first();
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/pembayaran/{$barisA->id}")->assertStatus(200);

        $this->assertSame(0, $a->fresh()->terbayar);
        $this->assertSame(20000, $b->fresh()->terbayar);
        $this->assertSame(20000, (int) TransaksiPembayaran::find($trxId)->total);

        $barisB = Pembayaran::where('transaksi_id', $trxId)->first();
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/pembayaran/{$barisB->id}")->assertStatus(200);
        $this->assertNull(TransaksiPembayaran::find($trxId));
    }

    public function test_riwayat_dan_harian_menampilkan_kwitansi_header(): void
    {
        $admin = $this->admin();
        $santri = $this->santri();
        $a = $this->tagihan($santri, 100000);
        $b = $this->tagihan($santri, 50000);

        $no = $this->actingAs($admin)->postJson('/api/admin/keuangan/transaksi', [
            'items' => [
                ['tagihan_id' => $a->id, 'jumlah' => 100000],
                ['tagihan_id' => $b->id, 'jumlah' => 20000],
            ],
            'no_kwitansi' => 'KW-MULTI-1',
        ])->assertStatus(201)->json('no_kwitansi');
        $this->assertSame('KW-MULTI-1', $no);

        $this->actingAs($admin)->getJson("/api/admin/keuangan/tagihan/{$a->id}/pembayaran")
            ->assertStatus(200)
            ->assertJsonPath('0.no_kwitansi', 'KW-MULTI-1');

        $tanggal = now()->toDateString();
        $harian = $this->actingAs($admin)->getJson("/api/admin/keuangan/pembayaran/harian?tanggal={$tanggal}")
            ->assertStatus(200)
            ->assertJsonPath('jumlah_transaksi', 1)
            ->assertJsonPath('total', 120000)
            ->assertJsonPath('data.0.no_kwitansi', 'KW-MULTI-1')
            ->assertJsonPath('data.0.jumlah_baris', 2)
            ->assertJsonPath('data.0.total', 120000)
            ->json();

        $this->assertSame(2, count($harian['rekap']));
        $this->assertSame(120000, collect($harian['rekap'])->sum('total'));

        $this->actingAs($admin)->postJson('/api/admin/keuangan/transaksi', [
            'items' => [['tagihan_id' => $b->id, 'jumlah' => 30000]],
        ])->assertStatus(201);

        $this->actingAs($admin)->getJson("/api/admin/keuangan/pembayaran/harian?tanggal={$tanggal}")
            ->assertStatus(200)
            ->assertJsonPath('jumlah_transaksi', 2)
            ->assertJsonPath('total', 150000)
            ->assertJsonPath('data.0.jumlah_baris', 1);
    }
}

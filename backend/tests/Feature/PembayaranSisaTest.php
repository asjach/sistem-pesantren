<?php

namespace Tests\Feature;

use App\Models\JenisTagihan;
use App\Models\Pembayaran;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pembayaran tidak boleh melebihi sisa tagihan.
 *
 * Sebelumnya `tagihan.terbayar` di-clamp (`min()`) sementara baris pembayaran
 * menyimpan jumlah penuh, jadi jumlah transfer kas tidak sama dengan `terbayar`
 * — data tidak bisa dipertanggungjawabkan saat rekonsiliasi. Sekarang melebihi
 * sisa ditolak 422 dan sisanya tidak tersentuh.
 */
class PembayaranSisaTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'phone' => '081234567890', 'password' => 'password']);
        $u->assignRole('super_admin');

        return $u;
    }

    private function tagihan(int $nominal, int $terbayar = 0): Tagihan
    {
        $jenis = JenisTagihan::create(['nama' => 'Infaq', 'tipe' => 'bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Bayar', 'jk' => 'L']);

        return Tagihan::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
            'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => $nominal,
            'terbayar' => $terbayar, 'status' => $terbayar > 0 ? 'sebagian' : 'belum',
        ]);
    }

    private function bayar(User $admin, Tagihan $t, int $jumlah)
    {
        return $this->actingAs($admin)->postJson('/api/admin/keuangan/pembayaran', [
            'tagihan_id' => $t->id, 'jumlah' => $jumlah, 'metode' => 'tunai', 'kas' => 'tunai_tu',
        ]);
    }

    public function test_melebihi_sisa_ditolak_dan_tidak_menulis_apapun(): void
    {
        $admin = $this->admin();
        $t = $this->tagihan(100000, 40000); // sisa 60.000

        $this->bayar($admin, $t, 60001)->assertStatus(422);

        $this->assertSame(0, Pembayaran::where('tagihan_id', $t->id)->count(), 'pembayaran tak boleh tersimpan');
        $this->assertSame(40000, $t->fresh()->terbayar, 'terbayar tak boleh berubah');
        $this->assertSame('sebagian', $t->fresh()->status);
    }

    public function test_tagihan_lunas_tolak_pembayaran_baru(): void
    {
        $admin = $this->admin();
        $t = $this->tagihan(100000, 100000);

        $r = $this->bayar($admin, $t, 1)->assertStatus(422);
        $this->assertSame('Tagihan ini sudah lunas.', $r->json('message'));
        $this->assertSame(0, Pembayaran::where('tagihan_id', $t->id)->count());
    }

    /* Invarian di bawah berlaku untuk pembayaran yang DIBUAT lewat endpoint:
       `terbayar` harus selalu sama dengan jumlah baris pembayaran aktif. Tagihan
       yang `terbayar`-nya di-seed tanpa baris pembayaran (kasusGenerate/seed)
       tidak memenuhi invarian ini sejak awal, jadi tidak dipakai di sini. */
    public function test_pembayaran_tepat_sisa_diterima_dan_jumlah_konsisten(): void
    {
        $admin = $this->admin();
        $t = $this->tagihan(100000);

        $this->bayar($admin, $t, 40000)->assertStatus(201);
        $this->bayar($admin, $t, 60000)->assertStatus(201); // tepat sisa

        $t->refresh();
        $this->assertSame(100000, $t->terbayar);
        $this->assertSame('lunas', $t->status);
        $this->assertSame(
            (int) $t->terbayar,
            (int) Pembayaran::where('tagihan_id', $t->id)->where('status', 'aktif')->sum('jumlah'),
        );
    }

    public function test_pembayaran_bertahap_konsisten(): void
    {
        $admin = $this->admin();
        $t = $this->tagihan(100000);

        foreach ([30000, 30000, 40000] as $potongan) {
            $this->bayar($admin, $t, $potongan)->assertStatus(201);
            $t->refresh();
            $this->assertSame(
                (int) $t->terbayar,
                (int) Pembayaran::where('tagihan_id', $t->id)->where('status', 'aktif')->sum('jumlah'),
                'terbayar harus selalu sama dengan jumlah transfer kas',
            );
        }

        $this->assertSame('lunas', $t->fresh()->status);
        $this->bayar($admin, $t, 1)->assertStatus(422);
    }

    public function test_batal_pembayaran_mengembalikan_invarian(): void
    {
        $admin = $this->admin();
        $t = $this->tagihan(100000);
        $res = $this->bayar($admin, $t, 40000)->assertStatus(201);
        $id = $res->json('id');

        $this->actingAs($admin)->postJson("/api/admin/keuangan/pembayaran/{$id}/batal")->assertStatus(200);

        $t->refresh();
        $this->assertSame(0, $t->terbayar);
        $this->assertSame('belum', $t->status);
        $this->assertSame(
            (int) $t->terbayar,
            (int) Pembayaran::where('tagihan_id', $t->id)->where('status', 'aktif')->sum('jumlah'),
        );
    }
}

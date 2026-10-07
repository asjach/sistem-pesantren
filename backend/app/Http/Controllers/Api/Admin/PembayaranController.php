<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\KeuanganLembaga;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PembayaranStoreRequest;
use App\Models\Pembayaran;
use App\Models\Tagihan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Keuangan: pembayaran tagihan. */
class PembayaranController extends Controller
{
    use KeuanganLembaga;

    public function storePembayaran(PembayaranStoreRequest $request)
    {
        $data = $request->validated();
        $tagihan = Tagihan::findOrFail($data['tagihan_id']);
        $this->canLembaga($request->user(), $tagihan->jenjang) || abort(403);

        $no = $data['no_kwitansi'] ?? strtoupper(bin2hex(random_bytes(5)));

        /* Pembayaran melebihi sisa ditolak, bukan dipotong diam-diam.
           Sebelumnya `terbayar` di-clamp dengan `min()` sedangkan baris
           pembayaran menyimpan jumlah penuh — sehingga jumlah transfer kas
           tidak sama dengan `terbayar` tagihan (mis. bayar Rp 150.000 atas sisa
           Rp 100.000: pembayaran 150.000, terbayar naik 100.000).ovi

           `lockForUpdate` + cek ulang di dalam transaksi: dua permintaan yang
           datang bersamaan (mis. dua kas menekan Bayar di detik sama) tidak
           bisa sama-sama lolos pemeriksaan sisa. */
        $pembayaran = DB::transaction(function () use ($data, $request, $tagihan, $no) {
            $tagihan = Tagihan::whereKey($tagihan->id)->lockForUpdate()->firstOrFail();
            $sisa = max(0, (int) $tagihan->nominal - (int) $tagihan->terbayar);
            if ((int) $data['jumlah'] > $sisa) {
                abort(422, $sisa === 0
                    ? 'Tagihan ini sudah lunas.'
                    : 'Nominal melebihi sisa tagihan (sisa Rp '.$sisa.').');
            }

            $pembayaran = Pembayaran::create([
                'tagihan_id' => $tagihan->id,
                'jumlah' => $data['jumlah'],
                'metode' => $data['metode'] ?? 'tunai',
                'kas' => $data['kas'] ?? 'tunai_tu',
                'no_kwitansi' => $no,
                'diterima_oleh' => $request->user()->id,
                'status' => 'aktif',
                'catatan' => $data['catatan'] ?? null,
            ]);

            $tagihan->terbayar = (int) $tagihan->terbayar + (int) $data['jumlah'];
            $tagihan->status = $tagihan->terbayar >= $tagihan->nominal ? 'lunas' : 'sebagian';
            $tagihan->save();

            return $pembayaran;
        });

        return response()->json($pembayaran, 201);
    }

    public function pembayaranTagihan(Request $request, Tagihan $tagihan)
    {
        $this->canLembaga($request->user(), $tagihan->jenjang) || abort(403);

        return response()->json($tagihan->pembayaran()->orderByDesc('id')->get());
    }

    public function batalPembayaran(Request $request, Pembayaran $pembayaran)
    {
        $tagihan = $pembayaran->tagihan;
        $this->canLembaga($request->user(), $tagihan->jenjang) || abort(403);
        if ($pembayaran->status === 'batal') {
            return response()->json(['pesan' => 'Sudah dibatalkan.']);
        }

        DB::transaction(function () use ($pembayaran, $tagihan) {
            $pembayaran->update(['status' => 'batal']);
            $tagihan->terbayar = max(0, $tagihan->terbayar - (int) $pembayaran->jumlah);
            $tagihan->status = $tagihan->terbayar <= 0 ? 'belum' : ($tagihan->terbayar >= $tagihan->nominal ? 'lunas' : 'sebagian');
            $tagihan->save();
        });

        return response()->json(['pesan' => 'Pembayaran dibatalkan.']);
    }

    public function destroyPembayaran(Request $request, Pembayaran $pembayaran)
    {
        $tagihan = $pembayaran->tagihan;
        $this->canLembaga($request->user(), $tagihan->jenjang) || abort(403);

        DB::transaction(function () use ($pembayaran, $tagihan) {
            if ($pembayaran->status === 'aktif') {
                $tagihan->terbayar = max(0, $tagihan->terbayar - (int) $pembayaran->jumlah);
                $tagihan->status = $tagihan->terbayar <= 0 ? 'belum' : ($tagihan->terbayar >= $tagihan->nominal ? 'lunas' : 'sebagian');
                $tagihan->save();
            }
            $pembayaran->delete();
        });

        return response()->json(['pesan' => 'Pembayaran dihapus.']);
    }
}

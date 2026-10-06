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
        $tagihan->terbayar = min($tagihan->nominal, $tagihan->terbayar + (int) $data['jumlah']);
        $tagihan->status = $tagihan->terbayar >= $tagihan->nominal ? 'lunas' : 'sebagian';
        $tagihan->save();

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

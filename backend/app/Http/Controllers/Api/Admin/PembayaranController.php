<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\KeuanganLembaga;
use App\Http\Controllers\Api\Concerns\TenantGuard;
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
    use TenantGuard;

    /** Daftar pembayaran harian (sumber tabel harian + rekap per jenis).
     *
     *  GET /api/admin/keuangan/pembayaran?tanggal=YYYY-MM-DD — hanya yang
     *  berstatus aktif pada tanggal itu (zona waktu server), lingkup lembaga
     *  mengikuti filter `jenjang` + hak akses pemanggil. */
    public function indexHarian(Request $request)
    {
        $request->validate(['tanggal' => 'required|date_format:Y-m-d']);
        $tanggal = $request->input('tanggal');

        $auth = $request->user();
        $dipilih = $this->selectedLembaga($request, $auth);

        $q = Pembayaran::with(['tagihan.santri', 'tagihan.jenis'])
            ->where('pembayaran.status', 'aktif')
            ->whereDate('pembayaran.created_at', $tanggal);

        if ($auth->bolehPesantren()) {
            if ($dipilih !== []) {
                $q->whereHas('tagihan', fn ($t) => $t->whereIn('jenjang', $dipilih));
            }
        } else {
            $ids = $auth->lembagaIdsDenganPasangan();
            if ($ids === []) {
                return response()->json([
                    'tanggal' => $tanggal, 'data' => [], 'rekap' => [],
                    'jumlah_transaksi' => 0, 'total' => 0,
                ]);
            }
            $pakai = $dipilih !== [] ? $dipilih : $ids;
            $q->whereHas('tagihan', fn ($t) => $t->whereIn('jenjang', $pakai));
        }

        $tas = $this->nilaiFilter($request, 'tahun_ajaran');
        if ($tas !== []) {
            $q->whereHas('tagihan', fn ($t) => $t->whereIn('tahun_ajaran', $tas));
        }

        $baris = $q->orderByDesc('pembayaran.id')->get()->map(fn (Pembayaran $p) => [
            'id' => $p->id,
            'no_kwitansi' => $p->no_kwitansi,
            'jumlah' => (int) $p->jumlah,
            'metode' => $p->metode,
            'kas' => $p->kas,
            'catatan' => $p->catatan,
            'waktu' => $p->created_at,
            'tagihan_id' => $p->tagihan_id,
            'santri' => $p->tagihan?->santri?->nama_lengkap,
            'jenis_id' => $p->tagihan?->jenis_id,
            'jenis_nama' => $p->tagihan?->jenis?->nama,
            'periode' => $p->tagihan?->periode,
            'tahun_ajaran' => $p->tagihan?->tahun_ajaran,
            'jenjang' => $p->tagihan?->jenjang,
        ]);

        $rekap = $baris->groupBy('jenis_id')->map(fn ($grup) => [
            'jenis_id' => $grup->first()['jenis_id'],
            'jenis_nama' => $grup->first()['jenis_nama'] ?? '—',
            'jumlah_transaksi' => $grup->count(),
            'total' => $grup->sum('jumlah'),
        ])->values();

        return response()->json([
            'tanggal' => $tanggal,
            'data' => $baris->values(),
            'rekap' => $rekap,
            'jumlah_transaksi' => $baris->count(),
            'total' => $baris->sum('jumlah'),
        ]);
    }

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

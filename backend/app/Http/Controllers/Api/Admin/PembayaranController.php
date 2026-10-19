<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\KeuanganLembaga;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PembayaranStoreRequest;
use App\Http\Requests\Admin\TransaksiStoreRequest;
use App\Models\Pembayaran;
use App\Models\Tagihan;
use App\Models\TransaksiPembayaran;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Keuangan: transaksi pembayaran (satu kwitansi, banyak tagihan). */
class PembayaranController extends Controller
{
    use KeuanganLembaga;
    use TenantGuard;

    /** Daftar pembayaran harian (sumber tabel harian + rekap per jenis).
     *
     *  GET /api/admin/keuangan/pembayaran/harian?tanggal=YYYY-MM-DD — `data`
     *  berisi SATU baris per transaksi (header/kwitansi) yang aktif pada tanggal
     *  itu; `rekap` merinci baris-barisnya per jenis tagihan. Lingkup lembaga
     *  mengikuti filter `jenjang` + hak akses pemanggil (header tampil bila
     *  punya ≥1 baris aktif dalam lingkup; angka header hanya menghitung baris
     *  dalam lingkup itu). */
    public function indexHarian(Request $request)
    {
        $request->validate(['tanggal' => 'required|date_format:Y-m-d']);
        $tanggal = $request->input('tanggal');

        $auth = $request->user();
        $dipilih = $this->selectedLembaga($request, $auth);

        if ($auth->bolehPesantren()) {
            $jenjangBoleh = $dipilih !== [] ? $dipilih : null;
        } else {
            $ids = $auth->lembagaIdsDenganPasangan();
            if ($ids === []) {
                return response()->json([
                    'tanggal' => $tanggal, 'data' => [], 'rekap' => [],
                    'jumlah_transaksi' => 0, 'total' => 0,
                ]);
            }
            $jenjangBoleh = $dipilih !== [] ? $dipilih : $ids;
        }
        $ta = $this->nilaiFilter($request, 'tahun_ajaran');
        $taBoleh = $ta !== [] ? $ta : null;

        $lingkup = function ($t) use ($jenjangBoleh, $taBoleh): void {
            if ($jenjangBoleh !== null) {
                $t->whereIn('jenjang', $jenjangBoleh);
            }
            if ($taBoleh !== null) {
                $t->whereIn('tahun_ajaran', $taBoleh);
            }
        };

        $transaksi = TransaksiPembayaran::with(['pembayaran.tagihan.santri', 'pembayaran.tagihan.jenis'])
            ->where('transaksi_pembayaran.status', 'aktif')
            ->whereDate('transaksi_pembayaran.created_at', $tanggal)
            ->whereHas('pembayaran', fn ($p) => $p->where('status', 'aktif')->whereHas('tagihan', $lingkup))
            ->orderByDesc('id')
            ->get()
            ->map(function (TransaksiPembayaran $trx) use ($jenjangBoleh, $taBoleh, $tanggal) {
                $baris = $trx->pembayaran->filter(fn (Pembayaran $p) => $p->status === 'aktif'
                    && $p->tagihan !== null
                    && ($jenjangBoleh === null || in_array($p->tagihan->jenjang, $jenjangBoleh, true))
                    && ($taBoleh === null || in_array($p->tagihan->tahun_ajaran, $taBoleh, true))
                )->values();
                if ($baris->isEmpty()) {
                    return null;
                }

                return [
                    'id' => $trx->id,
                    'tanggal' => $tanggal,
                    'no_kwitansi' => $trx->no_kwitansi,
                    'santri' => $baris->first()->tagihan->santri?->nama_lengkap,
                    'jumlah_baris' => $baris->count(),
                    'total' => $baris->sum('jumlah'),
                    'metode' => $trx->metode,
                    'kas' => $trx->kas,
                    'catatan' => $trx->catatan,
                    'baris' => $baris,
                ];
            })->filter()->values();

        $semuaBaris = $transaksi->pluck('baris')->flatten();
        $rekap = $semuaBaris->groupBy(fn (Pembayaran $p) => $p->tagihan->jenis_id)->map(fn ($grup) => [
            'jenis_id' => $grup->first()->tagihan->jenis_id,
            'jenis_nama' => $grup->first()->tagihan->jenis?->nama ?? '—',
            'jumlah_transaksi' => $grup->count(),
            'total' => $grup->sum('jumlah'),
        ])->values();

        return response()->json([
            'tanggal' => $tanggal,
            'data' => $transaksi->map(fn ($t) => collect($t)->except('baris')),
            'rekap' => $rekap,
            'jumlah_transaksi' => $transaksi->count(),
            'total' => $transaksi->sum('total'),
        ]);
    }

    /**
     * Inti tulis transaksi: kunci semua tagihan (urut id agar tak deadlock),
     * tolak bila ada jumlah melebihi sisa, lalu buat header + baris-barisnya
     * dan naikkan `terbayar` tiap tagihan — atomik (gagal satu = gagal semua).
     *
     * @param  array<int, array{tagihan_id: int, jumlah: int}>  $items
     */
    private function buatTransaksi(array $items, array $meta, $auth, int $penerimaId): TransaksiPembayaran
    {
        $ids = array_values(array_unique(array_map(fn ($it) => (int) $it['tagihan_id'], $items)));
        if (count($ids) !== count($items)) {
            abort(422, 'Tagihan yang sama tidak boleh dua kali dalam satu transaksi.');
        }

        return DB::transaction(function () use ($items, $ids, $meta, $auth, $penerimaId) {
            $tagihan = Tagihan::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            if ($tagihan->count() !== count($ids)) {
                abort(422, 'Ada tagihan yang tidak ditemukan.');
            }
            foreach ($tagihan as $t) {
                $this->canLembaga($auth, $t->jenjang) || abort(403);
            }
            if ($tagihan->pluck('santri_id')->unique()->count() > 1) {
                abort(422, 'Satu transaksi hanya untuk tagihan satu santri.');
            }

            /* Pembayaran melebihi sisa ditolak, bukan dipotong diam-diam —
               cek ulang di dalam transaksi agar dua kasir yang menekan Bayar di
               detik sama tidak bisa sama-sama lolos pemeriksaan sisa. Pesan
               transaksi satu baris dipertahankan seperti endpoint lama. */
            $tunggal = count($items) === 1;
            foreach ($items as $it) {
                $t = $tagihan[(int) $it['tagihan_id']];
                $sisa = max(0, (int) $t->nominal - (int) $t->terbayar);
                if ((int) $it['jumlah'] > $sisa) {
                    abort(422, $sisa === 0
                        ? ($tunggal ? 'Tagihan ini sudah lunas.' : "Tagihan {$t->id} sudah lunas.")
                        : ($tunggal
                            ? 'Nominal melebihi sisa tagihan (sisa Rp '.$sisa.').'
                            : "Nominal tagihan {$t->id} melebihi sisa (sisa Rp {$sisa})."));
                }
            }

            $trx = TransaksiPembayaran::create([
                'no_kwitansi' => $meta['no_kwitansi'] ?? strtoupper(bin2hex(random_bytes(5))),
                'total' => array_sum(array_map(fn ($it) => (int) $it['jumlah'], $items)),
                'metode' => $meta['metode'] ?? 'tunai',
                'kas' => $meta['kas'] ?? 'tunai_tu',
                'diterima_oleh' => $penerimaId,
                'status' => 'aktif',
                'catatan' => $meta['catatan'] ?? null,
            ]);

            foreach ($items as $it) {
                $t = $tagihan[(int) $it['tagihan_id']];
                Pembayaran::create([
                    'transaksi_id' => $trx->id,
                    'tagihan_id' => $t->id,
                    'jumlah' => (int) $it['jumlah'],
                    'status' => 'aktif',
                ]);
                $t->terbayar = (int) $t->terbayar + (int) $it['jumlah'];
                $t->status = $t->terbayar >= $t->nominal ? 'lunas' : 'sebagian';
                $t->save();
            }

            return $trx->load('pembayaran');
        });
    }

    /** Satu tagihan, satu kwitansi (transaksi satu baris; kompatibel lama). */
    public function storePembayaran(PembayaranStoreRequest $request)
    {
        $data = $request->validated();
        $trx = $this->buatTransaksi(
            [['tagihan_id' => $data['tagihan_id'], 'jumlah' => $data['jumlah']]],
            $data,
            $request->user(),
            $request->user()->id,
        );
        $baris = $trx->pembayaran->firstOrFail();

        return response()->json([
            'id' => $baris->id, 'transaksi_id' => $trx->id, 'no_kwitansi' => $trx->no_kwitansi,
        ], 201);
    }

    /** Banyak tagihan, satu kwitansi. */
    public function storeTransaksi(TransaksiStoreRequest $request)
    {
        $data = $request->validated();
        $trx = $this->buatTransaksi($data['items'], $data, $request->user(), $request->user()->id);

        return response()->json([
            'id' => $trx->id,
            'no_kwitansi' => $trx->no_kwitansi,
            'total' => (int) $trx->total,
            'jumlah_baris' => $trx->pembayaran->count(),
            'baris' => $trx->pembayaran->map(fn (Pembayaran $p) => [
                'id' => $p->id, 'tagihan_id' => $p->tagihan_id, 'jumlah' => (int) $p->jumlah,
            ])->values(),
        ], 201);
    }

    public function pembayaranTagihan(Request $request, Tagihan $tagihan)
    {
        $this->canLembaga($request->user(), $tagihan->jenjang) || abort(403);

        $baris = $tagihan->pembayaran()->with('transaksi')->orderByDesc('id')->get()
            ->map(fn (Pembayaran $p) => [
                'id' => $p->id,
                'transaksi_id' => $p->transaksi_id,
                'tagihan_id' => $p->tagihan_id,
                'jumlah' => (int) $p->jumlah,
                'metode' => $p->transaksi?->metode,
                'kas' => $p->transaksi?->kas,
                'no_kwitansi' => $p->transaksi?->no_kwitansi,
                'diterima_oleh' => $p->transaksi?->diterima_oleh,
                'status' => $p->status,
                'catatan' => $p->transaksi?->catatan,
                'created_at' => $p->created_at,
            ]);

        return response()->json($baris);
    }

    /** Semua mutasi memakai urutan kunci yang sama: tagihan, header, lalu pembayaran. */
    private function kunciTagihanPembayaran(?int $transaksiId, int $tagihanId = 0)
    {
        $ids = $transaksiId === null ? [$tagihanId]
            : Pembayaran::where('transaksi_id', $transaksiId)->pluck('tagihan_id')->all();
        $tagihan = Tagihan::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
        if ($transaksiId !== null) {
            TransaksiPembayaran::whereKey($transaksiId)->lockForUpdate()->first();
        }

        return $tagihan;
    }

    /** Koreksi `terbayar` satu tagihan setelah barisnya batal/dihapus. */
    private function koreksiTagihan(Tagihan $tagihan, int $kurang): void
    {
        $tagihan->terbayar = max(0, (int) $tagihan->terbayar - $kurang);
        $tagihan->status = $tagihan->terbayar <= 0
            ? 'belum'
            : ($tagihan->terbayar >= $tagihan->nominal ? 'lunas' : 'sebagian');
        $tagihan->save();
    }

    /**
     * Batalkan SELURUH transaksi pemilik baris ini (kwitansi batal utuh —
     * tak ada kwitansi yang batal sebagian).
     */
    private function batalkanTransaksi(TransaksiPembayaran $trx): int
    {
        if ($trx->status === 'batal') {
            return 0;
        }

        return DB::transaction(function () use ($trx) {
            $tagihan = $this->kunciTagihanPembayaran($trx->id);
            $trx = TransaksiPembayaran::whereKey($trx->id)->lockForUpdate()->firstOrFail();
            if ($trx->status === 'batal') {
                return 0;
            }
            $n = 0;
            foreach ($trx->pembayaran()->orderBy('id')->lockForUpdate()->get() as $p) {
                $p->setRelation('tagihan', $tagihan->get($p->tagihan_id));
                if ($p->status !== 'aktif' || $p->tagihan === null) {
                    continue;
                }
                $p->update(['status' => 'batal']);
                $this->koreksiTagihan($p->tagihan, (int) $p->jumlah);
                $n++;
            }
            $trx->update(['status' => 'batal']);

            return $n;
        });
    }

    public function batalPembayaran(Request $request, Pembayaran $pembayaran)
    {
        $tagihan = $pembayaran->tagihan;
        $this->canLembaga($request->user(), $tagihan->jenjang) || abort(403);

        $trx = $pembayaran->transaksi;
        if ($trx === null) {
            // Baris yatim (pra-skema transaksi): batalkan baris itu saja.
            if ($pembayaran->status === 'batal') {
                return response()->json(['pesan' => 'Sudah dibatalkan.']);
            }
            DB::transaction(function () use ($pembayaran, $tagihan) {
                $tagihan = $this->kunciTagihanPembayaran(null, $tagihan->id)->get($tagihan->id);
                $pembayaran = Pembayaran::whereKey($pembayaran->id)->lockForUpdate()->firstOrFail();
                if ($pembayaran->status !== 'aktif') {
                    return;
                }
                $pembayaran->update(['status' => 'batal']);
                $this->koreksiTagihan($tagihan, (int) $pembayaran->jumlah);
            });

            return response()->json(['pesan' => 'Pembayaran dibatalkan.']);
        }

        // Seluruh baris transaksi harus dalam jangkauan pemanggil.
        foreach ($trx->pembayaran()->with('tagihan')->get() as $p) {
            if ($p->tagihan !== null) {
                $this->canLembaga($request->user(), $p->tagihan->jenjang) || abort(403);
            }
        }

        $n = $this->batalkanTransaksi($trx);
        if ($n === 0) {
            return response()->json(['pesan' => 'Sudah dibatalkan.']);
        }

        return response()->json(['pesan' => "Transaksi dibatalkan ({$n} baris).", 'dibatalkan' => $n]);
    }

    public function batalTransaksi(Request $request, TransaksiPembayaran $transaksi)
    {
        foreach ($transaksi->pembayaran()->with('tagihan')->get() as $p) {
            if ($p->tagihan !== null) {
                $this->canLembaga($request->user(), $p->tagihan->jenjang) || abort(403);
            }
        }
        if ($transaksi->pembayaran()->doesntExist()) {
            return response()->json(['pesan' => 'Transaksi kosong.']);
        }

        $n = $this->batalkanTransaksi($transaksi);
        if ($n === 0) {
            return response()->json(['pesan' => 'Sudah dibatalkan.']);
        }

        return response()->json(['pesan' => "Transaksi dibatalkan ({$n} baris).", 'dibatalkan' => $n]);
    }

    /**
     * Hapus permanen SATU baris (koreksi): total header dihitung ulang, header
     * tanpa baris ikut terhapus.
     */
    private function hapusBaris(Pembayaran $pembayaran): void
    {
        DB::transaction(function () use ($pembayaran) {
            $tagihan = $this->kunciTagihanPembayaran($pembayaran->transaksi_id, $pembayaran->tagihan_id);
            $p = Pembayaran::whereKey($pembayaran->id)->lockForUpdate()->firstOrFail();
            $tagihan = $tagihan->get($p->tagihan_id);
            if ($p->status === 'aktif' && $tagihan !== null) {
                $this->koreksiTagihan($tagihan, (int) $p->jumlah);
            }
            $trxId = $p->transaksi_id;
            $p->delete();
            if ($trxId !== null) {
                $sisa = Pembayaran::where('transaksi_id', $trxId)->lockForUpdate()->get();
                if ($sisa->isEmpty()) {
                    TransaksiPembayaran::whereKey($trxId)->delete();
                } else {
                    TransaksiPembayaran::whereKey($trxId)->update(['total' => $sisa->sum('jumlah')]);
                }
            }
        });
    }

    public function destroyPembayaran(Request $request, Pembayaran $pembayaran)
    {
        $tagihan = $pembayaran->tagihan;
        $this->canLembaga($request->user(), $tagihan->jenjang) || abort(403);
        $this->hapusBaris($pembayaran);

        return response()->json(['pesan' => 'Pembayaran dihapus.']);
    }

    /** Hapus permanen SELURUH transaksi (tiap baris dikoreksi seperti hapus). */
    public function destroyTransaksi(Request $request, TransaksiPembayaran $transaksi)
    {
        $baris = $transaksi->pembayaran()->with('tagihan')->orderBy('id')->get();
        foreach ($baris as $p) {
            if ($p->tagihan !== null) {
                $this->canLembaga($request->user(), $p->tagihan->jenjang) || abort(403);
            }
        }
        if ($baris->isEmpty()) {
            $transaksi->delete();

            return response()->json(['pesan' => 'Transaksi dihapus.']);
        }
        foreach ($baris as $p) {
            $this->hapusBaris($p);
        }

        return response()->json(['pesan' => "Transaksi dihapus ({$baris->count()} baris)."]);
    }
}

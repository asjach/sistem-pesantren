<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\JenisTagihan;
use App\Models\Pembayaran;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TarifTagihan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Keuangan: jenis tagihan, tarif, tagihan, pembayaran, tunggakan. */
class KeuanganController extends Controller
{
    use TenantGuard;

    private function canLembaga($actor, string $jenjang): bool
    {
        return $actor->canAccessLembaga($jenjang);
    }

    public function indexJenis(Request $request)
    {
        $actor = $request->user();
        $q = JenisTagihan::orderBy('nama');
        $lembagaIds = $this->nilaiFilter($request, 'jenjang');
        $this->authorizeLembagaMany($actor, $lembagaIds);
        if ($lembagaIds !== []) {
            // Global (null) selalu ikut + khusus lembaga yang diminta.
            $q->where(fn ($w) => $w->whereNull('jenjang')->orWhereIn('jenjang', $lembagaIds));
        } elseif (! $actor->bolehPesantren()) {
            $milik = $actor->lembagaIds();
            $q->where(fn ($w) => $w->whereNull('jenjang')->orWhereIn('jenjang', $milik));
        }

        return response()->json($q->get());
    }

    public function storeJenis(Request $request)
    {
        $actor = $request->user();
        $data = $request->validate([
            'nama' => 'required|string|max:100|unique:jenis_tagihan,nama',
            'tipe' => 'in:bulanan,non_bulanan',
            'jenjang' => 'nullable|string|max:50',
        ]);
        if (! empty($data['jenjang'])) {
            $this->authorizeLembaga($actor, $data['jenjang']);
        } elseif (! $actor->bolehSuperAdmin()) {
            abort(403, 'Jenis global hanya boleh dibuat super_admin.');
        }

        return response()->json(JenisTagihan::create(['nama' => $data['nama'], 'tipe' => $data['tipe'] ?? 'non_bulanan', 'jenjang' => $data['jenjang'] ?? null, 'is_active' => true]), 201);
    }

    public function updateJenis(Request $request, JenisTagihan $jenis)
    {
        $actor = $request->user();
        $data = $request->validate([
            'nama' => 'required|string|max:100|unique:jenis_tagihan,nama,'.$jenis->id,
            'tipe' => 'in:bulanan,non_bulanan',
            'is_active' => 'boolean',
            'jenjang' => 'nullable|string|max:50',
        ]);
        $jenjangBaru = array_key_exists('jenjang', $data) ? $data['jenjang'] : $jenis->jenjang;
        if (! empty($jenjangBaru)) {
            $this->authorizeLembaga($actor, $jenjangBaru);
        } elseif (! $actor->bolehSuperAdmin()) {
            abort(403, 'Jenis global hanya boleh diubah super_admin.');
        }
        $jenis->update($data);

        return response()->json($jenis);
    }

    public function indexTarif(Request $request)
    {
        $q = TarifTagihan::with('jenis')->orderBy('jenjang')->orderBy('tahun_ajaran');
        if ($request->filled('jenjang')) {
            $q->where('jenjang', $request->input('jenjang'));
        }
        if ($request->filled('tahun_ajaran')) {
            $q->where('tahun_ajaran', $request->input('tahun_ajaran'));
        }

        return response()->json($q->get());
    }

    public function storeTarif(Request $request)
    {
        $data = $request->validate([
            'jenjang' => 'required|string',
            'paket' => 'required|string|max:20',
            'tahun_ajaran' => 'required|string|max:9',
            'jenis_id' => 'required|integer|exists:jenis_tagihan,id',
            'tingkat' => 'nullable|string|max:100',
            'nominal' => 'required|integer|min:0',
        ]);
        $this->canLembaga($request->user(), $data['jenjang']) || abort(403);

        return response()->json(TarifTagihan::create($data + ['is_active' => true]), 201);
    }

    public function updateTarif(Request $request, TarifTagihan $tarif)
    {
        $data = $request->validate(['nominal' => 'required|integer|min:0', 'is_active' => 'boolean']);
        $this->canLembaga($request->user(), $tarif->jenjang) || abort(403);
        $tarif->update($data);

        return response()->json($tarif);
    }

    public function destroyTarif(Request $request, TarifTagihan $tarif)
    {
        $this->canLembaga($request->user(), $tarif->jenjang) || abort(403);
        $tarif->delete();

        return response()->json(['pesan' => 'Tarif dihapus.']);
    }

    public function indexTagihan(Request $request)
    {
        $q = Tagihan::with(['jenis', 'santri'])->orderByDesc('id');
        $this->applyFilter($q, $request, 'jenjang', 'jenjang');
        $this->applyFilter($q, $request, 'tahun_ajaran', 'tahun_ajaran');
        if ($request->filled('jenis_id')) {
            $q->where('jenis_id', $request->input('jenis_id'));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->input('status'));
        }
        if ($request->filled('santri')) {
            $q->whereHas('santri', fn ($s) => $s->where('nama_lengkap', 'like', '%'.$request->input('santri').'%'));
        }

        return response()->json($q->paginate($this->perPage($request)));
    }

    public function storeTagihan(Request $request)
    {
        $data = $request->validate([
            'santri_id' => 'required|integer|exists:santri,id',
            'jenjang' => 'required|string',
            'paket' => 'required|string|max:20',
            'tahun_ajaran' => 'required|string|max:9',
            'jenis_id' => 'required|integer|exists:jenis_tagihan,id',
            'periode' => 'nullable|string|max:20',
            'nominal' => 'required|integer|min:0',
            'jatuh_tempo' => 'nullable|date',
        ]);
        $this->canLembaga($request->user(), $data['jenjang']) || abort(403);
        $tagihan = Tagihan::create($data + ['status' => 'belum', 'terbayar' => 0]);

        return response()->json($tagihan, 201);
    }

    /** Buat tagihan massal per tarif untuk santri aktif pada TA+paket terkait. */
    public function generateTagihan(Request $request)
    {
        $data = $request->validate([
            'jenjang' => 'required|string',
            'paket' => 'required|string|max:20',
            'tahun_ajaran' => 'required|string|max:9',
            'jenis_id' => 'required|integer|exists:jenis_tagihan,id',
            'periode' => 'nullable|string|max:20',
            'periode_sampai' => 'nullable|string|max:20',
            'jatuh_tempo' => 'nullable|date',
        ]);
        $this->canLembaga($request->user(), $data['jenjang']) || abort(403);

        $tarif = TarifTagihan::where('jenjang', $data['jenjang'])
            ->where('paket', $data['paket'])
            ->where('tahun_ajaran', $data['tahun_ajaran'])
            ->where('jenis_id', $data['jenis_id'])
            ->where('is_active', true)
            ->first() ?? abort(422, 'Tarif belum diatur untuk kombinasi ini.');

        // Periode: satu nilai, atau rentang bulan (YYYY-MM s/d YYYY-MM, maks 24)
        // khusus jenis bulanan — mis. Juli 2025 s/d Juni 2026 untuk setahun ajaran.
        $periodes = [$data['periode'] ?? null];
        $jenis = $tarif->jenis;
        if ($jenis && $jenis->tipe === 'bulanan'
            && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string) ($data['periode'] ?? ''))
            && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string) ($data['periode_sampai'] ?? ''))) {
            $mulai = new \DateTime($data['periode'].'-01');
            $akhir = new \DateTime($data['periode_sampai'].'-01');
            if ($akhir >= $mulai) {
                $periodes = [];
                $b = clone $mulai;
                while ($b <= $akhir && count($periodes) < 24) {
                    $periodes[] = $b->format('Y-m');
                    $b->modify('+1 month');
                }
            }
        }

        $dibuat = 0;
        $dilewati = 0;
        $satu = $this->paketAktifSantri($data['tahun_ajaran']);
        foreach ($periodes as $periode) {
            foreach ($satu as $santriId => $paketCode) {
                if ($paketCode !== $data['paket']) {
                    continue;
                }
                $tagihan = Tagihan::firstOrCreate(
                    ['santri_id' => $santriId, 'jenis_id' => $data['jenis_id'], 'periode' => $periode],
                    [
                        'jenjang' => $tarif->jenjang, 'paket' => $data['paket'],
                        'tahun_ajaran' => $data['tahun_ajaran'], 'nominal' => $tarif->nominal,
                        'jatuh_tempo' => $data['jatuh_tempo'] ?? null, 'status' => 'belum', 'terbayar' => 0,
                    ]
                );
                $tagihan->wasRecentlyCreated ? $dibuat++ : $dilewati++;
            }
        }

        return response()->json(['dibuat' => $dibuat, 'dilewati' => $dilewati]);
    }

    /** Paket per santri dari riwayat aktif pada TA terkait (MI+MD bersama = MI-MD). */
    private function paketAktifSantri(string $tahunAjaran): array
    {
        $baris = DB::table('riwayat_belajar')
            ->where('is_active_riwayat', 'Ya')
            ->where('tahun_ajaran', $tahunAjaran)
            ->get(['santri_id', 'jenjang']);
        $peta = [];
        foreach ($baris as $b) {
            $peta[$b->santri_id] ??= [];
            $peta[$b->santri_id][] = $b->jenjang;
        }
        $hasil = [];
        foreach ($peta as $santriId => $jenjangs) {
            $has = fn ($j) => in_array($j, $jenjangs, true);
            if ($has('MI') && $has('MD')) {
                $hasil[$santriId] = 'MI-MD';

                continue;
            }
            if ($has('MI')) {
                $hasil[$santriId] = 'MI';

                continue;
            }
            if ($has('MD')) {
                $hasil[$santriId] = 'MD';

                continue;
            }
            if ($has('MTS')) {
                $hasil[$santriId] = 'MTS';

                continue;
            }
            if ($has('MLN')) {
                $hasil[$santriId] = 'MLN';

                continue;
            }
        }

        return $hasil;
    }

    public function destroyTagihan(Request $request, Tagihan $tagihan)
    {
        $this->canLembaga($request->user(), $tagihan->jenjang) || abort(403);
        if ($tagihan->pembayaran()->where('status', 'aktif')->exists()) {
            abort(422, 'Hapus dulu pembayaran pada tagihan ini.');
        }
        $tagihan->delete();

        return response()->json(['pesan' => 'Tagihan dihapus.']);
    }

    public function storePembayaran(Request $request)
    {
        $data = $request->validate([
            'tagihan_id' => 'required|integer|exists:tagihan,id',
            'jumlah' => 'required|integer|min:1',
            'metode' => 'in:tunai,transfer',
            'kas' => 'in:tunai_tu,bank_lembaga,bank_pesantren',
            'no_kwitansi' => 'nullable|string|max:60|unique:pembayaran,no_kwitansi',
            'catatan' => 'nullable|string|max:190',
        ]);
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

    public function tunggakan(Request $request)
    {
        $q = Tagihan::with(['jenis', 'santri'])->where('status', '!=', 'lunas');
        if ($request->filled('jenjang')) {
            $q->where('jenjang', $request->input('jenjang'));
        }
        if ($request->filled('tahun_ajaran')) {
            $q->where('tahun_ajaran', $request->input('tahun_ajaran'));
        }
        $baris = $q->get();

        $perSantri = $baris->groupBy('santri_id')->map(function ($rows) {
            $s = $rows->first()->santri;

            return [
                'santri_id' => $rows->first()->santri_id,
                'nama' => $s?->nama_lengkap ?? 'Tidak dikenal',
                'total_tagihan' => $rows->sum('nominal'),
                'terbayar' => $rows->sum('terbayar'),
                'tunggakan' => $rows->sum(fn ($r) => max(0, $r->nominal - $r->terbayar)),
                'jumlah_tagihan' => $rows->count(),
            ];
        })->values();

        return response()->json(['per_santri' => $perSantri]);
    }
}

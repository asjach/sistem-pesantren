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
use Illuminate\Pagination\LengthAwarePaginator;
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
        // Filter global (boleh banyak nilai): `jenjang[]` dan `tahun_ajaran[]`.
        $this->applyFilter($q, $request, 'jenjang', 'jenjang');
        $this->applyFilter($q, $request, 'tahun_ajaran', 'tahun_ajaran');

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

        // Tarif yang sudah dipakai generate tagihan tidak boleh dihapus
        // (kombinasi inilah yang disalin ke baris tagihan).
        $dipakai = Tagihan::where('jenjang', $tarif->jenjang)
            ->where('paket', $tarif->paket)
            ->where('tahun_ajaran', $tarif->tahun_ajaran)
            ->where('jenis_id', $tarif->jenis_id)
            ->exists();
        if ($dipakai) {
            abort(422, 'Tarif tidak bisa dihapus karena sudah dipakai pada tagihan. Nonaktifkan saja bila tidak ingin dipakai lagi.');
        }

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
        if ($request->boolean('belum_lunas')) {
            $q->where('status', '!=', 'lunas');
        }
        if ($request->filled('santri_id')) {
            $q->where('santri_id', (int) $request->input('santri_id'));
        }
        if ($request->filled('santri')) {
            // Cari santri: nama, NISN, atau NIS lokal per lembaga.
            $cari = $request->input('santri');
            $q->whereHas('santri', fn ($s) => $s
                ->where('nama_lengkap', 'like', '%'.$cari.'%')
                ->orWhere('nisn', 'like', '%'.$cari.'%')
                ->orWhereHas('lembagaSantri', fn ($ls) => $ls->where('nis_lokal', 'like', '%'.$cari.'%')));
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

    /** Tingkat akhir per jenjang (sinkron peta TINGKAT_AKHIR halaman Kelulusan). */
    private const TINGKAT_AKHIR = ['MI' => '6', 'MD' => '6', 'MTS' => '9', 'MLN' => '12'];

    private const KELOMPOK_KANDIDAT = [
        'mi_saja', 'md_saja', 'mi', 'md', 'mi_md',
        'aktif', 'kelas_akhir', 'selain_kelas_akhir', 'custom',
    ];

    /**
     * Kandidat santri generate: daftar santri aktif pada satu TA sesuai
     * kelompok kriteria, sudah dihitung paket/jenjang/tingkat/kelasnya.
     * Santri yang sudah punya tagihan lengkap untuk jenis+periode terpilih
     * disembunyikan dari kandidat.
     */
    public function kandidatTagihan(Request $request)
    {
        $data = $request->validate([
            'tahun_ajaran' => 'required|string|max:9',
            'kelompok' => 'required|string|in:'.implode(',', self::KELOMPOK_KANDIDAT),
            'jenis_id' => 'nullable|integer|exists:jenis_tagihan,id',
            'periode' => 'nullable|string|max:20',
            'periode_sampai' => 'nullable|string|max:20',
            'q' => 'nullable|string|max:100',
        ]);
        $actor = $request->user();

        $peta = $this->petaSantriGenerate($data['tahun_ajaran'], [], $data['q'] ?? null);

        $jenis = isset($data['jenis_id']) ? JenisTagihan::find($data['jenis_id']) : null;
        $periodes = $jenis !== null
            ? $this->periodesTagihan($jenis, $data['tahun_ajaran'], $data['periode'] ?? null, $data['periode_sampai'] ?? null, false)
            : [];
        $lengkap = $jenis !== null && $periodes !== []
            ? $this->santriSudahLengkap(array_keys($peta), $jenis->id, $periodes)
            : [];

        $hasil = [];
        foreach ($peta as $id => $info) {
            if (! $this->lolosKelompok($info, $data['kelompok'])) {
                continue;
            }
            if (! $actor->canAccessLembaga($info['jenjang_utama'])) {
                continue;
            }
            if (isset($lengkap[$id])) {
                continue;
            }
            $hasil[] = [
                'santri_id' => $id,
                'nama_lengkap' => $info['nama_lengkap'],
                'nisn' => $info['nisn'],
                'nis_lokal' => $info['nis_lokal'],
                'paket' => $info['paket'],
                'jenjang' => $info['jenjang_utama'],
                'tingkat' => $info['tingkat'],
                'kelas' => $info['kelas'],
                'status_akhir' => $info['status_akhir'],
            ];
        }

        $page = max(1, (int) $request->input('page', 1));
        $perPage = $this->perPage($request);

        return response()->json(new LengthAwarePaginator(
            array_slice($hasil, ($page - 1) * $perPage, $perPage),
            count($hasil),
            $perPage,
            $page,
        ));
    }

    /**
     * Buat tagihan massal untuk daftar santri terpilih (tabel kedua dialog
     * generate). Paket/jenjang tiap santri dihitung dari riwayat TA terkait;
     * nominal boleh dioverride per santri.
     */
    public function generateTagihan(Request $request)
    {
        $data = $request->validate([
            'tahun_ajaran' => 'required|string|max:9',
            'jenis_id' => 'required|integer|exists:jenis_tagihan,id',
            'periode' => 'nullable|string|max:20',
            'periode_sampai' => 'nullable|string|max:20',
            'jatuh_tempo' => 'nullable|date',
            'nominal' => 'required|integer|min:0',
            'santri' => 'required|array|min:1',
            'santri.*.santri_id' => 'required|integer|distinct|exists:santri,id',
            'santri.*.nominal' => 'nullable|integer|min:0',
        ]);
        $actor = $request->user();

        $jenis = JenisTagihan::findOrFail($data['jenis_id']);
        $periodes = $this->periodesTagihan($jenis, $data['tahun_ajaran'], $data['periode'] ?? null, $data['periode_sampai'] ?? null);

        $diminta = collect($data['santri'])->keyBy(fn ($s) => (int) $s['santri_id']);
        $peta = $this->petaSantriGenerate($data['tahun_ajaran'], $diminta->keys()->all());

        $dibuat = 0;
        $dilewati = 0;
        foreach ($diminta as $santriId => $s) {
            $info = $peta[$santriId] ?? null;
            if ($info === null) {
                abort(422, "Santri #{$santriId} tidak aktif pada tahun ajaran {$data['tahun_ajaran']}.");
            }
            $this->canLembaga($actor, $info['jenjang_utama']) || abort(403);

            $nominal = $s['nominal'] ?? $data['nominal'];
            foreach ($periodes as $periode) {
                $tagihan = Tagihan::firstOrCreate(
                    ['santri_id' => $santriId, 'jenis_id' => $jenis->id, 'periode' => $periode],
                    [
                        'jenjang' => $info['jenjang_utama'], 'paket' => $info['paket'],
                        'tahun_ajaran' => $data['tahun_ajaran'], 'nominal' => $nominal,
                        'jatuh_tempo' => $data['jatuh_tempo'] ?? null, 'status' => 'belum', 'terbayar' => 0,
                    ]
                );
                $tagihan->wasRecentlyCreated ? $dibuat++ : $dilewati++;
            }
        }

        return response()->json(['dibuat' => $dibuat, 'dilewati' => $dilewati]);
    }

    /**
     * Periode tagihan efektif per tipe jenis:
     * - non_bulanan: satu tagihan per generate, periode = kode TA (mis. "2025/2026")
     *   sehingga bisa digenerate ulang tiap tahun ajaran;
     * - bulanan: satu bulan (YYYY-MM) wajib, atau rentang mulai s/d maks 24 bulan.
     * `$ketat` (generate) → abort 422 saat periode bulanan tidak valid;
     * `$ketat=false` (kandidat, input masih diketik) → `[]` = tanpa filter.
     *
     * @return list<string>
     */
    private function periodesTagihan(JenisTagihan $jenis, string $tahunAjaran, ?string $periode, ?string $sampai, bool $ketat = true): array
    {
        if ($jenis->tipe !== 'bulanan') {
            return [$tahunAjaran];
        }

        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string) $periode)) {
            if ($ketat) {
                abort(422, 'Isi bulan periode (YYYY-MM) untuk jenis bulanan.');
            }

            return [];
        }

        if ($sampai === null || $sampai === '') {
            return [$periode];
        }

        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string) $sampai)) {
            if ($ketat) {
                abort(422, 'Format bulan sampai tidak valid (YYYY-MM).');
            }

            return [$periode];
        }

        $mulai = new \DateTime($periode.'-01');
        $akhir = new \DateTime($sampai.'-01');
        if ($akhir < $mulai) {
            if ($ketat) {
                abort(422, 'Bulan sampai lebih awal dari bulan mulai.');
            }

            return [$periode];
        }

        $periodes = [];
        $b = clone $mulai;
        while ($b <= $akhir && count($periodes) < 24) {
            $periodes[] = $b->format('Y-m');
            $b->modify('+1 month');
        }

        return $periodes;
    }

    /**
     * Peta santri dari riwayat_belajar pada satu TA. Aktif = `status_akhir`
     * bukan `pindah_keluar` (bukan flag `is_active_riwayat`, agar TA lampau
     * tetap bisa digenerate). Baris semester 2 menang sebagai baris tampilan.
     *
     * @param  list<int>  $santriIds
     * @return array<int, array{santri_id:int, nama_lengkap:string, nisn:?string, nis_lokal:?string, per_jenjang:array<string, array{semester:?string, tingkat:?string, kelas:?string, status:?string}>, paket:string, jenjang_utama:string, tingkat:?string, kelas:?string, status_akhir:?string, kelas_akhir:bool}>
     */
    private function petaSantriGenerate(string $ta, array $santriIds = [], ?string $cari = null): array
    {
        $baris = DB::table('riwayat_belajar as rb')
            ->join('santri as s', 's.id', '=', 'rb.santri_id')
            ->leftJoin('kelas as k', 'k.id', '=', 'rb.kelas_id')
            ->leftJoin('lembaga_santri as ls', function ($j) {
                $j->on('ls.santri_id', '=', 'rb.santri_id')->on('ls.jenjang', '=', 'rb.jenjang');
            })
            ->where('rb.tahun_ajaran', $ta)
            ->where('rb.status_akhir', '!=', 'pindah_keluar')
            ->when($santriIds !== [], fn ($q) => $q->whereIn('rb.santri_id', $santriIds))
            ->when($cari !== null && $cari !== '', fn ($q) => $q->whereIn('rb.santri_id', DB::table('santri as s2')
                ->leftJoin('lembaga_santri as ls2', 'ls2.santri_id', '=', 's2.id')
                ->where(fn ($w) => $w
                    ->where('s2.nama_lengkap', 'like', '%'.$cari.'%')
                    ->orWhere('s2.nisn', 'like', '%'.$cari.'%')
                    ->orWhere('ls2.nis_lokal', 'like', '%'.$cari.'%'))
                ->select('s2.id')))
            ->orderBy('s.nama_lengkap')
            ->get(['rb.santri_id', 'rb.jenjang', 'rb.tingkat', 'rb.semester', 'rb.status_akhir', 's.nama_lengkap', 's.nisn', 'ls.nis_lokal', 'k.nama_kelas']);

        $peta = [];
        foreach ($baris as $b) {
            $id = (int) $b->santri_id;
            $peta[$id] ??= [
                'santri_id' => $id,
                'nama_lengkap' => (string) $b->nama_lengkap,
                'nisn' => $b->nisn,
                'nis_lokal' => $b->nis_lokal,
                'per_jenjang' => [],
            ];
            $lama = $peta[$id]['per_jenjang'][$b->jenjang] ?? null;
            if ($lama === null || ($lama['semester'] !== '2' && $b->semester === '2')) {
                $peta[$id]['per_jenjang'][$b->jenjang] = [
                    'semester' => $b->semester,
                    'tingkat' => $b->tingkat,
                    'kelas' => $b->nama_kelas,
                    'status' => $b->status_akhir,
                ];
            }
        }

        foreach ($peta as &$info) {
            $jenjangs = array_keys($info['per_jenjang']);
            $has = fn (string $j) => in_array($j, $jenjangs, true);
            $info['paket'] = $has('MI') && $has('MD') ? 'MI-MD' : ($has('MI') ? 'MI' : ($has('MD') ? 'MD' : ($jenjangs[0] ?? '')));
            $info['jenjang_utama'] = $has('MI') ? 'MI' : ($has('MD') ? 'MD' : ($jenjangs[0] ?? ''));
            $utama = $info['per_jenjang'][$info['jenjang_utama']] ?? null;
            $info['tingkat'] = $utama['tingkat'] ?? null;
            $info['kelas'] = $utama['kelas'] ?? null;
            $info['status_akhir'] = $utama['status'] ?? null;
            $info['kelas_akhir'] = false;
            foreach ($info['per_jenjang'] as $jenjang => $row) {
                if ($row['tingkat'] !== null && (self::TINGKAT_AKHIR[$jenjang] ?? null) === $row['tingkat']) {
                    $info['kelas_akhir'] = true;
                }
            }
        }
        unset($info);

        return $peta;
    }

    /**
     * Filter kelompok kriteria terhadap peta santri.
     *
     * @param  array{per_jenjang:array<string, mixed>, kelas_akhir:bool}  $info
     */
    private function lolosKelompok(array $info, string $kelompok): bool
    {
        $jenjangs = array_keys($info['per_jenjang']);
        $has = fn (string $j) => in_array($j, $jenjangs, true);

        return match ($kelompok) {
            'mi_saja' => $has('MI') && ! $has('MD'),
            'md_saja' => $has('MD') && ! $has('MI'),
            'mi' => $has('MI'),
            'md' => $has('MD'),
            'mi_md' => $has('MI') && $has('MD'),
            'kelas_akhir' => $info['kelas_akhir'],
            'selain_kelas_akhir' => ! $info['kelas_akhir'],
            default => true, // aktif & custom = semua santri aktif
        };
    }

    /**
     * Santri yang sudah punya tagihan untuk seluruh periode terpilih.
     *
     * @param  list<int>  $santriIds
     * @param  list<string>  $periodes
     * @return array<int, true>
     */
    private function santriSudahLengkap(array $santriIds, int $jenisId, array $periodes): array
    {
        if ($santriIds === [] || $periodes === []) {
            return [];
        }

        $baris = Tagihan::query()
            ->where('jenis_id', $jenisId)
            ->whereIn('santri_id', $santriIds)
            ->whereIn('periode', $periodes)
            ->selectRaw('santri_id, count(distinct periode) as jumlah')
            ->groupBy('santri_id')
            ->havingRaw('count(distinct periode) >= ?', [count($periodes)])
            ->pluck('jumlah', 'santri_id');

        $hasil = [];
        foreach ($baris as $santriId => $_) {
            $hasil[(int) $santriId] = true;
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

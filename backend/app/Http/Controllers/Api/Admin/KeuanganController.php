<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Models\Dispensasi;
use App\Models\JenisTagihan;
use App\Models\Pembayaran;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TarifTagihan;
use App\Services\DispensasiService;
use App\Services\UrutKatalog;
use App\Support\JatuhTempo;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/** Keuangan: jenis tagihan, tarif, tagihan, pembayaran, tunggakan. */
class KeuanganController extends Controller
{
    use TenantGuard;
    use UrutDaftar;

    private function canLembaga($actor, string $jenjang): bool
    {
        return $actor->canAccessLembaga($jenjang);
    }

    public function indexJenis(Request $request)
    {
        $actor = $request->user();
        $urut = $this->parseUrut($request, UrutKatalog::peta('keuangan_jenis'));
        $q = JenisTagihan::query();
        $lembagaIds = $this->nilaiFilter($request, 'jenjang');
        $this->authorizeLembagaMany($actor, $lembagaIds);
        if ($lembagaIds !== []) {
            // Global (null) selalu ikut + khusus lembaga yang diminta.
            $q->where(fn ($w) => $w->whereNull('jenjang')->orWhereIn('jenjang', $lembagaIds));
        } elseif (! $actor->bolehPesantren()) {
            $milik = $actor->lembagaIds();
            $q->where(fn ($w) => $w->whereNull('jenjang')->orWhereIn('jenjang', $milik));
        }
        if ($urut === null) {
            $q->orderBy('nama');
        } else {
            $this->terapkanUrut($q, $urut, [['jenis_tagihan.nama', 'naik']]);
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
        $urut = $this->parseUrut($request, UrutKatalog::peta('keuangan_tarif'));
        $q = TarifTagihan::with('jenis');
        // Filter global (boleh banyak nilai): `jenjang[]` dan `tahun_ajaran[]`.
        $this->applyFilter($q, $request, 'jenjang', 'jenjang');
        $this->applyFilter($q, $request, 'tahun_ajaran', 'tahun_ajaran');
        if ($urut === null) {
            $q->orderBy('jenjang')->orderBy('tahun_ajaran');
        } else {
            $q->select('tarif_tagihan.*')
                ->leftJoin('jenis_tagihan', 'jenis_tagihan.id', '=', 'tarif_tagihan.jenis_id');
            $this->terapkanUrut($q, $urut, [['tarif_tagihan.jenjang', 'naik'], ['tarif_tagihan.tahun_ajaran', 'naik']]);
        }

        return response()->json($q->get());
    }

    public function storeTarif(Request $request)
    {
        $data = $request->validate([
            'jenjang' => 'required|string',
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
            ->where('tahun_ajaran', $tarif->tahun_ajaran)
            ->where('jenis_id', $tarif->jenis_id)
            ->exists();
        if ($dipakai) {
            abort(422, 'Tarif tidak bisa dihapus karena sudah dipakai pada tagihan. Nonaktifkan saja bila tidak ingin dipakai lagi.');
        }

        $tarif->delete();

        return response()->json(['pesan' => 'Tarif dihapus.']);
    }

    /**
     * Daftar dispensasi. Filter TA/jenis/status; `santri_id` = hanya yang
     * berlaku untuk santri itu (dipakai profil santri).
     */
    public function indexDispensasi(Request $request)
    {
        $data = $request->validate([
            'tahun_ajaran' => 'nullable|string|max:20',
            'jenis_id' => 'nullable|integer|exists:jenis_tagihan,id',
            'santri_id' => 'nullable|integer|exists:santri,id',
        ]);

        $q = Dispensasi::with(['aturan.jenis', 'santriTambahan']);
        if (! empty($data['tahun_ajaran'])) {
            $q->where('tahun_ajaran', $data['tahun_ajaran']);
        }
        if (! empty($data['jenis_id'])) {
            $jenisId = (int) $data['jenis_id'];
            $q->whereHas('aturan', fn ($w) => $w->whereNull('jenis_id')->orWhere('jenis_id', $jenisId));
        }
        if ($request->filled('is_active')) {
            $q->where('is_active', $request->boolean('is_active'));
        }
        $urut = $this->parseUrut($request, UrutKatalog::peta('keuangan_dispensasi'));
        if ($urut === null) {
            $q->orderBy('tahun_ajaran')->orderBy('nama');
        } else {
            $this->terapkanUrut($q, $urut, [['dispensasi.tahun_ajaran', 'naik'], ['dispensasi.nama', 'naik']]);
        }

        $daftar = $q->get();

        if (! empty($data['santri_id'])) {
            if (empty($data['tahun_ajaran'])) {
                abort(422, 'Sertakan tahun ajaran untuk melihat dispensasi satu santri.');
            }
            $peta = $this->petaSantriGenerate($data['tahun_ajaran'], [(int) $data['santri_id']]);
            $info = $peta[(int) $data['santri_id']] ?? null;
            if ($info === null) {
                return response()->json([]);
            }
            $this->canLembaga($request->user(), $info['jenjang_utama']) || abort(403);
            $daftar = app(DispensasiService::class)->saring($daftar, (int) $data['santri_id']);
        }

        return response()->json($daftar->values());
    }

    public function storeDispensasi(Request $request)
    {
        $data = $this->validasiDispensasi($request);
        $this->authorizeDispensasi($request->user(), $data);

        $dispensasi = DB::transaction(function () use ($data) {
            $d = Dispensasi::create($this->bersihkanDispensasi($data));
            $this->simpanAturan($d, $data['aturan']);
            $d->santriTambahan()->sync($this->normalisasiSantriIds($data['santri_ids'] ?? null));

            return $d;
        });

        return response()->json($dispensasi->load(['aturan.jenis', 'santriTambahan']), 201);
    }

    public function updateDispensasi(Request $request, Dispensasi $dispensasi)
    {
        $data = $this->validasiDispensasi($request);
        $this->authorizeDispensasi($request->user(), $data);
        DB::transaction(function () use ($dispensasi, $data) {
            $dispensasi->update($this->bersihkanDispensasi($data));
            $this->simpanAturan($dispensasi, $data['aturan']);
            $dispensasi->santriTambahan()->sync($this->normalisasiSantriIds($data['santri_ids'] ?? null));
        });

        return response()->json($dispensasi->load(['aturan.jenis', 'santriTambahan']));
    }

    public function destroyDispensasi(Dispensasi $dispensasi)
    {
        if (Tagihan::whereJsonContains('dispensasi_ids', $dispensasi->id)->exists()) {
            abort(422, 'Dispensasi sudah dipakai tagihan. Nonaktifkan saja bila tidak ingin dipakai lagi.');
        }
        $dispensasi->delete();

        return response()->json(['pesan' => 'Dispensasi dihapus.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validasiDispensasi(Request $request): array
    {
        $data = $request->validate([
            'nama' => 'required|string|max:100',
            'keterangan' => 'nullable|string|max:255',
            'tahun_ajaran' => 'required|string|exists:tahun_ajaran,nama',
            'aturan' => 'required|array|min:1',
            'aturan.*.jenis_id' => 'nullable|integer|exists:jenis_tagihan,id',
            'aturan.*.tipe' => 'required|in:persen,nominal,bebas',
            'aturan.*.nilai' => 'required|integer|min:0',
            'santri_ids' => 'nullable|array',
            'santri_ids.*' => 'integer|exists:santri,id',
            'is_active' => 'nullable|boolean',
        ]);
        $data['aturan'] = $this->normalisasiAturan($data['aturan']);
        foreach ($data['aturan'] as $a) {
            if ($a['tipe'] === 'persen' && $a['nilai'] > 100) {
                abort(422, 'Nilai persen maksimal 100.');
            }
        }

        return $data;
    }

    /**
     * Normalisasi daftar aturan: dedupe per jenis (`jenis_id` null = semua
     * jenis, bila ada harus menjadi satu-satunya baris).
     *
     * @return list<array{jenis_id: ?int, tipe: string, nilai: int}>
     */
    private function normalisasiAturan(mixed $nilai): array
    {
        if (! is_array($nilai)) {
            abort(422, 'Aturan dispensasi tidak valid.');
        }
        $perJenis = [];
        foreach ($nilai as $a) {
            if (! is_array($a)) {
                continue;
            }
            $jenisId = ($a['jenis_id'] ?? null) === null || ($a['jenis_id'] ?? '') === ''
                ? null
                : (int) $a['jenis_id'];
            $kunci = $jenisId === null ? 'semua' : "jenis-{$jenisId}";
            $perJenis[$kunci] ??= [
                'jenis_id' => $jenisId,
                'tipe' => in_array($a['tipe'] ?? null, ['persen', 'nominal', 'bebas'], true) ? $a['tipe'] : 'nominal',
                'nilai' => max(0, (int) ($a['nilai'] ?? 0)),
            ];
        }
        $hasil = array_values($perJenis);
        if ($hasil === []) {
            abort(422, 'Isi minimal satu jenis tagihan.');
        }
        if (count($hasil) > 1 && array_any($hasil, fn ($a) => $a['jenis_id'] === null)) {
            abort(422, 'Aturan "semua jenis" harus berdiri sendiri.');
        }

        return $hasil;
    }

    /**
     * Lingkup lembaga mengikuti jenis tagihan yang dipilih: aturan semua
     * jenis atau seluruh jenis berjenjang global → super_admin saja;
     * selain itu tiap jenjang jenis wajib boleh diakses.
     *
     * @param  array<string, mixed>  $data
     */
    private function authorizeDispensasi($actor, array $data): void
    {
        $aturan = $data['aturan'] ?? [];
        if (array_any($aturan, fn ($a) => ($a['jenis_id'] ?? null) === null)) {
            $actor->bolehSuperAdmin() || abort(403, 'Dispensasi semua jenis hanya boleh dibuat super_admin.');
        }
        $ids = array_values(array_unique(array_map(
            fn ($a) => (int) $a['jenis_id'],
            array_filter($aturan, fn ($a) => ($a['jenis_id'] ?? null) !== null)
        )));
        if ($ids === []) {
            return;
        }
        $jenjang = JenisTagihan::whereIn('id', $ids)->pluck('jenjang')
            ->filter(fn ($j) => $j !== null && $j !== '')->unique()->values()->all();
        if ($jenjang === []) {
            $actor->bolehSuperAdmin() || abort(403, 'Dispensasi jenis global hanya boleh dibuat super_admin.');
        }
        $this->authorizeLembagaMany($actor, array_map('strval', $jenjang));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function bersihkanDispensasi(array $data): array
    {
        unset($data['aturan'], $data['santri_ids']);

        return $data;
    }

    /** Simpan ulang daftar aturan satu paket dispensasi. */
    private function simpanAturan(Dispensasi $dispensasi, array $aturan): void
    {
        $dispensasi->aturan()->delete();
        $sekarang = now();
        $baris = array_map(fn ($a) => [
            'jenis_id' => $a['jenis_id'],
            'tipe' => $a['tipe'],
            'nilai' => $a['nilai'],
            'created_at' => $sekarang,
            'updated_at' => $sekarang,
        ], $aturan);
        $dispensasi->aturan()->createMany($baris);
    }

    /** Normalisasi daftar santri tambahan menjadi id unik terurut. */
    private function normalisasiSantriIds(mixed $nilai): array
    {
        if (! is_array($nilai)) {
            return [];
        }
        $ids = array_values(array_unique(array_map('intval', array_filter($nilai, fn ($v) => $v !== null && $v !== ''))));
        sort($ids);

        return array_values(array_filter($ids, fn ($id) => $id > 0));
    }

    /**
     * GET /api/admin/keuangan/tagihan/crosstab — tabel silang: satu baris
     * per santri, kolom per jenis tagihan (jenis bulanan dipecah per bulan =
     * periode). Nilai sel membawa nominal + status sehingga FE bisa mewarnai
     * lunas/belum. Label bulan FE yang membentuk (dari `periode`).
     */
    public function crosstabTagihan(Request $request)
    {
        $request->validate([
            'tahun_ajaran' => 'nullable',
            'tahun_ajaran.*' => 'string|max:20',
            'jenjang' => 'nullable|array',
            'jenjang.*' => 'string|max:20',
            'jenis_id' => 'nullable|integer|exists:jenis_tagihan,id',
            'status' => 'nullable|in:belum,sebagian,lunas',
            'belum_lunas' => 'nullable|boolean',
            'terlambat' => 'nullable|boolean',
            'santri' => 'nullable|string|max:100',
        ]);

        $q = Tagihan::with(['jenis', 'santri']);
        $this->applyFilter($q, $request, 'jenjang', 'jenjang');
        $this->applyFilter($q, $request, 'tahun_ajaran', 'tahun_ajaran');
        if ($request->filled('jenis_id')) {
            $q->where('jenis_id', (int) $request->input('jenis_id'));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->input('status'));
        }
        if ($request->boolean('belum_lunas')) {
            $q->where('status', '!=', 'lunas');
        }
        // Tunggakan = belum lunas DAN lewat batas waktu. Tanpa jatuh tempo = lewat
        // (tidak ada batasnya), jadi ikut paling depan.
        if ($request->boolean('terlambat')) {
            $q->where('status', '!=', 'lunas')
                ->where(fn ($w) => $w->whereNull('jatuh_tempo')->orWhereDate('jatuh_tempo', '<', today()));
        }
        if ($request->filled('santri')) {
            $cari = $request->input('santri');
            $q->whereHas('santri', fn ($s) => $s
                ->where('nama_lengkap', 'like', '%'.$cari.'%')
                ->orWhere('nisn', 'like', '%'.$cari.'%')
                ->orWhereHas('lembagaSantri', fn ($ls) => $ls->where('nis_lokal', 'like', '%'.$cari.'%')));
        }

        $tagihan = $q->orderBy('santri_id')->orderBy('jenis_id')->get();
        $bulanan = fn ($t) => $t->jenis?->tipe === 'bulanan';
        $key = fn ($t) => $this->keyKolomCrosstab((int) $t->jenis_id, $bulanan($t) ? $t->periode : null, $bulanan($t));

        // Kolom: per jenis; bulanan dipecah satu kolom per bulan (periode).
        $kolom = [];
        foreach ($tagihan->groupBy('jenis_id') as $jenisId => $baris) {
            $jenis = $baris->first()->jenis;
            $periode = $jenis?->tipe === 'bulanan'
                ? $baris->pluck('periode')->filter()->unique()->sort()->values()->all()
                : [null];
            foreach ($periode as $p) {
                $kolom[] = [
                    'key' => $this->keyKolomCrosstab((int) $jenisId, $p, $jenis?->tipe === 'bulanan'),
                    'jenis_id' => (int) $jenisId,
                    'jenis_nama' => $jenis?->nama ?? 'Jenis #'.$jenisId,
                    'tipe' => $jenis?->tipe ?? 'non_bulanan',
                    'periode' => $p,
                ];
            }
        }

        $baris = [];
        foreach ($tagihan->groupBy('santri_id') as $santriId => $kelompok) {
            $sel = [];
            foreach ($kelompok as $t) {
                $sel[$key($t)] = [
                    'id' => (int) $t->id,
                    'nominal' => (int) $t->nominal,
                    'terbayar' => (int) $t->terbayar,
                    'sisa' => $t->sisa(),
                    'status' => (string) $t->status,
                    'terlambat' => $t->terlambat(),
                    'tahun_ajaran' => (string) $t->tahun_ajaran,
                    'jatuh_tempo' => $t->jatuh_tempo?->format('Y-m-d'),
                ];
            }
            $santri = $kelompok->first()->santri;
            $baris[] = [
                'santri_id' => (int) $santriId,
                'nama' => $santri?->nama_lengkap ?? 'Tidak dikenal',
                'ayah_nama' => $santri?->ayah_nama,
                'ibu_nama' => $santri?->ibu_nama,
                'jenjang' => (string) $kelompok->first()->jenjang,
                'sel' => $sel,
                'total_tagihan' => (int) $kelompok->sum('nominal'),
                'total_terbayar' => (int) $kelompok->sum('terbayar'),
                'tunggakan' => (int) $kelompok->sum(fn ($t) => $t->sisaTerlambat()),
            ];
        }

        $baris = $this->terapkanUrutKoleksi($request, $baris, [
            'nama' => 'nama',
            'total' => 'total_tagihan',
            'bayar' => 'total_terbayar',
            'sisa' => 'tunggakan',
            'id' => 'santri_id',
        ]);

        $page = max(1, (int) $request->input('page', 1));
        $perPage = $this->perPage($request);

        return response()->json([
            'kolom' => $kolom,
            'baris' => array_slice($baris, ($page - 1) * $perPage, $perPage),
            'total' => count($baris),
            'per_page' => $perPage,
            'current_page' => $page,
            'last_page' => max(1, (int) ceil(count($baris) / $perPage)),
        ]);
    }

    /** Kunci sel crosstab: bulanan per periode, non-bulanan satu kolom per jenis. */
    private function keyKolomCrosstab(int $jenisId, ?string $periode, bool $bulanan): string
    {
        return $bulanan && $periode !== null
            ? $jenisId.'-'.$periode
            : 'jenis-'.$jenisId;
    }

    public function indexTagihan(Request $request)
    {
        $q = Tagihan::with(['jenis', 'santri']);
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
        $urut = $this->parseUrut($request, UrutKatalog::peta('keuangan_tagihan'));
        if ($urut === null) {
            $q->orderByDesc('id');
        } else {
            $q->select('tagihan.*')
                ->leftJoin('santri', 'santri.id', '=', 'tagihan.santri_id')
                ->leftJoin('jenis_tagihan', 'jenis_tagihan.id', '=', 'tagihan.jenis_id');
            $this->terapkanUrut($q, $urut, [['tagihan.id', 'turun']]);
        }

        return response()->json($q->paginate($this->perPage($request)));
    }

    public function storeTagihan(Request $request)
    {
        $data = $request->validate([
            'santri_id' => 'required|integer|exists:santri,id',
            'jenjang' => 'required|string',
            'tahun_ajaran' => 'required|string|max:9',
            'jenis_id' => 'required|integer|exists:jenis_tagihan,id',
            'periode' => 'nullable|string|max:20',
            'nominal' => 'required|integer|min:0',
            'jatuh_tempo' => 'nullable|date',
        ]);
        $this->canLembaga($request->user(), $data['jenjang']) || abort(403);
        $jenis = JenisTagihan::findOrFail($data['jenis_id']);
        $data['jatuh_tempo'] = JatuhTempo::untuk((string) $jenis->tipe, $data['periode'] ?? null, $data['jatuh_tempo'] ?? null);
        $tagihan = Tagihan::create($data + ['status' => 'belum', 'terbayar' => 0]);

        return response()->json($tagihan, 201);
    }

    /**
     * Ubah tagihan yang sudah terlanjur dibuat: nominal, tahun ajaran, dan
     * jatuh tempo. Jenis & periode TIDAK bisa diubah — keduanya bagian kunci
     * `uq_tagihan_santri_jenis_periode`, jadi mengubahnya berarti tagihan ini
     * menjadi tagihan yang lain, bukan koreksi.
     *
     * Nominal tidak boleh turun di bawah yang sudah dibayar (sisa negatif).
     * Status dihitung ulang dari nominal vs terbayar. Jenis bulanan mengabaikan
     * jatuh tempo manual — aturan tanggal 10 bulan berjalan berlaku juga di
     * sini, supaya tunggangan tidak bisa dikecualikan lewat ubah.
     */
    public function updateTagihan(Request $request, Tagihan $tagihan)
    {
        $data = $request->validate([
            'nominal' => 'required|integer|min:0',
            'tahun_ajaran' => 'required|string|max:9',
            'jatuh_tempo' => 'nullable|date',
        ]);
        $this->canLembaga($request->user(), $tagihan->jenjang) || abort(403);

        if ($data['nominal'] < $tagihan->terbayar) {
            abort(422, "Nominal tidak boleh lebih kecil dari yang sudah dibayar (Rp {$tagihan->terbayar}).");
        }

        $jenis = JenisTagihan::findOrFail($tagihan->jenis_id);

        $tagihan->nominal = $data['nominal'];
        $tagihan->tahun_ajaran = $data['tahun_ajaran'];
        $tagihan->jatuh_tempo = JatuhTempo::untuk(
            (string) $jenis->tipe,
            $tagihan->periode,
            $data['jatuh_tempo'] ?? null,
        );
        $tagihan->status = match (true) {
            $tagihan->terbayar <= 0 => 'belum',
            $tagihan->terbayar >= $tagihan->nominal => 'lunas',
            default => 'sebagian',
        };
        $tagihan->save();

        return response()->json($tagihan);
    }

    /** Tingkat akhir per jenjang (sinkron peta TINGKAT_AKHIR halaman Kelulusan). */
    private const TINGKAT_AKHIR = ['MI' => '6', 'MD' => '6', 'MTS' => '9', 'MLN' => '12'];

    private const KELOMPOK_KANDIDAT = [
        'mi_saja', 'md_saja', 'mi', 'md', 'mi_md',
        'aktif', 'kelas_akhir', 'selain_kelas_akhir', 'custom',
    ];

    /**
     * Kandidat santri generate: daftar santri aktif pada satu TA sesuai
     * kelompok kriteria, sudah dihitung jenjang/tingkat/kelasnya.
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
                'jk' => $info['jk'],
                'nisn' => $info['nisn'],
                'nis_lokal' => $info['nis_lokal'],
                'jenjang' => $info['jenjang_utama'],
                'tingkat' => $info['tingkat'],
                'kelas' => $info['kelas'],
                'kelas_id' => $info['kelas_id'],
                'status_akhir' => $info['status_akhir'],
            ];
        }

        // Urut bawaan: kelas (tanpa kelas paling bawah) → JK (L dulu) → nama.
        // Param `sort` menimpa bawaan (sort koleksi, kolom keluaran di PETA).
        $hasil = $this->terapkanUrutKoleksi($request, $hasil, [
            'nama' => 'nama_lengkap',
            'jk' => 'jk',
            'nis' => 'nis_lokal',
            'tingkat' => 'tingkat',
            'kelas' => 'kelas',
            'status' => 'status_akhir',
            'id' => 'santri_id',
        ]);
        if ($request->input('sort') === null || $request->input('sort') === '' || $request->input('sort') === []) {
            usort($hasil, function ($a, $b) {
                if (($a['kelas'] === null) !== ($b['kelas'] === null)) {
                    return $a['kelas'] === null ? 1 : -1;
                }

                return [$a['kelas'] ?? '', $a['jk'] ?? '', $a['nama_lengkap']]
                    <=> [$b['kelas'] ?? '', $b['jk'] ?? '', $b['nama_lengkap']];
            });
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
     * generate). Jenjang tiap santri dihitung dari riwayat TA terkait;
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

        // Dispensasi aktif untuk TA+jenis ini; baris tanpa override manual
        // dihitung ulang di sini (otoritatif), override manual menang.
        $daftarDispensasi = Dispensasi::with(['aturan.jenis', 'santriTambahan'])
            ->where('tahun_ajaran', $data['tahun_ajaran'])
            ->where('is_active', true)
            ->whereHas('aturan', fn ($w) => $w->whereNull('jenis_id')->orWhere('jenis_id', $jenis->id))
            ->get();
        $aturan = app(DispensasiService::class);

        $dibuat = 0;
        $dilewati = 0;
        foreach ($diminta as $santriId => $s) {
            $info = $peta[$santriId] ?? null;
            if ($info === null) {
                abort(422, "Santri #{$santriId} tidak aktif pada tahun ajaran {$data['tahun_ajaran']}.");
            }
            $this->canLembaga($actor, $info['jenjang_utama']) || abort(403);

            if (array_key_exists('nominal', $s) && $s['nominal'] !== null) {
                $nominal = (int) $s['nominal'];
                $potongan = 0;
                $dispensasiIds = null;
            } else {
                $hasil = $aturan->terapkan((int) $data['nominal'], $aturan->saring($daftarDispensasi, (int) $santriId), (int) $jenis->id);
                $nominal = $hasil['nominal'];
                $potongan = $hasil['potongan'];
                $dispensasiIds = $hasil['ids'] === [] ? null : $hasil['ids'];
            }

            foreach ($periodes as $periode) {
                $tagihan = Tagihan::firstOrCreate(
                    ['santri_id' => $santriId, 'jenis_id' => $jenis->id, 'periode' => $periode],
                    [
                        'jenjang' => $info['jenjang_utama'],
                        'tahun_ajaran' => $data['tahun_ajaran'], 'nominal' => $nominal,
                        'potongan' => $potongan, 'dispensasi_ids' => $dispensasiIds,
                        'jatuh_tempo' => JatuhTempo::untuk((string) $jenis->tipe, $periode, $data['jatuh_tempo'] ?? null),
                        'status' => 'belum', 'terbayar' => 0,
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
     * Peta santri dari riwayat_belajar pada satu TA.
     *
     * Patokan keaktifan (sengaja): `status_akhir` bukan `pindah_keluar`.
     * Flag `is_active_riwayat` maupun `santri.is_active_pst` TIDAK dipakai —
     * supaya status `lulus`/`naik`/`lanjut` (santri yang sudah naik jenjang
     * atau lulus di TA tsb) tetap bisa digenerate tagihan, misalnya untuk
     * penagihan tunggakan TA sebelumnya.
     *
     * Baris semester 2 menang sebagai baris tampilan.
     *
     * @param  list<int>  $santriIds
     * @return array<int, array{santri_id:int, nama_lengkap:string, jk:?string, nisn:?string, nis_lokal:?string, per_jenjang:array<string, array{semester:?string, tingkat:?string, kelas:?string, kelas_id:?int, status:?string}>, jenjang_utama:string, tingkat:?string, kelas:?string, kelas_id:?int, status_akhir:?string, kelas_akhir:bool}>
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
            ->get(['rb.santri_id', 'rb.jenjang', 'rb.tingkat', 'rb.kelas_id', 'rb.semester', 'rb.status_akhir', 's.nama_lengkap', 's.nisn', 's.jk', 'ls.nis_lokal', 'k.nama_kelas']);

        $peta = [];
        foreach ($baris as $b) {
            $id = (int) $b->santri_id;
            $peta[$id] ??= [
                'santri_id' => $id,
                'nama_lengkap' => (string) $b->nama_lengkap,
                'jk' => $b->jk,
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
                    'kelas_id' => $b->kelas_id === null ? null : (int) $b->kelas_id,
                    'status' => $b->status_akhir,
                ];
            }
        }

        foreach ($peta as &$info) {
            $jenjangs = array_keys($info['per_jenjang']);
            $has = fn (string $j) => in_array($j, $jenjangs, true);
            $info['jenjang_utama'] = $has('MI') ? 'MI' : ($has('MD') ? 'MD' : ($jenjangs[0] ?? ''));
            $utama = $info['per_jenjang'][$info['jenjang_utama']] ?? null;
            $info['tingkat'] = $utama['tingkat'] ?? null;
            $info['kelas'] = $utama['kelas'] ?? null;
            $info['kelas_id'] = $utama['kelas_id'] ?? null;
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
     * Patokan keaktifan sudah ditegakkan di query peta: yang tersaring hanya
     * `pindah_keluar`, jadi kelompok di sini murni soal pola jenjang
     * atau tingkat akhir — bukan status aktif.
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
            default => true, // 'aktif' & 'custom' = semua (pindah keluar sudah tersaring)
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

    /**
     * Tunggakan per santri: tagihan belum lunas yang sudah lewat batas
     * waktunya. Tagihan bulanan bulan yang masih berjalan tidak dihitung;
     * tagihan tanpa jatuh tempo (non-bulanan yang tidak diisi manual) langsung
     * dihitung, sebab tidak punya batas waktu.
     */
    public function tunggakan(Request $request)
    {
        $q = Tagihan::with(['jenis', 'santri'])
            ->where('status', '!=', 'lunas')
            ->where(fn ($w) => $w->whereNull('jatuh_tempo')->orWhereDate('jatuh_tempo', '<', today()));
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
                'nama' => $s?->nama_lengkap ?? 'Tidak diketahui',
                'total_tagihan' => $rows->sum('nominal'),
                'terbayar' => $rows->sum('terbayar'),
                'tunggakan' => $rows->sum(fn ($r) => $r->sisaTerlambat()),
                'jumlah_tagihan' => $rows->count(),
                'terlambat_terlama' => $rows->filter(fn ($r) => $r->jatuh_tempo !== null)
                    ->min(fn ($r) => $r->jatuh_tempo->format('Y-m-d')),
                // Ada tagihan terlambat tanpa tanggal batas sama sekali.
                'tanpa_jatuh_tempo' => $rows->contains(fn ($r) => $r->jatuh_tempo === null),
            ];
        })->values();

        $perSantri = $this->terapkanUrutKoleksi($request, $perSantri->all(), [
            'nama' => 'nama',
            'total' => 'total_tagihan',
            'bayar' => 'terbayar',
            'sisa' => 'tunggakan',
            'jumlah' => 'jumlah_tagihan',
            'id' => 'santri_id',
        ]);

        return response()->json(['per_santri' => $perSantri]);
    }
}

<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\KeuanganLembaga;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DispensasiIndexRequest;
use App\Http\Requests\Admin\DispensasiRequest;
use App\Models\Dispensasi;
use App\Models\JenisTagihan;
use App\Models\Tagihan;
use App\Services\DispensasiService;
use App\Services\UrutKatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Keuangan: dispensasi (keringanan) tagihan. */
class DispensasiController extends Controller
{
    use KeuanganLembaga;
    use TenantGuard;
    use UrutDaftar;

    /**
     * Daftar dispensasi. Filter jenis/status; `santri_id` = hanya yang
     * berlaku untuk santri itu (dipakai profil santri; `tahun_ajaran`
     * wajib sebagai konteks jenjang santri). Paket TIDAK terikat TA —
     * `tahun_ajaran` hanya label arsip, bukan penyaring paket.
     */
    public function indexDispensasi(DispensasiIndexRequest $request)
    {
        $data = $request->validated();

        $q = Dispensasi::with(['aturan.jenis', 'santriTambahan.lembagaAktif']);
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
            $daftar = app(DispensasiService::class)->saring($daftar, (int) $data['santri_id'], $info['jenjang_utama']);
        }

        return response()->json($daftar->values());
    }

    /**
     * Kuota terpakai per santri per paket: jumlah tagihan BULANAN yang
     * memuat paket (seumur hidup, semua TA). Dipakai pratinjau generate &
     * popover agar tak over-janji; backend generate/Ubah tetap otoritatif.
     *
     * @return array<int, array<int, int>> santri_id → (paket_id → terpakai)
     */
    public function kuotaPakai(Request $request): array
    {
        $ids = collect($request->query('santri_ids', []))
            ->map(fn ($v) => (int) $v)->filter(fn ($v) => $v > 0)->unique()->take(500)->values();
        if ($ids->isEmpty()) {
            return [];
        }
        $paketIds = Dispensasi::whereNotNull('kuota_bulan')->pluck('id')
            ->map(fn ($v) => (int) $v)->all();
        if ($paketIds === []) {
            return [];
        }
        $jenisBulanan = JenisTagihan::where('tipe', 'bulanan')->pluck('id')
            ->map(fn ($v) => (int) $v)->all();
        $baris = Tagihan::whereIn('santri_id', $ids)->whereIn('jenis_id', $jenisBulanan)
            ->get(['santri_id', 'dispensasi_ids']);
        $hasil = [];
        foreach ($baris as $t) {
            foreach ((array) ($t->dispensasi_ids ?? []) as $did) {
                $did = (int) $did;
                if (in_array($did, $paketIds, true)) {
                    $sid = (int) $t->santri_id;
                    $hasil[$sid][$did] = ($hasil[$sid][$did] ?? 0) + 1;
                }
            }
        }

        return $hasil;
    }

    /**
     * Dampak dispensasi per lembaga: berapa tagihan yang benar-benar memuat
     * paket + total potongannya, dihitung dari data tagihan (bukan definisi
     * paket). `dispensasi_id` opsional untuk menelusuri sebaran SATU paket
     * ke tiap lembaga — paket berlingkup MI yang muncul di baris MD langsung
     * kelihatan dari angkanya.
     *
     * Lingkup: hanya lembaga yang boleh diakses pengguna (`scopeLembaga`),
     * plus filter `tahun_ajaran`/`jenjang` yang sama dengan tabel tagihan.
     */
    public function rekapDispensasi(Request $request)
    {
        $request->validate([
            'tahun_ajaran' => 'nullable',
            'tahun_ajaran.*' => 'string|max:20',
            'jenjang' => 'nullable|array',
            'jenjang.*' => 'string|max:20',
            'dispensasi_id' => 'nullable|integer|exists:dispensasi,id',
        ]);

        // Hanya tagihan yang BENAR-BENAR memuat paket: `dispensasi_ids` null
        // atau larik kosong bukan "punya dispensasi" (jalur tulis selalu null,
        // tapi baris lama tetap dijaga lewat `whereJsonLength`).
        $q = Tagihan::query()->whereJsonLength('dispensasi_ids', '>', 0);
        $this->scopeLembaga($q, $request->user(), $request, 'tagihan.jenjang');
        $this->applyFilter($q, $request, 'tahun_ajaran', 'tagihan.tahun_ajaran');
        if ($request->filled('dispensasi_id')) {
            $q->whereJsonContains('dispensasi_ids', (int) $request->input('dispensasi_id'));
        }

        $agregat = (clone $q)->toBase()
            ->groupBy('tagihan.jenjang')
            ->selectRaw('tagihan.jenjang as jenjang')
            ->selectRaw('COUNT(*) as jumlah_tagihan')
            ->selectRaw('COUNT(DISTINCT tagihan.santri_id) as jumlah_penerima')
            ->selectRaw('COALESCE(SUM(tagihan.potongan), 0) as total_potongan')
            ->get();

        /* Jumlah paket berbeda per lembaga: id-nya tersimpan sebagai larik JSON
           per baris, jadi dihitung di PHP dari pasangan (jenjang, ids) unik —
           tetap portabel di MySQL & SQLite (tak ada JSON_TABLE/json_each). */
        $paketPerLembaga = [];
        $pasangan = (clone $q)->toBase()
            ->select('tagihan.jenjang', 'tagihan.dispensasi_ids')->distinct()->get();
        foreach ($pasangan as $p) {
            $ids = is_string($p->dispensasi_ids)
                ? (json_decode($p->dispensasi_ids, true) ?? [])
                : (array) ($p->dispensasi_ids ?? []);
            foreach ($ids as $id) {
                $paketPerLembaga[(string) $p->jenjang][(int) $id] = true;
            }
        }

        $baris = [];
        foreach ($agregat as $a) {
            $jenjang = (string) $a->jenjang;
            $baris[] = [
                'id' => $jenjang,
                'jenjang' => $jenjang,
                'jumlah_tagihan' => (int) $a->jumlah_tagihan,
                'jumlah_penerima' => (int) $a->jumlah_penerima,
                'total_potongan' => (int) $a->total_potongan,
                'jumlah_paket' => count($paketPerLembaga[$jenjang] ?? []),
            ];
        }

        /* Urut bawaan: jenjang menaik. Param `sort` menimpa — kodenya sama
           dengan yang didaftarkan di `UrutKatalog` (dialog Preset Urut). */
        $tanpaSort = in_array($request->input('sort'), [null, '', []], true);
        $baris = $this->terapkanUrutKoleksi($request, $baris, [
            'lembaga' => 'jenjang',
            'tagihan' => 'jumlah_tagihan',
            'penerima' => 'jumlah_penerima',
            'potongan' => 'total_potongan',
            'paket' => 'jumlah_paket',
            'id' => 'jenjang',
        ]);
        if ($tanpaSort) {
            usort($baris, fn ($a, $b) => $a['jenjang'] <=> $b['jenjang']);
        }

        return response()->json(['data' => $baris]);
    }

    public function storeDispensasi(DispensasiRequest $request)
    {
        $data = $this->validasiDispensasi($request);
        $this->authorizeDispensasi($request->user(), $data);

        $dispensasi = DB::transaction(function () use ($data) {
            $d = Dispensasi::create($this->bersihkanDispensasi($data));
            $this->simpanAturan($d, $data['aturan']);
            $d->santriTambahan()->sync($this->normalisasiSantriIds($data['santri_ids'] ?? null));

            return $d;
        });

        return response()->json($dispensasi->load(['aturan.jenis', 'santriTambahan.lembagaAktif']), 201);
    }

    public function updateDispensasi(DispensasiRequest $request, Dispensasi $dispensasi)
    {
        $data = $this->validasiDispensasi($request);
        $this->authorizeDispensasi($request->user(), $data);
        DB::transaction(function () use ($dispensasi, $data) {
            $dispensasi->update($this->bersihkanDispensasi($data));
            $this->simpanAturan($dispensasi, $data['aturan']);
            $dispensasi->santriTambahan()->sync($this->normalisasiSantriIds($data['santri_ids'] ?? null));
        });

        return response()->json($dispensasi->load(['aturan.jenis', 'santriTambahan.lembagaAktif']));
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
    private function validasiDispensasi(DispensasiRequest $request): array
    {
        $data = $request->validated();
        $data['aturan'] = $this->normalisasiAturan($data['aturan']);
        foreach ($data['aturan'] as $a) {
            if ($a['tipe'] === 'persen' && $a['nilai'] > 100) {
                abort(422, 'Nilai persen maksimal 100.');
            }
        }
        $this->pastikanAturanSelarasJenjang($data);

        return $data;
    }

    /**
     * Paket berlingkup lembaga hanya boleh memakai jenis lembaga itu (atau
     * jenis global, `jenjang` null) — mencegah paket MI memotong jenis MD.
     *
     * @param  array<string, mixed>  $data
     */
    private function pastikanAturanSelarasJenjang(array $data): void
    {
        $jenjang = $data['jenjang'] ?? null;
        if (! is_string($jenjang) || $jenjang === '') {
            return;
        }
        $ids = array_values(array_unique(array_filter(
            array_map(fn ($a) => $a['jenis_id'] ?? null, $data['aturan']),
            fn ($id) => $id !== null,
        )));
        if ($ids === []) {
            return;
        }
        $salah = JenisTagihan::whereIn('id', $ids)
            ->whereNotNull('jenjang')
            ->where('jenjang', '!=', $jenjang)
            ->pluck('nama')->all();
        if ($salah !== []) {
            abort(422, 'Jenis tagihan '.implode(', ', $salah)." bukan milik lembaga {$jenjang} — ganti jenisnya atau kosongkan lingkup jenjang.");
        }
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
     * selain itu tiap jenjang jenis wajib boleh diakses. Lingkup paket
     * (`jenjang`) sendiri juga wajib boleh diakses pembuatnya.
     *
     * @param  array<string, mixed>  $data
     */
    private function authorizeDispensasi($actor, array $data): void
    {
        $jenjangPaket = $data['jenjang'] ?? null;
        if (is_string($jenjangPaket) && $jenjangPaket !== '') {
            $this->authorizeLembaga($actor, $jenjangPaket);
        }
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
}

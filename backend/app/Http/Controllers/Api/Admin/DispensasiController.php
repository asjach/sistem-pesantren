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
use App\Models\TarifTagihan;
use App\Services\DispensasiService;
use App\Services\UrutKatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
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

        $q = Dispensasi::with([
            'aturan.jenis',
            'santriTambahan' => fn ($s) => $s->tenantScope()->with('lembagaAktif'),
        ]);
        $jenjang = $this->jenjangUntukBerkas($request);
        $q->where(fn ($w) => $w->whereNull('jenjang')->orWhereIn('jenjang', $jenjang));
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
        $q = Tagihan::whereIn('santri_id', $ids)->whereIn('jenis_id', $jenisBulanan);
        $this->scopeLembaga($q, $request->user(), $request, 'tagihan.jenjang');
        $baris = $q->get(['santri_id', 'dispensasi_ids']);
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
     * Rekap dampak dispensasi per **paket × jenis tagihan**: berapa tagihan
     * yang benar-benar memuat paket + total potongannya, dihitung dari data
     * tagihan (bukan definisi paket). Barisnya = (lembaga, tahun ajaran,
     * paket, jenis tagihan), jadi sebaran satu paket ke tiap lembaga/TA/jenis
     * bisa ditelusuri — `dispensasi_id` mempersempit ke satu paket saja.
     *
     * Potongan tiap paket **dihitung ulang** dari nominal kotor
     * (`nominal + potongan`) memakai aturan akumulatif yang sama seperti
     * generate. Satu baris tagihan bisa memuat beberapa paket, dan `potongan`
     * di tabel tagihan adalah total GABUNGAN baris itu — tanpa hitung ulang,
     * potongan yang sama akan terhitung di tiap paket (total membengkak).
     *
     * Lingkup: hanya lembaga yang boleh diakses pengguna (`scopeLembaga`),
     * plus filter `tahun_ajaran`/`jenjang` yang sama dengan tabel tagihan.
     *
     * Selain angka dampak, tiap baris membawa konteks nominal: `total_kotor`
     * (jumlah `nominal + potongan` baris-barisnya), `tarif` (nominal master
     * `tarif_tagihan` untuk jenjang/TA/jenis itu; null bila belum diatur),
     * dan `persen` (potongan ÷ kotor, dibulatkan). `tarif` hanya PEMBANDING:
     * nominal yang benar-benar ditagih ada di `total_kotor`, sehingga tarif
     * yang berubah setelah tagihan dibuat tidak membuat persen melenceng.
     */
    public function rekapDispensasi(Request $request)
    {
        $request->validate([
            'tahun_ajaran' => 'nullable',
            'tahun_ajaran.*' => 'string|max:20',
            'jenjang' => 'nullable|array',
            'jenjang.*' => 'string|max:20',
            'dispensasi_id' => 'nullable|integer|exists:dispensasi,id',
            'bentuk' => 'nullable|in:daftar,crosstab',
        ]);

        // Hanya tagihan yang BENAR-BENAR memuat paket: `dispensasi_ids` null
        // atau larik kosong bukan "punya dispensasi" (jalur tulis selalu null,
        // tapi baris lama tetap dijaga lewat `whereJsonLength`).
        $q = Tagihan::query()->whereJsonLength('dispensasi_ids', '>', 0);
        $this->scopeLembaga($q, $request->user(), $request, 'tagihan.jenjang');
        $this->applyFilter($q, $request, 'tahun_ajaran', 'tagihan.tahun_ajaran');
        $filterPaket = null;
        if ($request->filled('dispensasi_id')) {
            $filterPaket = (int) $request->input('dispensasi_id');
            $q->whereJsonContains('dispensasi_ids', $filterPaket);
        }

        // Kolom seperlunya: kontribusi tiap paket dihitung ulang dari nominal
        // kotor, jadi butuh `nominal` + `potongan` tiap baris. `dispensasi_ids`
        // berupa larik JSON per baris sehingga pengelompokan per paket
        // dikerjakan di PHP — tetap portabel di MySQL & SQLite (tak ada
        // JSON_TABLE/json_each).
        $tagihan = $q->select([
            'tagihan.jenjang', 'tagihan.tahun_ajaran', 'tagihan.jenis_id',
            'tagihan.santri_id', 'tagihan.nominal', 'tagihan.potongan', 'tagihan.dispensasi_ids',
        ])->get();

        $namaJenis = JenisTagihan::whereIn('id', $tagihan->pluck('jenis_id')->unique()->all())
            ->pluck('nama', 'id');
        $paketIds = $tagihan
            ->flatMap(fn ($t) => array_map('intval', (array) ($t->dispensasi_ids ?? [])))
            ->unique()->values()->all();
        /** @var Collection<int, Dispensasi> $paket */
        $paket = Dispensasi::with('aturan')->whereIn('id', $paketIds)->get()->keyBy('id');
        $aturanSvc = app(DispensasiService::class);

        /** @var array<string, array<string, mixed>> $kumpulan */
        $kumpulan = [];
        foreach ($tagihan as $t) {
            $jenjang = (string) $t->jenjang;
            $ta = (string) $t->tahun_ajaran;
            $jenisId = (int) $t->jenis_id;
            $santriId = (int) $t->santri_id;

            $ids = array_values(array_unique(array_map('intval', (array) ($t->dispensasi_ids ?? []))));
            sort($ids);
            if ($ids === []) {
                continue;
            }

            // Kontribusi tiap paket dihitung ulang dengan aturan akumulatif
            // yang sama seperti generate (urut id), dari nominal KOTOR —
            // potongan paket dalam baris multi-paket bergantung urutan, jadi
            // hitung ulang harus memakai baris apa adanya meski tabel sedang
            // disaring ke satu paket.
            $cocok = collect($ids)->map(fn (int $id) => $paket->get($id))->filter()->values();
            $hitung = $aturanSvc->terapkan((int) $t->nominal + (int) $t->potongan, $cocok, $jenisId);
            $perId = [];
            foreach ($hitung['langkah'] as $l) {
                $perId[(int) $l['id']] = (int) $l['potongan'];
            }
            $nilai = array_map(fn (int $id) => $perId[$id] ?? 0, $ids);

            // Aturan paket bisa berubah setelah tagihan dibuat (atau paketnya
            // hilang) sehingga jumlah hasil hitung ulang tak lagi sama dengan
            // `potongan` tersimpan. Bagi potongan TERSIMPAN proporsional supaya
            // total per baris tetap sama dengan data tagihan.
            if (array_sum($nilai) !== (int) $t->potongan) {
                $nilai = $this->bagiProporsional($nilai, (int) $t->potongan);
            }

            foreach ($ids as $i => $paketId) {
                if ($filterPaket !== null && $paketId !== $filterPaket) {
                    continue;
                }
                $kunci = "{$jenjang}|{$ta}|{$jenisId}|{$paketId}";
                $kumpulan[$kunci] ??= [
                    'id' => $kunci,
                    'jenjang' => $jenjang,
                    'tahun_ajaran' => $ta,
                    'jenis_id' => $jenisId,
                    'jenis' => (string) ($namaJenis[$jenisId] ?? "#{$jenisId}"),
                    'paket_id' => $paketId,
                    'paket' => (string) ($paket->get($paketId)?->nama ?? "#{$paketId}"),
                    'jumlah_tagihan' => 0,
                    'jumlah_penerima' => 0,
                    'total_potongan' => 0,
                    'total_kotor' => 0,
                    'santri' => [],
                ];
                $kumpulan[$kunci]['jumlah_tagihan']++;
                $kumpulan[$kunci]['santri'][$santriId] = true;
                $kumpulan[$kunci]['total_potongan'] += $nilai[$i];
                // Nominal KOTOR (`nominal + potongan`) dijumlahkan agar persen
                // potongan dihitung dari basis yang sama dengan hitung ulang.
                $kumpulan[$kunci]['total_kotor'] += (int) $t->nominal + (int) $t->potongan;
            }
        }

        /* Tarif master per (jenjang, TA, jenis): pembanding nominal kotor
           tersimpan. Dimuat SEKALI untuk semua baris yang tampil (bukan query
           per baris). Bila tarif sudah berubah atau belum diatur, `tarif` null;
           nominal kotor tetap dilaporkan apa adanya agar persennya konsisten
           dengan potongan tersimpan. */
        $kunciTarif = fn (string $jenjang, string $ta, int $jenisId) => "{$jenjang}|{$ta}|{$jenisId}";
        $jenjangTampil = [];
        foreach ($kumpulan as $g) {
            $jenjangTampil[$g['jenjang']] = true;
        }
        $petaTarif = [];
        foreach (
            TarifTagihan::query()
                ->whereIn('jenjang', array_keys($jenjangTampil))
                ->get(['jenjang', 'tahun_ajaran', 'jenis_id', 'nominal']) as $tf
        ) {
            $petaTarif[$kunciTarif($tf->jenjang, $tf->tahun_ajaran, (int) $tf->jenis_id)] = (int) $tf->nominal;
        }

        $baris = [];
        foreach ($kumpulan as $g) {
            $g['jumlah_penerima'] = count($g['santri']);
            unset($g['santri']);
            $kotor = (int) $g['total_kotor'];
            $g['total_kotor'] = $kotor;
            $g['tarif'] = $petaTarif[$kunciTarif($g['jenjang'], $g['tahun_ajaran'], (int) $g['jenis_id'])] ?? null;
            // Persen potongan terhadap nominal kotor (dibulatkan): basis yang
            // sama dengan hitung ulang, jadi totalnya bisa > 100% bila beberapa
            // paket menumpuk pada satu baris tagihan.
            $g['persen'] = $kotor > 0 ? (int) round($g['total_potongan'] / $kotor * 100) : 0;
            $baris[] = $g;
        }

        /* Urut bawaan: lembaga → TA → paket → jenis. Param `sort` menimpa —
           kodenya sama dengan yang didaftarkan di `UrutKatalog`. */
        $tanpaSort = in_array($request->input('sort'), [null, '', []], true);
        $baris = $this->terapkanUrutKoleksi($request, $baris, [
            'lembaga' => 'jenjang',
            'ta' => 'tahun_ajaran',
            'paket' => 'paket',
            'tagihan' => 'jenis',
            'penerima' => 'jumlah_penerima',
            'kotor' => 'total_kotor',
            'tarif' => 'tarif',
            'potongan' => 'total_potongan',
            'persen' => 'persen',
            'id' => 'id',
        ]);
        if ($tanpaSort) {
            usort($baris, fn ($a, $b) => [$a['jenjang'], $a['tahun_ajaran'], $a['paket'], $a['jenis']]
                <=> [$b['jenjang'], $b['tahun_ajaran'], $b['paket'], $b['jenis']]);
        }

        /* Bentuk crosstab: sumbu baris = paket (dengan lembaga & TA sebagai
           identitasnya), sumbu kolom = JENIS TAGIHAN. Sel = total potongan
           paket pada jenis itu — angka yang sama dengan `total_potongan`
           pada bentuk daftar, hanya diputar. `tarif` disertakan di sel
           supaya FE bisa menampilkan pembandingnya sebagai tooltip. */
        if ($request->input('bentuk') === 'crosstab') {
            return response()->json($this->bentukCrosstab($baris));
        }

        return response()->json(['data' => $baris]);
    }

    /**
     * Putar baris rekap (paket × jenis) menjadi crosstab paket × jenis.
     *
     * Baris = kombinasi (lembaga, TA, paket) — paket yang sama di lembaga/TA
     * berbeda tetap baris terpisah karena potongannya pun berbeda. Kolom =
     * hanya jenis yang BENAR-BENAR terdampak pada lingkup filter (kalau semua
     * jenis tagihan dipaksakan, sebagian besar sel kosong dan tabelnya jadi
     * tak terbaca). Urutan kolom mengikuti id jenis agar stabil antar request.
     *
     * @param  list<array<string, mixed>>  $baris
     * @return array{baris: list<array<string, mixed>>, kolom: list<array<string, mixed>>}
     */
    private function bentukCrosstab(array $baris): array
    {
        $kolom = [];
        $kelompok = [];
        foreach ($baris as $b) {
            $jenisId = (int) $b['jenis_id'];
            $kolom[$jenisId] = ['key' => "jenis-{$jenisId}", 'jenis_id' => $jenisId, 'jenis_nama' => $b['jenis']];

            $kunci = "{$b['jenjang']}|{$b['tahun_ajaran']}|{$b['paket_id']}";
            $kelompok[$kunci] ??= [
                'id' => $kunci,
                'jenjang' => $b['jenjang'],
                'tahun_ajaran' => $b['tahun_ajaran'],
                'paket_id' => (int) $b['paket_id'],
                'paket' => $b['paket'],
                'total_potongan' => 0,
                'total_kotor' => 0,
                'jumlah_tagihan' => 0,
                'jumlah_penerima' => 0,
                'sel' => [],
            ];
            $kelompok[$kunci]['total_potongan'] += (int) $b['total_potongan'];
            $kelompok[$kunci]['total_kotor'] += (int) $b['total_kotor'];
            $kelompok[$kunci]['jumlah_tagihan'] += (int) $b['jumlah_tagihan'];
            /* Penerima dijumlahkan antar jenis: satu santri yang terdampak di
               dua jenis terhitung dua kali di sini — ini angka per baris
               paket, bukan jumlah santri unik (yang tersedia di bentuk daftar
               per jenis). Diberi nama `jumlah_penerima_jenis` supaya tidak
               terbaca sebagai hitungan unik. */
            $kelompok[$kunci]['jumlah_penerima'] += (int) $b['jumlah_penerima'];
            $kelompok[$kunci]['sel']["jenis-{$jenisId}"] = [
                'potongan' => (int) $b['total_potongan'],
                'kotor' => (int) $b['total_kotor'],
                'tarif' => $b['tarif'],
                'persen' => (int) $b['persen'],
                'jumlah_tagihan' => (int) $b['jumlah_tagihan'],
            ];
        }

        $kelompok = array_values($kelompok);
        // Urut bawaan sama dengan bentuk daftar: lembaga → TA → paket.
        usort($kelompok, fn ($a, $b) => [$a['jenjang'], $a['tahun_ajaran'], $a['paket']]
            <=> [$b['jenjang'], $b['tahun_ajaran'], $b['paket']]);

        $kolom = array_values($kolom);
        usort($kolom, fn ($a, $b) => $a['jenis_id'] <=> $b['jenis_id']);

        return ['baris' => $kelompok, 'kolom' => $kolom];
    }

    /**
     * Bagi `$target` menurut bobot `$bobot` (bulat >= 0) memakai metode sisa
     * terbesar, sehingga jumlah hasil SELALU tepat `$target`. Semua bobot nol
     * → seluruh target ke bobot pertama (satu-satunya atribusi yang masuk
     * akal: tak ada dasar untuk membagi).
     *
     * @param  list<int>  $bobot
     * @return list<int>
     */
    private function bagiProporsional(array $bobot, int $target): array
    {
        $n = count($bobot);
        if ($n === 0) {
            return [];
        }
        $target = max(0, $target);
        $total = array_sum($bobot);
        if ($total <= 0) {
            $hasil = array_fill(0, $n, 0);
            if ($target > 0) {
                $hasil[0] = $target;
            }

            return $hasil;
        }

        $hasil = [];
        $sisa = [];
        $terpakai = 0;
        foreach (array_values($bobot) as $i => $b) {
            $dasar = intdiv($b * $target, $total);
            $hasil[$i] = $dasar;
            $sisa[$i] = ($b * $target) % $total;
            $terpakai += $dasar;
        }
        // Selisih pembulatan dibagikan ke sisa terbesar (deterministik:
        // tie-break indeks terkecil) supaya jumlahnya pas.
        for ($kurang = $target - $terpakai; $kurang > 0; $kurang--) {
            $pilih = array_key_first($sisa);
            foreach ($sisa as $i => $r) {
                if ($r > $sisa[$pilih]) {
                    $pilih = $i;
                }
            }
            $hasil[$pilih]++;
            $sisa[$pilih] = -1; // sudah kebagian, jangan dipilih lagi
        }

        return $hasil;
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
        $this->authorizeDispensasi($request->user(), $dispensasi->load('aturan')->toArray());
        $data = $this->validasiDispensasi($request);
        $this->authorizeDispensasi($request->user(), $data);
        DB::transaction(function () use ($dispensasi, $data) {
            $dispensasi->update($this->bersihkanDispensasi($data));
            $this->simpanAturan($dispensasi, $data['aturan']);
            $dispensasi->santriTambahan()->sync($this->normalisasiSantriIds($data['santri_ids'] ?? null));
        });

        return response()->json($dispensasi->load(['aturan.jenis', 'santriTambahan.lembagaAktif']));
    }

    public function destroyDispensasi(Request $request, Dispensasi $dispensasi)
    {
        $this->authorizeDispensasi($request->user(), $dispensasi->load('aturan')->toArray());
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

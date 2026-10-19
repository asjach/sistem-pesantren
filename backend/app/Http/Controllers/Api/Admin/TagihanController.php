<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\KeuanganLembaga;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\TagihanCrosstabRequest;
use App\Http\Requests\Admin\TagihanGenerateRequest;
use App\Http\Requests\Admin\TagihanKandidatRequest;
use App\Http\Requests\Admin\TagihanStoreRequest;
use App\Http\Requests\Admin\TagihanUpdateRequest;
use App\Models\Dispensasi;
use App\Models\GrupSantriCustom;
use App\Models\JenisTagihan;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TarifTagihan;
use App\Services\DispensasiService;
use App\Services\UrutKatalog;
use App\Support\JatuhTempo;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Keuangan: tagihan, kandidat/generate, crosstab, dan tunggakan. */
class TagihanController extends Controller
{
    use KeuanganLembaga;
    use TenantGuard;
    use UrutDaftar;

    /**
     * GET /api/admin/keuangan/tagihan/crosstab — tabel silang: satu baris
     * per santri, kolom per jenis tagihan (jenis bulanan dipecah per bulan =
     * periode). Nilai sel membawa nominal + status sehingga FE bisa mewarnai
     * lunas/belum. Label bulan FE yang membentuk (dari `periode`).
     */
    /**
     * Saring santri berdasarkan keaktifan — cermin aturan penanda merah baris
     * crosstab (bukan `is_active` mentah): Santri MI-MD nonaktif HANYA bila
     * `status_akhir` MI dan MD sama-sama `pindah_keluar`; sisanya memakai
     * `status_akhir` jenjang utama (MI > MD > lainnya).
     *
     * Tanpa `tahun_ajaran` tak ada patokan status yang benar (sama seperti
     * kolom status di baris), jadi filter diabaikan — bukan diam-diam
     * menyaring semua.
     */
    private function applyFilterKeaktifan($q, string $ta, bool $mauAktif, string $kolom = 'tagihan.santri_id'): void
    {
        if ($ta === '') {
            return;
        }
        /* Status pemenang per (santri, jenjang): semester 2 menang (satu baris
           per jenjang; duplikat semester 2 ganda diabaikan lewat agregat). */
        $menang = DB::table('riwayat_belajar as rb')
            ->where('rb.tahun_ajaran', $ta)
            ->whereNotExists(function ($g) {
                $g->selectRaw('1')->from('riwayat_belajar as rb_genap')
                    ->whereColumn('rb_genap.santri_id', 'rb.santri_id')
                    ->whereColumn('rb_genap.jenjang', 'rb.jenjang')
                    ->whereColumn('rb_genap.tahun_ajaran', 'rb.tahun_ajaran')
                    ->where('rb_genap.semester', '2')
                    ->where('rb.semester', '<>', '2');
            })
            ->groupBy('rb.santri_id', 'rb.jenjang')
            ->select('rb.santri_id', 'rb.jenjang')
            ->selectRaw('MAX(rb.status_akhir) as status');
        /* Nonaktif = (MI & MD sama-sama pindah_keluar) ATAU (bukan keduanya
           dan status jenjang utama null/pindah_keluar). */
        $nonaktif = DB::query()->fromSub($menang, 'm')
            ->groupBy('m.santri_id')
            ->select('m.santri_id')
            ->havingRaw("SUM(m.jenjang = 'MI' AND m.status = 'pindah_keluar') > 0"
                ." AND SUM(m.jenjang = 'MD' AND m.status = 'pindah_keluar') > 0")
            ->orHavingRaw("NOT (SUM(m.jenjang = 'MI') > 0 AND SUM(m.jenjang = 'MD') > 0)"
                ." AND (COALESCE(MAX(CASE WHEN m.jenjang = 'MI' THEN m.status END),"
                ." MAX(CASE WHEN m.jenjang = 'MD' THEN m.status END),"
                .' MAX(m.status)) IS NULL'
                ." OR COALESCE(MAX(CASE WHEN m.jenjang = 'MI' THEN m.status END),"
                ." MAX(CASE WHEN m.jenjang = 'MD' THEN m.status END),"
                ." MAX(m.status)) = 'pindah_keluar')");
        if ($mauAktif) {
            $q->whereNotIn($kolom, $nonaktif);
            // Tanpa riwayat pada TA patokan = nonaktif di baris (info null),
            // jadi ikut tersaring keluar.
            $q->whereExists(function ($e) use ($ta, $kolom) {
                $e->selectRaw('1')->from('riwayat_belajar as rb_ada')
                    ->whereColumn('rb_ada.santri_id', $kolom)
                    ->where('rb_ada.tahun_ajaran', $ta);
            });
        } else {
            $q->where(function ($w) use ($nonaktif, $ta, $kolom) {
                $w->whereIn($kolom, $nonaktif)
                    ->orWhereNotExists(function ($e) use ($ta, $kolom) {
                        $e->selectRaw('1')->from('riwayat_belajar as rb_ada')
                            ->whereColumn('rb_ada.santri_id', $kolom)
                            ->where('rb_ada.tahun_ajaran', $ta);
                    });
            });
        }
    }

    /**
     * Roster santri crosstab: santri dalam lingkup (riwayat TA + rail +
     * keaktifan + cari) digabung pemegang tagihan lingkup. Baris tampil
     * untuk seluruh roster walau belum punya tagihan (LEFT JOIN di agregat).
     *
     * Tanpa `tahun_ajaran` tak ada patokan roster (sama seperti kolom
     * status/kelas di baris) → hanya pemegang tagihan (perilaku lama).
     *
     * @param  Builder  $tagihanScope
     * @param  list<string>  $tahunAjaran
     * @param  list<string>  $jenjang
     * @return \Illuminate\Database\Query\Builder
     */
    private function rosterSantriCrosstab($tagihanScope, TagihanCrosstabRequest $request, array $tahunAjaran, array $jenjang)
    {
        $pemegang = (clone $tagihanScope)->toBase()->select('tagihan.santri_id as id')->distinct();
        $gabung = $pemegang;
        if ($tahunAjaran !== []) {
            $dariRiwayat = DB::table('santri as rs')->select('rs.id')
                ->whereExists(function ($e) use ($tahunAjaran, $jenjang) {
                    $e->selectRaw('1')->from('riwayat_belajar as rb_r')
                        ->whereColumn('rb_r.santri_id', 'rs.id')
                        ->whereIn('rb_r.tahun_ajaran', $tahunAjaran);
                    $e->whereIn('rb_r.jenjang', $jenjang);
                });
            $gabung = $dariRiwayat->union($pemegang);
        }
        $roster = DB::query()->fromSub($gabung, 'g')->select('g.id')->distinct();
        if ($tahunAjaran === []) {
            return $roster;
        }

        // Rail tingkat & kelas: baris riwayat yang DIPAKAI tampil (genap
        // menang) — patokan sama dengan kolom "Kelas" di baris.
        $tingkat = $this->nilaiFilter($request, 'tingkat');
        $kelasId = array_map('intval', $this->nilaiFilter($request, 'kelas_id'));
        if ($tingkat !== [] || $kelasId !== []) {
            $roster->whereExists(function ($e) use ($tahunAjaran, $jenjang, $tingkat, $kelasId) {
                $e->selectRaw('1')->from('riwayat_belajar as rb_t')
                    ->whereColumn('rb_t.santri_id', 'g.id')
                    ->whereIn('rb_t.tahun_ajaran', [$tahunAjaran[0]]);
                if ($jenjang !== []) {
                    $e->whereIn('rb_t.jenjang', $jenjang);
                }
                if ($tingkat !== []) {
                    $e->whereIn('rb_t.tingkat', $tingkat);
                }
                if ($kelasId !== []) {
                    $e->whereIn('rb_t.kelas_id', $kelasId);
                }
                $e->whereNotExists(function ($g) {
                    $g->selectRaw('1')->from('riwayat_belajar as rb_genap')
                        ->whereColumn('rb_genap.santri_id', 'rb_t.santri_id')
                        ->whereColumn('rb_genap.jenjang', 'rb_t.jenjang')
                        ->whereColumn('rb_genap.tahun_ajaran', 'rb_t.tahun_ajaran')
                        ->where('rb_genap.semester', '2')
                        ->where('rb_t.semester', '<>', '2');
                });
            });
        }

        if ($request->filled('keaktifan')) {
            $this->applyFilterKeaktifan($roster, (string) ($tahunAjaran[0] ?? ''), $request->input('keaktifan') === 'aktif', 'g.id');
        }
        if ($request->filled('santri')) {
            $cari = (string) $request->input('santri');
            $roster->join('santri as s_cari', 's_cari.id', '=', 'g.id')
                ->where(fn ($w) => $w
                    ->where('s_cari.nama_lengkap', 'like', '%'.$cari.'%')
                    ->orWhere('s_cari.ayah_nama', 'like', '%'.$cari.'%')
                    ->orWhere('s_cari.ibu_nama', 'like', '%'.$cari.'%'));
        }

        return $roster;
    }

    public function crosstabTagihan(TagihanCrosstabRequest $request)
    {
        $q = Tagihan::with(['jenis', 'santri']);
        $this->scopeLembaga($q, $request->user(), $request, 'tagihan.jenjang');
        $this->applyFilter($q, $request, 'tahun_ajaran', 'tagihan.tahun_ajaran');
        if ($request->filled('jenis_id')) {
            $q->where('tagihan.jenis_id', (int) $request->input('jenis_id'));
        }
        if ($request->filled('status')) {
            $q->where('tagihan.status', $request->input('status'));
        }
        if ($request->boolean('belum_lunas')) {
            $q->where('tagihan.status', '!=', 'lunas');
        }
        // Tunggakan = belum lunas DAN lewat batas waktu. Tanpa jatuh tempo = lewat
        // (tidak ada batasnya), jadi ikut paling depan.
        if ($request->boolean('terlambat')) {
            $q->where('status', '!=', 'lunas')
                ->where(fn ($w) => $w->whereNull('tagihan.jatuh_tempo')->orWhereDate('tagihan.jatuh_tempo', '<', today()));
        }
        if ($request->filled('santri')) {
            $cari = $request->input('santri');
            $q->whereHas('santri', fn ($s) => $s
                ->where('nama_lengkap', 'like', '%'.$cari.'%')
                ->orWhere('ayah_nama', 'like', '%'.$cari.'%')
                ->orWhere('ibu_nama', 'like', '%'.$cari.'%'));
        }

        /* Filter rail/keaktifan/cari dipasang di ROSTER (bukan `$q`) supaya
           ikut memotong paginasi, total, dan baris — termasuk santri yang
           belum punya tagihan. `$q` hanya melingkupi data tagihan (sel,
           agregat, kolom). */
        $tahunAjaran = $this->nilaiFilter($request, 'tahun_ajaran');
        $jenjang = $this->jenjangUntukBerkas($request);
        $roster = $this->rosterSantriCrosstab($q, $request, $tahunAjaran, $jenjang);

        $page = max(1, (int) $request->input('page', 1));
        $perPage = $this->perPage($request);

        /* Agregat per santri roster + urutan + paginasi di SQL. Tagihan
           digabung LEFT JOIN: santri tanpa tagihan tetap tampil dengan sel
           kosong (total 0). Filter atribut tagihan (jenis/status/terlambat)
           butuh baris tagihan → JOIN biasa saat salah satunya aktif. */
        $butuhTagihan = $request->filled('jenis_id') || $request->filled('status')
            || $request->boolean('belum_lunas') || $request->boolean('terlambat');
        $cakupanTagihan = (clone $q)->toBase()->select(
            'tagihan.santri_id',
            'tagihan.nominal',
            'tagihan.terbayar',
            'tagihan.jatuh_tempo'
        );
        $agregat = DB::table('santri as s')->whereIn('s.id', $roster);
        if ($butuhTagihan) {
            $agregat->joinSub($cakupanTagihan, 't', 't.santri_id', '=', 's.id');
        } else {
            $agregat->leftJoinSub($cakupanTagihan, 't', 't.santri_id', '=', 's.id');
        }
        $agregat
            ->select('s.id as santri_id')
            ->selectRaw('s.nama_lengkap, s.ayah_nama, s.ibu_nama, s.foto_url')
            ->selectRaw('SUM(t.nominal) as total_tagihan')
            ->selectRaw('SUM(t.terbayar) as total_terbayar')
            /* Sama dengan `Tagihan::sisaTerlambat()`: sisa > 0 DAN lewat batas
               waktu; jatuh tempo kosong = tanpa batas = lewat. */
            ->selectRaw(
                'SUM(CASE WHEN (t.nominal - t.terbayar) > 0'
                .' AND (t.jatuh_tempo IS NULL OR t.jatuh_tempo < ?) THEN (t.nominal - t.terbayar) ELSE 0 END) as tunggakan',
                [today()->toDateString()]
            )
            /* `s` di-group: kolomnya ikut dipilih, jadi MySQL dengan
               ONLY_FULL_GROUP_BY akan menolak kalau tidak. */
            ->groupBy('s.id', 's.nama_lengkap', 's.ayah_nama', 's.ibu_nama', 's.foto_url');

        /* Allowlist kode urut crosstab = katalog `keuangan_tagihan_crosstab`
           (satu sumber bersama dialog Kelola Tabel). Nilai katalog = satu
           ekspresi ORDER BY per kode (agregat alias), jadi diratakan ke token
           → kolom tunggal untuk `kriteriaUrutan`. */
        $petaUrut = array_map(
            static fn (array $kolom): string => $kolom[0],
            UrutKatalog::peta('keuangan_tagihan_crosstab'),
        );
        $kriteria = $this->kriteriaUrutan($request, $petaUrut);
        /* Tanpa `sort`: kelas lalu nama — urutan bawaan lama yang dulu selalu
           dikirim frontend, supaya tampilan awal tak berubah saat tabel belum
           punya preset urut. */
        if ($kriteria === []) {
            $kriteria = [['kelas_urut', 'naik'], ['s.nama_lengkap', 'naik']];
        }
        if (in_array('kelas_urut', array_column($kriteria, 0), true)) {
            /* Kunci urut kelas: nama_kelas dari riwayat_belajar pada TA yang
               ditampilkan (TA pertama bila beberapa dipilih — sama patokannya
               dengan kolom `kelas` di baris hasil). `kelas_id` tidak ada di
               tabel `santri`, melainkan per (santri, TA) di riwayat_belajar
               dengan aturan jenjang_utama (MI > MD > lainnya) dan semester 2
               menang — direplikasi sebagai subkueri agar agregat tetap satu
               baris per Santri (join langsung akan menggandakan baris sekaligus
               nominalnya). Hanya dihitung bila diminta. */
            $taKelas = (string) ($tahunAjaran[0] ?? '');
            $subKelas = '(SELECT k2.nama_kelas FROM riwayat_belajar AS rb2'
                .' LEFT JOIN kelas AS k2 ON k2.id = rb2.kelas_id'
                .' WHERE rb2.santri_id = s.id AND rb2.tahun_ajaran = ?'
                ." ORDER BY CASE rb2.jenjang WHEN 'MI' THEN 0 WHEN 'MD' THEN 1 ELSE 2 END,"
                ." CASE rb2.semester WHEN '2' THEN 0 ELSE 1 END LIMIT 1)";
            $agregat->selectRaw("{$subKelas} as kelas_urut", [$taKelas]);
            // Santri tanpa kelas selalu paling bawah, apa pun arah urutnya
            // (mengikuti urut bawaan endpoint daftar tagihan).
            $agregat->orderByRaw('kelas_urut IS NULL');
        }
        foreach ($kriteria as [$kolom, $arah]) {
            $agregat->orderBy($kolom, $arah === 'turun' ? 'desc' : 'asc');
        }

        $totalSantri = (int) (clone $roster)->distinct()->count('g.id');

        $perPageSql = $perPage >= self::PER_PAGE_ALL ? $totalSantri : $perPage;
        $halaman = $agregat
            ->offset(max(0, ($page - 1) * $perPageSql))
            ->limit(max(1, $perPageSql))
            ->get();

        // Kolom: per jenis; bulanan dipecah satu kolom per bulan (periode).
        /* Kolom = GABUNGAN dua sumber:
           1) kombinasi (jenis, periode) yang sudah ADA di tabel tagihan —
              diambil distinct di SQL, sebab satu baris per tagihan (7.602 di
              dev DB) hanya dirangkum jadi daftar kolom;
           2) seluruh TARIF aktif dalam lingkup filter — supaya jenis yang
              belum punya satu tagihan pun tetap punya kolom, sehingga sel
              kosongnya bisa diisi lewat Buat Massal. */
        $petaKolom = [];
        foreach ((clone $q)->join('jenis_tagihan as jt', 'jt.id', '=', 'tagihan.jenis_id')
            ->select('tagihan.jenis_id', 'tagihan.periode')
            ->selectRaw('MIN(jt.nama) as jenis_nama, MIN(jt.tipe) as tipe, MIN(jt.urutan) as jenis_urutan')
            ->groupBy('tagihan.jenis_id', 'tagihan.periode')
            ->get() as $barisKolom) {
            $jenisId = (int) $barisKolom->jenis_id;
            $bulanan = $barisKolom->tipe === 'bulanan';
            $p = $bulanan ? $barisKolom->periode : null;
            $kunci = $this->keyKolomCrosstab($jenisId, $p, $bulanan);
            $petaKolom[$kunci] = [
                'key' => $kunci,
                'jenis_id' => $jenisId,
                'jenis_nama' => $barisKolom->jenis_nama ?? 'Jenis #'.$jenisId,
                'tipe' => $barisKolom->tipe ?? 'non_bulanan',
                'periode' => $p,
                'urutan' => (int) $barisKolom->jenis_urutan,
            ];
        }
        foreach ($this->kolomDariTarif($request, $tahunAjaran) as $kunci => $k) {
            $petaKolom[$kunci] ??= $k;
        }
        /* Urut kolom: yang PUNYA angka `urutan` lebih dulu menurut angkanya,
           yang belum diatur (`urutan` = 0) menyusul dan kembali ke urutan
           `id`. Di dalam satu jenis, periode tetap menaik (periode NULL =
           non-bulanan lebih dulu, sama dengan urutan ASC MySQL). Tanpa angka
           yang diisi sama sekali, hasilnya persis seperti sebelum kolom
           `urutan` ada. */
        $kolom = array_values($petaKolom);
        usort($kolom, static function (array $a, array $b): int {
            $aBelum = $a['urutan'] === 0 ? 1 : 0;
            $bBelum = $b['urutan'] === 0 ? 1 : 0;

            return [$aBelum, $a['urutan'], $a['jenis_id'], (string) ($a['periode'] ?? '')]
                <=> [$bBelum, $b['urutan'], $b['jenis_id'], (string) ($b['periode'] ?? '')];
        });
        /* `urutan` cuma alat sortir — jangan bocor ke respons (bentuk kolom
           crosstab tetap seperti semula). */
        $kolom = array_map(static function (array $k): array {
            unset($k['urutan']);

            return $k;
        }, $kolom);

        /* Kelas & status keaktifan per Santri, diambil dari riwayat TA yang
           sama dengan filter topBar: semester 2 (genap) menang, dan Santri
           MI-MD memakai kelas MI (`jenjang_utama` sudah embody aturan itu).
           `pindah_keluar` ikut diambil — statusnya justru dipakai untuk
           penanda titik merah, bukan untuk menyembunyikan baris. Kalau filter
           TA kosong, tidak ada patokan kelas yang benar, jadi kolomnya dibiarkan kosong. */
        $idHalaman = $halaman->pluck('santri_id')->all();
        $peta = $tahunAjaran === [] || $idHalaman === []
            ? []
            : $this->petaSantriGenerate((string) $tahunAjaran[0], $idHalaman, null, true);

        // Sel tagihan hanya untuk Santri di halaman ini (bukan semua).
        $tagihan = $idHalaman === []
            ? collect()
            : (clone $q)->with('jenis')->whereIn('santri_id', $idHalaman)
                ->orderBy('santri_id')->orderBy('jenis_id')->get();

        /* Foto lingkaran: id dokumen foto aktif untuk sehalaman Santri.
           Satu kueri (bukan N+1); byte diambil malas saat popover dibuka.
           Urutan pilih per baris: Pas Foto (jenjang baris → tanpa lembaga →
           apa saja), lalu Foto Ijazah dengan urutan sama. */
        $dokFoto = $idHalaman === []
            ? collect()
            : DB::table('dokumen_santri')
                ->whereIn('santri_id', $idHalaman)
                ->whereIn('jenis_dokumen_santri', ['Pas Foto', 'Foto Ijazah'])
                ->where('is_active', true)
                ->orderByDesc('id')
                ->get(['id', 'santri_id', 'jenis_dokumen_santri', 'lembaga']);

        $bulanan = fn ($t) => $t->jenis?->tipe === 'bulanan';
        $key = fn ($t) => $this->keyKolomCrosstab((int) $t->jenis_id, $bulanan($t) ? $t->periode : null, $bulanan($t));

        /* Baris dirakit mengikuti urutan `$halaman` (hasil agregat yang sudah
           terurut & dipaginasi di SQL), bukan urutan query sel. Sebelumnya
           baris disusun dari `groupBy` query sel yang berurutan `santri_id`,
           sehingga urutan SQL (mis. nama menurun) hilang dan semua respons
           kembali ke urutan id. */
        $selPerSantri = $tagihan->groupBy('santri_id');
        $baris = [];
        foreach ($halaman as $agregatSantri) {
            $santriId = (int) $agregatSantri->santri_id;
            $kelompok = $selPerSantri->get($santriId, collect());
            $sel = [];
            foreach ($kelompok as $t) {
                $sel[$key($t)] = [
                    'id' => (int) $t->id,
                    // Lembaga penagih baris ini — dipakai popover agar paket
                    // dispensasi berlingkup lembaga lain tak ditawarkan.
                    'jenjang' => (string) $t->jenjang,
                    'nominal' => (int) $t->nominal,
                    'potongan' => (int) ($t->potongan ?? 0),
                    'dispensasi_ids' => $t->dispensasi_ids ?? null,
                    'terbayar' => (int) $t->terbayar,
                    'sisa' => $t->sisa(),
                    'status' => (string) $t->status,
                    'terlambat' => $t->terlambat(),
                    'tahun_ajaran' => (string) $t->tahun_ajaran,
                    'jatuh_tempo' => $t->jatuh_tempo?->format('Y-m-d'),
                ];
            }

            /* Keaktifan (aturan user): untuk Santri MI-MD, tidak aktif HANYA
               bila `status_akhir` di MI **dan** MD sama-sama `pindah_keluar`;
               kalau hanya salah satu, Santri itu dianggap masih aktif (mis.
               pindah dari MI tapi masih sekolah di MD). Dievaluasi dari
               `per_jenjang` — bukan dari jenjang yang kebetulan sedang difilter
               crosstab, supaya Santri yang pindah tidak ditandai merah ketika
               tabel sedang disaring jenjang MD, atau sebaliknya. Santri
               berjenjang tunggal (atau MTS/MLN) memakai `status_akhir`. */
            $info = $peta[(int) $santriId] ?? null;
            /* Jenjang terdaftar pada TA filter (MI > MD > lainnya, selaras
               jenjang_utama) — dipakai label "Kelas X (MI-MD)" di popover. */
            $jenjangAda = array_keys($info['per_jenjang'] ?? []);
            usort($jenjangAda, fn ($a, $b) => [$a !== 'MI', $a !== 'MD', $a] <=> [$b !== 'MI', $b !== 'MD', $b]);
            $status = null;
            $aktif = false;
            if ($info !== null) {
                $statusMi = $info['per_jenjang']['MI']['status'] ?? null;
                $statusMd = $info['per_jenjang']['MD']['status'] ?? null;
                if ($statusMi !== null && $statusMd !== null) {
                    $aktif = ! ($statusMi === 'pindah_keluar' && $statusMd === 'pindah_keluar');
                    $status = $aktif ? ($info['status_akhir'] ?? null) : 'pindah_keluar';
                } else {
                    $status = $info['status_akhir'];
                    $aktif = $status !== null && $status !== 'pindah_keluar';
                }
            }

            $baris[] = [
                'santri_id' => (int) $santriId,
                'nama' => $agregatSantri->nama_lengkap ?? 'Tidak dikenal',
                'ayah_nama' => $agregatSantri->ayah_nama ?? null,
                'ibu_nama' => $agregatSantri->ibu_nama ?? null,
                /* Tanpa tagihan: pakai jenjang terdaftar pertama (MI > MD >
                   lainnya) agar alur tambah dari sel kosong tetap punya
                   jenjang yang sah. */
                'jenjang' => (string) ($kelompok->first()?->jenjang ?? $jenjangAda[0] ?? ''),
                'kelas' => $info['kelas'] ?? null,
                'tingkat' => $info['tingkat'] ?? null,
                'jenjang_riwayat' => $jenjangAda,
                'foto_dokumen_id' => (function () use ($dokFoto, $santriId, $kelompok) {
                    $kandidat = $dokFoto->where('santri_id', $santriId);
                    if ($kandidat->isEmpty()) {
                        return null;
                    }
                    $jenjangBaris = (string) ($kelompok->first()?->jenjang ?? $jenjangAda[0] ?? '');
                    foreach (['Pas Foto', 'Foto Ijazah'] as $jenis) {
                        $sejenis = $kandidat->where('jenis_dokumen_santri', $jenis);
                        $pilih = $sejenis->first(fn ($d) => $d->lembaga === $jenjangBaris)
                            ?? $sejenis->first(fn ($d) => $d->lembaga === null)
                            ?? $sejenis->first();
                        if ($pilih !== null) {
                            return (int) $pilih->id;
                        }
                    }

                    return null;
                })(),
                'foto_profil' => ($agregatSantri->foto_url ?? '') !== '',
                /* `aktif` hasil hitungan MI+MD di atas — bukan `status !== 'pindah_keluar'`,
                   karena untuk MI-MD sudah aktif meski `status_akhir` (MI) pindah_keluar. */
                'status_akhir' => $status,
                'aktif' => $aktif,
                'sel' => $sel,
                'total_tagihan' => (int) ($agregatSantri->total_tagihan ?? $kelompok->sum('nominal')),
                'total_terbayar' => (int) ($agregatSantri->total_terbayar ?? $kelompok->sum('terbayar')),
                'tunggakan' => (int) ($agregatSantri->tunggakan ?? $kelompok->sum(fn ($t) => $t->sisaTerlambat())),
            ];
        }

        return response()->json([
            'kolom' => $kolom,
            'baris' => $baris,
            'total' => $totalSantri,
            'per_page' => $perPage,
            'current_page' => $page,
            'last_page' => max(1, (int) ceil($totalSantri / $perPage)),
        ]);
    }

    /** Kunci sel crosstab: bulanan per periode, non-bulanan satu kolom per jenis. */
    private function keyKolomCrosstab(int $jenisId, ?string $periode, bool $bulanan): string
    {
        return $bulanan && $periode !== null
            ? $jenisId.'-'.$periode
            : 'jenis-'.$jenisId;
    }

    /**
     * Kolom crosstab dari SELURUH tarif aktif dalam lingkup filter — supaya
     * jenis yang belum punya satu tagihan pun tetap tampil sebagai kolom
     * (sel kosongnya bisa diisi lewat Buat Massal).
     *
     * Lingkup mengikuti filter yang sama dengan kueri tagihan: `jenjang`,
     * `tahun_ajaran`, dan `jenis_id`. Hanya tarif & jenis berstatus aktif yang
     * dipakai; tarif nonaktif sengaja disembunyikan (bukan ditawarkan).
     *
     * Wajib ada filter `tahun_ajaran`: dari sanalah rentang bulan jenis
     * bulanan diturunkan, dan tanpa TA patokan roster crosstab sendiri sudah
     * kosong (lihat `rosterSantriCrosstab`). Tanpa TA → daftar kosong, kolom
     * kembali seperti sebelumnya (dari tagihan yang ada).
     *
     * `urutan` ikut dibawa sebagai alat sortir saja (dibuang dari respons oleh
     * pemanggil).
     *
     * @param  list<string>  $tahunAjaran
     * @return array<string, array{key:string, jenis_id:int, jenis_nama:string, tipe:string, periode:?string, urutan:int}>
     */
    private function kolomDariTarif(Request $request, array $tahunAjaran): array
    {
        if ($tahunAjaran === []) {
            return [];
        }

        $q = TarifTagihan::query()->with('jenis')
            ->where('is_active', true)
            ->whereHas('jenis', fn ($j) => $j->where('is_active', true));
        $this->scopeLembaga($q, $request->user(), $request, 'tarif_tagihan.jenjang');
        $this->applyFilter($q, $request, 'tahun_ajaran', 'tarif_tagihan.tahun_ajaran');
        if ($request->filled('jenis_id')) {
            $q->where('tarif_tagihan.jenis_id', (int) $request->input('jenis_id'));
        }

        $kolom = [];
        foreach ($q->get() as $tarif) {
            $jenis = $tarif->jenis;
            if ($jenis === null) {
                continue;
            }
            $jenisId = (int) $jenis->id;
            $bulanan = $jenis->tipe === 'bulanan';
            foreach ($this->periodeKolomTarif($bulanan, (string) $tarif->tahun_ajaran) as $p) {
                $kunci = $this->keyKolomCrosstab($jenisId, $p, $bulanan);
                $kolom[$kunci] = [
                    'key' => $kunci,
                    'jenis_id' => $jenisId,
                    'jenis_nama' => (string) $jenis->nama,
                    'tipe' => (string) $jenis->tipe,
                    'periode' => $p,
                    'urutan' => (int) $jenis->urutan,
                ];
            }
        }

        return $kolom;
    }

    /**
     * Bulan yang dicakup satu tarif: jenis bulanan memakai SELURUH bulan tahun
     * ajarannya (Juli TA mulai → Juni TA akhir, sama seperti rentang default
     * dialog Buat Tagihan); non-bulanan satu kolom per jenis (periode null,
     * karena kolom crosstab non-bulanan memang tanpa periode).
     *
     * TA yang tidak berbentuk `YYYY/YYYY` → `[null]`: tak ada rentang bulan
     * yang sah, kolomnya jatuh ke kunci `jenis-<id>` seperti perilaku lama.
     *
     * @return list<?string>
     */
    private function periodeKolomTarif(bool $bulanan, string $tahunAjaran): array
    {
        if (! $bulanan) {
            return [null];
        }
        if (! preg_match('/^(\d{4})\/(\d{4})$/', trim($tahunAjaran), $m)) {
            return [null];
        }

        $akhir = new \DateTime($m[2].'-06-01');
        $b = new \DateTime($m[1].'-07-01');
        $periodes = [];
        while ($b <= $akhir && count($periodes) < 24) {
            $periodes[] = $b->format('Y-m');
            $b->modify('+1 month');
        }

        return $periodes;
    }

    public function indexTagihan(Request $request)
    {
        $q = Tagihan::with(['jenis', 'santri']);
        $this->scopeLembaga($q, $request->user(), $request, 'tagihan.jenjang');
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

    private function pastikanJenisLembaga($actor, JenisTagihan $jenis, string $jenjang): void
    {
        if ($jenis->jenjang !== null) {
            $this->authorizeLembaga($actor, $jenis->jenjang);
            if ($jenis->jenjang !== $jenjang) {
                abort(422, 'Jenis tagihan tidak berlaku pada lembaga ini.');
            }
        }
    }

    public function storeTagihan(TagihanStoreRequest $request)
    {
        $data = $request->validated();
        $this->canLembaga($request->user(), $data['jenjang']) || abort(403);
        $jenis = JenisTagihan::findOrFail($data['jenis_id']);
        $this->pastikanJenisLembaga($request->user(), $jenis, $data['jenjang']);
        $santriSesuai = Santri::whereKey($data['santri_id'])->where(fn ($s) => $s
            ->whereHas('lembagaSantri', fn ($l) => $l->where('jenjang', $data['jenjang']))
            ->orWhereHas('riwayatBelajar', fn ($r) => $r->where('jenjang', $data['jenjang'])))->exists();
        if (! $santriSesuai) {
            abort(422, 'Santri tidak terdaftar pada lembaga tagihan.');
        }
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
     * Dispensasi eksplisit (`dispensasi_ids`, dari combobox tab Ubah):
     * nominal dihitung ulang dari KOTOR (`nominal + potongan` tersimpan —
     * tepat, karena potongan selalu `awal - akhir`) memakai paket terpilih;
     * [] = lepas + koreksi manual (pakai nominal ketikan, jejak dibersihkan).
     * Tanpa kunci itu, koreksi nominal manual membersihkan jejak lama (agar
     * tak basi), nilai sama membiarkannya. Santri yang belum terdaftar
     * otomatis menjadi penerima paket (bebas dari tab Ubah — daftar
     * penerima selalu cermin pemakaian), dalam transaksi yang sama.
     * Paket berkuota yang habis ditolak (kecuali sudah menempel di
     * tagihan ini) — khusus tagihan bulanan. Pilihan eksplisit
     * menggantikan yang se-grup; grup lain yang menempel dipertahankan.
     *
     * Nominal tidak boleh turun di bawah yang sudah dibayar (sisa negatif).
     * Status dihitung ulang dari nominal vs terbayar. Jenis bulanan mengabaikan
     * jatuh tempo manual — aturan tanggal 10 bulan berjalan berlaku juga di
     * sini, supaya tunggangan tidak bisa dikecualikan lewat ubah.
     */
    public function updateTagihan(TagihanUpdateRequest $request, Tagihan $tagihan)
    {
        return DB::transaction(function () use ($request, $tagihan) {
            $tagihan = Tagihan::whereKey($tagihan->id)->lockForUpdate()->firstOrFail();
            $data = $request->validated();
            $this->canLembaga($request->user(), $tagihan->jenjang) || abort(403);

            $perluDaftar = [];
            if (array_key_exists('dispensasi_ids', $data)) {
                $ids = collect($data['dispensasi_ids'] ?? [])
                    ->map(fn ($v) => (int) $v)->unique()->sort()->values();
                if ($ids->isEmpty()) {
                    // Lepas eksplisit ("Tanpa dispensasi") + koreksi manual: pakai
                    // nominal ketikan, jejak lama dibersihkan.
                    $data['potongan'] = 0;
                    $data['dispensasi_ids'] = null;
                } else {
                    $aturanSvc = app(DispensasiService::class);
                    $paket = Dispensasi::with(['aturan.jenis', 'santriTambahan'])
                        ->whereIn('id', $ids)->where('is_active', true)->get();
                    if ($paket->count() !== $ids->count()) {
                        abort(422, 'Dispensasi tidak valid atau sudah nonaktif.');
                    }
                    foreach ($paket as $d) {
                        if (! $aturanSvc->lingkupCocok($d->jenjang, $tagihan->jenjang)) {
                            abort(422, "Dispensasi '{$d->nama}' hanya berlaku untuk lembaga {$d->jenjang}.");
                        }
                        if ($aturanSvc->aturanUntukJenis($d, (int) $tagihan->jenis_id) === null) {
                            abort(422, "Dispensasi '{$d->nama}' tidak punya aturan untuk jenis tagihan ini.");
                        }
                        if (! in_array((int) $tagihan->santri_id, $d->santri_ids ?? [], true)) {
                            $perluDaftar[] = $d->id;
                        }
                    }
                    if (JenisTagihan::whereKey($tagihan->jenis_id)->value('tipe') === 'bulanan') {
                        $punya = array_map('intval', (array) ($tagihan->dispensasi_ids ?? []));
                        $pakai = $this->pakaiKuota($paket, (int) $tagihan->santri_id);
                        foreach ($paket as $d) {
                            if ($d->kuota_bulan !== null
                                && ! in_array((int) $d->id, $punya, true)
                                && ($pakai[(int) $d->id] ?? 0) >= (int) $d->kuota_bulan) {
                                abort(422, "Kuota {$d->kuota_bulan} bulan paket '{$d->nama}' sudah habis untuk santri ini.");
                            }
                        }
                    }
                    // Pilihan eksplisit menggantikan yang se-grup; grup lain yang
                    // menempel dipertahankan (digabung, bukan ditimpa semua).
                    $punya = array_map('intval', (array) ($tagihan->dispensasi_ids ?? []));
                    $sudahAda = $this->grupMenempel((int) $tagihan->santri_id)->only($punya)->values();
                    $final = $aturanSvc->selaraskan($paket, $sudahAda);
                    $hasil = $aturanSvc->terapkan(
                        (int) $tagihan->nominal + (int) $tagihan->potongan,
                        $final,
                        (int) $tagihan->jenis_id,
                    );
                    $data['nominal'] = $hasil['nominal'];
                    $data['potongan'] = $hasil['potongan'];
                    $data['dispensasi_ids'] = $hasil['ids'] === [] ? null : $hasil['ids'];
                }
            } elseif ((int) $data['nominal'] !== (int) $tagihan->nominal) {
                // Koreksi manual: jejak potongan lama basi bila nominal berubah.
                $data['potongan'] = 0;
                $data['dispensasi_ids'] = null;
            }

            if ($data['nominal'] < $tagihan->terbayar) {
                abort(422, "Nominal tidak boleh lebih kecil dari yang sudah dibayar (Rp {$tagihan->terbayar}).");
            }

            $jenis = JenisTagihan::findOrFail($tagihan->jenis_id);

            $tagihan->nominal = $data['nominal'];
            $tagihan->tahun_ajaran = $data['tahun_ajaran'];
            // Jejak dispensasi hanya berubah lewat dua jalur di atas (terapkan
            // eksplisit / koreksi manual); ubah TA/tanggal saja mempertahankannya.
            if (array_key_exists('potongan', $data)) {
                $tagihan->potongan = $data['potongan'];
            }
            if (array_key_exists('dispensasi_ids', $data)) {
                $tagihan->dispensasi_ids = $data['dispensasi_ids'];
            }
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
            DB::transaction(function () use ($tagihan, $perluDaftar) {
                foreach ($perluDaftar as $did) {
                    Dispensasi::whereKey($did)->firstOrFail()
                        ->santriTambahan()->syncWithoutDetaching([(int) $tagihan->santri_id]);
                }
                $tagihan->save();
            });

            return response()->json($tagihan);
        });
    }

    /**
     * Kandidat santri generate: daftar santri aktif pada satu TA sesuai
     * kelompok kriteria, sudah dihitung jenjang/tingkat/kelasnya.
     * Santri yang sudah punya tagihan lengkap untuk jenis+periode terpilih
     * disembunyikan dari kandidat.
     */
    public function kandidatTagihan(TagihanKandidatRequest $request)
    {
        $data = $request->validated();
        $actor = $request->user();

        $peta = $this->petaSantriGenerate($data['tahun_ajaran'], [], $data['q'] ?? null);

        $jenis = isset($data['jenis_id']) ? JenisTagihan::find($data['jenis_id']) : null;
        $periodes = $jenis !== null
            ? $this->periodesTagihan($jenis, $data['tahun_ajaran'], $data['periode'] ?? null, $data['periode_sampai'] ?? null, false)
            : [];

        /* Santri yang sudah punya tagihan untuk periode terpilih TIDAK lagi
           disembunyikan: alur generate dua tahap (tagih semua, lalu perbarui
           sebagian) butuh mereka tetap bisa dipilih. Yang dikirim cukup
           agregat — jumlah periode yang terisi + total nominal/terbayar — buat
           pratinjau "sudah ada · 3/3 bulan · Rp 225.000" di dialog, bukan
           rincian per periode (bisa 24 baris per Santri). */
        $sudahAda = $jenis !== null && $periodes !== []
            ? $this->rekapTagihanSudahAda(array_keys($peta), $jenis->id, $periodes)
            : [];

        $hasil = [];
        /* Kelompok custom + grup dipilih = hanya anggota grup itu. Tanpa grup
           (kompatibel lama) = semua, sama seperti 'aktif'. */
        $anggotaCustom = null;
        if ($data['kelompok'] === 'custom' && isset($data['grup_custom_id'])) {
            $anggotaCustom = array_flip(GrupSantriCustom::find($data['grup_custom_id'])
                ?->santri()->pluck('santri.id')->map(fn ($v) => (int) $v)->all() ?? []);
        }
        foreach ($peta as $id => $info) {
            if (! $this->lolosKelompok($info, $data['kelompok'])) {
                continue;
            }
            if ($anggotaCustom !== null && ! isset($anggotaCustom[$id])) {
                continue;
            }
            if (! $actor->canAccessLembaga($info['jenjang_utama'])) {
                continue;
            }
            $ada = $sudahAda[$id] ?? ['periode' => 0, 'nominal' => 0, 'terbayar' => 0];
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
                'tagihan_periode' => $ada['periode'],
                'tagihan_nominal' => $ada['nominal'],
                'tagihan_terbayar' => $ada['terbayar'],
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
     *
     * Alur dua tahap yang didukung: generate pertama menagih semua Santri
     * aktif, generate berikutnya untuk sebagian Santri terpilih **memperbarui**
     * tagihan yang sudah ada (nominal, jatuh tempo, tahun ajaran, jenjang,
     * potongan/dispensasi) — bukan membuat duplikat dan bukan mengabaikannya.
     * `terbayar` beserta riwayat pembayarannya tidak pernah disentuh dan status
     * dihitung ulang dari nominal vs terbayar. Tagihan bulanan yang sudah ada
     * pembayarannya **dilewati** (generate ulang hanya yang belum dibayar);
     * non-bulanan dilewati bila nominal barunya lebih kecil dari terbayar —
     * alasannya dikembalikan agar bisa ditampilkan ke pengguna.
     *
     * Dispensasi aktif selalu otomatis tiap generate; paket berkuota
     * dialokasikan ke N bulan pertama per santri (baris yang sudah
     * menempel dipertahankan). Se-grup tak menumpuk: yang menempel
     * menang (meneruskan). Generate tak pernah menambah penerima.
     */
    public function generateTagihan(TagihanGenerateRequest $request)
    {
        $data = $request->validated();
        $actor = $request->user();

        $jenis = JenisTagihan::findOrFail($data['jenis_id']);
        if ($jenis->jenjang !== null) {
            $this->authorizeLembaga($actor, $jenis->jenjang);
        }
        $periodes = $this->periodesTagihan($jenis, $data['tahun_ajaran'], $data['periode'] ?? null, $data['periode_sampai'] ?? null);

        $diminta = collect($data['santri'])->keyBy(fn ($s) => (int) $s['santri_id']);
        $peta = $this->petaSantriGenerate($data['tahun_ajaran'], $diminta->keys()->all());

        // Dispensasi aktif untuk jenis ini — TIDAK terikat tahun ajaran:
        // paket berlaku lintas TA (kuota/penerima/grup yang membatasi).
        // Baris tanpa override manual dihitung ulang di sini (otoritatif),
        // override manual menang.
        $daftarDispensasi = Dispensasi::with(['aturan.jenis', 'santriTambahan'])
            ->where('is_active', true)
            ->whereHas('aturan', fn ($w) => $w->whereNull('jenis_id')->orWhere('jenis_id', $jenis->id))
            ->get();
        $aturan = app(DispensasiService::class);
        // Kuota dihitung dari tagihan bulanan; jenis non-bulanan mengabaikannya.
        $kuotaBerlaku = $jenis->tipe === 'bulanan';

        /* Satu transaksi untuk seluruh daftar. Tanpa itu `abort()` di tengah
           loop (mis. Santri tidak aktif pada TA) meninggalkan tagihan yang
           sudah terlanjur dibuat: user melihat "gagal" padahal sebagian data
           sudah jadi, lalu generate ulang hanya melaporkan "dilewati". */
        $hasil = DB::transaction(function () use (
            $actor, $data, $jenis, $periodes, $diminta, $peta, $daftarDispensasi, $aturan, $kuotaBerlaku
        ): array {
            $dibuat = 0;
            $diperbarui = 0;
            $tetap = 0;
            $alasan = [];
            $santriIds = $diminta->keys()->all();
            // Kunci santri juga menyerialkan dua generate ketika tagihan belum ada.
            Santri::whereIn('id', $santriIds)->orderBy('id')->lockForUpdate()->get(['id']);
            Tagihan::whereIn('santri_id', $santriIds)->orderBy('id')->lockForUpdate()->get(['id']);
            $posisi = 0;
            $adaPeta = [];

            foreach ($diminta as $santriId => $s) {
                // Batasi model existing yang ditahan di memori, tanpa query per bulan.
                if ($posisi % 200 === 0) {
                    $adaPeta = $this->petaTagihanAda(array_slice($santriIds, $posisi, 200), (int) $jenis->id, $periodes, true);
                }
                $posisi++;
                $info = $peta[$santriId] ?? null;
                if ($info === null) {
                    abort(422, "Santri #{$santriId} tidak aktif pada tahun ajaran {$data['tahun_ajaran']}.");
                }
                $this->canLembaga($actor, $info['jenjang_utama']) || abort(403);
                $this->pastikanJenisLembaga($actor, $jenis, $info['jenjang_utama']);

                if (array_key_exists('nominal', $s) && $s['nominal'] !== null) {
                    $paketDasar = null;
                    $nominalManual = (int) $s['nominal'];
                    $pakaiKuota = [];
                } else {
                    // Generate tak pernah mendaftarkan penerima baru —
                    // itu wewenang dialog Dispensasi / Ubah per tagihan.
                    $paketDasar = $aturan->saring($daftarDispensasi, (int) $santriId, $info['jenjang_utama'])
                        ->sortBy('id')->values();
                    // Kuota terpakai per paket (tagihan bulanan santri ini
                    // yang sudah memuat paket) — alokasi per baris di bawah.
                    $pakaiKuota = $this->pakaiKuota($paketDasar, (int) $santriId);
                    // Paket aktif yang menempel di tagihan santri — prioritas
                    // "meneruskan" per grup saat digabung per baris.
                    $punyaPaket = collect($adaPeta[$santriId] ?? [])
                        ->contains(fn (Tagihan $t) => ! empty($t->dispensasi_ids));
                    $grupMap = $punyaPaket ? $this->grupMenempel((int) $santriId) : collect();
                    $nominalManual = null;
                }

                foreach ($periodes as $periode) {
                    $jatuhTempo = JatuhTempo::untuk((string) $jenis->tipe, $periode, $data['jatuh_tempo'] ?? null);
                    $ada = $adaPeta[$santriId][$periode] ?? null;

                    if ($ada === null) {
                        if ($paketDasar === null) {
                            $nominal = $nominalManual;
                            $potongan = 0;
                            $dispensasiIds = null;
                        } else {
                            // Baris baru: menempel tak ada di sini, jadi paket
                            // yang tersisa kuotanya menang per grup.
                            $hitung = $this->hitungBarisDispensasi(
                                $paketDasar, $pakaiKuota, collect(), null, $kuotaBerlaku,
                                (int) $data['nominal'], (int) $jenis->id, $aturan
                            );
                            $nominal = $hitung['nominal'];
                            $potongan = $hitung['potongan'];
                            $dispensasiIds = $hitung['ids'] === [] ? null : $hitung['ids'];
                            $this->konsumsiKuota($hitung['ids'], $pakaiKuota, null);
                        }
                        Tagihan::create([
                            'santri_id' => $santriId,
                            'jenis_id' => $jenis->id,
                            'periode' => $periode,
                            'jenjang' => $info['jenjang_utama'],
                            'tahun_ajaran' => $data['tahun_ajaran'],
                            'nominal' => $nominal,
                            'potongan' => $potongan,
                            'dispensasi_ids' => $dispensasiIds,
                            'jatuh_tempo' => $jatuhTempo,
                            'status' => 'belum',
                            'terbayar' => 0,
                        ]);
                        $dibuat++;

                        continue;
                    }

                    if ($paketDasar === null) {
                        $nominal = $nominalManual;
                        $potongan = 0;
                        $dispensasiIds = null;
                        $idsBaru = [];
                        $punyaIds = null;
                    } else {
                        $punyaIds = $ada->dispensasi_ids;
                        // Menempel menang dalam grupnya (meneruskan); failover
                        // kuota: yang habis & belum menempel dicoret dulu agar
                        // se-grup yang bersisa bisa maju ke baris ini.
                        $hitung = $this->hitungBarisDispensasi(
                            $paketDasar, $pakaiKuota, $grupMap, $ada, $kuotaBerlaku,
                            (int) $data['nominal'], (int) $jenis->id, $aturan
                        );
                        $nominal = $hitung['nominal'];
                        $potongan = $hitung['potongan'];
                        $dispensasiIds = $hitung['ids'] === [] ? null : $hitung['ids'];
                        $idsBaru = $hitung['ids'];
                    }

                    if ($paketDasar !== null && $jenis->tipe === 'bulanan' && (int) $ada->terbayar > 0) {
                        $alasan[] = [
                            'santri_id' => (int) $santriId,
                            'periode' => $periode,
                            'nominal_sekarang' => (int) $ada->nominal,
                            'terbayar' => (int) $ada->terbayar,
                            'sebab' => 'sudah ada pembayaran',
                        ];

                        continue;
                    }

                    if ($nominal < (int) $ada->terbayar) {
                        $alasan[] = [
                            'santri_id' => (int) $santriId,
                            'periode' => $periode,
                            'nominal_sekarang' => (int) $ada->nominal,
                            'terbayar' => (int) $ada->terbayar,
                            'sebab' => 'nominal baru di bawah terbayar',
                        ];

                        continue;
                    }

                    $ada->fill([
                        'jenjang' => $info['jenjang_utama'],
                        'tahun_ajaran' => $data['tahun_ajaran'],
                        'nominal' => $nominal,
                        'potongan' => $potongan,
                        'dispensasi_ids' => $dispensasiIds,
                        'jatuh_tempo' => $jatuhTempo,
                    ]);
                    $ada->terbayar = (int) $ada->terbayar;
                    $ada->status = match (true) {
                        $ada->terbayar <= 0 => 'belum',
                        $ada->terbayar >= (int) $ada->nominal => 'lunas',
                        default => 'sebagian',
                    };
                    $ada->save();
                    if ($paketDasar !== null) {
                        $this->konsumsiKuota($idsBaru, $pakaiKuota, $punyaIds);
                    }
                    // Tanpa perubahan nilai = tidak dihitung "diperbarui"
                    // (save() pun tak mengeluarkan query bila tak dirty).
                    if (! $ada->wasChanged()) {
                        $tetap++;

                        continue;
                    }
                    $diperbarui++;
                }
            }

            return ['dibuat' => $dibuat, 'diperbarui' => $diperbarui, 'tetap' => $tetap, 'alasan' => $alasan];
        });

        return response()->json([
            'dibuat' => $hasil['dibuat'],
            'diperbarui' => $hasil['diperbarui'],
            'tetap' => $hasil['tetap'],
            'dilewati' => count($hasil['alasan']),
            'alasan' => $hasil['alasan'],
        ]);
    }

    /**
     * POST /api/admin/keuangan/tagihan/pratinjau — hitungan yang SAMA dengan
     * `generateTagihan`, tetapi tidak menulis apa pun. Dialog Buat Tagihan
     * memakai ini supaya nominal potongan & dispensasi yang ditampilkan
     * berasal dari sumber yang sama (aturan grup/kuota tak lagi dicerminkan
     * di frontend).
     *
     * Hasil per santri: nilai periode pertama (yang ditampilkan tabel) +
     * rincian seluruh periode (termasuk sumbangan tiap paket per baris), nama
     * paket yang menempel, serta paket penerima berkuota yang tak kebagian
     * kuota sama sekali dalam rentang ini.
     */
    public function pratinjauTagihan(TagihanGenerateRequest $request)
    {
        $data = $request->validated();
        $actor = $request->user();

        $jenis = JenisTagihan::findOrFail($data['jenis_id']);
        if ($jenis->jenjang !== null) {
            $this->authorizeLembaga($actor, $jenis->jenjang);
        }
        $periodes = $this->periodesTagihan($jenis, $data['tahun_ajaran'], $data['periode'] ?? null, $data['periode_sampai'] ?? null);

        $diminta = collect($data['santri'])->keyBy(fn ($s) => (int) $s['santri_id']);
        $peta = $this->petaSantriGenerate($data['tahun_ajaran'], $diminta->keys()->all());

        $daftarDispensasi = Dispensasi::with(['aturan.jenis', 'santriTambahan'])
            ->where('is_active', true)
            ->whereHas('aturan', fn ($w) => $w->whereNull('jenis_id')->orWhere('jenis_id', $jenis->id))
            ->get();
        $aturan = app(DispensasiService::class);
        $kuotaBerlaku = $jenis->tipe === 'bulanan';

        // Baris existing seluruh santri sekaligus: pratinjau tidak menulis,
        // jadi tak perlu satu query per santri per periode seperti generate.
        $adaPeta = $this->petaTagihanAda($diminta->keys()->all(), (int) $jenis->id, $periodes);

        $hasil = [];
        foreach ($diminta as $santriId => $s) {
            $info = $peta[$santriId] ?? null;
            if ($info === null) {
                abort(422, "Santri #{$santriId} tidak aktif pada tahun ajaran {$data['tahun_ajaran']}.");
            }
            $this->canLembaga($actor, $info['jenjang_utama']) || abort(403);
            $this->pastikanJenisLembaga($actor, $jenis, $info['jenjang_utama']);

            if (array_key_exists('nominal', $s) && $s['nominal'] !== null) {
                $paketDasar = null;
                $nominalManual = (int) $s['nominal'];
                $pakaiKuota = [];
                $grupMap = collect();
            } else {
                $paketDasar = $aturan->saring($daftarDispensasi, (int) $santriId, $info['jenjang_utama'])->sortBy('id')->values();
                $pakaiKuota = $this->pakaiKuota($paketDasar, (int) $santriId);
                $grupMap = $this->grupMenempel((int) $santriId);
                $nominalManual = null;
            }

            $namaPaket = $paketDasar === null ? [] : $paketDasar->pluck('nama', 'id')->all();
            foreach ($grupMap as $d) {
                $namaPaket[(int) $d->id] = $d->nama;
            }

            $baris = [];
            $menempel = [];
            foreach ($periodes as $periode) {
                $ada = $adaPeta[$santriId][$periode] ?? null;
                $langkah = [];
                if ($paketDasar === null) {
                    $nominal = $nominalManual;
                    $potongan = 0;
                    $ids = [];
                } else {
                    $hitung = $this->hitungBarisDispensasi(
                        $paketDasar, $pakaiKuota, $grupMap, $ada, $kuotaBerlaku,
                        (int) $data['nominal'], (int) $jenis->id, $aturan
                    );
                    $nominal = $hitung['nominal'];
                    $potongan = $hitung['potongan'];
                    $ids = $hitung['ids'];
                    $langkah = $hitung['langkah'];
                }

                // Sebab yang sama dengan generate: baris begini dilewati —
                // tak ditulis ulang dan tak ikut menghabiskan kuota.
                $sebab = null;
                if ($ada !== null && $paketDasar !== null && $kuotaBerlaku && (int) $ada->terbayar > 0) {
                    $sebab = 'sudah ada pembayaran';
                } elseif ($ada !== null && $nominal < (int) $ada->terbayar) {
                    $sebab = 'nominal baru di bawah terbayar';
                }

                if ($sebab === null) {
                    if ($paketDasar !== null) {
                        $this->konsumsiKuota($ids, $pakaiKuota, $ada?->dispensasi_ids);
                    }
                } elseif ($ada !== null) {
                    // Baris dibiarkan apa adanya — itulah bentuknya setelah generate.
                    $nominal = (int) $ada->nominal;
                    $potongan = (int) $ada->potongan;
                    $ids = array_map('intval', (array) ($ada->dispensasi_ids ?? []));
                    $langkah = [];
                }
                foreach ($ids as $id) {
                    $menempel[(int) $id] = true;
                }

                $baris[] = [
                    'periode' => $periode,
                    'nominal' => $nominal,
                    'potongan' => $potongan,
                    'dispensasi_ids' => $ids,
                    'nama' => array_map(fn ($id) => $namaPaket[(int) $id] ?? "#{$id}", $ids),
                    // Sumbangan tiap paket di baris ini (sebelum → sesudah).
                    'langkah' => $langkah,
                    'sebab' => $sebab,
                ];
            }

            // Periode berbeda bisa berakhir beda paket (failover kuota); tabel
            // menampilkan periode pertama, jadi tandai bila sisanya beda.
            $pertama = $baris[0];
            $seragam = ! array_any(
                $baris,
                fn ($b) => $b['nominal'] !== $pertama['nominal'] || $b['dispensasi_ids'] !== $pertama['dispensasi_ids']
            );

            $takKebagian = [];
            foreach ($paketDasar ?? [] as $d) {
                if ($d->kuota_bulan !== null && ! isset($menempel[(int) $d->id])) {
                    $takKebagian[] = $d->nama;
                }
            }

            $hasil[] = [
                'santri_id' => (int) $santriId,
                'nominal' => (int) $pertama['nominal'],
                'potongan' => (int) $pertama['potongan'],
                'dispensasi_ids' => $pertama['dispensasi_ids'] === [] ? null : $pertama['dispensasi_ids'],
                'dispensasi_nama' => $pertama['nama'],
                'seragam' => $seragam,
                'tak_kebagian' => $takKebagian,
                'periode' => $baris,
            ];
        }

        return response()->json($hasil);
    }

    /**
     * Peta tagihan existing per santri per periode untuk pratinjau:
     * `santri_id → periode → Tagihan`.
     *
     * @param  list<int>  $santriIds
     * @param  list<string>  $periodes
     * @return array<int, array<string, Tagihan>>
     */
    private function petaTagihanAda(array $santriIds, int $jenisId, array $periodes, bool $kunci = false): array
    {
        if ($santriIds === [] || $periodes === []) {
            return [];
        }
        $peta = [];
        $q = Tagihan::whereIn('santri_id', $santriIds)->where('jenis_id', $jenisId)
            ->whereIn('periode', $periodes)->orderBy('id');
        if ($kunci) {
            $q->lockForUpdate();
        }
        foreach ($q->get() as $t) {
            $peta[(int) $t->santri_id][(string) $t->periode] = $t;
        }

        return $peta;
    }

    /**
     * Model paket aktif yang menempel di tagihan santri (periode apa pun),
     * diindeks id — dasar prioritas "meneruskan" per grup saat digabung
     * dengan paket berlaku/diminta.
     *
     * @return Collection<int, Dispensasi>
     */
    private function grupMenempel(int $santriId): Collection
    {
        $ids = Tagihan::where('santri_id', $santriId)->whereNotNull('dispensasi_ids')
            ->pluck('dispensasi_ids')->flatten()->map(fn ($v) => (int) $v)->unique()->values();
        if ($ids->isEmpty()) {
            return collect();
        }

        return Dispensasi::with('aturan.jenis')->whereIn('id', $ids)
            ->where('is_active', true)->get()->keyBy('id');
    }

    /**
     * Kuota terpakai per paket: jumlah tagihan BULANAN santri yang memuat
     * paket (seumur hidup, semua TA) — dasar alokasi N bulan pertama.
     *
     * @param  Collection<int, Dispensasi>  $paket
     * @return array<int, int> peta id paket → terpakai
     */
    private function pakaiKuota(Collection $paket, int $santriId): array
    {
        $berkuota = $paket->filter(fn ($d) => $d->kuota_bulan !== null);
        if ($berkuota->isEmpty()) {
            return [];
        }
        $jenisBulanan = JenisTagihan::where('tipe', 'bulanan')->pluck('id')
            ->map(fn ($v) => (int) $v)->all();
        $daftar = Tagihan::where('santri_id', $santriId)->whereIn('jenis_id', $jenisBulanan)->pluck('dispensasi_ids');
        $pakai = [];
        foreach ($berkuota as $d) {
            $c = 0;
            foreach ($daftar as $ids) {
                if (is_array($ids) && in_array((int) $d->id, array_map('intval', $ids), true)) {
                    $c++;
                }
            }
            $pakai[(int) $d->id] = $c;
        }

        return $pakai;
    }

    /**
     * Satu paket boleh dipakai baris ini: tanpa kuota selalu boleh;
     * berkuota boleh bila sudah menempel (tak konsumsi baru) atau sisa
     * masih ada. Non-bulanan mengabaikan kuota.
     *
     * @param  array<int, int>  $pakai
     * @param  list<int>  $punya
     */
    private function kuotaTersedia(Dispensasi $d, array $pakai, array $punya, bool $kuotaBerlaku): bool
    {
        if (! $kuotaBerlaku || $d->kuota_bulan === null) {
            return true;
        }
        if (in_array((int) $d->id, $punya, true)) {
            return true;
        }

        return ($pakai[(int) $d->id] ?? 0) < (int) $d->kuota_bulan;
    }

    /**
     * Hitung satu baris tagihan dari paket dispensasi santri — dipakai BAIK
     * oleh generate (menulis) maupun pratinjau (tanpa menulis) supaya aturan
     * kuota/grup hanya hidup di satu tempat.
     *
     * Urutannya: saring kuota dulu (failover se-grup — yang habis dicoret
     * agar se-grup yang bersisa bisa maju), lalu selaraskan grup (paket yang
     * menempel di baris ini menang), lalu terapkan aturan akumulatif.
     * Murni, tanpa efek — pencatatan konsumsi kuota dilakukan pemanggil
     * lewat `konsumsiKuota()` setelah barisnya pasti jadi/ditulis.
     *
     * @param  Collection<int, Dispensasi>  $paketDasar
     * @param  array<int, int>  $pakaiKuota
     * @param  Collection<int, Dispensasi>  $grupMap
     * @return array{nominal: int, potongan: int, ids: list<int>}
     */
    private function hitungBarisDispensasi(
        Collection $paketDasar,
        array $pakaiKuota,
        Collection $grupMap,
        ?Tagihan $ada,
        bool $kuotaBerlaku,
        int $nominalDasar,
        int $jenisId,
        DispensasiService $aturan,
    ): array {
        $punya = array_map('intval', (array) ($ada->dispensasi_ids ?? []));
        $berlaku = $paketDasar
            ->filter(fn ($d) => $this->kuotaTersedia($d, $pakaiKuota, $punya, $kuotaBerlaku))
            ->values();
        $gabung = $aturan->selaraskan($grupMap->only($punya)->values(), $berlaku);

        return $aturan->terapkan($nominalDasar, $gabung, $jenisId);
    }

    /**
     * Catat konsumsi kuota atas id yang baru menempel di baris ini
     * (yang sudah menempel sebelumnya tidak dihitung ulang).
     *
     * @param  list<int>  $idsBaru
     * @param  array<int, int>  $pakai
     * @param  list<int>|null  $punya
     */
    private function konsumsiKuota(array $idsBaru, array &$pakai, ?array $punya): void
    {
        $punyaInt = array_map('intval', $punya ?? []);
        foreach ($idsBaru as $id) {
            if (! in_array((int) $id, $punyaInt, true)) {
                $pakai[(int) $id] = ($pakai[(int) $id] ?? 0) + 1;
            }
        }
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
     * Rekap tagihan yang sudah ada untuk periode terpilih, per Santri.
     *
     * Dipakai dialog generate untuk pratinjau: berapa bulan yang sudah terisi
     * serta total nominal & pembayarannya, sehingga user bisa lihat
     * "sudah ada · 3/3 bulan · Rp 225.000" sebelum menekan tombol Generate.
     *
     * @param  list<int>  $santriIds
     * @param  list<string>  $periodes
     * @return array<int, array{periode: int, nominal: int, terbayar: int}>
     */
    private function rekapTagihanSudahAda(array $santriIds, int $jenisId, array $periodes): array
    {
        if ($santriIds === [] || $periodes === []) {
            return [];
        }

        $baris = Tagihan::query()
            ->where('jenis_id', $jenisId)
            ->whereIn('santri_id', $santriIds)
            ->whereIn('periode', $periodes)
            ->groupBy('santri_id')
            ->selectRaw('santri_id, count(distinct periode) as periode, SUM(nominal) as nominal, SUM(terbayar) as terbayar')
            ->get();

        $hasil = [];
        foreach ($baris as $b) {
            $hasil[(int) $b->santri_id] = [
                'periode' => (int) $b->periode,
                'nominal' => (int) $b->nominal,
                'terbayar' => (int) $b->terbayar,
            ];
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
}

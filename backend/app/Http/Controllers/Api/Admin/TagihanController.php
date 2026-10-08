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
use App\Models\JenisTagihan;
use App\Models\Tagihan;
use App\Services\DispensasiService;
use App\Services\UrutKatalog;
use App\Support\JatuhTempo;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
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
     * Saring Santri berdasarkan tingkat & kelas pada baris riwayat yang DIPAKAI
     * tampil di baris crosstab (genap menang atas ganjil pada jenjang + TA yang
     * sama) — bukan baris riwayat mana pun.
     *
     * Kalau hanya "ada riwayat yang cocok", Santri naik kelas di tengah tahun
     * akan muncul di kelas yang tak tercantum pada barisnya. Jadi saringan dibuat
     * sama dengan kolom "Kelas" di tabel.
     *
     * Tanpa `tahun_ajaran` tak ada patokan kelas yang benar (sama seperti peta
     * kelas di baris), jadi filter diabaikan — bukan diam-diam menyaring semua.
     *
     * @param  list<string>  $tahunAjaran
     * @param  list<string>  $jenjang
     * @param  list<string>  $tingkat
     * @param  list<string>  $kelasId
     */
    private function applyFilterKelasTampil($q, array $tahunAjaran, array $jenjang, array $tingkat, array $kelasId): void
    {
        if ($tahunAjaran === [] || ($tingkat === [] && $kelasId === [])) {
            return;
        }
        $q->whereHas('santri.riwayatBelajar', function ($rb) use ($tahunAjaran, $jenjang, $tingkat, $kelasId) {
            $rb->whereIn('tahun_ajaran', [$tahunAjaran[0]]);
            if ($jenjang !== []) {
                $rb->whereIn('jenjang', $jenjang);
            }
            if ($tingkat !== []) {
                $rb->whereIn('tingkat', $tingkat);
            }
            if ($kelasId !== []) {
                $rb->whereIn('kelas_id', array_map('intval', $kelasId));
            }
            // Genap menang atas ganjil: baris ganjil gugur begitu ada baris
            // semester 2 pada (santri, jenjang, tahun ajaran) yang sama.
            $rb->whereNotExists(function ($g) {
                $g->selectRaw('1')->from('riwayat_belajar as rb_genap')
                    ->whereColumn('rb_genap.santri_id', 'riwayat_belajar.santri_id')
                    ->whereColumn('rb_genap.jenjang', 'riwayat_belajar.jenjang')
                    ->whereColumn('rb_genap.tahun_ajaran', 'riwayat_belajar.tahun_ajaran')
                    ->where('rb_genap.semester', '2')
                    ->where('riwayat_belajar.semester', '<>', '2');
            });
        });
    }

    public function crosstabTagihan(TagihanCrosstabRequest $request)
    {
        $q = Tagihan::with(['jenis', 'santri']);
        $this->applyFilter($q, $request, 'jenjang', 'tagihan.jenjang');
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
                ->orWhere('nisn', 'like', '%'.$cari.'%')
                ->orWhereHas('lembagaSantri', fn ($ls) => $ls->where('nis_lokal', 'like', '%'.$cari.'%')));
        }

        /* Filter rail tingkat & kelas dipasang di `$q` (bukan di query agregat
          terpisah) supaya ikut memotong paginasi, total, daftar kolom, dan sel. */
        $tahunAjaran = $this->nilaiFilter($request, 'tahun_ajaran');
        $jenjang = $this->nilaiFilter($request, 'jenjang');
        $this->applyFilterKelasTampil(
            $q,
            $tahunAjaran,
            $jenjang,
            $this->nilaiFilter($request, 'tingkat'),
            $this->nilaiFilter($request, 'kelas_id'),
        );

        $page = max(1, (int) $request->input('page', 1));
        $perPage = $this->perPage($request);

        /* Agregat per Santri + urutan + paginasi dilakukan di SQL. Sebelumnya
           seluruh tagihan (7.602 baris di dev DB untuk TA 2026/2027) dimuat ke
           memori lalu di-group dan di-`array_slice` di PHP: tumbuh linier
           dengan data dan menahan memori meski tabel hanya menampilkan satu
           halaman. Sekarang hanya Santri di halaman ini yang diambil datanya. */
        $petaUrut = [
            'nama' => 's.nama_lengkap',
            'total' => 'total_tagihan',
            'bayar' => 'total_terbayar',
            'sisa' => 'tunggakan',
            'id' => 'tagihan.santri_id',
        ];
        $agregat = (clone $q)
            ->join('santri as s', 's.id', '=', 'tagihan.santri_id')
            ->select('tagihan.santri_id')
            ->selectRaw('s.nama_lengkap, s.ayah_nama, s.ibu_nama')
            ->selectRaw('SUM(tagihan.nominal) as total_tagihan')
            ->selectRaw('SUM(tagihan.terbayar) as total_terbayar')
            /* Sama dengan `Tagihan::sisaTerlambat()`: sisa > 0 DAN lewat batas
               waktu; jatuh tempo kosong = tanpa batas = lewat. */
            ->selectRaw(
                'SUM(CASE WHEN (tagihan.nominal - tagihan.terbayar) > 0'
                .' AND (tagihan.jatuh_tempo IS NULL OR tagihan.jatuh_tempo < ?) THEN (tagihan.nominal - tagihan.terbayar) ELSE 0 END) as tunggakan',
                [today()->toDateString()]
            )
            /* `santri` di-group juga: kolomnya ikut dipilih, jadi MySQL dengan
               ONLY_FULL_GROUP_BY akan menolak kalau tidak. Idempoten terhadap
               `tagihan.santri_id` (satu Santri = satu baris), jadi hasil & biaya
               sama. */
            ->groupBy('tagihan.santri_id', 's.nama_lengkap', 's.ayah_nama', 's.ibu_nama');

        foreach ($this->kriteriaUrutan($request, $petaUrut) as [$kolom, $arah]) {
            $agregat->orderBy($kolom, $arah === 'turun' ? 'desc' : 'asc');
        }
        // Tanpa parameter urutan: urut Santri id (perilaku lama).
        if ($this->kriteriaUrutan($request, $petaUrut) === []) {
            $agregat->orderBy('tagihan.santri_id');
        }

        $totalSantri = (int) (clone $q)->join('santri as s', 's.id', '=', 'tagihan.santri_id')
            ->distinct()->count('tagihan.santri_id');

        $perPageSql = $perPage >= self::PER_PAGE_ALL ? $totalSantri : $perPage;
        $halaman = $agregat
            ->offset(max(0, ($page - 1) * $perPageSql))
            ->limit(max(1, $perPageSql))
            ->get();

        // Kolom: per jenis; bulanan dipecah satu kolom per bulan (periode).
        /* Kolom cukup dari kombinasi (jenis, periode) yang ADA, jadi diambil
          distinct di SQL — bukan semua baris tagihan._baris sebelumnya satu baris
           per tagihan (7.602 di dev DB) hanya dirangkum jadi daftar kolom. */
        $kolom = [];
        foreach ((clone $q)->join('jenis_tagihan as jt', 'jt.id', '=', 'tagihan.jenis_id')
            ->select('tagihan.jenis_id', 'tagihan.periode')
            ->selectRaw('MIN(jt.nama) as jenis_nama, MIN(jt.tipe) as tipe')
            ->groupBy('tagihan.jenis_id', 'tagihan.periode')
            ->orderBy('tagihan.jenis_id')
            ->orderBy('tagihan.periode')
            ->get() as $barisKolom) {
            $jenisId = (int) $barisKolom->jenis_id;
            $bulanan = $barisKolom->tipe === 'bulanan';
            $p = $bulanan ? $barisKolom->periode : null;
            $kolom[] = [
                'key' => $this->keyKolomCrosstab($jenisId, $p, $bulanan),
                'jenis_id' => $jenisId,
                'jenis_nama' => $barisKolom->jenis_nama ?? 'Jenis #'.$jenisId,
                'tipe' => $barisKolom->tipe ?? 'non_bulanan',
                'periode' => $p,
            ];
        }

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
                'jenjang' => (string) $kelompok->first()->jenjang,
                'kelas' => $info['kelas'] ?? null,
                'tingkat' => $info['tingkat'] ?? null,
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

    public function storeTagihan(TagihanStoreRequest $request)
    {
        $data = $request->validated();
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
     * Dispensasi eksplisit (`dispensasi_ids`, dari combobox tab Ubah):
     * nominal dihitung ulang dari KOTOR (`nominal + potongan` tersimpan —
     * tepat, karena potongan selalu `awal - akhir`) memakai paket terpilih;
     * [] = lepas + koreksi manual (pakai nominal ketikan, jejak dibersihkan).
     * Tanpa kunci itu, koreksi nominal manual membersihkan jejak lama (agar
     * tak basi), nilai sama membiarkannya.
     *
     * Nominal tidak boleh turun di bawah yang sudah dibayar (sisa negatif).
     * Status dihitung ulang dari nominal vs terbayar. Jenis bulanan mengabaikan
     * jatuh tempo manual — aturan tanggal 10 bulan berjalan berlaku juga di
     * sini, supaya tunggangan tidak bisa dikecualikan lewat ubah.
     */
    public function updateTagihan(TagihanUpdateRequest $request, Tagihan $tagihan)
    {
        $data = $request->validated();
        $this->canLembaga($request->user(), $tagihan->jenjang) || abort(403);

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
                    if ($aturanSvc->aturanUntukJenis($d, (int) $tagihan->jenis_id) === null) {
                        abort(422, "Dispensasi '{$d->nama}' tidak punya aturan untuk jenis tagihan ini.");
                    }
                    if (!in_array((int) $tagihan->santri_id, $d->santri_ids ?? [], true)) {
                        abort(422, "Santri bukan penerima dispensasi '{$d->nama}'.");
                    }
                }
                $hasil = $aturanSvc->terapkan(
                    (int) $tagihan->nominal + (int) $tagihan->potongan,
                    $paket,
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
        $tagihan->save();

        return response()->json($tagihan);
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
        foreach ($peta as $id => $info) {
            if (! $this->lolosKelompok($info, $data['kelompok'])) {
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
     * dihitung ulang dari nominal vs terbayar. Tagihan yang nominal barunya
     * lebih kecil dari yang sudah dibayar **dilewati**, bukan dipaksa turun,
     * dan alasannya dikembalikan agar bisa ditampilkan ke pengguna.
     */
    public function generateTagihan(TagihanGenerateRequest $request)
    {
        $data = $request->validated();
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

        /* Satu transaksi untuk seluruh daftar. Tanpa itu `abort()` di tengah
           loop (mis. Santri tidak aktif pada TA) meninggalkan tagihan yang
           sudah terlanjur dibuat: user melihat "gagal" padahal sebagian data
           sudah jadi, lalu generate ulang hanya melaporkan "dilewati". */
        $hasil = DB::transaction(function () use (
            $actor, $data, $jenis, $periodes, $diminta, $peta, $daftarDispensasi, $aturan
        ): array {
            $dibuat = 0;
            $diperbarui = 0;
            $alasan = [];

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
                    $terapkan = $aturan->terapkan((int) $data['nominal'], $aturan->saring($daftarDispensasi, (int) $santriId), (int) $jenis->id);
                    $nominal = $terapkan['nominal'];
                    $potongan = $terapkan['potongan'];
                    $dispensasiIds = $terapkan['ids'] === [] ? null : $terapkan['ids'];
                }

                foreach ($periodes as $periode) {
                    $jatuhTempo = JatuhTempo::untuk((string) $jenis->tipe, $periode, $data['jatuh_tempo'] ?? null);
                    $ada = Tagihan::where('santri_id', $santriId)
                        ->where('jenis_id', $jenis->id)
                        ->where('periode', $periode)
                        ->first();

                    if ($ada === null) {
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

                    if ($nominal < (int) $ada->terbayar) {
                        $alasan[] = [
                            'santri_id' => (int) $santriId,
                            'periode' => $periode,
                            'nominal_sekarang' => (int) $ada->nominal,
                            'terbayar' => (int) $ada->terbayar,
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
                    $diperbarui++;
                }
            }

            return ['dibuat' => $dibuat, 'diperbarui' => $diperbarui, 'alasan' => $alasan];
        });

        return response()->json([
            'dibuat' => $hasil['dibuat'],
            'diperbarui' => $hasil['diperbarui'],
            'dilewati' => count($hasil['alasan']),
            'alasan' => $hasil['alasan'],
        ]);
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

    /**
     * Tunggakan per santri, terpaginasi: tagihan belum lunas yang sudah lewat
     * batas waktunya. Tagihan bulanan bulan yang masih berjalan tidak dihitung;
     * tagihan tanpa jatuh tempo (non-bulanan yang tidak diisi manual) langsung
     * dihitung, sebab tidak punya batas waktu.
     *
     * Agregasi dilakukan di SQL — bukan memuat semua baris lalu groupBy di PHP —
     * supaya daftar bisa dipaginasi. Nilainya setara `Tagihan::sisaTerlambat()`:
     * baris yang lolos filter tanggal selalu terlambat, sisa = max(0, nominal - terbayar).
     */
    public function tunggakan(Request $request)
    {
        $q = Tagihan::query()
            ->selectRaw("tagihan.santri_id as santri_id,
                COALESCE(santri.nama_lengkap, 'Tidak diketahui') as nama,
                SUM(tagihan.nominal) as total_tagihan,
                SUM(tagihan.terbayar) as terbayar,
                SUM(CASE WHEN tagihan.nominal > tagihan.terbayar THEN tagihan.nominal - tagihan.terbayar ELSE 0 END) as tunggakan,
                COUNT(*) as jumlah_tagihan,
                MIN(tagihan.jatuh_tempo) as terlambat_terlama,
                SUM(CASE WHEN tagihan.jatuh_tempo IS NULL THEN 1 ELSE 0 END) as tanpa_jatuh_tempo")
            ->leftJoin('santri', 'santri.id', '=', 'tagihan.santri_id')
            ->where('tagihan.status', '!=', 'lunas')
            ->where(fn ($w) => $w->whereNull('tagihan.jatuh_tempo')->orWhereDate('tagihan.jatuh_tempo', '<', today()))
            ->groupBy('tagihan.santri_id', 'santri.nama_lengkap');
        $this->applyFilter($q, $request, 'jenjang', 'tagihan.jenjang');
        $this->applyFilter($q, $request, 'tahun_ajaran', 'tagihan.tahun_ajaran');

        // Token urut sama dengan katalog lama (nama/total/bayar/sisa/jumlah/id),
        // kini memetakan ke alias SQL hasil agregasi.
        $urut = $this->parseUrut($request, [
            'nama' => ['nama'],
            'total' => ['total_tagihan'],
            'bayar' => ['terbayar'],
            'sisa' => ['tunggakan'],
            'jumlah' => ['jumlah_tagihan'],
            'id' => ['santri_id'],
        ]);
        $this->terapkanUrut($q, $urut, [['santri_id', 'naik']]);

        return response()->json($q->paginate($this->perPage($request))->through(fn ($r) => [
            'santri_id' => (int) $r->santri_id,
            'nama' => $r->nama,
            'total_tagihan' => (int) $r->total_tagihan,
            'terbayar' => (int) $r->terbayar,
            'tunggakan' => (int) $r->tunggakan,
            'jumlah_tagihan' => (int) $r->jumlah_tagihan,
            // MIN() mengembalikan datetime mentah; samakan format lama (Y-m-d).
            'terlambat_terlama' => $r->terlambat_terlama === null
                ? null
                : substr((string) $r->terlambat_terlama, 0, 10),
            'tanpa_jatuh_tempo' => (bool) $r->tanpa_jatuh_tempo,
        ]));
    }
}

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
    public function crosstabTagihan(TagihanCrosstabRequest $request)
    {
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

        /* Kelas & status keaktifan per Santri, diambil dari riwayat TA yang
           sama dengan filter topBar: semester 2 (genap) menang, dan Santri
           MI-MD memakai kelas MI (`jenjang_utama` sudah embody aturan itu).
           `pindah_keluar` ikut diambil — statusnya justru dipakai untuk
           penanda titik merah, bukan untuk menyembunyikan baris. Kalau filter
           TA kosong, tidak ada patokan kelas yang benar, jadi kolomnya dibiarkan kosong. */
        $tahunAjaran = $this->nilaiFilter($request, 'tahun_ajaran');
        $peta = $tahunAjaran === []
            ? []
            : $this->petaSantriGenerate((string) $tahunAjaran[0], array_keys($tagihan->groupBy('santri_id')->all()), null, true);

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
            $info = $peta[(int) $santriId] ?? null;

            /* Keaktifan (aturan user): untuk Santri MI-MD, tidak aktif HANYA
               bila `status_akhir` di MI **dan** MD sama-sama `pindah_keluar`;
               kalau hanya salah satu, Santri itu dianggap masih aktif (mis.
               pindah dari MI tapi masih sekolah di MD). Dievaluasi dari
               `per_jenjang` — bukan dari jenjang yang kebetulan sedang difilter
               crosstab, supaya Santri yang pindah tidak ditandai merah ketika
               tabel sedang disaring jenjang MD, atau sebaliknya. Santri
               berjenjang tunggal (atau MTS/MLN) memakai `status_akhir`. */
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
                'nama' => $santri?->nama_lengkap ?? 'Tidak dikenal',
                'ayah_nama' => $santri?->ayah_nama,
                'ibu_nama' => $santri?->ibu_nama,
                'jenjang' => (string) $kelompok->first()->jenjang,
                'kelas' => $info['kelas'] ?? null,
                'tingkat' => $info['tingkat'] ?? null,
                /* `aktif` hasil hitungan MI+MD di atas — bukan `status !== 'pindah_keluar'`,
                   karena untuk MI-MD sudah aktif meski `status_akhir` (MI) pindah_keluar. */
                'status_akhir' => $status,
                'aktif' => $aktif,
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
     * Nominal tidak boleh turun di bawah yang sudah dibayar (sisa negatif).
     * Status dihitung ulang dari nominal vs terbayar. Jenis bulanan mengabaikan
     * jatuh tempo manual — aturan tanggal 10 bulan berjalan berlaku juga di
     * sini, supaya tunggangan tidak bisa dikecualikan lewat ubah.
     */
    public function updateTagihan(TagihanUpdateRequest $request, Tagihan $tagihan)
    {
        $data = $request->validated();
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

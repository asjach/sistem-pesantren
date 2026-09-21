<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SiklusDaftarKelasRequest;
use App\Http\Requests\Admin\SiklusLembagaRequest;
use App\Http\Requests\Admin\SiklusLulusRequest;
use App\Http\Requests\Admin\SiklusMutasiKeluarRequest;
use App\Http\Requests\Admin\SiklusNaikKelasOtomatisRequest;
use App\Http\Requests\Admin\SiklusNaikKelasRequest;
use App\Http\Requests\Admin\SiklusRekapRequest;
use App\Http\Requests\Admin\SiklusSalinGenapRequest;
use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Services\SiklusSantriService;
use App\Services\UrutKatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Siklus akademik santri: salin genap, kenaikan, kelulusan, mutasi keluar,
 * berhenti jenjang, daftar kelas, rekap, dan profil santri.
 */
class SiklusController extends Controller
{
    use TenantGuard;
    use UrutDaftar;

    private const SORT_NULLABLE_ARSIP = [
        'mutasi_keluar.tanggal_mutasi', 'alumni.tanggal_lulus',
        'kelas.nama_kelas', 'tahun_ajaran.nama',
    ];

    public function __construct(private SiklusSantriService $siklusService) {}

    // ---------------- Salin genap ----------------

    /** POST /api/admin/akademik/salin-genap — massal per lembaga (partial per-item). */
    public function salinGenapMassal(SiklusSalinGenapRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();

        $lembagaId = (int) $data['lembaga_id'];
        $this->authorizeLembaga($request->user(), $lembagaId);
        $this->tolakLembagaRoot($lembagaId);
        $tanggal = (string) $data['tanggal_masuk'];

        $items = $data['siswa'] ?? RiwayatBelajar::where('lembaga_id', $lembagaId)
            ->where('semester', '1')->where('is_active_riwayat', RiwayatBelajar::YA)
            ->orderBy('id')->get()
            ->map(fn (RiwayatBelajar $r) => ['santri_id' => (int) $r->santri_id])
            ->all();

        $ok = 0;
        $gagal = [];
        foreach ($items as $item) {
            try {
                $santri = Santri::findOrFail($item['santri_id']);
                $this->authorizeAksiLembaga($request, $santri, $lembagaId);
                $kelasId = isset($item['kelas_id']) ? (int) $item['kelas_id'] : null;
                $this->cekKelasGenap($santri, $lembagaId, $kelasId);
                $this->siklusService->salinKeGenap(
                    $santri,
                    $lembagaId,
                    $tanggal,
                    isset($item['no_absen']) ? (int) $item['no_absen'] : null,
                    $kelasId
                );
                $ok++;
            } catch (\Throwable $e) {
                $gagal[] = ['santri_id' => $item['santri_id'] ?? null, 'pesan' => $e->getMessage()];
            }
        }

        return response()->json(['pesan' => 'Salin ke genap selesai.', 'berhasil' => $ok, 'gagal' => $gagal]);
    }

    /** Guard kelas pengganti salin genap: wajib se-lembaga & se-tahun dengan baris aktif. */
    protected function cekKelasGenap(Santri $santri, int $lembagaId, ?int $kelasId): void
    {
        if ($kelasId === null) {
            return;
        }
        $kelas = Kelas::findOrFail($kelasId);
        if ((int) $kelas->lembaga_id !== $lembagaId) {
            throw ValidationException::withMessages(['kelas_id' => 'Kelas beda lembaga.']);
        }
        $ganjil = RiwayatBelajar::where('santri_id', $santri->id)
            ->where('lembaga_id', $lembagaId)->where('is_active_riwayat', RiwayatBelajar::YA)
            ->latest('id')->first();
        if ($ganjil && $kelas->tahun_ajaran !== $ganjil->tahun_ajaran) {
            throw ValidationException::withMessages(['kelas_id' => 'Kelas beda tahun ajaran.']);
        }
    }

    // ---------------- Kenaikan / kelulusan ----------------

    /** POST /api/admin/akademik/naik-kelas — batch = 1 lembaga + 1 tahun + 1 tingkat. */
    public function naikKelasMassal(SiklusNaikKelasRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();

        $lembagaId = (int) $data['lembaga_id'];
        $tahunBaru = (string) $data['tahun_ajaran_baru'];
        $tingkat = (string) $data['tingkat'];
        $this->tolakLembagaRoot($lembagaId);
        $this->cekTaEfektif($lembagaId, $tahunBaru, 'tahun_ajaran_baru');

        $ok = 0;
        $gagal = [];
        foreach ($data['siswa'] as $item) {
            try {
                $santri = Santri::findOrFail($item['santri_id']);
                $this->authorizeAksiLembaga($request, $santri, $lembagaId);
                $this->siklusService->prosesKenaikanPerSantri(
                    $santri,
                    $lembagaId,
                    $tahunBaru,
                    $tingkat,
                    $item['status'],
                    $item['tgl_masuk'] ?? null,
                    isset($item['no_absen']) ? (int) $item['no_absen'] : null
                );
                $ok++;
            } catch (\Throwable $e) {
                $gagal[] = ['santri_id' => $item['santri_id'] ?? null, 'pesan' => $e->getMessage()];
            }
        }

        return response()->json(['pesan' => 'Proses kenaikan selesai.', 'berhasil' => $ok, 'gagal' => $gagal]);
    }

    /** POST /api/admin/akademik/naik-kelas-otomatis — TA + kelas tujuan
     *  dibuatkan otomatis (partial per-item). */
    public function naikKelasOtomatis(SiklusNaikKelasOtomatisRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();

        $lembagaId = (int) $data['lembaga_id'];
        $this->tolakLembagaRoot($lembagaId);

        $ok = 0;
        $gagal = [];
        $hasil = [];
        foreach ($data['siswa'] as $item) {
            try {
                $santri = Santri::findOrFail($item['santri_id']);
                $this->authorizeAksiLembaga($request, $santri, $lembagaId);
                $baru = $this->siklusService->prosesKenaikanOtomatis(
                    $santri,
                    $lembagaId,
                    $item['status'],
                    $item['tgl_masuk']
                );
                $baru->load(['santri:id,nama_lengkap', 'kelas:id,nama_kelas', 'tahunAjaran:id,nama']);
                $hasil[] = [
                    'santri_id' => $baru->santri_id,
                    'nama' => $baru->santri?->nama_lengkap,
                    'kelas' => $baru->kelas?->nama_kelas,
                    'tingkat' => $baru->tingkat,
                    'tahun_ajaran' => $baru->tahunAjaran?->nama,
                ];
                $ok++;
            } catch (\Throwable $e) {
                $gagal[] = ['santri_id' => $item['santri_id'] ?? null, 'pesan' => $e->getMessage()];
            }
        }

        return response()->json(['pesan' => 'Proses kenaikan selesai.', 'berhasil' => $ok, 'gagal' => $gagal, 'data' => $hasil]);
    }

    /** POST /api/admin/santri/{santri}/batal-kenaikan — urungkan hasil kenaikan. */
    public function batalKenaikan(SiklusLembagaRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();

        $this->tolakLembagaRoot((int) $data['lembaga_id']);
        $this->authorizeAksiLembaga($request, $santri, (int) $data['lembaga_id']);

        $lama = $this->siklusService->batalKenaikan($santri, (int) $data['lembaga_id']);

        return response()->json(['pesan' => 'Kenaikan dibatalkan; santri kembali ke kelas asal.', 'data' => $lama]);
    }

    /** POST /api/admin/santri/{santri}/lulus — kelulusan per lembaga (+arsip alumni). */
    public function lulus(SiklusLulusRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();

        $this->tolakLembagaRoot((int) $data['lembaga_id']);
        $this->cekTaEfektif((int) $data['lembaga_id'], (string) $data['tahun_ajaran_lulus'], 'tahun_ajaran_lulus');
        $this->authorizeAksiLembaga($request, $santri, (int) $data['lembaga_id']);

        $alumni = $this->siklusService->prosesLulusPerLembaga($santri, (int) $data['lembaga_id'], $data);

        return response()->json([
            'pesan' => 'Santri dinyatakan lulus dan masuk data alumni.',
            'data' => $alumni,
        ]);
    }

    /** POST /api/admin/santri/{santri}/tidak-lulus — buka riwayat mengulang TA berikut. */
    public function tidakLulus(SiklusLembagaRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();

        $this->tolakLembagaRoot((int) $data['lembaga_id']);
        $this->authorizeAksiLembaga($request, $santri, (int) $data['lembaga_id']);

        $riwayat = $this->siklusService->prosesTidakLulus($santri, (int) $data['lembaga_id']);

        return response()->json([
            'pesan' => 'Santri tidak lulus; riwayat mengulang tapel berikut dibuka.',
            'data' => $riwayat,
        ]);
    }

    // ---------------- Mutasi / berhenti ----------------

    /** POST /api/admin/santri/{santri}/mutasi — mutasi keluar per lembaga. */
    public function mutasiKeluar(SiklusMutasiKeluarRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();

        $this->tolakLembagaRoot((int) $data['lembaga_id']);
        $this->authorizeAksiLembaga($request, $santri, (int) $data['lembaga_id']);

        $mutasi = $this->siklusService->prosesMutasiPerLembaga($santri, (int) $data['lembaga_id'], $data);

        return response()->json([
            'pesan' => 'Santri berhasil dimutasi keluar.',
            'data' => $mutasi,
        ]);
    }

    /** POST /api/admin/santri/{santri}/berhenti-jenjang — tutup satu jenjang (paket). */
    public function berhentiJenjang(SiklusLembagaRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();

        $this->tolakLembagaRoot((int) $data['lembaga_id']);
        $this->authorizeAksiLembaga($request, $santri, (int) $data['lembaga_id']);

        $this->siklusService->nonAktifkanRiwayat($santri, (int) $data['lembaga_id']);

        return response()->json(['pesan' => 'Riwayat jenjang dinonaktifkan.', 'data' => $santri->fresh()]);
    }

    // ---------------- Daftar & arsip ----------------

    /** GET /api/admin/mutasi-keluar — arsip mutasi (terskop tenant). */
    public function getMutasiKeluar(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);
        $urut = $this->parseUrut($request, UrutKatalog::peta('mutasi_arsip'));

        $mutasi = MutasiKeluar::tenantScope()
            ->with(['santri:id,nama_lengkap,nisn', 'lembaga:id,nama,kode', 'kelasTerakhir:id,nama_kelas'])
            ->when($request->filled('lembaga_id'), fn ($q) => $q->where('lembaga_id', $request->integer('lembaga_id')));
        if ($urut !== null) {
            $mutasi->select('mutasi_keluar.*')
                ->leftJoin('santri', 'santri.id', '=', 'mutasi_keluar.santri_id')
                ->leftJoin('lembaga', 'lembaga.id', '=', 'mutasi_keluar.lembaga_id')
                ->leftJoin('kelas', 'kelas.id', '=', 'mutasi_keluar.kelas_terakhir_id');
        }
        $this->terapkanUrut($mutasi, $urut, [['mutasi_keluar.id', 'turun']], self::SORT_NULLABLE_ARSIP);
        $mutasi = $mutasi->paginate($this->perPage($request));

        return response()->json($mutasi);
    }

    /** GET /api/admin/alumni — arsip alumni (terskop tenant via lembaga lulus). */
    public function getAlumni(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);
        $urut = $this->parseUrut($request, UrutKatalog::peta('kelulusan_alumni'));

        $alumni = Alumni::tenantScope()
            ->with(['santri:id,nama_lengkap,nisn', 'lembagaLulus:id,nama,kode', 'tahunAjaranLulus:nama', 'kelasLulus:id,nama_kelas'])
            ->when($request->filled('lembaga_id'), fn ($q) => $q->where('lembaga_lulus_id', $request->integer('lembaga_id')))
            ->when($request->filled('tahun_ajaran_lulus'), fn ($q) => $q->where('tahun_ajaran_lulus', $request->input('tahun_ajaran_lulus')));
        if ($urut !== null) {
            $alumni->select('alumni.*')
                ->leftJoin('santri', 'santri.id', '=', 'alumni.santri_id')
                ->leftJoin('lembaga', 'lembaga.id', '=', 'alumni.lembaga_lulus_id')
                ->leftJoin('tahun_ajaran', 'tahun_ajaran.nama', '=', 'alumni.tahun_ajaran_lulus')
                ->leftJoin('kelas', 'kelas.id', '=', 'alumni.kelas_lulus_id');
        }
        $this->terapkanUrut($alumni, $urut, [['alumni.id', 'turun']], self::SORT_NULLABLE_ARSIP);
        $alumni = $alumni->paginate($this->perPage($request));

        return response()->json($alumni);
    }

    /**
     * GET /api/admin/akademik/daftar-kelas — daftar santri per kelas.
     * Muatan penuh 3 tabel: `riwayat_belajar` + `santri` (semua kolom) +
     * `lembaga_anggota` (baris `lembaga_santri` santri+lembaga, aktif
     * diutamakan) + relasi kelas/lembaga/tahun ajaran. `nis_lokal` ringkas
     * dipertahankan untuk kompatibilitas.
     * Tanpa `kelompok_status`: perilaku lama (is_active_riwayat pada TA default aktif
     * + semester berjalan). Dengan `kelompok_status=aktif|nonaktif`: basis
     * tampil = status_akhir (aktif = Aktif, Naik, Tidak Naik, Lulus,
     * Tidak Lulus; nonaktif = Pindah/Keluar) dan `lintas_periode=1`
     * mematikan default TA/semester agar bisa lintas periode.
     */
    public function daftarKelas(SiklusDaftarKelasRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();
        $lembagaId = (int) $data['lembaga_id'];
        $this->authorizeLembaga($request->user(), $lembagaId);

        $lintas = $request->boolean('lintas_periode');
        $kelompok = $data['kelompok_status'] ?? null;

        $ta = $data['tahun_ajaran']
            ?? ($lintas ? null : TahunAjaran::aktif($lembagaId)?->nama);
        if (! $lintas && $ta === null) {
            return response()->json(['pesan' => 'Tahun ajaran aktif belum ada di lembaga ini.', 'data' => []]);
        }

        $semester = $data['semester']
            ?? ($lintas || $ta === null ? null : (string) (RiwayatBelajar::where('lembaga_id', $lembagaId)
                ->where('tahun_ajaran', $ta)->where('is_active_riwayat', RiwayatBelajar::YA)
                ->orderByDesc('semester')->value('semester') ?? '1'));

        $query = RiwayatBelajar::with([
            'santri',
            'kelas:id,nama_kelas,tingkat',
            'lembaga:id,nama,kode',
            'tahunAjaran:nama',
        ])->where('lembaga_id', $lembagaId);
        if ($ta !== null) {
            $query->where('tahun_ajaran', $ta);
        }
        if ($semester !== null) {
            $query->where('semester', $semester);
        }
        if ($kelompok === 'aktif') {
            // Aktif = gabungan status akhir (bukan flag is_active_riwayat).
            $query->whereIn('status_akhir', ['aktif', 'naik', 'tidak_naik', 'lulus', 'tidak_lulus']);
        } elseif ($kelompok === 'nonaktif') {
            $query->where('status_akhir', 'pindah_keluar');
        } else {
            $query->where('is_active_riwayat', RiwayatBelajar::YA);
        }

        if (! empty($data['kelas_id'])) {
            $query->where('kelas_id', (int) $data['kelas_id']);
        }
        if (! empty($data['tingkat'])) {
            $query->where('tingkat', $data['tingkat']);
        }

        $baris = $query->orderBy('tahun_ajaran')->orderBy('semester')->orderBy('kelas_id')->orderBy('no_absen')->orderBy('santri_id')->get();
        // Keanggotaan penuh (satu baris per santri; aktif diutamakan) + NIS lokal
        // ringkas (kompatibilitas payload lama).
        $anggota = LembagaSantri::whereIn('santri_id', $baris->pluck('santri_id')->unique())
            ->where('lembaga_id', $lembagaId)
            ->orderByDesc('is_active_lembaga')->orderBy('id')
            ->get()->groupBy('santri_id')->map->first();
        $baris->each(function ($r) use ($anggota) {
            $ls = $anggota[$r->santri_id] ?? null;
            $r->setRelation('lembaga_anggota', $ls);
            $r->setAttribute('nis_lokal', $ls?->nis_lokal);
        });

        return response()->json([
            'lembaga_id' => $lembagaId,
            'tahun_ajaran' => $ta,
            'semester' => $semester,
            'data' => $baris,
        ]);
    }

    /**
     * GET /api/admin/akademik/rekap-santri — rekap jumlah santri per tahun ajaran,
     * per tingkat, per kelas, plus usia per kelas.
     */
    public function rekapSantri(SiklusRekapRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();

        $riwayatQuery = function () use ($request, $data) {
            $q = RiwayatBelajar::query()->where('is_active_riwayat', RiwayatBelajar::YA);
            $this->scopeLembaga($q, $request->user(), $request, 'lembaga_id');
            if (! empty($data['tahun_ajaran'])) {
                $q->where('tahun_ajaran', $data['tahun_ajaran']);
            }

            return $q;
        };

        $perTingkat = (clone $riwayatQuery())
            ->selectRaw('lembaga_id, tingkat, COUNT(*) as jumlah')
            ->groupBy('lembaga_id', 'tingkat')
            ->with('lembaga:id,nama,kode')
            ->get()
            ->map(fn ($r) => [
                'lembaga' => $r->lembaga?->kode ?? $r->lembaga?->nama,
                'tingkat' => $r->tingkat,
                'jumlah' => (int) $r->jumlah,
            ])->values()->all();

        $kelasQuery = Kelas::query()->with(['lembaga:id,nama,kode', 'tahunAjaran:nama']);
        $this->scopeLembaga($kelasQuery, $request->user(), $request, 'lembaga_id');
        if (! empty($data['tahun_ajaran'])) {
            $kelasQuery->where('tahun_ajaran', $data['tahun_ajaran']);
        }
        $kelas = $kelasQuery->orderBy('lembaga_id')->orderBy('tingkat')->orderBy('nama_kelas')->get();

        $terisi = (clone $riwayatQuery())
            ->whereIn('kelas_id', $kelas->pluck('id'))
            ->selectRaw('kelas_id, COUNT(*) as jumlah')
            ->groupBy('kelas_id')
            ->pluck('jumlah', 'kelas_id');

        $perKelas = $kelas->map(fn (Kelas $k) => [
            'kelas_id' => $k->id,
            'kelas' => $k->nama_kelas,
            'tingkat' => $k->tingkat,
            'lembaga' => $k->lembaga?->kode ?? $k->lembaga?->nama,
            'tahun_ajaran' => $k->tahunAjaran?->nama,
            'kapasitas' => $k->kapasitas !== null ? (int) $k->kapasitas : null,
            'terisi' => (int) ($terisi[$k->id] ?? 0),
            'sisa' => $k->kapasitas !== null ? max(0, (int) $k->kapasitas - (int) ($terisi[$k->id] ?? 0)) : null,
        ])->values()->all();

        // Usia per kelas: rata-rata + sebaran kelompok umur (dari tgl_lahir santri).
        $usiaPerKelas = [];
        $riwayatKelas = (clone $riwayatQuery())
            ->whereNotNull('kelas_id')
            ->with(['santri:id,tgl_lahir', 'kelas:id,nama_kelas'])
            ->get()
            ->groupBy('kelas_id');

        foreach ($riwayatKelas as $kelasId => $baris) {
            $usia = $baris->map(function (RiwayatBelajar $r) {
                if (! $r->santri?->tgl_lahir) {
                    return null;
                }

                return $r->santri->tgl_lahir->age;
            })->filter(fn ($u) => $u !== null);

            if ($usia->isEmpty()) {
                continue;
            }
            $kelompok = ['<7' => 0, '7-9' => 0, '10-12' => 0, '13-15' => 0, '>=16' => 0];
            foreach ($usia as $u) {
                if ($u < 7) {
                    $kelompok['<7']++;
                } elseif ($u <= 9) {
                    $kelompok['7-9']++;
                } elseif ($u <= 12) {
                    $kelompok['10-12']++;
                } elseif ($u <= 15) {
                    $kelompok['13-15']++;
                } else {
                    $kelompok['>=16']++;
                }
            }
            $usiaPerKelas[] = [
                'kelas_id' => (int) $kelasId,
                'kelas' => $baris->first()->kelas?->nama_kelas,
                'jumlah' => $usia->count(),
                'rata_usia' => round($usia->avg(), 1),
                'min' => $usia->min(),
                'max' => $usia->max(),
                'kelompok' => $kelompok,
            ];
        }

        $perTahunAjaran = (clone $riwayatQuery())
            ->selectRaw('tahun_ajaran, COUNT(*) as jumlah')
            ->groupBy('tahun_ajaran')
            ->with('tahunAjaran:nama')
            ->get()
            ->map(fn ($r) => [
                'tahun_ajaran' => $r->tahun_ajaran,
                'jumlah_riwayat_aktif' => (int) $r->jumlah,
            ])->values()->all();

        return response()->json([
            'total_aktif' => (int) (clone $riwayatQuery())->count(),
            'per_tahun_ajaran' => $perTahunAjaran,
            'per_tingkat' => $perTingkat,
            'per_kelas' => $perKelas,
            'usia_per_kelas' => $usiaPerKelas,
        ]);
    }

    /** GET /api/admin/santri/{santri}/profil — identitas + keanggotaan + riwayat + arsip. */
    public function profilSantri(Request $request, Santri $santri): JsonResponse
    {
        $this->authorize('view', $santri);

        $santri->load([
            'lembagaSantri.lembaga:id,nama,kode,nsm',
        ]);
        $riwayat = RiwayatBelajar::where('santri_id', $santri->id)
            ->with(['kelas:id,nama_kelas,tingkat', 'lembaga:id,nama,kode', 'tahunAjaran:nama'])
            ->orderByDesc('id')->get();
        $mutasi = MutasiKeluar::where('santri_id', $santri->id)
            ->with(['lembaga:id,nama,kode', 'kelasTerakhir:id,nama_kelas'])
            ->orderByDesc('id')->get();
        $alumni = Alumni::where('santri_id', $santri->id)
            ->with(['lembagaLulus:id,nama,kode', 'tahunAjaranLulus:nama'])
            ->orderByDesc('id')->get();

        return response()->json([
            'santri' => $santri,
            'keanggotaan' => $santri->lembagaSantri,
            'riwayat' => $riwayat,
            'mutasi' => $mutasi,
            'alumni' => $alumni,
        ]);
    }
}

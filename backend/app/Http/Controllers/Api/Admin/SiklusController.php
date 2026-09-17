<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Services\SiklusSantriService;
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

    private const SORT_MUTASI = [
        'santri' => ['santri.nama_lengkap'],
        'tanggal' => ['mutasi_keluar.tanggal_mutasi'],
        'lembaga' => ['lembaga.kode'],
        'kelas' => ['kelas.nama_kelas'],
        'id' => ['mutasi_keluar.id'],
    ];

    private const SORT_ALUMNI = [
        'santri' => ['santri.nama_lengkap'],
        'tanggal' => ['alumni.tanggal_lulus'],
        'lembaga' => ['lembaga.kode'],
        'ta' => ['tahun_ajaran.nama'],
        'kelas' => ['kelas.nama_kelas'],
        'id' => ['alumni.id'],
    ];

    private const SORT_NULLABLE_ARSIP = [
        'mutasi_keluar.tanggal_mutasi', 'alumni.tanggal_lulus',
        'kelas.nama_kelas', 'tahun_ajaran.nama',
    ];

    public function __construct(private SiklusSantriService $siklusService) {}

    // ---------------- Salin genap ----------------

    /** POST /api/admin/akademik/salin-genap — massal per lembaga (partial per-item). */
    public function salinGenapMassal(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validate([
            'lembaga_id' => 'required|exists:lembaga,id',
            'tanggal_masuk' => 'required|date',
            'siswa' => 'nullable|array|min:1',
            'siswa.*.santri_id' => 'required|exists:santri,id',
            'siswa.*.kelas_id' => 'nullable|exists:kelas,id',
            'siswa.*.no_absen' => 'nullable|integer|min:1',
        ]);

        $lembagaId = (int) $data['lembaga_id'];
        $this->authorizeLembaga($request->user(), $lembagaId);
        $this->tolakLembagaRoot($lembagaId);
        $tanggal = (string) $data['tanggal_masuk'];

        $items = $data['siswa'] ?? RiwayatBelajar::where('lembaga_id', $lembagaId)
            ->where('semester', '1')->where('is_aktif', true)
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
            ->where('lembaga_id', $lembagaId)->where('is_aktif', true)
            ->latest('id')->first();
        if ($ganjil && (int) $kelas->tahun_ajaran_id !== (int) $ganjil->tahun_ajaran_id) {
            throw ValidationException::withMessages(['kelas_id' => 'Kelas beda tahun ajaran.']);
        }
    }

    // ---------------- Kenaikan / kelulusan ----------------

    /** POST /api/admin/akademik/naik-kelas — batch = 1 lembaga + 1 tahun + 1 tingkat. */
    public function naikKelasMassal(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validate([
            'lembaga_id' => 'required|exists:lembaga,id',
            'tahun_ajaran_baru_id' => 'required|exists:tahun_ajaran,id',
            'tingkat' => 'required|string',
            'siswa' => 'required|array|min:1',
            'siswa.*.santri_id' => 'required|exists:santri,id',
            'siswa.*.status' => 'required|in:naik,tidak_naik',
            'siswa.*.tgl_masuk' => 'nullable|date',
            'siswa.*.no_absen' => 'nullable|integer|min:1',
        ]);

        $lembagaId = (int) $data['lembaga_id'];
        $tahunBaruId = (int) $data['tahun_ajaran_baru_id'];
        $tingkat = (string) $data['tingkat'];
        $this->tolakLembagaRoot($lembagaId);
        $this->cekTaEfektif($lembagaId, $tahunBaruId, 'tahun_ajaran_baru_id');

        $ok = 0;
        $gagal = [];
        foreach ($data['siswa'] as $item) {
            try {
                $santri = Santri::findOrFail($item['santri_id']);
                $this->authorizeAksiLembaga($request, $santri, $lembagaId);
                $this->siklusService->prosesKenaikanPerSantri(
                    $santri,
                    $lembagaId,
                    $tahunBaruId,
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

    /** POST /api/admin/santri/{santri}/lulus — kelulusan per lembaga (+arsip alumni). */
    public function lulus(Request $request, Santri $santri): JsonResponse
    {
        $data = $request->validate([
            'lembaga_id' => 'required|exists:lembaga,id',
            'tahun_ajaran_lulus_id' => 'required|exists:tahun_ajaran,id',
            'tanggal_lulus' => 'required|date',
            'nomor_ijazah' => ['nullable', 'string'],
            'no_surat_ijazah' => ['nullable', 'string', 'max:50'],
            'kegiatan_setelah_lulus' => ['nullable', 'string'],
            'penyerahan_ijazah' => ['nullable', 'in:sudah,belum'],
            'melanjutkan' => ['nullable', 'in:ya,tidak'],
        ]);

        $this->tolakLembagaRoot((int) $data['lembaga_id']);
        $this->cekTaEfektif((int) $data['lembaga_id'], (int) $data['tahun_ajaran_lulus_id'], 'tahun_ajaran_lulus_id');
        $this->authorizeAksiLembaga($request, $santri, (int) $data['lembaga_id']);

        $alumni = $this->siklusService->prosesLulusPerLembaga($santri, (int) $data['lembaga_id'], $data);

        return response()->json([
            'pesan' => 'Santri dinyatakan lulus dan masuk data alumni.',
            'data' => $alumni,
        ]);
    }

    /** POST /api/admin/santri/{santri}/tidak-lulus — buka riwayat mengulang TA berikut. */
    public function tidakLulus(Request $request, Santri $santri): JsonResponse
    {
        $data = $request->validate(['lembaga_id' => 'required|exists:lembaga,id']);

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
    public function mutasiKeluar(Request $request, Santri $santri): JsonResponse
    {
        $data = $request->validate([
            'lembaga_id' => 'required|exists:lembaga,id',
            'tanggal_mutasi' => 'required|date',
            'alasan_mutasi' => 'required|string|max:100',
            'kelas_terakhir_id' => 'nullable|exists:kelas,id',
            'no_surat' => 'nullable|string|max:50',
            'nama_sekolah_tujuan' => 'nullable|string|max:255',
            'npsn_sekolah_tujuan' => 'nullable|string|max:20',
            'nsm_sekolah_tujuan' => 'nullable|string|max:30',
            'alamat_sekolah_tujuan' => 'nullable|string',
            'keterangan' => 'nullable|string',
        ]);

        $this->tolakLembagaRoot((int) $data['lembaga_id']);
        $this->authorizeAksiLembaga($request, $santri, (int) $data['lembaga_id']);

        $mutasi = $this->siklusService->prosesMutasiPerLembaga($santri, (int) $data['lembaga_id'], $data);

        return response()->json([
            'pesan' => 'Santri berhasil dimutasi keluar.',
            'data' => $mutasi,
        ]);
    }

    /** POST /api/admin/santri/{santri}/berhenti-jenjang — tutup satu jenjang (paket). */
    public function berhentiJenjang(Request $request, Santri $santri): JsonResponse
    {
        $data = $request->validate(['lembaga_id' => 'required|exists:lembaga,id']);

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
        $urut = $this->parseUrut($request, self::SORT_MUTASI);

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
        $urut = $this->parseUrut($request, self::SORT_ALUMNI);

        $alumni = Alumni::tenantScope()
            ->with(['santri:id,nama_lengkap,nisn', 'lembagaLulus:id,nama,kode', 'tahunAjaranLulus:id,nama', 'kelasLulus:id,nama_kelas'])
            ->when($request->filled('lembaga_id'), fn ($q) => $q->where('lembaga_lulus_id', $request->integer('lembaga_id')))
            ->when($request->filled('tahun_ajaran_lulus_id'), fn ($q) => $q->where('tahun_ajaran_lulus_id', $request->integer('tahun_ajaran_lulus_id')));
        if ($urut !== null) {
            $alumni->select('alumni.*')
                ->leftJoin('santri', 'santri.id', '=', 'alumni.santri_id')
                ->leftJoin('lembaga', 'lembaga.id', '=', 'alumni.lembaga_lulus_id')
                ->leftJoin('tahun_ajaran', 'tahun_ajaran.id', '=', 'alumni.tahun_ajaran_lulus_id')
                ->leftJoin('kelas', 'kelas.id', '=', 'alumni.kelas_lulus_id');
        }
        $this->terapkanUrut($alumni, $urut, [['alumni.id', 'turun']], self::SORT_NULLABLE_ARSIP);
        $alumni = $alumni->paginate($this->perPage($request));

        return response()->json($alumni);
    }

    /**
     * GET /api/admin/akademik/daftar-kelas — santri aktif pada TA (default TA aktif
     * lembaga) dan semester (default semester berjalan) — sumber halaman Daftar Kelas.
     */
    public function daftarKelas(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validate([
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
            'tahun_ajaran_id' => ['nullable', 'integer', 'exists:tahun_ajaran,id'],
            'semester' => ['nullable', 'in:1,2'],
            'kelas_id' => ['nullable', 'integer', 'exists:kelas,id'],
            'tingkat' => ['nullable', 'string'],
        ]);
        $lembagaId = (int) $data['lembaga_id'];
        $this->authorizeLembaga($request->user(), $lembagaId);

        $taId = isset($data['tahun_ajaran_id'])
            ? (int) $data['tahun_ajaran_id']
            : (int) (TahunAjaran::aktif($lembagaId)?->id ?? 0);
        if ($taId === 0) {
            return response()->json(['pesan' => 'Tahun ajaran aktif belum ada di lembaga ini.', 'data' => []]);
        }

        $semester = $data['semester'] ?? (string) (RiwayatBelajar::where('lembaga_id', $lembagaId)
            ->where('tahun_ajaran_id', $taId)->where('is_aktif', true)
            ->orderByDesc('semester')->value('semester') ?? '1');

        $query = RiwayatBelajar::with(['santri:id,nama_lengkap,jk', 'kelas:id,nama_kelas,tingkat'])
            ->where('lembaga_id', $lembagaId)
            ->where('tahun_ajaran_id', $taId)
            ->where('semester', $semester)
            ->where('is_aktif', true);

        if (! empty($data['kelas_id'])) {
            $query->where('kelas_id', (int) $data['kelas_id']);
        }
        if (! empty($data['tingkat'])) {
            $query->where('tingkat', $data['tingkat']);
        }

        $baris = $query->orderBy('kelas_id')->orderBy('no_absen')->orderBy('santri_id')->get();
        $peta = LembagaSantri::whereIn('santri_id', $baris->pluck('santri_id')->unique())
            ->where('lembaga_id', $lembagaId)
            ->pluck('nis_lokal', 'santri_id');
        $baris->each(fn ($r) => $r->setAttribute('nis_lokal', $peta[$r->santri_id] ?? null));

        return response()->json([
            'lembaga_id' => $lembagaId,
            'tahun_ajaran_id' => $taId,
            'semester' => $semester,
            'data' => $baris,
        ]);
    }

    /**
     * GET /api/admin/akademik/rekap-santri — rekap jumlah santri per tahun ajaran,
     * per tingkat, per kelas, plus usia per kelas.
     */
    public function rekapSantri(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validate([
            'lembaga_id' => ['nullable', 'integer', 'exists:lembaga,id'],
            'tahun_ajaran_id' => ['nullable', 'integer', 'exists:tahun_ajaran,id'],
        ]);

        $riwayatQuery = function () use ($request, $data) {
            $q = RiwayatBelajar::query()->where('is_aktif', true);
            $this->scopeLembaga($q, $request->user(), $request, 'lembaga_id');
            if (! empty($data['tahun_ajaran_id'])) {
                $q->where('tahun_ajaran_id', (int) $data['tahun_ajaran_id']);
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

        $kelasQuery = Kelas::query()->with(['lembaga:id,nama,kode', 'tahunAjaran:id,nama']);
        $this->scopeLembaga($kelasQuery, $request->user(), $request, 'lembaga_id');
        if (! empty($data['tahun_ajaran_id'])) {
            $kelasQuery->where('tahun_ajaran_id', (int) $data['tahun_ajaran_id']);
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
            ->selectRaw('tahun_ajaran_id, COUNT(*) as jumlah')
            ->groupBy('tahun_ajaran_id')
            ->with('tahunAjaran:id,nama')
            ->get()
            ->map(fn ($r) => [
                'tahun_ajaran_id' => (int) $r->tahun_ajaran_id,
                'tahun_ajaran' => $r->tahunAjaran?->nama,
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
            ->with(['kelas:id,nama_kelas,tingkat', 'lembaga:id,nama,kode', 'tahunAjaran:id,nama'])
            ->orderByDesc('id')->get();
        $mutasi = MutasiKeluar::where('santri_id', $santri->id)
            ->with(['lembaga:id,nama,kode', 'kelasTerakhir:id,nama_kelas'])
            ->orderByDesc('id')->get();
        $alumni = Alumni::where('santri_id', $santri->id)
            ->with(['lembagaLulus:id,nama,kode', 'tahunAjaranLulus:id,nama'])
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

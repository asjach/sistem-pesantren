<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\LembagaSantriStoreRequest;
use App\Http\Requests\Admin\LembagaSantriUpdateRequest;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Services\NisKemenagService;
use App\Services\PenerimaanService;
use App\Services\UrutKatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Keanggotaan santri per lembaga (`lembaga_santri`) — panel Buku Induk:
 * NIS lokal/kemenag, status aktif, tanggal mulai/selesai, generate NIS Kemenag.
 */
class LembagaSantriController extends Controller
{
    use TenantGuard;
    use UrutDaftar;

    /** Peta allowlist sort: nilai => kolom ORDER BY (berurutan bila lebih dari satu). */
    /** Kolom yang boleh NULL: NULL selalu di bawah (tak mengambang di atas). */
    private const SORT_NULLABLE = [
        'lembaga_santri.nis_lokal',
        'lembaga_santri.nis_kemenag',
        'lembaga_santri.tgl_masuk',
        'lembaga_santri.tgl_selesai',
        'lembaga.jenjang',
    ];

    /** GET /api/admin/lembaga-santri — daftar lintas santri (halaman Keanggotaan terpusat). */
    public function daftar(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $urut = $this->parseUrut($request, UrutKatalog::peta('keanggotaan'));

        $query = $this->scopeLembaga(
            LembagaSantri::with([
                'santri:id,nama_lengkap,jk',
                'lembaga:jenjang,nama',
            ]),
            $request->user(),
            $request,
            'lembaga_santri.jenjang'
        );

        if ($request->filled('jenjang')) {
            $query->where('lembaga_santri.jenjang', (string) $request->input('jenjang'));
        }
        if ($request->has('is_active_lembaga')) {
            $query->where('lembaga_santri.is_active_lembaga', $request->boolean('is_active_lembaga') ? LembagaSantri::YA : LembagaSantri::TIDAK);
        }
        if ($request->filled('tanpa_nis')) {
            $query->whereNull('lembaga_santri.nis_lokal');
        }
        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->whereHas('santri', fn ($qq) => $qq->where('nama_lengkap', 'like', "%{$s}%"))
                    ->orWhere('lembaga_santri.nis_lokal', 'like', "%{$s}%")
                    ->orWhere('lembaga_santri.nis_kemenag', 'like', "%{$s}%");
            });
        }

        $bawaan = [
            ['lembaga_santri.is_active_lembaga', 'turun'], ['lembaga_santri.id', 'turun'],
        ];
        // Join relasi hanya bila ada kunci urut (eksplisit atau bawaan) yang butuh.
        $kunciEfektif = ['kunci' => $urut !== null ? $urut['kunci'] : array_map(fn ($p) => $p[0], $bawaan)];
        $butuhSantri = $this->urutButuhAwalan($kunciEfektif, 'santri.');
        $butuhLembaga = $this->urutButuhAwalan($kunciEfektif, 'lembaga.');
        if ($butuhSantri || $butuhLembaga) {
            $query->select('lembaga_santri.*');
        }
        if ($butuhSantri) {
            $query->leftJoin('santri', 'santri.id', '=', 'lembaga_santri.santri_id');
        }
        if ($butuhLembaga) {
            $query->leftJoin('lembaga', 'lembaga.jenjang', '=', 'lembaga_santri.jenjang');
        }
        $this->terapkanUrut($query, $urut, $bawaan, self::SORT_NULLABLE);

        return response()->json(
            $query->paginate($this->perPage($request))
        );
    }

    /** True bila ada kunci sort memakai kolom berawalan $awalan (butuh join relasi). */
    protected function urutButuhAwalan(array $urut, string $awalan): bool
    {
        foreach ($urut['kunci'] as $kolom) {
            if (str_starts_with($kolom, $awalan)) {
                return true;
            }
        }

        return false;
    }

    /** GET /api/admin/santri/{santri}/lembaga — daftar keanggotaan santri. */
    public function index(Request $request, Santri $santri): JsonResponse
    {
        $this->authorize('view', $santri);

        return response()->json([
            'pesan' => 'Keanggotaan lembaga berhasil dimuat.',
            'data' => $santri->lembagaSantri()
                ->with('lembaga:jenjang,nama,nsm')
                ->orderByDesc('is_active_lembaga')
                ->orderBy('id')
                ->get(),
        ]);
    }

    /** POST /api/admin/santri/{santri}/lembaga — buat/aktifkan keanggotaan.
     *  Kolom di halaman Santri Per Jenjang: NIS lokal/kemenag, status aktif,
     *  tanggal masuk/selesai, konteks penerimaan, dan detail sekolah asal. */
    public function store(LembagaSantriStoreRequest $request, Santri $santri, PenerimaanService $penerimaan): JsonResponse
    {
        $this->authorize('update', $santri);

        $data = $request->validated();
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        $keanggotaan = DB::transaction(function () use ($santri, $data, $penerimaan) {
            // NIS lokal + konteks penerimaan lewat pintu tunggal penerimaan.
            $row = $penerimaan->pastikanKeanggotaan($santri, $data['jenjang'], [
                'nis_lokal' => $data['nis_lokal'] ?? null,
                'tgl_masuk' => $data['tgl_masuk'] ?? null,
                'tahaj_masuk' => $data['tahaj_masuk'] ?? null,
                'tingkat_masuk' => $data['tingkat_masuk'] ?? null,
                'no_urut' => $data['no_urut'] ?? null,
                'nama_sekolah_asal' => $data['nama_sekolah_asal'] ?? null,
                'npsn_sekolah_asal' => $data['npsn_sekolah_asal'] ?? null,
                'nss_sekolah_asal' => $data['nss_sekolah_asal'] ?? null,
                'alamat_sekolah_asal' => $data['alamat_sekolah_asal'] ?? null,
            ]);

            $tambahan = [];
            if (array_key_exists('nis_kemenag', $data)) {
                $tambahan['nis_kemenag'] = $this->nisKemenagBersih($data['jenjang'], $data['nis_kemenag'], (int) $row->id);
            }
            if (array_key_exists('tgl_selesai', $data)) {
                $tambahan['tgl_selesai'] = $data['tgl_selesai'] ?: null;
            }
            if (array_key_exists('is_active_lembaga', $data)) {
                $tambahan['is_active_lembaga'] = $data['is_active_lembaga'];
            }
            if ($tambahan !== []) {
                $row->update($tambahan);
            }

            return $row->fresh();
        });

        return response()->json(['pesan' => 'Keanggotaan lembaga disimpan.', 'data' => $keanggotaan], 201);
    }

    /** PATCH /api/admin/lembaga-santri/{lembagaSantri} — NIS/status/tanggal. */
    public function update(LembagaSantriUpdateRequest $request, LembagaSantri $lembagaSantri): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $lembagaSantri->jenjang);

        $data = $request->validated();

        if (array_key_exists('nis_lokal', $data)) {
            $nis = trim((string) $data['nis_lokal']) ?: null;
            if (LembagaSantri::nisLokalDipakai($lembagaSantri->jenjang, $nis, (int) $lembagaSantri->id)) {
                abort(422, 'NIS lokal sudah dipakai santri lain di lembaga ini.');
            }
            $data['nis_lokal'] = $nis;
        }

        if (array_key_exists('nis_kemenag', $data)) {
            $data['nis_kemenag'] = $this->nisKemenagBersih(
                $lembagaSantri->jenjang,
                $data['nis_kemenag'],
                (int) $lembagaSantri->id,
            );
        }

        $lembagaSantri->update($data);

        // Status aktif keanggotaan tidak otomatis mengubah riwayat; is_active_pst tetap turunan riwayat.

        return response()->json(['pesan' => 'Keanggotaan diperbarui.', 'data' => $lembagaSantri->fresh()]);
    }

    /**
     * NIS Kemenag manual: trim, kosong → null, wajib unik per lembaga.
     * (Generate otomatis lewat `generateNisk` tetap tersedia.)
     */
    protected function nisKemenagBersih(string $lembagaId, mixed $nis, ?int $kecualiId = null): ?string
    {
        $nilai = trim((string) $nis);
        $nilai = $nilai === '' ? null : $nilai;

        if ($nilai !== null && LembagaSantri::nisKemenagDipakai($lembagaId, $nilai, $kecualiId)) {
            abort(422, 'NIS Kemenag sudah dipakai santri lain di lembaga ini.');
        }

        return $nilai;
    }

    /** POST /api/admin/lembaga-santri/{lembagaSantri}/generate-nisk — NIS Kemenag manual. */
    public function generateNisk(Request $request, LembagaSantri $lembagaSantri, NisKemenagService $service): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $lembagaSantri->jenjang);

        $hasil = $service->generate($lembagaSantri);

        return response()->json([
            'pesan' => 'NIS Kemenag digenerate.',
            'data' => $hasil,
        ], 201);
    }

    /** POST /api/admin/lembaga-santri/generate-nisk-bulk — generate untuk semua
     *  baris cocok filter halaman. Dilewati: sudah ada NISK, NIS lokal kosong,
     *  dan lembaga MD. Kegagalan per baris dikumpulkan (maks 20) tanpa
     *  menggagalkan yang lain. */
    public function generateNiskBulk(Request $request, NisKemenagService $service): JsonResponse
    {
        $auth = $request->user();

        $query = $this->scopeLembaga(LembagaSantri::query(), $auth, $request);
        if ($request->filled('jenjang')) {
            $query->where('lembaga_santri.jenjang', (string) $request->input('jenjang'));
        }
        if ($request->has('is_active_lembaga')) {
            $query->where('lembaga_santri.is_active_lembaga', $request->boolean('is_active_lembaga') ? LembagaSantri::YA : LembagaSantri::TIDAK);
        }
        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->whereHas('santri', fn ($qq) => $qq->where('nama_lengkap', 'like', "%{$s}%"))
                    ->orWhere('lembaga_santri.nis_lokal', 'like', "%{$s}%")
                    ->orWhere('lembaga_santri.nis_kemenag', 'like', "%{$s}%");
            });
        }
        $query->whereNull('lembaga_santri.nis_kemenag')
            ->whereNotNull('lembaga_santri.nis_lokal')
            ->whereHas('lembaga', fn ($q) => $q->where('jenjang', '!=', 'MD'));

        $berhasil = 0;
        $dilewati = 0;
        $gagal = [];
        // Baris sudah dibatasi scopeLembaga ke lembaga yang boleh diakses user.
        $query->chunkById(200, function ($rows) use ($service, &$berhasil, &$dilewati, &$gagal) {
            foreach ($rows as $row) {
                try {
                    $service->generate($row);
                    $berhasil++;
                } catch (ValidationException $e) {
                    $dilewati++;
                    if (count($gagal) < 20) {
                        $gagal[] = [
                            'id' => $row->id,
                            'pesan' => collect($e->errors())->flatten()->first(),
                        ];
                    }
                }
            }
        });

        return response()->json([
            'pesan' => "NISK digenerate: {$berhasil} berhasil, {$dilewati} dilewati.",
            'data' => ['berhasil' => $berhasil, 'dilewati' => $dilewati, 'gagal' => $gagal],
        ]);
    }
}

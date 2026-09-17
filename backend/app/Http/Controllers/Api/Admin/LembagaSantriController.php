<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Services\NisKemenagService;
use App\Services\PenerimaanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Keanggotaan santri per lembaga (`lembaga_santri`) — panel Buku Induk:
 * NIS lokal/kemenag, status aktif, tanggal mulai/selesai, generate NIS Kemenag.
 */
class LembagaSantriController extends Controller
{
    use TenantGuard;

    /** Peta allowlist sort: nilai => kolom ORDER BY (berurutan bila lebih dari satu). */
    private const SORT_PETA = [
        'nama' => ['santri.nama_lengkap'],
        'jk' => ['santri.jk'],
        'lembaga' => ['lembaga.kode'],
        'nis_lokal' => ['lembaga_santri.nis_lokal'],
        'nis_kemenag' => ['lembaga_santri.nis_kemenag'],
        'aktif' => ['lembaga_santri.is_active'],
        'mulai' => ['lembaga_santri.tgl_mulai'],
        'selesai' => ['lembaga_santri.tgl_selesai'],
        'id' => ['lembaga_santri.id'],
    ];

    /** Kolom yang boleh NULL: NULL selalu di bawah (tak mengambang di atas). */
    private const SORT_NULLABLE = [
        'lembaga_santri.nis_lokal',
        'lembaga_santri.nis_kemenag',
        'lembaga_santri.tgl_mulai',
        'lembaga_santri.tgl_selesai',
        'lembaga.kode',
    ];

    /** GET /api/admin/lembaga-santri — daftar lintas santri (halaman Keanggotaan terpusat). */
    public function daftar(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $urut = $this->parseSort($request);

        $query = $this->scopeLembaga(
            LembagaSantri::with([
                'santri:id,nama_lengkap,jk',
                'lembaga:id,nama,kode',
            ]),
            $request->user(),
            $request
        );

        if ($urut !== null) {
            // Join hanya bila ada kunci sort relasi (hindari ambiguitas kolom).
            $butuhSantri = $this->sortButuhJoin($urut, 'santri.');
            $butuhLembaga = $this->sortButuhJoin($urut, 'lembaga.');
            if ($butuhSantri || $butuhLembaga) {
                $query->select('lembaga_santri.*');
            }
            if ($butuhSantri) {
                $query->leftJoin('santri', 'santri.id', '=', 'lembaga_santri.santri_id');
            }
            if ($butuhLembaga) {
                $query->leftJoin('lembaga', 'lembaga.id', '=', 'lembaga_santri.lembaga_id');
            }
        }

        if ($request->filled('lembaga_id')) {
            $query->where('lembaga_id', $request->integer('lembaga_id'));
        }
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }
        if ($request->filled('tanpa_nis')) {
            $query->whereNull('nis_lokal');
        }
        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->whereHas('santri', fn ($qq) => $qq->where('nama_lengkap', 'like', "%{$s}%"))
                    ->orWhere('nis_lokal', 'like', "%{$s}%")
                    ->orWhere('nis_kemenag', 'like', "%{$s}%");
            });
        }

        if ($urut === null) {
            $query->orderByDesc('is_active')->latest('id');
        } else {
            $metode = $urut['arah'] === 'naik' ? 'orderBy' : 'orderByDesc';
            foreach ($urut['kunci'] as $kolom) {
                if (in_array($kolom, self::SORT_NULLABLE, true)) {
                    $query->orderByRaw("{$kolom} IS NULL");
                }
                $query->{$metode}($kolom);
            }
        }

        return response()->json(
            $query->paginate($this->perPage($request))
        );
    }

    /**
     * Urai param sort+arah menjadi daftar kolom terurut.
     * Mengembalikan null bila tanpa sort (pakai urutan bawaan lama).
     *
     * @return array{kunci: string[], arah: string}|null
     */
    private function parseSort(Request $request): ?array
    {
        $mentah = $request->input('sort');
        if ($mentah === null || $mentah === '' || $mentah === []) {
            return null;
        }
        $daftar = is_array($mentah) ? $mentah : explode(',', (string) $mentah);
        $daftar = array_values(array_filter(array_map(fn ($v) => trim((string) $v), $daftar)));
        if ($daftar === []) {
            return null;
        }

        $request->validate(['arah' => ['nullable', Rule::in(['naik', 'turun'])]]);

        validator(
            ['sort' => $daftar],
            ['sort' => ['array', 'min:1', 'max:3'], 'sort.*' => [Rule::in(array_keys(self::SORT_PETA))]]
        )->validate();

        $kunci = [];
        foreach ($daftar as $nilai) {
            foreach (self::SORT_PETA[$nilai] as $kolom) {
                if (! in_array($kolom, $kunci, true)) {
                    $kunci[] = $kolom;
                }
            }
        }

        return ['kunci' => $kunci, 'arah' => $request->input('arah', 'naik')];
    }

    /** True bila ada kunci sort memakai kolom dari tabel relasi berawalan $awalan. */
    private function sortButuhJoin(array $urut, string $awalan): bool
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
                ->with('lembaga:id,nama,kode,nsm')
                ->orderByDesc('is_active')
                ->orderBy('id')
                ->get(),
        ]);
    }

    /** POST /api/admin/santri/{santri}/lembaga — buat/aktifkan keanggotaan. */
    public function store(Request $request, Santri $santri, PenerimaanService $penerimaan): JsonResponse
    {
        $this->authorize('update', $santri);

        $data = $request->validate([
            'lembaga_id' => ['required', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'nis_lokal' => ['nullable', 'string', 'max:20'],
            'tgl_mulai' => ['nullable', 'date'],
        ]);
        $this->authorizeLembaga($request->user(), (int) $data['lembaga_id']);

        $keanggotaan = $penerimaan->pastikanKeanggotaan($santri, (int) $data['lembaga_id'], [
            'nis_lokal' => $data['nis_lokal'] ?? null,
            'tgl_mulai' => $data['tgl_mulai'] ?? null,
        ]);

        return response()->json(['pesan' => 'Keanggotaan lembaga disimpan.', 'data' => $keanggotaan], 201);
    }

    /** PATCH /api/admin/lembaga-santri/{lembagaSantri} — NIS/status/tanggal. */
    public function update(Request $request, LembagaSantri $lembagaSantri): JsonResponse
    {
        $this->authorizeLembaga($request->user(), (int) $lembagaSantri->lembaga_id);

        $data = $request->validate([
            'nis_lokal' => ['sometimes', 'nullable', 'string', 'max:20'],
            'is_active' => ['sometimes', 'boolean'],
            'tgl_mulai' => ['sometimes', 'nullable', 'date'],
            'tgl_selesai' => ['sometimes', 'nullable', 'date'],
        ]);

        if (array_key_exists('nis_lokal', $data)) {
            $nis = trim((string) $data['nis_lokal']) ?: null;
            if (LembagaSantri::nisLokalDipakai((int) $lembagaSantri->lembaga_id, $nis, (int) $lembagaSantri->id)) {
                abort(422, 'NIS lokal sudah dipakai santri lain di lembaga ini.');
            }
            $data['nis_lokal'] = $nis;
        }

        $lembagaSantri->update($data);

        // Status aktif keanggotaan tidak otomatis mengubah riwayat; status_global tetap turunan riwayat.

        return response()->json(['pesan' => 'Keanggotaan diperbarui.', 'data' => $lembagaSantri->fresh()]);
    }

    /** POST /api/admin/lembaga-santri/{lembagaSantri}/generate-nisk — NIS Kemenag manual. */
    public function generateNisk(Request $request, LembagaSantri $lembagaSantri, NisKemenagService $service): JsonResponse
    {
        $this->authorizeLembaga($request->user(), (int) $lembagaSantri->lembaga_id);

        $hasil = $service->generate($lembagaSantri);

        return response()->json([
            'pesan' => 'NIS Kemenag digenerate.',
            'data' => $hasil,
        ], 201);
    }
}

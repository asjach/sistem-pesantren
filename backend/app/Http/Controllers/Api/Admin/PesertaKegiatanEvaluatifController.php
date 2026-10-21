<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PengaturanNomorPesertaRequest;
use App\Http\Requests\Admin\PesertaKegiatanEvaluatifGenerateRequest;
use App\Http\Requests\Admin\PesertaKegiatanEvaluatifIndexRequest;
use App\Http\Requests\Admin\PesertaKegiatanEvaluatifUbahRequest;
use App\Models\KegiatanEvaluatif;
use App\Models\Santri;
use App\Services\NomorPesertaService;
use Illuminate\Http\JsonResponse;

class PesertaKegiatanEvaluatifController extends Controller
{
    use TenantGuard;

    public function __construct(private readonly NomorPesertaService $nomorPeserta) {}

    public function index(PesertaKegiatanEvaluatifIndexRequest $request): JsonResponse
    {
        $data = $request->validated();
        $kegiatanEvaluatif = KegiatanEvaluatif::query()->with('lembaga:jenjang,nama,logo_url')->findOrFail($data['kegiatan_evaluatif_id']);
        $this->authorizeLembaga($request->user(), $kegiatanEvaluatif->jenjang);

        $peserta = $this->nomorPeserta->daftar(
            $kegiatanEvaluatif,
            $data['semester'],
            array_map('intval', $data['kelas_id'] ?? []),
            array_map('strval', $data['tingkat'] ?? []),
            trim((string) ($data['q'] ?? '')),
        );

        return response()->json([
            'kegiatan_evaluatif' => $kegiatanEvaluatif,
            'lembaga' => $kegiatanEvaluatif->lembaga,
            'pengaturan' => $this->nomorPeserta->pengaturan($kegiatanEvaluatif, $data['semester']),
            'token' => $this->nomorPeserta->tokenTersedia(),
            'peserta' => $peserta,
            'ringkasan' => [
                'total' => $peserta->count(),
                'belum_bernomor' => $peserta->whereNull('nomor_peserta')->count(),
                'manual' => $peserta->where('sumber_nomor', 'manual')->count(),
                'otomatis' => $peserta->where('sumber_nomor', 'otomatis')->count(),
            ],
        ]);
    }

    public function simpanPengaturan(PengaturanNomorPesertaRequest $request): JsonResponse
    {
        $data = $request->validated();
        $kegiatanEvaluatif = KegiatanEvaluatif::query()->findOrFail($data['kegiatan_evaluatif_id']);
        $this->authorizeLembaga($request->user(), $kegiatanEvaluatif->jenjang);

        $pengaturan = $this->nomorPeserta->simpanPengaturan(
            $kegiatanEvaluatif,
            $data['semester'],
            $data['template'],
            $data['mode_urutan'],
        );

        return response()->json([
            'pesan' => 'Pola nomor peserta disimpan.',
            'pengaturan' => $pengaturan,
        ]);
    }

    public function ubahNomor(PesertaKegiatanEvaluatifUbahRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();
        $kegiatanEvaluatif = KegiatanEvaluatif::query()->findOrFail($data['kegiatan_evaluatif_id']);
        $this->authorizeLembaga($request->user(), $kegiatanEvaluatif->jenjang);

        $peserta = $this->nomorPeserta->simpanManual(
            $kegiatanEvaluatif,
            $santri,
            $data['semester'],
            $data['nomor_peserta'],
        );

        return response()->json([
            'pesan' => $peserta === null ? 'Nomor peserta dikosongkan.' : 'Nomor peserta manual disimpan.',
            'peserta' => $peserta,
        ]);
    }

    public function generate(PesertaKegiatanEvaluatifGenerateRequest $request): JsonResponse
    {
        $data = $request->validated();
        $kegiatanEvaluatif = KegiatanEvaluatif::query()->findOrFail($data['kegiatan_evaluatif_id']);
        $this->authorizeLembaga($request->user(), $kegiatanEvaluatif->jenjang);

        $hasil = $this->nomorPeserta->buatNomor(
            $kegiatanEvaluatif,
            $data['semester'],
            $data['template'],
            $data['mode_urutan'],
            (bool) ($data['buat_ulang_otomatis'] ?? false),
        );

        return response()->json([
            'pesan' => "Nomor peserta dibuat untuk {$hasil['dibuat']} santri.",
            'hasil' => $hasil,
        ]);
    }
}

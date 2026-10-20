<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PengaturanNomorPesertaRequest;
use App\Http\Requests\Admin\PesertaPeristiwaGenerateRequest;
use App\Http\Requests\Admin\PesertaPeristiwaIndexRequest;
use App\Http\Requests\Admin\PesertaPeristiwaUbahRequest;
use App\Models\PeristiwaNilai;
use App\Models\Santri;
use App\Services\NomorPesertaService;
use Illuminate\Http\JsonResponse;

class PesertaPeristiwaController extends Controller
{
    use TenantGuard;

    public function __construct(private readonly NomorPesertaService $nomorPeserta) {}

    public function index(PesertaPeristiwaIndexRequest $request): JsonResponse
    {
        $data = $request->validated();
        $peristiwa = PeristiwaNilai::query()->with('lembaga:jenjang,nama,logo_url')->findOrFail($data['peristiwa_id']);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);

        $peserta = $this->nomorPeserta->daftar(
            $peristiwa,
            $data['semester'],
            array_map('intval', $data['kelas_id'] ?? []),
            array_map('strval', $data['tingkat'] ?? []),
            trim((string) ($data['q'] ?? '')),
        );

        return response()->json([
            'peristiwa' => $peristiwa,
            'lembaga' => $peristiwa->lembaga,
            'pengaturan' => $this->nomorPeserta->pengaturan($peristiwa, $data['semester']),
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
        $peristiwa = PeristiwaNilai::query()->findOrFail($data['peristiwa_id']);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);

        $pengaturan = $this->nomorPeserta->simpanPengaturan(
            $peristiwa,
            $data['semester'],
            $data['template'],
            $data['mode_urutan'],
        );

        return response()->json([
            'pesan' => 'Pola nomor peserta disimpan.',
            'pengaturan' => $pengaturan,
        ]);
    }

    public function ubahNomor(PesertaPeristiwaUbahRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();
        $peristiwa = PeristiwaNilai::query()->findOrFail($data['peristiwa_id']);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);

        $peserta = $this->nomorPeserta->simpanManual(
            $peristiwa,
            $santri,
            $data['semester'],
            $data['nomor_peserta'],
        );

        return response()->json([
            'pesan' => $peserta === null ? 'Nomor peserta dikosongkan.' : 'Nomor peserta manual disimpan.',
            'peserta' => $peserta,
        ]);
    }

    public function generate(PesertaPeristiwaGenerateRequest $request): JsonResponse
    {
        $data = $request->validated();
        $peristiwa = PeristiwaNilai::query()->findOrFail($data['peristiwa_id']);
        $this->authorizeLembaga($request->user(), $peristiwa->jenjang);

        $hasil = $this->nomorPeserta->buatNomor(
            $peristiwa,
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

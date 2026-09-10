<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PsbDaftarRequest;
use App\Models\PsbCalonSantri;
use App\Services\PsbGelombangService;
use App\Services\PsbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

class PsbPublikController extends Controller
{
    /** POST /api/psb/cek-nik (publik, throttle:5,1) -> {terdaftar: bool} SAJA. */
    public function cekNik(Request $request, PsbService $service): JsonResponse
    {
        $data = $request->validate([
            'nik' => ['required', 'digits:16'],
        ]);

        return response()->json(['terdaftar' => $service->cekNikTerdaftar($data['nik'])]);
    }

    /** POST /api/psb/daftar (publik, throttle:10,1). */
    public function store(PsbDaftarRequest $request, PsbService $service, PsbGelombangService $gelombang): JsonResponse
    {
        $data = $request->validated();
        $gelombang->cekBukaDanKuota((int) $data['gelombang_id'], (int) $data['lembaga_id']);

        $calon = $service->daftarPublik($data);

        return response()->json([
            'pesan' => 'Pendaftaran berhasil.',
            'data' => [
                'calon' => $calon->fresh(),
                'no_pendaftaran' => $calon->no_pendaftaran,
                'signedUrlBukti' => $this->signedBukti($calon->id),
            ],
        ], 201);
    }

    /** POST /api/psb/daftar-paket (publik, throttle:10,1, paket MI-MD atomik 2 baris). */
    public function storePaket(PsbDaftarRequest $request, PsbService $service, PsbGelombangService $gelombang): JsonResponse
    {
        $data = $request->validated();
        $gelombang->cekBukaDanKuota((int) $data['gelombang_id'], (int) $data['lembaga_id']);

        $hasil = $service->daftarPaket($data);

        return response()->json([
            'pesan' => $hasil['waiting']
                ? 'Pendaftaran paket berhasil (waiting list).'
                : 'Pendaftaran paket berhasil.',
            'data' => [
                'primer' => $hasil['primer'],
                'sekunder' => $hasil['sekunder'],
                'no_pendaftaran' => $hasil['primer']->no_pendaftaran,
                'waiting' => $hasil['waiting'],
                'signedUrlBukti' => $this->signedBukti($hasil['primer']->id),
            ],
        ], 201);
    }

    /**
     * GET /api/psb/{calon}/bukti-pdf (signed, expiry 7 hari).
     * SKIP PDF: spec §5 hanya menyebut "DomPDF kuitansi pendaftaran" tanpa isi/view
     * konkret + package dompdf tidak ada di composer — kembalikan JSON ringkasan.
     */
    public function bukti(PsbCalonSantri $calon): JsonResponse
    {
        $calon->load(['lembagaTujuan:id,nama,kode', 'gelombang:id,nama']);

        return response()->json([
            'pesan' => 'Ringkasan bukti pendaftaran.',
            'data' => [
                'no_pendaftaran' => $calon->no_pendaftaran,
                'nama_lengkap' => $calon->nama_lengkap,
                'nik' => $calon->nik,
                'lembaga' => $calon->lembagaTujuan,
                'gelombang' => $calon->gelombang,
                'tipe_santri' => $calon->tipe_santri,
                'status_pendaftaran' => $calon->status_pendaftaran,
                'tanggal_daftar' => $calon->tanggal_daftar,
            ],
        ]);
    }

    protected function signedBukti(int $calonId): string
    {
        return URL::signedRoute('psb.bukti-pdf', ['calon' => $calonId], now()->addDays(7));
    }
}

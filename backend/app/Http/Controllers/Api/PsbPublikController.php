<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PsbCekNikRequest;
use App\Http\Requests\PsbDaftarRequest;
use App\Models\Lembaga;
use App\Models\PsbCalonSantri;
use App\Models\PsbKuotaBiaya;
use App\Services\PsbGelombangService;
use App\Services\PsbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;

class PsbPublikController extends Controller
{
    /** POST /api/psb/cek-nik (publik, throttle:5,1) -> {terdaftar: bool} SAJA. */
    public function cekNik(PsbCekNikRequest $request, PsbService $service): JsonResponse
    {
        $data = $request->validated();

        return response()->json(['terdaftar' => $service->cekNikTerdaftar($data['nik'])]);
    }

    /**
     * GET /api/psb/opsi (publik, throttle:30,1) — gelombang aktif otomatis (pendaftar tidak memilih)
     * + lembaga yang dikonfigurasi di gelombang itu: kuota, matriks tingkat baru/pindahan.
     */
    public function opsi(PsbGelombangService $gelombang): JsonResponse
    {
        $gelombangAktif = $gelombang->gelombangAktif();
        if (! $gelombangAktif) {
            return response()->json([
                'pesan' => 'Tidak ada gelombang pendaftaran yang dibuka.',
                'data' => ['gelombang_aktif' => null, 'lembaga' => []],
            ]);
        }

        $lembagas = Lembaga::where('is_active', true)
            ->whereIn('jenjang', array_keys(PsbService::TINGKAT_MASUK_BARU))
            ->orderBy('jenjang')
            ->get(['jenjang', 'nama', 'nama_singkat', 'kelompok_psb', 'is_seleksi']);

        $kuotaSemua = PsbKuotaBiaya::where('gelombang_id', $gelombangAktif->id)
            ->whereIn('jenjang', $lembagas->pluck('jenjang'))
            ->get(['gelombang_id', 'jenjang', 'tipe_santri', 'paket_tersedia']);

        $dataLembaga = $lembagas
            ->map(function (Lembaga $l) use ($kuotaSemua, $gelombangAktif, $gelombang) {
                $rows = $kuotaSemua->where('jenjang', $l->jenjang);
                if ($rows->isEmpty()) {
                    return null;
                }

                return [
                    'id' => $l->jenjang,
                    'kode' => $l->jenjang,
                    'nama' => $l->nama,
                    'nama_singkat' => $l->nama_singkat,
                    'kelompok_psb' => $l->kelompok_psb,
                    'is_seleksi' => (bool) $l->is_seleksi,
                    'tingkat_baru' => PsbService::TINGKAT_MASUK_BARU[$l->jenjang] ?? null,
                    'tingkat_pindahan' => PsbService::TINGKAT_PINDAHAN[$l->jenjang] ?? [],
                    'kuota' => $rows->map(fn (PsbKuotaBiaya $k) => [
                        'tipe_santri' => $k->tipe_santri,
                        'paket_tersedia' => (bool) $k->paket_tersedia,
                        'sisa_kuota' => $gelombang->sisaKuota(
                            $gelombangAktif->id,
                            $l->jenjang,
                            $k->tipe_santri === 'semua' ? null : $k->tipe_santri
                        ),
                    ])->values(),
                ];
            })
            ->filter()
            ->values();

        return response()->json([
            'pesan' => 'Opsi pendaftaran dimuat.',
            'data' => [
                'gelombang_aktif' => [
                    'id' => $gelombangAktif->id,
                    'nama' => $gelombangAktif->nama,
                    'nomor' => $gelombangAktif->nomor,
                    'tgl_buka' => $gelombangAktif->tgl_buka?->toDateString(),
                    'tgl_tutup' => $gelombangAktif->tgl_tutup?->toDateString(),
                    'kegiatan' => $gelombangAktif->kegiatan?->only(['id', 'nama']),
                ],
                'lembaga' => $dataLembaga,
            ],
        ]);
    }

    /** POST /api/psb/daftar (publik, throttle:10,1). */
    public function store(PsbDaftarRequest $request, PsbService $service, PsbGelombangService $gelombang): JsonResponse
    {
        $data = $request->validated();
        $this->tolakLanjutanPublik($data);
        $this->pastikanGelombangAktif($data, $gelombang);

        $calon = $service->daftarPublik($data);

        return response()->json([
            'pesan' => $calon->status_pendaftaran === 'waiting_list'
                ? 'Pendaftaran berhasil (waiting list).'
                : 'Pendaftaran berhasil.',
            'data' => [
                'calon' => $calon->fresh(),
                'no_pendaftaran' => $calon->no_pendaftaran,
                'waiting' => $calon->status_pendaftaran === 'waiting_list',
                'signedUrlBukti' => $this->signedBukti($calon->id),
            ],
        ], 201);
    }

    /** POST /api/psb/daftar-paket (publik, throttle:10,1) — 1 calon + baris anak MI & MD. */
    public function storePaket(PsbDaftarRequest $request, PsbService $service, PsbGelombangService $gelombang): JsonResponse
    {
        $data = $request->validated();
        $data['paket'] = PsbService::PAKET_MI_MD['kode'];
        $this->tolakLanjutanPublik($data);
        $this->pastikanGelombangAktif($data, $gelombang);

        $calon = $service->daftarPublik($data);

        return response()->json([
            'pesan' => $calon->status_pendaftaran === 'waiting_list'
                ? 'Pendaftaran paket berhasil (waiting list).'
                : 'Pendaftaran paket berhasil.',
            'data' => [
                'calon' => $calon->fresh(),
                'no_pendaftaran' => $calon->no_pendaftaran,
                'waiting' => $calon->status_pendaftaran === 'waiting_list',
                'signedUrlBukti' => $this->signedBukti($calon->id),
            ],
        ], 201);
    }

    /**
     * GET /api/psb/{calon}/bukti-pdf (signed, expiry 7 hari).
     * Kembalikan JSON ringkasan (tanpa render PDF).
     */
    public function bukti(PsbCalonSantri $calon): JsonResponse
    {
        $calon->load(['lembagaTujuan:jenjang,nama', 'gelombang:id,nama']);

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

    protected function tolakLanjutanPublik(array $data): void
    {
        if (! empty($data['santri_asal_id'])) {
            throw ValidationException::withMessages([
                'santri_asal_id' => 'Pendaftaran lanjutan hanya tersedia melalui portal orang tua.',
            ]);
        }
    }

    /** Isi gelombang otomatis (aktif) lalu pastikan sedang buka; admin manual boleh override. */
    protected function pastikanGelombangAktif(array &$data, PsbGelombangService $gelombang): void
    {
        if (empty($data['gelombang_id'])) {
            $aktif = $gelombang->gelombangAktif();
            if (! $aktif) {
                throw ValidationException::withMessages(['gelombang_id' => 'Pendaftaran sedang ditutup: tidak ada gelombang yang sedang dibuka.']);
            }
            $data['gelombang_id'] = $aktif->id;
        }
        $gelombang->cekBukaDanKuota((int) $data['gelombang_id'], $data['jenjang']);
    }
}

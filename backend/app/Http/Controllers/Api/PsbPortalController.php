<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PsbLengkapiRequest;
use App\Models\PsbCalonSantri;
use App\Models\Santri;
use App\Models\User;
use App\Models\WaliSantriRelasi;
use App\Services\PsbGelombangService;
use App\Services\PsbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;

class PsbPortalController extends Controller
{
    /** PUT /api/portal/psb/{calon}/lengkapi — UPDATE baris sama (tahap 2). */
    public function lengkapi(PsbLengkapiRequest $request, PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->assertPemilik($request->user(), $calon);

        $hasil = $service->lengkapiDaftarUlang($calon->id, $request->validated());
        if ($hasil->foto_url) {
            $hasil->foto_link = Storage::url($hasil->foto_url);
        }

        return response()->json(['pesan' => 'Data tahap 2 tersimpan.', 'data' => $hasil]);
    }

    /** POST /api/portal/psb/{calon}/ajukan-daftar-ulang — cek pemilik + dokumen wajib di service. */
    public function ajukan(Request $request, PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        return response()->json([
            'pesan' => 'Pengajuan daftar ulang terkirim.',
            'data' => $service->ajukanDaftarUlang($calon->id, $request->user()),
        ], 201);
    }

    /**
     * POST /api/portal/psb/lanjutan — NIK terdaftar + login: pilih santri miliknya + jenjang.
     * Adaptasi: repo belum punya PsbService::daftarLanjutan, disusun dari
     * daftarPublik (pintu lanjutan via santri_asal_id) + cek relasi wali.
     */
    public function daftarLanjutan(Request $request, PsbService $service, PsbGelombangService $gelombang): JsonResponse
    {
        $data = $request->validate([
            'santri_id' => ['required', 'integer', 'exists:santri,id'],
            'gelombang_id' => ['nullable', 'integer', 'exists:psb_gelombang,id'], // kosong = gelombang aktif
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
        ]);

        $milik = WaliSantriRelasi::where('user_id', $request->user()->id)
            ->where('santri_id', $data['santri_id'])
            ->where('is_active', true)
            ->exists();
        if (! $milik) {
            abort(403, 'Santri ini bukan tanggungan akun Anda.');
        }

        if (empty($data['gelombang_id'])) {
            $aktif = $gelombang->gelombangAktif();
            if (! $aktif) {
                throw ValidationException::withMessages(['gelombang_id' => 'Pendaftaran sedang ditutup: tidak ada gelombang aktif.']);
            }
            $data['gelombang_id'] = $aktif->id;
        }
        $gelombang->cekBukaDanKuota((int) $data['gelombang_id'], (int) $data['lembaga_id']);

        $santri = Santri::findOrFail($data['santri_id']);
        $calon = $service->daftarPublik([
            'gelombang_id' => $data['gelombang_id'],
            'lembaga_id' => $data['lembaga_id'],
            'tipe_santri' => $santri->tipe_santri ?? 'non_asrama',
            'nik' => $santri->nik,
            'nama_lengkap' => $santri->nama_lengkap,
            'jk' => $santri->jk,
            'tgl_lahir' => $santri->tgl_lahir?->toDateString(),
            'email_ortu' => $request->user()->email,
            'telp_ortu' => $request->user()->phone,
            'santri_asal_id' => $santri->id,
        ]);

        return response()->json([
            'pesan' => 'Pendaftaran lanjutan berhasil.',
            'data' => [
                'calon' => $calon->fresh(),
                'no_pendaftaran' => $calon->no_pendaftaran,
                'signedUrlBukti' => URL::signedRoute('psb.bukti-pdf', ['calon' => $calon->id], now()->addDays(7)),
            ],
        ], 201);
    }

    /** GET /api/portal/psb/riwayat — pendaftaran milik ortu via email/telp/relasi. */
    public function riwayat(Request $request): JsonResponse
    {
        $user = $request->user();
        $santriIds = WaliSantriRelasi::where('user_id', $user->id)
            ->where('is_active', true)
            ->pluck('santri_id')->all();

        $adaKriteria = ($user->email && $user->email !== '')
            || ($user->phone && $user->phone !== '')
            || ! empty($santriIds);

        $list = collect();
        if ($adaKriteria) {
            $list = PsbCalonSantri::where(function ($q) use ($user, $santriIds) {
                $q->whereRaw('1 = 0');
                if ($user->email) {
                    $q->orWhere('email_ortu', $user->email);
                }
                if ($user->phone) {
                    $q->orWhere('telp_ortu', $user->phone);
                }
                if ($santriIds) {
                    $q->orWhereIn('santri_asal_id', $santriIds);
                }
            })
                ->with(['lembagaTujuan:id,nama,kode', 'gelombang:id,nama'])
                ->latest('id')
                ->get();
        }

        return response()->json(['pesan' => 'Riwayat pendaftaran berhasil dimuat.', 'data' => $list]);
    }

    /** GET /api/portal/santri/{santri}/riwayat-pembayaran — WHERE santri_id (pra+pasca ACC via backfill). */
    public function riwayatPembayaran(Request $request, Santri $santri): JsonResponse
    {
        $this->assertAnak($request->user()->id, $santri->id);

        $tagihan = \App\Models\Tagihan::where('santri_id', $santri->id)->latest('id')->get();
        $pembayaran = DB::table('pembayaran')->where('santri_id', $santri->id)->orderByDesc('id')->get();

        return response()->json([
            'pesan' => 'Riwayat pembayaran berhasil dimuat.',
            'data' => ['tagihan' => $tagihan, 'pembayaran' => $pembayaran],
        ]);
    }

    /** GET /api/portal/riwayat-keluarga — list anak -> klik detail. */
    public function riwayatKeluarga(Request $request): JsonResponse
    {
        $list = WaliSantriRelasi::where('user_id', $request->user()->id)
            ->where('is_active', true)
            ->with(['santri.lembaga:id,nama'])
            ->latest('id')
            ->get()
            ->pluck('santri')
            ->filter();

        return response()->json(['pesan' => 'Riwayat keluarga berhasil dimuat.', 'data' => $list]);
    }

    /**
     * Cek pemilik B5 (mirror PsbService::ajukanDaftarUlang): email_calon = email akun,
     * atau telp ternormalisasi sama, atau calon lanjutan tertaut relasi wali.
     * Service lengkapiDaftarUlang tidak enforce pemilik, jadi dicek di sini.
     */
    protected function assertPemilik(User $wali, PsbCalonSantri $calon): void
    {
        $milik = ($calon->email_ortu && $calon->email_ortu === $wali->email)
            || ($calon->telp_ortu && $this->normalTelp($calon->telp_ortu) === $this->normalTelp($wali->phone ?? ''))
            || ($calon->santri_asal_id && WaliSantriRelasi::where('user_id', $wali->id)
                ->where('santri_id', $calon->santri_asal_id)
                ->where('is_active', true)
                ->exists());
        if (! $milik) {
            abort(403, 'Calon ini bukan tanggungan akun Anda.');
        }
    }

    protected function assertAnak(int $userId, int $santriId): void
    {
        $milik = WaliSantriRelasi::where('user_id', $userId)
            ->where('santri_id', $santriId)
            ->where('is_active', true)
            ->exists();
        if (! $milik) {
            abort(403, 'Santri ini bukan tanggungan akun Anda.');
        }
    }

    protected function normalTelp(?string $telp): string
    {
        $t = preg_replace('/\D/', '', $telp ?? '');

        return preg_replace('/^(0|62)/', '62', $t);
    }
}

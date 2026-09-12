<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pembayaran;
use App\Models\Tagihan;
use App\Services\KeuanganService;
use Illuminate\Http\Request;

class KeuanganController extends Controller
{
    protected $keuanganService;

    public function __construct(KeuanganService $keuanganService)
    {
        $this->keuanganService = $keuanganService;
    }

    // List Tagihan Aktif Per Santri — cek tenant lembaga via policy.
    public function getTagihanSantri(Request $request, $santriId)
    {
        $santri = \App\Models\Santri::findOrFail($santriId);
        $contoh = Tagihan::where('santri_id', $santriId)->first();
        if ($contoh) {
            $this->authorize('view', $contoh);
        } else {
            // Belum ada tagihan: tenant via lembaga santri (tanpa pesantren_id).
            $actor = $request->user();
            if (! $actor->hasRole('super_admin') && ! $actor->isAdminFull()) {
                if (! $santri->lembaga_id || ! $actor->canAccessLembaga((int) $santri->lembaga_id)) abort(403);
            }
        }
        $tagihan = Tagihan::with('posKeuangan')
            ->where('santri_id', $santriId)
            ->whereIn('status', ['belum_bayar', 'mencicil'])
            ->latest('id')->get();

        return response()->json(['pesan' => 'Tagihan santri berhasil dimuat.', 'data' => $tagihan]);
    }

    // Generate Tagihan Bulanan Massal — satu batch satu lembaga.
    public function generateBulanan(Request $request)
    {
        $actor = $request->user();
        $data = $request->validate([
            'lembaga_id' => 'required|exists:lembaga,id',
            'tahun_ajaran_id' => 'required|exists:tahun_ajaran,id',
            'periode' => 'required|regex:/^\d{4}-\d{2}$/', // YYYY-MM
        ]);
        if (! $actor->hasRole('super_admin') && ! $actor->isAdminFull()) {
            $this->canLembaga($actor, (int) $data['lembaga_id']) || abort(403);
        }

        $hasil = $this->keuanganService->generateTagihanBulanan((int) $data['lembaga_id'], (int) $data['tahun_ajaran_id'], $data['periode']);

        return response()->json(['pesan' => "Generate selesai: {$hasil['berhasil']} tagihan.", 'data' => $hasil]);
    }

    // Transaksi Bayar / Cicil Tagihan (Kasir) — tenant via canAccessLembaga + policy per item.
    public function bayar(Request $request)
    {
        $actor = $request->user();
        $data = $request->validate([
            'akun_kas_id' => 'required|exists:akun_kas,id',
            'total_bayar' => 'required|numeric|min:1',
            'metode_pembayaran' => 'required|string|max:50', // ref_metode_pembayaran (tunai/transfer/va/qris)
            'items' => 'required|array|min:1',
            'items.*.tagihan_id' => 'required|exists:tagihan,id',
            'items.*.nominal_dibayar' => 'required|numeric|min:1',
            'tgl_pembayaran' => 'nullable|date',
            'catatan' => 'nullable|string',
            'santri_id' => 'nullable|exists:santri,id',
            'psb_calon_santri_id' => 'nullable|exists:psb_calon_santri,id',
            'client_op_id' => 'nullable|string|max:64', // Opsi B: kunci idempoten kirim-ulang
        ]);
        $data['user_id'] = $actor->id;
        // Validasi kamus: metode + kategori kas via RefService efektif (fallback string bebas bila ragu).
        try {
            if (class_exists(\App\Services\RefService::class)) {
                $lembagaKas = \App\Models\AkunKas::findOrFail($data['akun_kas_id'])->lembaga_id;
                $daftar = array_merge(
                    \App\Services\RefService::kodeAktif('metode_pembayaran', $lembagaKas ? (int) $lembagaKas : null),
                    \App\Services\RefService::kodeAktif('metode_pembayaran', null)
                );
                if (! in_array($data['metode_pembayaran'], $daftar, true)) abort(422, 'Metode pembayaran tidak dikenal.');
            }
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            throw $e;
        } catch (\Throwable $e) {
            // Ragu (kamus tidak tersedia) → string bebas max 50 (sudah divalidasi di atas).
        }
        // Kasir hanya kas lembaganya; kas pusat (lembaga_id null) hanya admin full.
        $kas = \App\Models\AkunKas::findOrFail($data['akun_kas_id']);
        if (! $actor->hasRole('super_admin') && ! $actor->isAdminFull()) {
            if (is_null($kas->lembaga_id) || ! $this->canLembaga($actor, (int) $kas->lembaga_id)) abort(403, 'Kas di luar lembaga Anda.');
        }
        foreach ($data['items'] as $item) {
            $this->authorize('bayar', Tagihan::findOrFail($item['tagihan_id']));
        }
        if (! $actor->hasRole('super_admin') && ! $actor->isAdminFull()) {
            $data['tenant_lembaga_ids'] = $actor->lembagaIds();
        }

        $pembayaran = $this->keuanganService->bayarTagihan($data);

        return response()->json(['pesan' => 'Pembayaran berhasil diproses.', 'data' => $pembayaran], 201);
    }

    // Void pembayaran (admin only).
    public function void(Request $request, Pembayaran $pembayaran)
    {
        $this->authorize('update', $pembayaran);
        $data = $request->validate(['alasan' => 'required|string']);

        return response()->json([
            'pesan' => 'Pembayaran berhasil di-void.',
            'data' => $this->keuanganService->voidPembayaran($pembayaran, $request->user()->id, $data['alasan']),
        ]);
    }

    // Choke point tenant: alias resmi canAccessLembaga (admin full/super_admin semua).
    protected function canLembaga($actor, int $lembagaId): bool
    {
        if ($actor->hasRole('super_admin') || $actor->isAdminFull()) return true;

        return $actor->canAccessLembaga($lembagaId);
    }
}

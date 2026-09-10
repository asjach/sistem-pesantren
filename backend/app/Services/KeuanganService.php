<?php

namespace App\Services;

use App\Models\Lembaga;
use App\Models\PosKeuangan;
use App\Models\PsbCalonSantri;
use App\Models\PsbKuotaBiaya;
use App\Models\Santri;
use App\Models\Tagihan;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * KeuanganService MINIMAL untuk jahitan PSB (Modul 100).
 *
 * Hanya berisi 2 method pendaftaran/masuk. Bayar/kuitansi/void = scope 103-tx,
 * JANGAN ditambahkan di sini.
 */
class KeuanganService
{
    /**
     * Tagihan pendaftaran PSB (pos PSB_REG).
     *
     * Idempoten per calon: bila tagihan pendaftaran untuk calon+pos sudah ada,
     * kembalikan baris yang ada (skip, tanpa insert ganda).
     */
    public function createTagihanPendaftaranPsb(PsbCalonSantri $calon, float $nominal, int $tahunAjaranId): Tagihan
    {
        $pos = PosKeuangan::where('kode_pos', 'PSB_REG')->first();
        if (! $pos) {
            throw ValidationException::withMessages([
                'pos_keuangan' => 'Pos keuangan PSB_REG belum dibuat. Admin harus membuat pos pendaftaran terlebih dahulu.',
            ]);
        }

        return DB::transaction(function () use ($calon, $nominal, $tahunAjaranId, $pos) {
            $ada = Tagihan::where('psb_calon_santri_id', $calon->id)
                ->where('pos_keuangan_id', $pos->id)
                ->lockForUpdate()
                ->first();
            if ($ada) {
                return $ada;
            }

            $usaha = 0;
            while (true) {
                try {
                    $tagihan = Tagihan::create([
                        'no_tagihan' => $this->generateNoTagihan((int) $calon->lembaga_id),
                        'santri_id' => null,
                        'psb_calon_santri_id' => $calon->id,
                        'pos_keuangan_id' => $pos->id,
                        'tahun_ajaran_id' => $tahunAjaranId,
                        'lembaga_id' => $calon->lembaga_id,
                        'periode' => null,
                        'paket_kode' => $calon->paket_grup_id ? 'MI-MD' : null,
                        'nominal_total' => $nominal,
                        'nominal_terbayar' => 0,
                        'sisa_tagihan' => $nominal,
                        'status' => 'belum_bayar',
                    ]);

                    return $tagihan->fresh();
                } catch (QueryException $e) {
                    if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) {
                        throw $e;
                    }
                }
            }
        });
    }

    /**
     * Tagihan masuk/daftar ulang PSB (pos DFR_ULANG).
     *
     * Nominal dari nominal_masuk kuota primer (exact tipe dulu, fallback 'semua';
     * tanpa baris kuota = 0). Idempoten per santri+pos: bila sudah ada,
     * kembalikan baris yang ada.
     *
     * Paket: panggil HANYA untuk baris primer (accPaket menjamin ini).
     * Bila baris sekunder yang masuk, kembalikan null (sekunder gratis,
     * tanpa tagihan).
     */
    public function createTagihanMasukPsb(PsbCalonSantri $calon, Santri $santri): ?Tagihan
    {
        $pos = PosKeuangan::where('kode_pos', 'DFR_ULANG')->first();
        if (! $pos) {
            throw ValidationException::withMessages([
                'pos_keuangan' => 'Pos keuangan DFR_ULANG belum dibuat. Admin harus membuat pos daftar ulang terlebih dahulu.',
            ]);
        }

        if ($calon->paket_grup_id && ! $this->isPrimerPaket($calon)) {
            return null;
        }

        return DB::transaction(function () use ($calon, $santri, $pos) {
            $ada = Tagihan::where('santri_id', $santri->id)
                ->where('pos_keuangan_id', $pos->id)
                ->whereNull('periode')
                ->lockForUpdate()
                ->first();
            if ($ada) {
                return $ada;
            }

            $nominal = $this->nominalMasuk($calon);

            $usaha = 0;
            while (true) {
                try {
                    $tagihan = Tagihan::create([
                        'no_tagihan' => $this->generateNoTagihan((int) $calon->lembaga_id),
                        'santri_id' => $santri->id,
                        'psb_calon_santri_id' => $calon->id,
                        'pos_keuangan_id' => $pos->id,
                        'tahun_ajaran_id' => $calon->tahun_ajaran_id,
                        'lembaga_id' => $calon->lembaga_id,
                        'periode' => null,
                        'paket_kode' => $calon->paket_grup_id ? 'MI-MD' : null,
                        'nominal_total' => $nominal,
                        'nominal_terbayar' => 0,
                        'sisa_tagihan' => $nominal,
                        'status' => 'belum_bayar',
                    ]);

                    return $tagihan->fresh();
                } catch (QueryException $e) {
                    if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) {
                        throw $e;
                    }
                }
            }
        });
    }

    /**
     * Baris paket primer = lembaga berkode MI (selaras PsbService::PAKET_MI_MD).
     * Dibaca dari kolom kode agar KeuanganService tidak bergantung ke PsbService.
     */
    protected function isPrimerPaket(PsbCalonSantri $calon): bool
    {
        $lembaga = Lembaga::find($calon->lembaga_id);

        return $lembaga && strtoupper((string) ($lembaga->kode ?? '')) === 'MI';
    }

    /**
     * Nominal masuk dari kuota baris calon (exact tipe dulu, fallback 'semua').
     */
    protected function nominalMasuk(PsbCalonSantri $calon): float
    {
        $kuota = PsbKuotaBiaya::where('gelombang_id', $calon->gelombang_id)
            ->where('lembaga_id', $calon->lembaga_id)
            ->where('tipe_santri', $calon->tipe_santri)
            ->first()
            ?? PsbKuotaBiaya::where('gelombang_id', $calon->gelombang_id)
                ->where('lembaga_id', $calon->lembaga_id)
                ->where('tipe_santri', 'semua')
                ->first();

        return $kuota ? (float) $kuota->nominal_masuk : 0.0;
    }

    /**
     * Format: TGH_{tahun}_{kodeLembaga}_{seq4}; seq reset per (lembaga, tahun).
     * Caller WAJIB catch QueryException 1062 lalu regenerate (maks 3x).
     */
    protected function generateNoTagihan(int $lembagaId): string
    {
        $lembaga = Lembaga::findOrFail($lembagaId);
        $kode = strtoupper((string) ($lembaga->kode ?: ($lembaga->jenjang ?: $lembagaId)));
        $tahun = date('Y');
        $seq = Tagihan::where('lembaga_id', $lembagaId)
            ->whereYear('created_at', $tahun)
            ->lockForUpdate()
            ->count() + 1;

        return sprintf('TGH_%s_%s_%04d', $tahun, $kode, $seq);
    }
}

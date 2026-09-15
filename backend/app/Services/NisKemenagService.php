<?php

namespace App\Services;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use Illuminate\Validation\ValidationException;

/**
 * NIS Kemenag (`lembaga_santri.nis_kemenag`) — digenerate MANUAL dari halaman
 * Buku Induk dengan pola:
 *
 *   NSM (12 digit lembaga) + YY (2 digit tahun diterima) + 4 digit terakhir nis_lokal
 *
 * Contoh: NSM 123456789012, TA 2026/2027, nis_lokal "26001" → 123456789012266001
 *
 * Syarat: `nis_lokal` terisi dan NSM lembaga valid (12 digit). Bila belum,
 * nis_kemenag dibiarkan NULL. Unik per lembaga.
 */
class NisKemenagService
{
    /** Generate NISK untuk satu baris keanggotaan; return baris ter-update. */
    public function generate(LembagaSantri $lembagaSantri): LembagaSantri
    {
        $nisLokal = trim((string) $lembagaSantri->nis_lokal);
        if ($nisLokal === '') {
            throw ValidationException::withMessages([
                'nis_lokal' => 'Isi NIS lokal dulu sebelum generate NIS Kemenag.',
            ]);
        }

        $lembaga = Lembaga::find($lembagaSantri->lembaga_id);
        $nsm = preg_replace('/\D/', '', (string) ($lembaga->nsm ?? ''));
        if (strlen($nsm) !== 12) {
            throw ValidationException::withMessages([
                'nsm' => 'NSM lembaga belum valid (butuh 12 digit) — lengkapi data lembaga dulu.',
            ]);
        }

        $yy = $this->tahunDiterimaYY((int) $lembagaSantri->santri_id, (int) $lembagaSantri->lembaga_id, $lembagaSantri->tgl_mulai?->format('Y'));
        if ($yy === null) {
            throw ValidationException::withMessages([
                'nis_kemenag' => 'Tahun diterima belum diketahui — isi riwayat belajar atau tanggal mulai keanggotaan.',
            ]);
        }

        $urut = str_pad(substr($nisLokal, -4), 4, '0', STR_PAD_LEFT);
        $nisKemenag = $nsm.$yy.$urut;

        if (LembagaSantri::nisKemenagDipakai((int) $lembagaSantri->lembaga_id, $nisKemenag, (int) $lembagaSantri->id)) {
            throw ValidationException::withMessages([
                'nis_kemenag' => "NIS Kemenag {$nisKemenag} sudah dipakai santri lain di lembaga ini. Sesuaikan 4 digit akhir NIS lokal.",
            ]);
        }

        $lembagaSantri->update(['nis_kemenag' => $nisKemenag]);

        return $lembagaSantri->fresh();
    }

    /**
     * Dua digit tahun diterima: dari riwayat semester 1 paling awal (nama TA
     * "2026/2027" → "26"); fallback tahun `tgl_mulai`.
     */
    protected function tahunDiterimaYY(int $santriId, int $lembagaId, ?string $tglMulaiTahun): ?string
    {
        $riwayat = RiwayatBelajar::where('santri_id', $santriId)
            ->where('lembaga_id', $lembagaId)
            ->where('semester', '1')
            ->with('tahunAjaran:id,nama,tanggal_mulai')
            ->orderBy('tahun_ajaran_id')
            ->first();

        $namaTa = $riwayat?->tahunAjaran?->nama;
        $tahun = null;
        if (is_string($namaTa) && preg_match('/(\d{4})/', $namaTa, $m) === 1) {
            $tahun = $m[1];
        } elseif ($riwayat?->tahunAjaran?->tanggal_mulai) {
            $tahun = $riwayat->tahunAjaran->tanggal_mulai->format('Y');
        } elseif ($tglMulaiTahun !== null) {
            $tahun = $tglMulaiTahun;
        }

        return $tahun !== null ? substr($tahun, -2) : null;
    }
}

<?php

namespace App\Services;

use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbKuotaBiaya;
use Illuminate\Validation\ValidationException;

class PsbGelombangService
{
    public function cekBukaDanKuota(int $gelombangId, int $lembagaId): void
    {
        $gelombang = PsbGelombang::findOrFail($gelombangId);
        $hariIni = now()->toDateString();
        $buka = $gelombang->tgl_buka ? $gelombang->tgl_buka->toDateString() : null;
        $tutup = $gelombang->tgl_tutup ? $gelombang->tgl_tutup->toDateString() : null;
        if ($buka && $hariIni < $buka) {
            throw ValidationException::withMessages(['gelombang_id' => 'Pendaftaran belum dibuka.']);
        }
        if ($tutup && $hariIni > $tutup) {
            throw ValidationException::withMessages(['gelombang_id' => 'Pendaftaran sudah ditutup.']);
        }
        // Kuota dihitung saat INPUT per-tipe; waiting_list tidak memakan kursi (lihat kuotaPenuh di PsbService).
    }

    public function sisaKuota(int $gelombangId, int $lembagaId, ?string $tipeSantri = null): ?int
    {
        $q = PsbKuotaBiaya::where('gelombang_id', $gelombangId)->where('lembaga_id', $lembagaId);
        $kuota = $tipeSantri
            ? (clone $q)->whereIn('tipe_santri', [$tipeSantri, 'semua'])->sum('kuota')
            : $q->sum('kuota');
        if (! $kuota) {
            return null; // kuota null = tanpa batas
        }
        $terpakai = PsbCalonSantri::where('gelombang_id', $gelombangId)
            ->where('lembaga_id', $lembagaId)
            ->when($tipeSantri, fn ($qq) => $qq->where('tipe_santri', $tipeSantri))
            ->whereNotIn('status_pendaftaran', ['ditolak', 'tidak_lolos', 'waiting_list'])
            ->count();

        return max(0, (int) $kuota - $terpakai);
    }
}

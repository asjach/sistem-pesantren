<?php

namespace App\Services;

use App\Models\Lembaga;
use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbKuotaBiaya;
use Illuminate\Validation\ValidationException;

class PsbGelombangService
{
    public function cekBukaDanKuota(int $gelombangId, int $lembagaId): void
    {
        $gelombang = PsbGelombang::findOrFail($gelombangId);
        if (! $gelombang->is_aktif) {
            throw ValidationException::withMessages(['gelombang_id' => 'Gelombang pendaftaran tidak aktif.']);
        }
        $hariIni = now()->toDateString();
        $buka = $gelombang->tgl_buka ? $gelombang->tgl_buka->toDateString() : null;
        $tutup = $gelombang->tgl_tutup ? $gelombang->tgl_tutup->toDateString() : null;
        if ($buka && $hariIni < $buka) {
            throw ValidationException::withMessages(['gelombang_id' => 'Pendaftaran belum dibuka.']);
        }
        if ($tutup && $hariIni > $tutup) {
            throw ValidationException::withMessages(['gelombang_id' => 'Pendaftaran sudah ditutup.']);
        }
        // Kuota dihitung saat INPUT per kelompok PSB; waiting_list tidak memakan kursi (lihat sisaKuota).
    }

    /**
     * Gelombang yang sedang aktif (kegiatan aktif + tanggal hari ini dalam rentang).
     * Tanpa $kegiatanId, kegiatan aktif tunggal dipakai (aturan satu kegiatan aktif).
     */
    public function gelombangAktif(?int $kegiatanId = null): ?PsbGelombang
    {
        $hariIni = now()->toDateString();
        $q = PsbGelombang::query()
            ->where('is_aktif', true)
            ->whereHas('kegiatan', fn ($qq) => $qq->where('is_aktif', true))
            ->where(fn ($qq) => $qq->whereNull('tgl_buka')->orWhere('tgl_buka', '<=', $hariIni))
            ->where(fn ($qq) => $qq->whereNull('tgl_tutup')->orWhere('tgl_tutup', '>=', $hariIni));
        if ($kegiatanId) {
            $q->where('psb_kegiatan_id', $kegiatanId);
        }

        return $q->orderBy('psb_kegiatan_id')->orderBy('nomor')->first();
    }

    /** Tolak rentang gelombang yang tumpang tindih dalam kegiatan yang sama. */
    public function validasiRentang(?int $kegiatanId, ?string $buka, ?string $tutup, ?int $ignoreId = null): void
    {
        if (! $kegiatanId || ! $buka || ! $tutup) {
            return;
        }
        if ($buka > $tutup) {
            throw ValidationException::withMessages(['tgl_tutup' => 'Tanggal tutup harus setelah tanggal buka.']);
        }
        $bentrok = PsbGelombang::where('psb_kegiatan_id', $kegiatanId)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->whereNotNull('tgl_buka')
            ->whereNotNull('tgl_tutup')
            ->where(fn ($q) => $q->where('tgl_buka', '<=', $tutup)->where('tgl_tutup', '>=', $buka))
            ->first();
        if ($bentrok) {
            throw ValidationException::withMessages([
                'tgl_buka' => "Rentang bertabrakan dengan gelombang lain ({$bentrok->nama}: " . $bentrok->tgl_buka?->toDateString() . ' s.d. ' . $bentrok->tgl_tutup?->toDateString() . ').',
            ]);
        }
    }

    /**
     * Sisa kuota POOL GABUNGAN per kelompok PSB (root PRD: kuota digabung MI/MD/MI-MD).
     * Angka pool dibaca dari baris psb_kuota_biaya lembaga PRIMER kelompok (combo_mi_md -> MI).
     * Pemakaian = calon aktif yang punya baris lembaga di kelompok tsb (distinct calon, 1 calon = 1 baris).
     * null = tanpa batas (kuota kosong/0).
     */
    public function sisaKuota(int $gelombangId, int $lembagaId, ?string $tipeSantri = null): ?int
    {
        $lembaga = Lembaga::find($lembagaId);
        if (! $lembaga || ! $lembaga->kelompok_psb) {
            return null;
        }
        $combo = $lembaga->kelompok_psb === PsbService::KELOMPOK_COMBO;
        $primer = $combo
            ? (Lembaga::where('kode', PsbService::PAKET_MI_MD['primer'])->first() ?? $lembaga)
            : $lembaga;
        $q = PsbKuotaBiaya::where('gelombang_id', $gelombangId)->where('lembaga_id', $primer->id);
        $kuota = $tipeSantri
            ? (clone $q)->whereIn('tipe_santri', [$tipeSantri, 'semua'])->sum('kuota')
            : $q->sum('kuota');
        if (! $kuota) {
            return null;
        }

        $anggotaIds = $combo
            ? Lembaga::whereIn('kode', PsbService::PAKET_MI_MD['anggota'])->pluck('id')->all()
            : [$lembaga->id];
        $terpakai = PsbCalonSantri::where('gelombang_id', $gelombangId)
            ->whereHas('lembagaDetail', fn ($qq) => $qq->whereIn('lembaga_id', $anggotaIds))
            ->when($tipeSantri, fn ($qq) => $qq->where('tipe_santri', $tipeSantri))
            ->whereNotIn('status_pendaftaran', ['ditolak', 'tidak_lolos', 'waiting_list'])
            ->count();

        return max(0, (int) $kuota - $terpakai);
    }
}

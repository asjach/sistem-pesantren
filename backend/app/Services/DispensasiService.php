<?php

namespace App\Services;

use App\Models\Dispensasi;
use App\Models\DispensasiAturan;
use Illuminate\Support\Collection;

/**
 * Aturan dispensasi: pencocokan penerima (pivot `santri_dispensasi`)
 * dan penerapan akumulatif urut id ke nominal tagihan.
 */
class DispensasiService
{
    /**
     * Saring dispensasi yang berlaku untuk satu santri: santri tercatat
     * di pivot penerima. Relasi `santriTambahan` sebaiknya eager-loaded.
     *
     * @param  Collection<int, Dispensasi>  $daftar
     * @return Collection<int, Dispensasi>
     */
    public function saring(Collection $daftar, int $santriId): Collection
    {
        return $daftar->filter(function (Dispensasi $d) use ($santriId) {
            $ids = $d->santri_ids ?? [];

            return in_array($santriId, $ids, true);
        })->values();
    }

    /**
     * Terapkan akumulatif urut id: tiap dispensasi menyumbang aturannya
     * untuk jenis tagihan ini (`jenis_id` null = semua jenis; spesifik
     * menang bila keduanya ada). Persen memotong sisanya, nominal
     * mengurangi langsung, bebas menihilkan; hasil akhir min 0.
     * Hanya dispensasi yang aturannya cocok yang tercatat di `ids`.
     *
     * @param  Collection<int, Dispensasi>  $cocok
     * @return array{nominal: int, potongan: int, ids: list<int>}
     */
    public function terapkan(int $nominalAwal, Collection $cocok, int $jenisId): array
    {
        $urut = $cocok->sortBy('id')->values();
        $nominal = $nominalAwal;
        $ids = [];
        foreach ($urut as $d) {
            $aturan = $this->aturanUntukJenis($d, $jenisId);
            if ($aturan === null) {
                continue;
            }
            $nominal = match ($aturan->tipe) {
                'persen' => (int) floor($nominal * (100 - min(100, max(0, $aturan->nilai))) / 100),
                'bebas' => 0,
                default => max(0, $nominal - max(0, $aturan->nilai)),
            };
            $ids[] = (int) $d->id;
        }

        return [
            'nominal' => $nominal,
            'potongan' => max(0, $nominalAwal - $nominal),
            'ids' => $ids,
        ];
    }

    /**
     * Gabung dua daftar paket per grup: `$utama` menang dalam grupnya,
     * daftar pertama menang bila se-grup ganda (termasuk di dalam
     * `$utama` sendiri — menormalkan jejak legacy). Grup null selalu
     * digabung. Generate memakai (menempel, berlaku),
     * Ubah memakai (diminta, menempel).
     *
     * @param  Collection<int, Dispensasi>  $utama
     * @param  Collection<int, Dispensasi>  $lawan
     * @return Collection<int, Dispensasi>
     */
    public function selaraskan(Collection $utama, Collection $lawan): Collection
    {
        $grupMenang = [];
        $hasil = collect();
        foreach ([$utama, $lawan] as $daftar) {
            foreach ($daftar as $d) {
                if ($hasil->contains('id', $d->id)) {
                    continue;
                }
                if ($d->grup !== null && isset($grupMenang[$d->grup])) {
                    continue;
                }
                $hasil->push($d);
                if ($d->grup !== null) {
                    $grupMenang[$d->grup] = true;
                }
            }
        }

        return $hasil->values();
    }

    /**
     * Aturan satu dispensasi untuk satu jenis: spesifik (`jenis_id` = jenis)
     * menang atas umum (`jenis_id` null); null bila tak ada yang cocok.
     * Publik untuk validasi eksplisit di ubah-tagihan (dipakai juga di
     * dalam `terapkan`).
     */
    public function aturanUntukJenis(Dispensasi $d, int $jenisId): ?DispensasiAturan
    {
        $daftar = $d->relationLoaded('aturan') ? $d->aturan : $d->aturan()->get();
        $umum = null;
        foreach ($daftar as $a) {
            if ($a->jenis_id === null) {
                $umum ??= $a;
            } elseif ((int) $a->jenis_id === $jenisId) {
                return $a;
            }
        }

        return $umum;
    }
}

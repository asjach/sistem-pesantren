<?php

namespace App\Services;

use App\Models\Dispensasi;
use Illuminate\Support\Collection;

/**
 * Aturan dispensasi: pencocokan target (kriteria akademik / santri tambahan)
 * dan penerapan akumulatif ke nominal tagihan.
 */
class DispensasiService
{
    /**
     * Saring dispensasi yang cocok untuk satu santri.
     * `$info`: santri_id, paket, tingkat, kelas_id (dari riwayat TA terpilih).
     * Kriteria yang diisi harus cocok semua; `santri_ids` menang langsung;
     * semua kriteria kosong = berlaku untuk semua santri.
     *
     * @param  Collection<int, Dispensasi>  $daftar
     * @return Collection<int, Dispensasi>
     */
    public function saring(Collection $daftar, array $info): Collection
    {
        return $daftar->filter(function (Dispensasi $d) use ($info) {
            $santriIds = $d->santri_ids ?? [];
            if ($santriIds !== [] && in_array((int) $info['santri_id'], array_map('intval', $santriIds), true)) {
                return true;
            }

            return $this->cocokPaket($d->paket ?? [], $info['paket'] ?? null)
                && $this->cocokTeks($d->tingkat ?? [], $info['tingkat'] ?? null)
                && $this->cocokAngka($d->kelas_id ?? [], $info['kelas_id'] ?? null);
        })->values();
    }

    /**
     * Terapkan akumulatif urut prioritas lalu id: persen memotong sisanya,
     * nominal mengurangi langsung, bebas menihilkan; hasil akhir min 0.
     *
     * @param  Collection<int, Dispensasi>  $cocok
     * @return array{nominal: int, potongan: int, ids: list<int>}
     */
    public function terapkan(int $nominalAwal, Collection $cocok): array
    {
        $urut = $cocok->sortBy([['prioritas', 'asc'], ['id', 'asc']])->values();
        $nominal = $nominalAwal;
        foreach ($urut as $d) {
            $nominal = match ($d->tipe) {
                'persen' => (int) floor($nominal * (100 - min(100, max(0, $d->nilai))) / 100),
                'bebas' => 0,
                default => max(0, $nominal - max(0, $d->nilai)),
            };
        }

        return [
            'nominal' => $nominal,
            'potongan' => max(0, $nominalAwal - $nominal),
            'ids' => $urut->pluck('id')->map(fn ($id) => (int) $id)->all(),
        ];
    }

    /**
     * Paket sasaran: MI mencakup MI-MD, MD mencakup MI-MD (konsisten dengan
     * kelompok generate); MI-MD hanya cocok untuk santri MI-MD.
     *
     * @param  list<string>  $pilihan
     */
    private function cocokPaket(array $pilihan, ?string $paket): bool
    {
        if ($pilihan === []) {
            return true;
        }
        if ($paket === null) {
            return false;
        }
        $kandidat = $paket === 'MI-MD' ? ['MI-MD', 'MI', 'MD'] : [$paket];

        return array_intersect($pilihan, $kandidat) !== [];
    }

    /** @param  list<string>  $pilihan */
    private function cocokTeks(array $pilihan, ?string $nilai): bool
    {
        return $pilihan === [] || ($nilai !== null && in_array($nilai, $pilihan, true));
    }

    /** @param  list<int|string>  $pilihan */
    private function cocokAngka(array $pilihan, ?int $nilai): bool
    {
        return $pilihan === [] || ($nilai !== null && in_array($nilai, array_map('intval', $pilihan), true));
    }
}

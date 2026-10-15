<?php

namespace App\Http\Controllers\Api\Admin\Concerns;

/**
 * Helper bersama controller keuangan: lingkup lembaga + peta santri per TA.
 * Dipakai JenisTarifController, DispensasiController, TagihanController,
 * dan PembayaranController.
 *
 * Peta santri (`petaSantriGenerate`) sendiri tinggal di trait
 * `PetaSantriRiwayat` karena ikut dipakai `SantriController` (kolom Kelas
 * daftar buku induk) — satu sumber untuk aturan baris yang mewakili.
 */
trait KeuanganLembaga
{
    use PetaSantriRiwayat;

    private function canLembaga($actor, string $jenjang): bool
    {
        return $actor->canAccessLembaga($jenjang);
    }
}

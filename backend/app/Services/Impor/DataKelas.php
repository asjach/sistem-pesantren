<?php

namespace App\Services\Impor;

use App\Exports\KelasTemplateExport;
use App\Models\Kelas;

/**
 * Penyedia data kelas existing untuk dialog import (backend hanya mengirim
 * data; berkas Excel disusun di browser). Kolom SAMA PERSIS dengan template
 * import (`KelasTemplateExport::kolom()`) supaya round-trip: unduh → edit →
 * import (kunci = jenjang + tahun_ajaran + nama_kelas).
 *
 * `walas` diisi NIP (import menerima NIP lebih dulu, fallback nama). Semua
 * nilai dikembalikan sebagai string agar NIS/angka tidak berubah format.
 */
class DataKelas
{
    /** @param  list<string>  $jenjang  lembaga yang boleh diakses (sudah disaring) */
    public function __construct(private array $jenjang) {}

    /** @return list<string> */
    public function kolom(): array
    {
        return KelasTemplateExport::kolom();
    }

    /** @return list<string> */
    public function wajib(): array
    {
        return KelasTemplateExport::WAJIB;
    }

    /** @return list<list<string>> */
    public function baris(): array
    {
        if ($this->jenjang === []) {
            return [];
        }

        return Kelas::with('walas:id,nip,nama_lengkap')
            ->whereIn('jenjang', $this->jenjang)
            ->orderBy('jenjang')
            ->orderBy('tahun_ajaran')
            ->orderBy('urutan')
            ->orderBy('nama_kelas')
            ->get()
            ->map(fn (Kelas $k) => [
                (string) $k->jenjang,
                (string) $k->tahun_ajaran,
                (string) $k->nama_kelas,
                (string) ($k->nama_alias ?? ''),
                (string) ($k->walas?->nip ?? $k->walas?->nama_lengkap ?? ''),
                (string) ($k->tingkat ?? ''),
                (string) ($k->urutan ?? ''),
                $k->kapasitas === null ? '' : (string) $k->kapasitas,
            ])
            ->all();
    }
}

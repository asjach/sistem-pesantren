<?php

namespace App\Services\Impor;

use App\Exports\SantriLembagaTemplateExport;
use App\Models\LembagaSantri;
use App\Models\Santri;
use DateTimeInterface;

/**
 * Penyedia data siswa existing untuk dialog import (backend hanya mengirim
 * data; berkas Excel disusun di browser). Kolom SAMA PERSIS dengan template
 * gabungan, terisi `santri_id` + profil + keanggotaan → round-trip update.
 */
class DataSantri
{
    /** @param  list<string>  $jenjang  lembaga yang boleh diakses (sudah disaring) */
    public function __construct(private array $jenjang) {}

    /** @return list<string> */
    public function kolom(): array
    {
        return SantriLembagaTemplateExport::kolom();
    }

    /** @return list<string> */
    public function wajib(): array
    {
        return SantriLembagaTemplateExport::kolomWajib();
    }

    /** @return list<list<string>> */
    public function baris(): array
    {
        if ($this->jenjang === []) {
            return [];
        }

        return LembagaSantri::whereIn('jenjang', $this->jenjang)
            ->with('santri')
            ->orderBy('jenjang')
            ->orderBy('santri_id')
            ->get()
            ->filter(fn (LembagaSantri $ls) => $ls->santri !== null)
            ->map(function (LembagaSantri $ls) {
                $s = $ls->santri;
                $baris = [
                    'santri_id' => (string) $s->id,
                    'jenjang' => (string) $ls->jenjang,
                    'nis_lokal' => (string) ($ls->nis_lokal ?? ''),
                    'nis_kemenag' => (string) ($ls->nis_kemenag ?? ''),
                    'is_active_lembaga' => (string) $ls->is_active_lembaga,
                    'tgl_masuk' => $this->teks($ls->tgl_masuk),
                    'tgl_selesai' => $this->teks($ls->tgl_selesai),
                    'tahaj_masuk' => (string) ($ls->tahaj_masuk ?? ''),
                    'tingkat_masuk' => (string) ($ls->tingkat_masuk ?? ''),
                    'no_urut' => $ls->no_urut !== null ? (string) $ls->no_urut : '',
                    'nama_sekolah_asal' => (string) ($ls->nama_sekolah_asal ?? ''),
                    'npsn_sekolah_asal' => (string) ($ls->npsn_sekolah_asal ?? ''),
                    'nss_sekolah_asal' => (string) ($ls->nss_sekolah_asal ?? ''),
                    'alamat_sekolah_asal' => (string) ($ls->alamat_sekolah_asal ?? ''),
                ];
                foreach (Santri::KOLOM_PROFIL as $kolom) {
                    $baris[$kolom] = $this->teks($s->getAttribute($kolom));
                }

                return array_map(fn (string $kolom) => $baris[$kolom] ?? '', $this->kolom());
            })
            ->all();
    }

    protected function teks(mixed $nilai): string
    {
        if ($nilai === null) {
            return '';
        }
        if ($nilai instanceof DateTimeInterface) {
            return $nilai->format('Y-m-d');
        }
        if (is_bool($nilai)) {
            return $nilai ? '1' : '0';
        }

        return (string) $nilai;
    }
}

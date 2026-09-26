<?php

namespace App\Services\Impor;

use App\Exports\AlumniTemplateExport;
use App\Models\Alumni;
use App\Models\LembagaSantri;
use DateTimeInterface;

/**
 * Penyedia data arsip alumni existing untuk dialog import (backend hanya
 * mengirim data; berkas Excel disusun di browser). Kolom SAMA PERSIS dengan
 * template import; kunci baris = NIS lokal + jenjang (1 arsip per santri).
 *
 * `kelas_lulus` dikirim sebagai NAMA rombel (import membaca nama lebih dulu).
 * `tanggal_lulus` boleh kosong (arsip historis → kolom NULL).
 */
class DataAlumni
{
    /** @param  list<string>  $jenjang  lembaga yang boleh diakses (sudah disaring) */
    public function __construct(private array $jenjang) {}

    /** @return list<string> */
    public function kolom(): array
    {
        return AlumniTemplateExport::kolom();
    }

    /** @return list<string> */
    public function wajib(): array
    {
        return AlumniTemplateExport::WAJIB;
    }

    /** @return list<list<string>> */
    public function baris(): array
    {
        if ($this->jenjang === []) {
            return [];
        }

        $nis = LembagaSantri::query()
            ->whereIn('jenjang', $this->jenjang)
            ->pluck('nis_lokal', 'santri_id');

        return Alumni::with('kelasLulus:id,nama_kelas')
            ->whereIn('lembaga_lulus', $this->jenjang)
            ->orderBy('lembaga_lulus')
            ->orderBy('tahun_ajaran_lulus')
            ->orderBy('santri_id')
            ->get()
            ->map(fn (Alumni $a) => [
                (string) ($nis[$a->santri_id] ?? ''),
                (string) $a->lembaga_lulus,
                (string) $a->tahun_ajaran_lulus,
                $this->teks($a->tanggal_lulus),
                (string) ($a->kelasLulus?->nama_kelas ?? ''),
                (string) ($a->nomor_ijazah ?? ''),
                (string) ($a->no_peserta ?? ''),
                (string) ($a->skhun ?? ''),
                (string) ($a->no_surat_ijazah ?? ''),
                (string) ($a->kegiatan_setelah_lulus ?? ''),
                (string) ($a->penyerahan_ijazah ?? ''),
                (string) ($a->melanjutkan ?? ''),
                (string) ($a->catatan ?? ''),
            ])
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

        return (string) $nilai;
    }
}

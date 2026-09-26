<?php

namespace App\Services\Impor;

use App\Exports\MutasiKeluarTemplateExport;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use DateTimeInterface;

/**
 * Penyedia data arsip mutasi keluar existing untuk dialog import (backend
 * hanya mengirim data; berkas Excel disusun di browser). Kolom SAMA PERSIS
 * dengan template import; kunci baris = NIS lokal + jenjang.
 *
 * `kelas_terakhir` dikirim sebagai NAMA rombel + `tahun_ajaran` rombelnya
 * (import membaca nama lebih dulu), bukan id.
 */
class DataMutasiKeluar
{
    /** @param  list<string>  $jenjang  lembaga yang boleh diakses (sudah disaring) */
    public function __construct(private array $jenjang) {}

    /** @return list<string> */
    public function kolom(): array
    {
        return MutasiKeluarTemplateExport::kolom();
    }

    /** @return list<string> */
    public function wajib(): array
    {
        return MutasiKeluarTemplateExport::WAJIB;
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

        return MutasiKeluar::with('kelasTerakhir:id,nama_kelas,tahun_ajaran')
            ->whereIn('jenjang', $this->jenjang)
            ->orderBy('jenjang')
            ->orderBy('tanggal_mutasi')
            ->orderBy('id')
            ->get()
            ->map(fn (MutasiKeluar $m) => [
                (string) ($nis[$m->santri_id] ?? ''),
                (string) $m->jenjang,
                $this->teks($m->tanggal_mutasi),
                (string) ($m->alasan_mutasi ?? ''),
                (string) ($m->kelasTerakhir?->nama_kelas ?? ''),
                (string) ($m->kelasTerakhir?->tahun_ajaran ?? ''),
                (string) ($m->no_surat ?? ''),
                (string) ($m->nama_sekolah_tujuan ?? ''),
                (string) ($m->npsn_sekolah_tujuan ?? ''),
                (string) ($m->nsm_sekolah_tujuan ?? ''),
                (string) ($m->alamat_sekolah_tujuan ?? ''),
                (string) ($m->keterangan ?? ''),
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

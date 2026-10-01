<?php

namespace App\Services\Impor;

use App\Exports\DokumenTemplateExport;
use App\Models\DokumenLembaga;
use App\Models\DokumenSantri;
use App\Models\LembagaPegawai;
use App\Models\LembagaSantri;
use Illuminate\Support\Facades\DB;

/**
 * Penyedia data dokumen existing untuk dialog import (backend hanya
 * mengirim data; berkas Excel disusun di browser). Kolom SAMA PERSIS dengan
 * template import per tipe; kunci baris mengikuti kunci import (santri:
 * nis_lokal + jenjang; pegawai: pegawai_id/nipp/nama; lembaga: jenjang).
 *
 * Status dikirim berlabel (Menunggu/Valid/Ditolak) seperti contoh template;
 * import menerimanya tanpa peduli kapital. `tidak_memiliki` = Ya/Tidak.
 * Baris yang pemiliknya tak punya penempatan dalam lingkup dilewati agar
 * hasilnya selalu bisa diimport kembali apa adanya.
 */
class DataDokumen
{
    /** @param  list<string>  $jenjang  lembaga yang boleh diakses (sudah disaring) */
    public function __construct(private string $tipe, private array $jenjang) {}

    /** @return list<string> */
    public function kolom(): array
    {
        return DokumenTemplateExport::kolom($this->tipe);
    }

    /** @return list<string> */
    public function wajib(): array
    {
        return DokumenTemplateExport::kolomWajib($this->tipe);
    }

    /** @return list<list<string>> */
    public function baris(): array
    {
        if ($this->jenjang === []) {
            return [];
        }

        return match ($this->tipe) {
            'santri' => $this->barisSantri(),
            'pegawai' => $this->barisPegawai(),
            'lembaga' => $this->barisLembaga(),
            default => [],
        };
    }

    /** Satu baris per dokumen santri yang penempatannya masuk lingkup. */
    protected function barisSantri(): array
    {
        // Penempatan dalam lingkup, aktif diutamakan per santri.
        $tempat = LembagaSantri::query()
            ->whereIn('jenjang', $this->jenjang)
            ->orderByRaw("is_active_lembaga = 'Ya' desc")
            ->orderBy('id')
            ->get(['santri_id', 'jenjang', 'nis_lokal'])
            ->unique('santri_id')
            ->keyBy('santri_id');

        return DokumenSantri::query()
            ->whereNotNull('santri_id')
            ->orderBy('id')
            ->get()
            ->filter(fn ($d) => isset($tempat[$d->santri_id]))
            ->map(fn ($d) => [
                (string) ($tempat[$d->santri_id]->nis_lokal ?? ''),
                (string) $tempat[$d->santri_id]->jenjang,
                (string) $d->jenis_dokumen_santri,
                $this->status($d->status_verifikasi),
                $d->tidak_memiliki ? 'Ya' : 'Tidak',
                (string) ($d->catatan ?? ''),
            ])
            ->values()
            ->all();
    }

    /** Satu baris per dokumen pegawai yang penempatannya masuk lingkup. */
    protected function barisPegawai(): array
    {
        $tempat = LembagaPegawai::query()
            ->whereIn('jenjang', $this->jenjang)
            ->orderByRaw("is_active_lembaga = 'Ya' desc")
            ->orderBy('id')
            ->get(['pegawai_id', 'jenjang'])
            ->unique('pegawai_id')
            ->keyBy('pegawai_id');

        return DB::table('dokumen_pegawai')
            ->join('pegawai', 'pegawai.id', '=', 'dokumen_pegawai.pegawai_id')
            ->select('dokumen_pegawai.*', 'pegawai.nama_lengkap', 'pegawai.nipp')
            ->orderBy('dokumen_pegawai.id')
            ->get()
            ->filter(fn ($d) => isset($tempat[$d->pegawai_id]))
            ->map(fn ($d) => [
                (string) $d->pegawai_id,
                (string) ($d->nipp ?? ''),
                (string) ($d->nama_lengkap ?? ''),
                (string) $tempat[$d->pegawai_id]->jenjang,
                (string) $d->jenis_dokumen_pegawai,
                $this->status($d->status_verifikasi),
                (string) ($d->catatan ?? ''),
            ])
            ->values()
            ->all();
    }

    protected function barisLembaga(): array
    {
        return DokumenLembaga::query()
            ->whereIn('jenjang', $this->jenjang)
            ->orderBy('jenjang')
            ->orderBy('jenis_dokumen')
            ->orderBy('id')
            ->get()
            ->map(fn ($d) => [
                (string) $d->jenjang,
                (string) $d->jenis_dokumen,
                $this->status($d->status_verifikasi),
                (string) ($d->catatan ?? ''),
            ])
            ->all();
    }

    /** Kode status (`menunggu|valid|ditolak`) → label seperti contoh template. */
    protected function status(?string $nilai): string
    {
        return match ($nilai) {
            'valid' => 'Valid',
            'ditolak' => 'Ditolak',
            default => 'Menunggu',
        };
    }
}

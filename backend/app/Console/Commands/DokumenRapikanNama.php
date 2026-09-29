<?php

namespace App\Console\Commands;

use App\Models\DokumenLembaga;
use App\Models\DokumenSantri;
use App\Models\Lembaga;
use App\Models\Pegawai;
use App\Models\PsbCalonSantri;
use App\Models\Santri;
use App\Support\NamaBerkasDokumen;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

#[Signature('dokumen:rapikan-nama {--dry-run : Tampilkan rencana tanpa memindah berkas/ubah baris}')]
#[Description('Rapikan berkas dokumen lama ke direktori kanonis + nama template (santri/dokumen, pegawai/dokumen, lembaga/dokumen).')]
class DokumenRapikanNama extends Command
{
    /** Backfill satu-kali: samakan fisik + nama_file ke template sebelum kolom path_file dicabut. */
    public function handle(): int
    {
        $kering = (bool) $this->option('dry-run');
        $disk = Storage::disk('local');
        $rapi = 0;
        $selaras = 0;
        $lewat = 0;

        $baris = [];
        foreach (DokumenSantri::whereNotNull('path_file')->get() as $r) {
            $baris[] = [
                'tipe' => 'santri', 'id' => $r->id, 'path' => $r->path_file,
                'nama' => $this->namaSantri($r), 'jenis' => (string) ($r->jenis_dokumen_santri ?? ''),
                'catatan' => $r->catatan, 'waktu' => $r->created_at, 'dir' => 'santri/dokumen',
                'simpan' => fn (string $path, string $nama) => $r->update(['path_file' => $path, 'nama_file' => $nama]),
            ];
        }
        foreach (DB::table('dokumen_pegawai')->whereNotNull('path_file')->get() as $r) {
            $baris[] = [
                'tipe' => 'pegawai', 'id' => $r->id, 'path' => $r->path_file,
                'nama' => (string) (Pegawai::find($r->pegawai_id)?->nama_lengkap ?? 'pegawai-'.$r->pegawai_id),
                'jenis' => (string) ($r->jenis_dokumen_pegawai ?? ''),
                'catatan' => $r->catatan, 'waktu' => $r->created_at, 'dir' => 'pegawai/dokumen',
                'simpan' => fn (string $path, string $nama) => DB::table('dokumen_pegawai')->where('id', $r->id)->update([
                    'path_file' => $path, 'nama_file' => $nama, 'updated_at' => now(),
                ]),
            ];
        }
        foreach (DokumenLembaga::whereNotNull('path_file')->get() as $r) {
            $baris[] = [
                'tipe' => 'lembaga', 'id' => $r->id, 'path' => $r->path_file,
                'nama' => (string) (Lembaga::where('jenjang', $r->jenjang)->value('nama') ?? $r->jenjang),
                'jenis' => (string) ($r->jenis_dokumen ?? ''),
                'catatan' => $r->catatan, 'waktu' => $r->created_at, 'dir' => 'lembaga/dokumen',
                'simpan' => fn (string $path, string $nama) => $r->update(['path_file' => $path, 'nama_file' => $nama]),
            ];
        }

        foreach ($baris as $b) {
            $ekstensi = strtolower(pathinfo((string) $b['path'], PATHINFO_EXTENSION));
            $dasar = NamaBerkasDokumen::buat($b['nama'], $b['jenis'], $b['catatan'], $ekstensi, $b['waktu']);
            $dirSama = dirname((string) $b['path']) === $b['dir'];
            if ($dirSama && basename((string) $b['path']) === $dasar) {
                // Path sudah baku; selaraskan nama_file bila masih nama asli.
                $rowNama = $this->namaTersimpan($b['tipe'], $b['id']);
                if ($rowNama !== $dasar) {
                    $this->line(($kering ? '[kering] ' : '')."{$b['tipe']}#{$b['id']}: selaraskan nama_file → {$dasar}");
                    if (! $kering) {
                        ($b['simpan'])((string) $b['path'], $dasar);
                    }
                    $selaras++;
                }

                continue;
            }
            $tujuan = $b['dir'].'/'.NamaBerkasDokumen::unik(
                'local', $b['dir'], $dasar, $dirSama ? basename((string) $b['path']) : null,
            );
            if (! $disk->exists((string) $b['path'])) {
                $this->warn("Lewat {$b['tipe']}#{$b['id']}: fisik tak ada ({$b['path']}).");
                $lewat++;

                continue;
            }
            $this->line(($kering ? '[kering] ' : '')."{$b['tipe']}#{$b['id']}: {$b['path']} → {$tujuan}");
            if ($kering) {
                continue;
            }
            $disk->move((string) $b['path'], $tujuan);
            ($b['simpan'])($tujuan, basename($tujuan));
            $rapi++;
        }

        $this->info($kering
            ? 'Kering: '.count($baris).' baris berberkas diperiksa.'
            : "Selesai: {$rapi} dirapikan, {$selaras} nama diselaraskan, {$lewat} dilewat (fisik hilang).");

        return self::SUCCESS;
    }

    /** Nilai nama_file tersimpan saat ini (untuk deteksi selisih). */
    private function namaTersimpan(string $tipe, int $id): ?string
    {
        $tabel = match ($tipe) {
            'santri' => 'dokumen_santri',
            'pegawai' => 'dokumen_pegawai',
            default => 'dokumen_lembaga',
        };

        return DB::table($tabel)->where('id', $id)->value('nama_file');
    }

    /** Nama pemilik baris santri (santri, calon PSB, atau fallback id). */
    private function namaSantri(DokumenSantri $r): string
    {
        if ($r->santri_id) {
            return (string) (Santri::find($r->santri_id)?->nama_lengkap ?? 'santri-'.$r->santri_id);
        }
        if ($r->psb_calon_santri_id) {
            return (string) (PsbCalonSantri::find($r->psb_calon_santri_id)?->nama_lengkap ?? 'calon-'.$r->psb_calon_santri_id);
        }

        return 'dokumen-'.$r->id;
    }
}

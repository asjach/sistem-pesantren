<?php

namespace App\Console\Commands;

use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Services\SiklusSantriService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('riwayat:sinkron-aktif {--jenjang= : Batasi ke satu jenjang (mis. MI)} {--santri= : Batasi ke satu santri_id}')]
#[Description('Sinkronkan is_active_riwayat: hanya periode terakhir per (santri, jenjang) yang status_akhir-nya aktif.')]
class SinkronAktifRiwayat extends Command
{
    /** Jalankan backfill: arsipkan riwayat lama, sisakan periode terakhir aktif. */
    public function handle(SiklusSantriService $siklus): int
    {
        $jenjang = (string) $this->option('jenjang');
        $santriId = $this->option('santri');

        $pasangan = RiwayatBelajar::query()
            ->select('santri_id', 'jenjang')
            ->when($jenjang !== '', fn ($q) => $q->where('jenjang', $jenjang))
            ->when($santriId !== null && $santriId !== '', fn ($q) => $q->where('santri_id', (int) $santriId))
            ->distinct()
            ->get();

        if ($pasangan->isEmpty()) {
            $this->warn('Tidak ada baris riwayat yang cocok.');

            return self::SUCCESS;
        }

        $tersentuh = [];
        $bar = $this->output->createProgressBar($pasangan->count());
        foreach ($pasangan as $p) {
            $siklus->sinkronkanAktifRiwayat((int) $p->santri_id, (string) $p->jenjang);
            $tersentuh[(int) $p->santri_id] = true;
            $bar->advance();
        }
        $bar->finish();
        $this->newLine();

        foreach (array_keys($tersentuh) as $id) {
            Santri::find($id)?->hitungUlangStatusGlobal();
        }

        $this->info("Selesai: {$pasangan->count()} pasangan (santri+jenjang), ".count($tersentuh).' santri dihitung ulang.');

        return self::SUCCESS;
    }
}

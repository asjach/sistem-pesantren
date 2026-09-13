<?php

namespace Database\Seeders;

use App\Models\Lembaga;
use App\Models\PsbCalonSantri;
use App\Services\PsbGelombangService;
use App\Services\PsbService;
use Illuminate\Database\Seeder;

/** Data uji pendaftar PSB (dev): 10 MI, 10 MI-MD, 2 MD, 25 MTs, 20 MLN. */
class DevPendaftarSeeder extends Seeder
{
    public function run(): void
    {
        $gelombang = app(PsbGelombangService::class)->gelombangAktif();
        if (! $gelombang) {
            $this->command?->error('Tidak ada gelombang yang sedang dibuka. Jalankan DevSeeder dulu.');

            return;
        }

        $service = app(PsbService::class);
        $lembaga = Lembaga::whereIn('kode', ['MI', 'MD', 'MTS', 'MLN'])->get()->keyBy('kode');

        $rencana = array_merge(
            array_fill(0, 10, ['MI', false]),
            array_fill(0, 10, ['MIMD', false]),
            array_fill(0, 2, ['MD', false]),
            array_fill(0, 25, ['MTS', false]),
            array_fill(0, 20, ['MLN', false]),
        );

        $dibuat = 0;
        $dilewati = 0;
        $nomor = 1;
        foreach ($rencana as [$jenis, $asrama]) {
            $seq = str_pad((string) $nomor, 2, '0', STR_PAD_LEFT);
            $nik = '3200' . str_pad((string) $nomor, 12, '0', STR_PAD_LEFT);
            $nomor++;

            if (PsbCalonSantri::withTrashed()->where('nik', $nik)->exists()) {
                $dilewati++;
                continue;
            }

            $kodePrimer = $jenis === 'MIMD' ? 'MI' : $jenis;
            $lembagaPrimer = $lembaga->get($kodePrimer);
            if (! $lembagaPrimer) {
                continue;
            }

            $tglLahir = match ($jenis) {
                'MTS' => '2013-05-01',
                'MLN' => '2010-05-01',
                default => '2015-05-01',
            };

            $payload = [
                'gelombang_id' => $gelombang->id,
                'lembaga_id' => $lembagaPrimer->id,
                'tipe_santri' => $asrama ? 'asrama' : 'non_asrama',
                'nik' => $nik,
                'nama_lengkap' => "Uji {$jenis} {$seq}",
                'jk' => $nomor % 2 === 0 ? 'L' : 'P',
                'tgl_lahir' => $tglLahir,
                'email_ortu' => 'uji.' . strtolower(str_replace('-', '', $jenis)) . ".{$seq}@example.com",
                'telp_ortu' => '0855' . str_pad((string) $nomor, 8, '0', STR_PAD_LEFT),
                'nama_ayah' => "Ayah Uji {$seq}",
                'nama_ibu' => "Ibu Uji {$seq}",
            ];
            if ($jenis === 'MIMD') {
                $payload['paket'] = PsbService::PAKET_MI_MD['kode'];
            }

            $service->daftarPublik($payload);
            $dibuat++;
        }

        $this->command?->info("Pendaftar uji dibuat: {$dibuat}" . ($dilewati ? ", dilewati (sudah ada): {$dilewati}" : '') . '.');
    }
}

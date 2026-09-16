<?php

namespace Database\Seeders;

use App\Models\Lembaga;
use App\Models\PsbGelombang;
use App\Models\PsbKegiatan;
use App\Models\PsbKuotaBiaya;
use App\Models\TahunAjaran;
use Illuminate\Database\Seeder;

class DevSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(AkunSeeder::class);

        $root = Lembaga::firstOrCreate(
            ['kode' => 'PESANTREN'],
            ['nama' => 'Pesantren', 'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true],
        );
        $root->update(['kelompok_psb' => 'eksklusif']);

        $mi = Lembaga::firstOrCreate(
            ['kode' => 'MI'],
            ['parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true],
        );
        $md = Lembaga::firstOrCreate(
            ['kode' => 'MD'],
            ['parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true],
        );
        $mts = Lembaga::firstOrCreate(
            ['kode' => 'MTS'],
            ['parent_id' => $root->id, 'nama' => 'Madrasah Tsanawiyah', 'is_seleksi' => true, 'kelompok_psb' => 'eksklusif', 'is_active' => true],
        );
        $mln = Lembaga::firstOrCreate(
            ['kode' => 'MLN'],
            ['parent_id' => $root->id, 'nama' => "Mu'allimin", 'is_seleksi' => true, 'kelompok_psb' => 'eksklusif', 'is_active' => true],
        );
        foreach ([$mi, $md] as $l) {
            $l->update(['kelompok_psb' => 'combo_mi_md']);
        }
        foreach ([$mts, $mln] as $l) {
            $l->update(['kelompok_psb' => 'eksklusif']);
        }

        // Asrama hanya untuk lembaga yang menyediakannya (bukan MI/MD).
        PsbKuotaBiaya::whereIn('lembaga_id', [$mi->id, $md->id])->where('tipe_santri', 'asrama')->delete();

        // TA kini data pesantren (global, `lembaga_id` NULL) dan hanya satu yang aktif.
        $ta = TahunAjaran::firstOrCreate(
            ['lembaga_id' => null, 'nama' => '2026/2027'],
            ['tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_active' => true],
        );
        $ta->update(['tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_active' => true]);
        TahunAjaran::where('id', '!=', $ta->id)->update(['is_aktif' => false]);
        TahunAjaran::where('id', $ta->id)->update(['is_aktif' => true]);

        // Kegiatan PSB se-pesantren: satu kegiatan per tahun ajaran (kuota/biaya
        // per lembaga diisi di dalam gelombangnya).
        $kegiatan = PsbKegiatan::firstOrCreate(
            ['tahun_ajaran_id' => $ta->id, 'nama' => 'PSB 2026/2027'],
            ['is_aktif' => true],
        );
        $kegiatan->update(['is_aktif' => true]);
        PsbKegiatan::where('id', '!=', $kegiatan->id)->update(['is_aktif' => false]);

        $gelombang = PsbGelombang::firstOrCreate(
            ['psb_kegiatan_id' => $kegiatan->id, 'nomor' => 1],
            [
                'nama' => 'Gelombang 1 2026/2027',
                'tgl_buka' => now()->subDays(30)->toDateString(),
                'tgl_tutup' => now()->addDays(30)->toDateString(),
            ],
        );
        $gelombang->update([
            'tgl_buka' => now()->subDays(30)->toDateString(),
            'tgl_tutup' => now()->addDays(30)->toDateString(),
        ]);

        $kuota = [
            [$mi, 'non_asrama', true, 100],
            [$md, 'non_asrama', false, null],
            [$mts, 'non_asrama', false, 120],
            [$mts, 'asrama', false, 60],
            [$mln, 'non_asrama', false, 100],
            [$mln, 'asrama', false, 60],
        ];
        foreach ($kuota as [$lembaga, $tipe, $paket, $jumlah]) {
            PsbKuotaBiaya::updateOrCreate(
                ['gelombang_id' => $gelombang->id, 'lembaga_id' => $lembaga->id, 'tipe_santri' => $tipe],
                [
                    'paket_tersedia' => $paket,
                    'kuota' => $jumlah,
                    'membutuhkan_seleksi' => null,
                    'membutuhkan_pemberkasan' => true,
                ],
            );
        }

        $this->command?->info('DevSeeder: 4 akun, '.Lembaga::count().' lembaga, kegiatan #'.$kegiatan->id.' gelombang #'.$gelombang->id.' siap.');
    }
}

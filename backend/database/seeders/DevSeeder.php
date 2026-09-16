<?php

namespace Database\Seeders;

use App\Models\Lembaga;
use App\Models\PosKeuangan;
use App\Models\PsbBiayaLembaga;
use App\Models\PsbGelombang;
use App\Models\PsbKegiatan;
use App\Models\PsbKuotaBiaya;
use App\Models\TahunAjaran;
use App\Models\User;
use Illuminate\Database\Seeder;

class DevSeeder extends Seeder
{
    public function run(): void
    {
        $akun = [
            ['Reviewer Sementara', 'reviewer.tmp@example.com', '081200000001', 'password', 'super_admin'],
            ['Asjach', 'asjach@gmail.com', '081200000002', 'rahayu45', 'super_admin'],
            ['Reviewer Orang Tua', 'reviewer.orangtua@simpes.local', '081200000003', 'password', 'orang_tua'],
            ['Reviewer Santri', 'reviewer.santri@simpes.local', '081200000004', 'password', 'santri'],
        ];
        foreach ($akun as [$nama, $email, $phone, $password, $role]) {
            $user = User::updateOrCreate(
                ['email' => $email],
                ['name' => $nama, 'phone' => $phone, 'password' => $password],
            );
            $user->syncRoles([$role]);
        }

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

        $biaya = [
            [$mi, 'non_asrama', 150000, 50000, 250000, 100],
            [$md, 'non_asrama', 100000, null, null, null],
            [$mts, 'non_asrama', 175000, null, null, 120],
            [$mts, 'asrama', 175000, null, null, 60],
            [$mln, 'non_asrama', 175000, null, null, 100],
            [$mln, 'asrama', 175000, null, null, 60],
        ];
        foreach ($biaya as [$lembaga, $tipe, $pendaftaran, $lanjutan, $paket, $kuota]) {
            PsbKuotaBiaya::updateOrCreate(
                ['gelombang_id' => $gelombang->id, 'lembaga_id' => $lembaga->id, 'tipe_santri' => $tipe],
                [
                    'nominal_pendaftaran' => $pendaftaran,
                    'nominal_pendaftaran_lanjutan' => $lanjutan,
                    'nominal_paket' => $paket,
                    'kuota' => $kuota,
                    'membutuhkan_seleksi' => null,
                    'membutuhkan_pemberkasan' => true,
                ],
            );
        }

        $biayaLembaga = [
            [$mi, 1000000, 0],
            [$md, 500000, 0],
            [$mts, 1500000, 750000],
            [$mln, 1500000, 750000],
        ];
        foreach ($biayaLembaga as [$lembaga, $masuk, $asrama]) {
            PsbBiayaLembaga::updateOrCreate(
                ['lembaga_id' => $lembaga->id],
                ['biaya_masuk' => $masuk, 'biaya_asrama' => $asrama],
            );
        }

        PosKeuangan::firstOrCreate(['kode_pos' => 'PSB_REG'], ['nama_pos' => 'Pendaftaran PSB', 'tipe' => 'sekali_bayar']);
        PosKeuangan::firstOrCreate(['kode_pos' => 'DFR_ULANG'], ['nama_pos' => 'Daftar Ulang PSB', 'tipe' => 'sekali_bayar']);
        PosKeuangan::firstOrCreate(['kode_pos' => 'ASRAMA'], ['nama_pos' => 'Biaya Asrama', 'tipe' => 'sekali_bayar']);

        $this->command?->info('DevSeeder: 4 akun, '.Lembaga::count().' lembaga, kegiatan #'.$kegiatan->id.' gelombang #'.$gelombang->id.' siap.');
    }
}

<?php

namespace Database\Seeders;

use App\Models\Papan\PapanButir;
use App\Models\Papan\PapanItem;
use App\Models\Papan\PapanModul;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Cetak biru papan perkembangan proyek (27 sub-modul, 7 modul).
 *
 * Papan hidup di koneksi \`papan\` (SQLite terpisah). Data di sini adalah
 * sumber yang bisa dibangun ulang kapan saja — menjalankan seeder ini
 * mengembalikan papan ke kondisi awal tanpa menyentuh DB pesantren:
 *
 *     php artisan migrate --path=database/migrations/papan --database=papan
 *     php artisan db:seed --class=PapanSeeder
 *
 * Seeder bersifat idempoten: baris dicocokkan lewat (modul, kode), jadi
 * menjalankannya dua kali tidak menggandakan data.
 */
class PapanSeeder extends Seeder
{
    /**
     * Struktur papan: modul => daftar sub-modul.
     *
     * Tiap sub-modul: kode, nama, dan butir per status. Status TIDAK disimpan
     * di sub-modul — statusnya diturunkan dari poin-poinnya (lihat
     * PapanService::statusTurunan), jadi yang perlu dicatat di cetak biru ini
     * hanyalah status tiap butir.
     *
     * @var array<int, array{kode: string, nama: string, sub: array<int, array<string, mixed>>}>
     */
    private const PAPAN = [
        ['kode' => 'A', 'nama' => 'Fondasi', 'sub' => [
            ['kode' => 'A.1', 'nama' => 'Setup (001)', 'butir' => [
                'sudah' => ['Proyek Laravel 13 dengan `.env` dan guard `sanctum` sudah berjalan.'],
            ]],
            ['kode' => 'A.2', 'nama' => 'Skema Database (002)', 'butir' => [
                'sudah' => [
                    '84 file migrasi; `migrate:fresh` hijau dengan 126 tabel termasuk tabel framework.',
                    'Spesifikasi kolom lengkap ada di [SCHEMA.md](SCHEMA.md).',
                ],
            ]],
            ['kode' => 'A.3', 'nama' => 'Autentikasi & Pengguna (003)', 'butir' => [
                'sudah' => [
                    'Login multi-identifier (email/telepon/username) dengan throttle dan `login_audits`, lima peran efektif.',
                    'Ada kunci diri dan anti-eskalasi: pengguna tak bisa mengubah atau menghapus dirinya sendiri.',
                    'Act-as lembaga lewat header `X-Lembaga-Aktif`; impor pengguna massal tersedia.',
                ],
            ]],
            ['kode' => 'A.4', 'nama' => 'Referensi & Master (004)', 'butir' => [
                'sudah' => [
                    '34 tabel kamus per lembaga dengan fan-out, dilayani `RefService` ber-cache.',
                    'CRUD Lembaga, Tahun Ajaran, dan Kelas lengkap dengan scope tenant.',
                ],
            ]],
            ['kode' => 'A.5', 'nama' => 'Dashboard Ringkas', 'butir' => [
                'sudah' => [
                    '`GET /api/dashboard/ringkasan` menyajikan blok lembaga, santri, pegawai, keuangan, siklus, dan PSB.',
                    'Tiap blok digerbangi izin modulnya dan bernilai null bila akun tak berizin.',
                ],
                'akan' => ['Dashboard eksekutif pimpinan (modul 504) yang lebih ringkas dan terarah.'],
            ]],
        ]],
        ['kode' => 'B', 'nama' => 'PSB & Santri', 'sub' => [
            ['kode' => 'B.1', 'nama' => 'PSB (100)', 'butir' => [
                'sudah' => [
                    'Master kegiatan, gelombang anti-tumpang, dan kuota pendaftaran per lembaga.',
                    'Dua jalur pendaftaran (langsung atau seleksi), plus verifikasi, seleksi, daftar ulang, ACC, dan undur diri.',
                    'Aksi massal untuk semua tahap, impor, dokumen, dan promosi calon menjadi santri.',
                ],
            ]],
            ['kode' => 'B.2', 'nama' => 'Santri (101)', 'butir' => [
                'sudah' => [
                    'CRUD santri dengan `SantriPolicy`, impor satu pintu, kamus, dan kolom NIS.',
                    'Foto dan dokumen per santri bisa diunggah; ada fitur samakan NIS massal.',
                ],
            ]],
            ['kode' => 'B.3', 'nama' => 'Siklus Santri (102)', 'butir' => [
                'sudah' => [
                    'Salin genap, naik kelas (massal dan otomatis), pindah kelas, mutasi keluar beserta arsipnya.',
                    'Lulus/batal, roster dan arsip, penanganan MI-MD, beku kelas, serta berhenti jenjang.',
                ],
            ]],
        ]],
        ['kode' => 'C', 'nama' => 'Kepegawaian & Kurikulum', 'sub' => [
            ['kode' => 'C.1', 'nama' => 'Pegawai (200)', 'butir' => [
                'sudah' => [
                    'Master `pegawai` global dengan kolom EMIS, multi-lembaga lewat `keaktifan_pegawai`.',
                    'Sertifikasi, keluarga, dokumen, penautan akun, dan `setWalas` dengan validasi tiga lapis.',
                ],
            ]],
            ['kode' => 'C.2', 'nama' => 'Kurikulum & Mata Pelajaran (201)', 'butir' => [
                'sudah' => [
                    'Tiga halaman jalan: Mata Pelajaran (KKM dan urutan), Pengampu (kelas × mapel → guru), Jadwal Pelajaran.',
                    'Jadwal memakai slot per jenjang dan menolak bentrok kelas maupun bentrok guru.',
                ],
                'akan' => [
                    'Tampilan jadwal dari sudut guru, bukan hanya per kelas.',
                    'Cetak dan unduh jadwal per kelas.',
                    'Salin daftar mapel antar tahun ajaran.',
                ],
                'ditunda' => [
                    'Tes endpoint yang belum tertulis dan tes komponen halaman Pengampu.',
                ],
            ]],
        ]],
        ['kode' => 'D', 'nama' => 'Penilaian', 'sub' => [
            ['kode' => 'D.1', 'nama' => 'Nilai & Peristiwa (202)', 'butir' => [
                'sudah' => [
                    'Nilai diikat per peristiwa (PTS, ASAS, ASAT, UJIAN, UAP), bukan per semester.',
                    'Komponen dan bobot bisa bersumber manual, dari rapor tingkat sebelumnya, atau dari peristiwa lain.',
                    'Leger crosstab per peristiwa bisa diunduh Excel; rapor lengkap bisa dicetak per santri maupun per kelas.',
                    'Empat template impor lewat mesin `import-potong`.',
                ],
                'akan' => [
                    'Kunci impor/edit setelah batch rapor pertama dicetak, plus log cetak berisi siapa, kapan, dan berapa santri.',
                    'Buka-kunci dengan alasan tercatat, karena mengubah nilai setelah rapor beredar harus bisa diaudit.',
                ],
                'ditunda' => [
                    'Bobot UJIAN bawaan (UM 60 / Rata-rata Rapor 40) masih placeholder, menunggu kebijakan pesantren.',
                    'Salin peristiwa dari tahun ajaran sebelumnya; kini tiap TA dibuat ulang atau klik "Muat bawaan".',
                ],
            ]],
            ['kode' => 'D.2', 'nama' => 'Cetak Rapor', 'butir' => [
                'sudah' => [
                    'Rapor per santri dan per kelas dengan kop, identitas, nilai + terbilang, rekap, dan halaman 2.',
                    'Cek kelengkapan kelas; tombol cetak terkunci selama masih ada santri yang nilainya belum lengkap.',
                ],
                'akan' => [
                    'Cetak massal satu kelas dalam sekali klik, dengan parameter peringkat sekali per batch.',
                    'Snapshot nama dan gelar penanda tangan saat batch pertama dicetak agar cetak ulang identik.',
                    'Absensi otomatis dari `sesi_presensi`/`presensi_santri`; kolom leger jadi override bila presensi kosong.',
                    'Tombol unduh data existing di dialog impor, memakai pola `data-existing`.',
                ],
            ]],
        ]],
        ['kode' => 'E', 'nama' => 'Keuangan', 'sub' => [
            ['kode' => 'E.1', 'nama' => 'Tagihan & Tarif', 'butir' => [
                'sudah' => [
                    'Master jenis tagihan dan tarif per lembaga/tahun ajaran.',
                    'Generate tagihan satu layar tanpa duplikat: bulanan terbayar dilewati, dispensasi dan kuota diterapkan otomatis.',
                    'Crosstab tagihan, dispensasi, dan grup santri custom.',
                ],
                'akan' => [
                    'Kartu piutang per santri lintas tahun ajaran, bisa dicetak sebagai surat tagihan resmi.',
                ],
            ]],
            ['kode' => 'E.2', 'nama' => 'Kasir & Kwitansi', 'butir' => [
                'sudah' => [
                    'Kasir harian, pencatatan pembayaran, batal/hapus transaksi dengan saldo terkunci barisnya.',
                    'Kwitansi cetak dan cetak ulang, baik dari dialog setelah bayar maupun dari tabel harian.',
                ],
                'akan' => [
                    'Penomoran kwitansi runut per lembaga/kas/tahun menggantikan hex acak.',
                    'Split payment: satu kwitansi boleh gabungan metode atau kas, dengan rincian sub-bayar.',
                    'Format nomor kwitansi (mis. `KW-MI-2026-000123`) belum ditetapkan; perlu keputusan dulu.',
                ],
            ]],
            ['kode' => 'E.3', 'nama' => 'Rekap & Tutup Buku Kas', 'butir' => [
                'akan' => [
                    'Rekap penerimaan per posisi kas (tunai TU, bank lembaga, bank pesantren) per tanggal atau periode.',
                    'Mutasi kas harian untuk melihat arus masuk per kas per hari.',
                    'Tutup buku harian yang menolak tambah/batal/hapus mundur, dengan jalur buka-kunci beralasan.',
                ],
                'ditunda' => ['Tarif per asrama belum diakomodasi; menunggu modul 505 dibuka.'],
            ]],
            ['kode' => 'E.4', 'nama' => 'Tunggakan', 'butir' => [
                'sudah' => [
                    'Crosstab tunggakan per santri/kelas dan dasbor ringkas (total tagihan, terbayar, tunggakan).',
                ],
                'akan' => [
                    'Laporan aging 30/60/90+ hari dari `jatuh_tempo` sebagai dasar surat tagihan.',
                    'Pengingat tunggakan: penanda di crosstab; WhatsApp menyusul lewat modul notifikasi G8.',
                ],
                'ditunda' => ['Tren penerimaan bulanan dan rincian per tahun ajaran di dasbor.'],
            ]],
            ['kode' => 'E.5', 'nama' => 'Audit & Kontrol', 'butir' => [
                'akan' => [
                    'Jejak audit: log siapa mencatat, membatalkan, atau menghapus transaksi, dengan alasan wajib.',
                    'Maker-checker pembatalan agar pencatat tidak sekaligus menyetujui pembatalan.',
                    'Ekspor laporan ke Excel/PDF untuk crosstab, transaksi harian, rekap per jenis, dan tunggakan.',
                ],
            ]],
        ]],
        ['kode' => 'F', 'nama' => 'Portal & Klien', 'sub' => [
            ['kode' => 'F.1', 'nama' => 'Portal Wali (203)', 'butir' => [
                'sudah' => ['Jalur PSB lanjutan, riwayat keluarga, dan pengajuan biodata (satu aktif per santri, bisa dibatalkan).'],
                'akan' => [
                    'Dashboard portal dan ringkasan tagihan untuk wali.',
                    'Aktor santri, karena rute portal saat ini hanya untuk `orang_tua`.',
                ],
            ]],
            ['kode' => 'F.2', 'nama' => 'Klien Desktop admin-desktop-tauri', 'butir' => [
                'sudah' => [
                    '48 halaman dalam 10 grup navigasi, dengan dua mode: lembaga dan pesantren.',
                    'Dijaga 123 file tes; klien ini untuk `super_admin` dan `admin` lembaga saja.',
                ],
                'akan' => ['Jalur peran guru, yang izin bawaannya masih kosong.'],
            ]],
            ['kode' => 'F.3', 'nama' => 'Aplikasi Mobile', 'butir' => [
                'akan' => ['Empat klien belum di-scaffold: kasir, orang tua, pimpinan, dan guru.'],
            ]],
        ]],
        ['kode' => 'G', 'nama' => 'Pasca Production', 'sub' => [
            ['kode' => 'G.1', 'nama' => 'Presensi Santri (500)', 'butir' => [
                'sudah' => ['Tabel `sesi_presensi`, `presensi_santri`, dan `pelanggaran_santri` sudah dibuat.'],
                'akan' => ['UI presensi dan UI pelanggaran.'],
            ]],
            ['kode' => 'G.2', 'nama' => 'Presensi Pegawai (501)', 'butir' => [
                'sudah' => ['Tabel `presensi_pegawai` sudah dibuat.'],
                'akan' => ['UI absensi guru.'],
            ]],
            ['kode' => 'G.3', 'nama' => 'Jadwal Pelajaran (502)', 'butir' => [
                'sudah' => ['Sudah live dan menjadi bagian modul 201, bukan lagi pekerjaan pasca production.'],
            ]],
            ['kode' => 'G.4', 'nama' => 'Tahfizh (503)', 'butir' => [
                'sudah' => ['Tabel `target_tahfiz`, `setoran_tahfiz`, dan `rekap_tahfiz_santri` sudah dibuat.'],
                'akan' => ['UI tahfizh untuk ziyadah dan murajaah.'],
            ]],
            ['kode' => 'G.5', 'nama' => 'Statistik Pimpinan (504)', 'butir' => [
                'akan' => ['Dashboard eksekutif pimpinan yang ringkas, terpisah dari `/api/dashboard/ringkasan`.'],
            ]],
            ['kode' => 'G.6', 'nama' => 'Asrama (505)', 'butir' => [
                'ditunda' => [
                    'Baru sebatas gambaran; tabel, peran, dan pivot belum dibuat.',
                    'Pasca production dan tidak dikerjakan dalam waktu dekat.',
                ],
            ]],
            ['kode' => 'G.7', 'nama' => 'Deploy (900/901)', 'butir' => [
                'akan' => ['Deploy VPS dan konfigurasi production.'],
            ]],
        ]],
    ];

    /** Status yang dipakai berulang; diurutkan sesuai tampilan papan. */
    private const URUTAN_STATUS = ['akan', 'sedang', 'sudah', 'ditunda'];

    public function run(): void
    {
        $koneksi = DB::connection('papan');

        foreach (self::PAPAN as $urutanModul => $modul) {
            $barisModul = PapanModul::updateOrCreate(
                ['kode' => $modul['kode']],
                ['nama' => $modul['nama'], 'urutan' => $urutanModul + 1],
            );

            foreach ($modul['sub'] as $urutanItem => $sub) {
                $item = PapanItem::updateOrCreate(
                    ['modul_id' => $barisModul->id, 'kode' => $sub['kode']],
                    ['nama' => $sub['nama'], 'urutan' => $urutanItem + 1],
                );

                $item->butir()->delete();

                $urutanButir = 0;
                foreach (self::URUTAN_STATUS as $status) {
                    foreach ($sub['butir'][$status] ?? [] as $deskripsi) {
                        PapanButir::create([
                            'item_id' => $item->id,
                            'status' => $status,
                            'deskripsi' => $deskripsi,
                            'urutan' => ++$urutanButir,
                        ]);
                    }
                }
            }
        }

        $jumlah = 'Modul: '.PapanModul::count().
            ' | Sub-modul: '.PapanItem::count().
            ' | Butir: '.PapanButir::count();

        $this->command?->info("PapanSeeder: {$jumlah} (koneksi {$koneksi->getName()}).");
    }
}

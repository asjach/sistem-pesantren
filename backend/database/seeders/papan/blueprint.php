<?php

/**
 * Cetak biru timeline Board per aplikasi.
 *
 * Format tiap poin: [deskripsi, [subpoin...]]. Setiap poin wajib punya
 * minimal satu subpoin. Status `sudah` otomatis menandai seluruh subpoinnya
 * selesai; status lain belum selesai.
 *
 * Urutan aplikasi mengikuti PapanService::APLIKASI. Modul dan sub-modul
 * diurutkan sesuai urutan array.
 */
return [
    'desktop-admin' => [
        ['kode' => 'DA1', 'nama' => 'Fondasi & Infrastruktur', 'sub' => [
            ['kode' => 'DA1.1', 'nama' => 'Setup & Runtime', 'butir' => [
                'sudah' => [
                    ['Proyek Laravel 13, Vite, dan Tauri berjalan', ['API-first', 'Sanctum', 'SQLite/MySQL siap']],
                    ['Konfigurasi dev dan produksi terdokumentasi', ['.env contoh', 'CORS localhost', 'perintah artisan/npm']],
                ],
            ]],
            ['kode' => 'DA1.2', 'nama' => 'Skema Database', 'butir' => [
                'sudah' => [
                    ['Migrasi dan skema pesantren terkendali', ['84 file migrasi', '126 tabel termasuk framework', 'SCHEMA.md']],
                    ['Database papan terpisah dari database pesantren', ['koneksi papan', 'migrasi path papan', 'tidak ikut migrate:fresh']],
                ],
            ]],
            ['kode' => 'DA1.3', 'nama' => 'Referensi & Master', 'butir' => [
                'sudah' => [
                    ['Kamus referensi per lembaga', ['34 tabel kamus', 'RefService ber-cache', 'fan-out']],
                    ['CRUD Lembaga, Tahun Ajaran, dan Kelas', ['scope tenant', 'validasi jenjang', 'kode unik']],
                ],
            ]],
        ]],
        ['kode' => 'DA2', 'nama' => 'Autentikasi & Pengguna', 'sub' => [
            ['kode' => 'DA2.1', 'nama' => 'Login & Sesi', 'butir' => [
                'sudah' => [
                    ['Login multi-identifier', ['email/HP/username', 'throttle 6/menit', 'login_audits']],
                    ['Kunci diri dan anti-eskalasi', ['tidak bisa hapus diri', 'role tidak naik sendiri', 'kebijakan izin']],
                ],
            ]],
            ['kode' => 'DA2.2', 'nama' => 'Peran & Izin', 'butir' => [
                'sudah' => [
                    ['Lima peran efektif dan matriks izin', ['super_admin/admin/guru/orang_tua/santri', 'IzinKatalog', 'PermissionSeeder']],
                    ['Mode lembaga dan pesantren', ['X-Lembaga-Aktif', 'scope tenant', 'act-as']],
                ],
            ]],
            ['kode' => 'DA2.3', 'nama' => 'Akun PTK', 'butir' => [
                'akan' => [
                    ['Undangan dan aktivasi akun guru', ['email/WA', 'token sekali pakai', 'reset kata sandi']],
                    ['Sinkron akun dengan data pegawai', ['tautan pegawai_id', 'peran guru/kasir', 'nonaktif otomatis']],
                ],
            ]],
        ]],
        ['kode' => 'DA3', 'nama' => 'PSB & Santri', 'sub' => [
            ['kode' => 'DA3.1', 'nama' => 'PSB', 'butir' => [
                'sudah' => [
                    ['Master kegiatan, gelombang, dan kuota', ['per lembaga', 'anti-tumpang', 'kuota']],
                    ['Pendaftaran dua jalur dan tahapan', ['langsung/seleksi', 'verifikasi', 'daftar ulang/ACC/undur']],
                    ['Aksi massal dan impor', ['promosi calon', 'dokumen', 'impor']],
                ],
            ]],
            ['kode' => 'DA3.2', 'nama' => 'Santri', 'butir' => [
                'sudah' => [
                    ['CRUD santri dan NIS', ['SantriPolicy', 'impor satu pintu', 'samakan NIS massal']],
                    ['Foto dan dokumen santri', ['unggah', 'jenis dokumen', 'viewer']],
                ],
            ]],
            ['kode' => 'DA3.3', 'nama' => 'Siklus Santri', 'butir' => [
                'sudah' => [
                    ['Naik kelas, pindah, mutasi, lulus', ['massal/otomatis', 'arsip', 'MI-MD']],
                    ['Roster dan status global', ['riwayat_belajar', 'status turunan', 'beku kelas']],
                ],
            ]],
            ['kode' => 'DA3.4', 'nama' => 'Presensi Santri', 'butir' => [
                'sudah' => [
                    ['Tabel presensi dan pelanggaran', ['sesi_presensi', 'presensi_santri', 'pelanggaran_santri']],
                ],
                'ditunda' => [
                    ['UI presensi dan pelanggaran', ['input per sesi', 'rekap kehadiran', 'poin pelanggaran']],
                ],
            ]],
            ['kode' => 'DA3.5', 'nama' => 'Asrama', 'butir' => [
                'ditunda' => [
                    ['Fondasi asrama', ['tabel asrama/kamar/penghuni', 'peran asrama', 'pivot user_asrama']],
                    ['Alur izin pulang dan kegiatan', ['pengajuan', 'persetujuan', 'kalender kegiatan']],
                ],
            ]],
        ]],
        ['kode' => 'DA4', 'nama' => 'Kepegawaian', 'sub' => [
            ['kode' => 'DA4.1', 'nama' => 'Pegawai', 'butir' => [
                'sudah' => [
                    ['Master pegawai global', ['EMIS', 'keaktifan_pegawai', 'sertifikasi']],
                    ['Walas dan akun PTK', ['setWalas tiga lapis', 'penautan akun', 'dokumen']],
                ],
            ]],
            ['kode' => 'DA4.2', 'nama' => 'Presensi Pegawai', 'butir' => [
                'sudah' => [
                    ['Tabel presensi pegawai', ['presensi_pegawai', 'status harian', 'rekap']],
                ],
                'ditunda' => [
                    ['UI absensi guru', ['input harian', 'koreksi', 'izin/cuti']],
                ],
            ]],
        ]],
        ['kode' => 'DA5', 'nama' => 'Kurikulum', 'sub' => [
            ['kode' => 'DA5.1', 'nama' => 'Mata Pelajaran', 'butir' => [
                'sudah' => [
                    ['Master mapel dan KKM', ['per jenjang', 'kelompok formal/pesantren', 'urutan rapor']],
                ],
                'akan' => [
                    ['Salin mapel antar tahun ajaran', ['pilih sumber', 'pratinjau', 'hindari duplikat']],
                ],
            ]],
            ['kode' => 'DA5.2', 'nama' => 'Pengampu', 'butir' => [
                'sudah' => [
                    ['Pivot kelas × mapel → guru', ['validasi bentrok', 'guru aktif', 'per TA']],
                ],
                'ditunda' => [
                    ['Tes komponen halaman Pengampu', ['tes render', 'tes validasi', 'tes izin']],
                ],
            ]],
            ['kode' => 'DA5.3', 'nama' => 'Jadwal Pelajaran', 'butir' => [
                'sudah' => [
                    ['Slot per jenjang dan anti bentrok', ['bentrok kelas', 'bentrok guru', 'grid mingguan']],
                    ['Jadwal per kelas', ['template', 'salin', 'cetak']],
                ],
                'akan' => [
                    ['Jadwal dari sudut guru', ['agenda mengajar', 'filter guru', 'tampilan mobile']],
                    ['Cetak/unduh jadwal', ['PDF', 'Excel', 'kop']],
                ],
            ]],
        ]],
        ['kode' => 'DA6', 'nama' => 'Penilaian', 'sub' => [
            ['kode' => 'DA6.1', 'nama' => 'Nilai & Peristiwa', 'butir' => [
                'sudah' => [
                    ['Nilai per peristiwa', ['PTS/ASAS/ASAT/UJIAN/UAP', 'komponen/bobot', 'sumber nilai']],
                    ['Leger crosstab dan rapor', ['ekspor Excel', 'cetak per santri/kelas', 'rekap']],
                    ['Impor nilai', ['empat template', 'import-potong', 'validasi']],
                ],
                'akan' => [
                    ['Kunci dan buka kunci nilai', ['kunci setelah cetak', 'alasan buka', 'log audit']],
                ],
                'ditunda' => [
                    ['Bobot UJIAN final', ['UM 60', 'rata-rata rapor 40', 'kebijakan pesantren']],
                ],
            ]],
            ['kode' => 'DA6.2', 'nama' => 'Cetak Rapor', 'butir' => [
                'sudah' => [
                    ['Rapor per santri/kelas', ['kop', 'identitas', 'nilai + terbilang']],
                    ['Validasi kelengkapan', ['kelas lengkap', 'tombol cetak terkunci', 'halaman 2']],
                ],
                'akan' => [
                    ['Cetak massal satu kelas', ['sekali klik', 'peringkat per batch', 'snapshot penanda tangan']],
                    ['Absensi otomatis', ['sesi_presensi', 'override leger', 'rekap kehadiran']],
                ],
            ]],
            ['kode' => 'DA6.3', 'nama' => 'Tahfizh', 'butir' => [
                'sudah' => [
                    ['Tabel tahfizh', ['target_tahfiz', 'setoran_tahfiz', 'rekap_tahfiz_santri']],
                ],
                'ditunda' => [
                    ['UI tahfizh', ['ziyadah', 'murajaah', 'rekap per santri']],
                ],
            ]],
        ]],
        ['kode' => 'DA7', 'nama' => 'Keuangan', 'sub' => [
            ['kode' => 'DA7.1', 'nama' => 'Tagihan & Tarif', 'butir' => [
                'sudah' => [
                    ['Master jenis tagihan dan tarif', ['per lembaga/TA', 'bulanan', 'dispensasi']],
                    ['Generate tagihan', ['anti duplikat', 'terbayar dilewati', 'kuota']],
                    ['Crosstab tagihan', ['dispensasi', 'grup custom', 'ekspor']],
                ],
                'akan' => [
                    ['Kartu piutang per santri', ['lintas TA', 'surat tagihan', 'cetak']],
                ],
            ]],
            ['kode' => 'DA7.2', 'nama' => 'Kasir & Kwitansi', 'butir' => [
                'sudah' => [
                    ['Kasir harian', ['pembayaran', 'saldo terkunci', 'batal/hapus']],
                    ['Kwitansi', ['cetak', 'cetak ulang', 'dialog/tabel']],
                ],
                'akan' => [
                    ['Nomor kwitansi runut', ['per lembaga/kas/tahun', 'format final', 'tidak ada hex acak']],
                    ['Split payment', ['gabungan metode', 'sub-bayar', 'rincian']],
                ],
            ]],
            ['kode' => 'DA7.3', 'nama' => 'Rekap & Tutup Buku', 'butir' => [
                'akan' => [
                    ['Rekap per posisi kas', ['tunai TU', 'bank lembaga', 'bank pesantren']],
                    ['Mutasi kas harian', ['arus masuk', 'per hari', 'filter']],
                    ['Tutup buku', ['tolak mundur', 'buka kunci', 'alasan']],
                ],
                'ditunda' => [
                    ['Tarif per asrama', ['menunggu modul asrama', 'tarif kamar', 'penghuni']],
                ],
            ]],
            ['kode' => 'DA7.4', 'nama' => 'Tunggakan', 'butir' => [
                'sudah' => [
                    ['Crosstab tunggakan', ['per santri/kelas', 'total tagihan', 'terbayar']],
                ],
                'akan' => [
                    ['Aging 30/60/90', ['jatuh tempo', 'surat tagihan', 'ekspor']],
                    ['Pengingat WhatsApp', ['template', 'antrean kirim', 'log']],
                ],
                'ditunda' => [
                    ['Tren penerimaan', ['bulanan', 'per TA', 'dasbor']],
                ],
            ]],
            ['kode' => 'DA7.5', 'nama' => 'Audit & Kontrol', 'butir' => [
                'akan' => [
                    ['Jejak audit transaksi', ['siapa', 'kapan', 'alasan']],
                    ['Maker-checker', ['pencatat', 'penyetuju', 'konflik peran']],
                    ['Ekspor laporan', ['Excel', 'PDF', 'crosstab/harian/rekap']],
                ],
            ]],
        ]],
        ['kode' => 'DA8', 'nama' => 'Portal & Integrasi', 'sub' => [
            ['kode' => 'DA8.1', 'nama' => 'Portal Wali', 'butir' => [
                'sudah' => [
                    ['Jalur PSB lanjutan dan pengajuan biodata', ['satu aktif per santri', 'batal', 'riwayat keluarga']],
                ],
                'akan' => [
                    ['Dashboard portal wali', ['ringkasan anak', 'tagihan', 'pengumuman']],
                    ['Aktor santri', ['peran santri', 'rute portal', 'batas data']],
                ],
            ]],
            ['kode' => 'DA8.2', 'nama' => 'API Mobile & Publik', 'butir' => [
                'akan' => [
                    ['Kontrak API mobile', ['versi API', 'token per device', 'dokumentasi']],
                    ['Endpoint publik landing', ['profil', 'berita', 'PSB']],
                    ['Rate limit dan observability', ['throttle', 'log', 'metrics']],
                ],
            ]],
        ]],
        ['kode' => 'DA9', 'nama' => 'Production & Operasional', 'sub' => [
            ['kode' => 'DA9.1', 'nama' => 'Deploy', 'butir' => [
                'ditunda' => [
                    ['Deploy VPS dan production', ['domain', 'TLS', 'queue/scheduler']],
                    ['Migrasi dan rollback', ['backup', 'urutan migrasi', 'rollback']],
                ],
            ]],
            ['kode' => 'DA9.2', 'nama' => 'Backup & Restore', 'butir' => [
                'akan' => [
                    ['Backup terjadwal', ['DB pesantren', 'DB papan', 'retensi']],
                    ['Uji restore', ['RTO/RPO', 'dokumentasi', 'simulasi']],
                ],
            ]],
            ['kode' => 'DA9.3', 'nama' => 'Monitoring & Log', 'butir' => [
                'akan' => [
                    ['Log aplikasi dan error', ['Laravel log', 'error tracking', 'rotasi']],
                    ['Monitoring uptime', ['health check', 'disk/DB', 'alert']],
                ],
            ]],
        ]],
        ['kode' => 'DA10', 'nama' => 'Dashboard & Laporan', 'sub' => [
            ['kode' => 'DA10.1', 'nama' => 'Dashboard Ringkas', 'butir' => [
                'sudah' => [
                    ['Ringkasan lintas modul', ['lembaga/santri/pegawai', 'keuangan/siklus/PSB', 'izin per blok']],
                ],
            ]],
            ['kode' => 'DA10.2', 'nama' => 'Statistik Pimpinan', 'butir' => [
                'ditunda' => [
                    ['Dashboard eksekutif', ['KPI', 'tren', 'perbandingan lembaga']],
                    ['Ekspor laporan pimpinan', ['PDF/Excel', 'jadwal kirim', 'filter periode']],
                ],
            ]],
        ]],
    ],

    'mobile-orang-tua' => [
        ['kode' => 'MO1', 'nama' => 'Akun & Onboarding', 'sub' => [
            ['kode' => 'MO1.1', 'nama' => 'API Autentikasi', 'butir' => [
                'sudah' => [
                    ['Login wali lewat API', ['Sanctum', 'multi-identifier', 'peran orang_tua']],
                ],
            ]],
            ['kode' => 'MO1.2', 'nama' => 'UI Mobile', 'butir' => [
                'akan' => [
                    ['Login dan onboarding wali', ['email/HP', 'OTP', 'pilih santri']],
                    ['Verifikasi relasi wali-santri', ['data wali', 'data santri', 'batas akses']],
                ],
            ]],
        ]],
        ['kode' => 'MO2', 'nama' => 'Profil Santri', 'sub' => [
            ['kode' => 'MO2.1', 'nama' => 'API Portal', 'butir' => [
                'sudah' => [
                    ['Rute portal wali', ['portal/*', 'role orang_tua', 'agregator baca']],
                ],
            ]],
            ['kode' => 'MO2.2', 'nama' => 'UI Profil', 'butir' => [
                'akan' => [
                    ['Biodata dan dokumen anak', ['lihat', 'unduh', 'pengajuan perubahan']],
                    ['Riwayat belajar', ['per lembaga', 'kelas', 'status aktif']],
                ],
            ]],
        ]],
        ['kode' => 'MO3', 'nama' => 'Tagihan & Pembayaran', 'sub' => [
            ['kode' => 'MO3.1', 'nama' => 'API Keuangan', 'butir' => [
                'sudah' => [
                    ['Data tagihan dan pembayaran', ['tagihan', 'kwitansi', 'tunggakan']],
                ],
            ]],
            ['kode' => 'MO3.2', 'nama' => 'UI Tagihan', 'butir' => [
                'akan' => [
                    ['Daftar tagihan per anak', ['jatuh tempo', 'status', 'filter']],
                    ['Pembayaran digital', ['metode', 'bukti', 'kwitansi']],
                    ['Tunggakan', ['aging', 'pengingat', 'riwayat']],
                ],
            ]],
        ]],
        ['kode' => 'MO4', 'nama' => 'Presensi & Perilaku', 'sub' => [
            ['kode' => 'MO4.1', 'nama' => 'API Presensi', 'butir' => [
                'sudah' => [
                    ['Tabel presensi santri', ['sesi', 'kehadiran', 'pelanggaran']],
                ],
            ]],
            ['kode' => 'MO4.2', 'nama' => 'UI Presensi', 'butir' => [
                'ditunda' => [
                    ['Presensi harian anak', ['per sesi', 'izin/sakit', 'rekap']],
                    ['Pelanggaran', ['jenis', 'poin', 'tindak lanjut']],
                ],
            ]],
        ]],
        ['kode' => 'MO5', 'nama' => 'Tahfizh', 'sub' => [
            ['kode' => 'MO5.1', 'nama' => 'API Tahfizh', 'butir' => [
                'sudah' => [
                    ['Tabel target dan setoran', ['target', 'setoran', 'rekap']],
                ],
            ]],
            ['kode' => 'MO5.2', 'nama' => 'UI Tahfizh', 'butir' => [
                'ditunda' => [
                    ['Target dan setoran', ['ziyadah', 'murajaah', 'grafik']],
                    ['Rekap tahfizh', ['periode', 'catatan guru', 'unduh']],
                ],
            ]],
        ]],
        ['kode' => 'MO6', 'nama' => 'PSB & Pengajuan', 'sub' => [
            ['kode' => 'MO6.1', 'nama' => 'API PSB', 'butir' => [
                'sudah' => [
                    ['Pendaftaran dan pengajuan', ['PSB', 'biodata', 'dokumen']],
                ],
            ]],
            ['kode' => 'MO6.2', 'nama' => 'UI PSB', 'butir' => [
                'akan' => [
                    ['PSB online', ['formulir', 'unggah dokumen', 'status']],
                    ['Pengajuan biodata', ['satu aktif', 'batal', 'verifikasi']],
                ],
            ]],
        ]],
        ['kode' => 'MO7', 'nama' => 'Notifikasi', 'sub' => [
            ['kode' => 'MO7.1', 'nama' => 'Push & WhatsApp', 'butir' => [
                'akan' => [
                    ['Notifikasi tagihan dan presensi', ['push', 'WhatsApp', 'deep link']],
                    ['Preferensi notifikasi', ['jenis', 'jam tenang', 'per anak']],
                ],
            ]],
        ]],
    ],

    'mobile-guru' => [
        ['kode' => 'MG1', 'nama' => 'Akun & Login', 'sub' => [
            ['kode' => 'MG1.1', 'nama' => 'API Autentikasi', 'butir' => [
                'sudah' => [
                    ['Login guru lewat API', ['Sanctum', 'multi-identifier', 'peran guru']],
                ],
            ]],
            ['kode' => 'MG1.2', 'nama' => 'UI Guru', 'butir' => [
                'akan' => [
                    ['Login mobile dan profil guru', ['email/HP', 'sesi perangkat', 'penempatan']],
                ],
            ]],
        ]],
        ['kode' => 'MG2', 'nama' => 'Jadwal Mengajar', 'sub' => [
            ['kode' => 'MG2.1', 'nama' => 'API Jadwal', 'butir' => [
                'sudah' => [
                    ['Jadwal per kelas', ['slot', 'anti bentrok', 'per TA']],
                ],
            ]],
            ['kode' => 'MG2.2', 'nama' => 'UI Jadwal', 'butir' => [
                'akan' => [
                    ['Agenda mengajar guru', ['hari ini', 'minggu', 'filter']],
                    ['Detail kelas', ['mapel', 'jam', 'ruang']],
                ],
            ]],
        ]],
        ['kode' => 'MG3', 'nama' => 'Input Nilai', 'sub' => [
            ['kode' => 'MG3.1', 'nama' => 'API Nilai', 'butir' => [
                'sudah' => [
                    ['Nilai per peristiwa', ['komponen', 'impor', 'leger']],
                ],
            ]],
            ['kode' => 'MG3.2', 'nama' => 'UI Input', 'butir' => [
                'akan' => [
                    ['Input nilai per kelas', ['mapel', 'komponen', 'validasi']],
                    ['Rekap dan submit nilai', ['kunci', 'status', 'koreksi']],
                ],
            ]],
        ]],
        ['kode' => 'MG4', 'nama' => 'Presensi Pegawai', 'sub' => [
            ['kode' => 'MG4.1', 'nama' => 'API Presensi', 'butir' => [
                'sudah' => [
                    ['Tabel presensi pegawai', ['status harian', 'rekap', 'koreksi']],
                ],
            ]],
            ['kode' => 'MG4.2', 'nama' => 'UI Presensi', 'butir' => [
                'ditunda' => [
                    ['Absen harian guru', ['masuk/pulang', 'lokasi', 'riwayat']],
                    ['Izin dan cuti', ['pengajuan', 'persetujuan', 'lampiran']],
                ],
            ]],
        ]],
        ['kode' => 'MG5', 'nama' => 'Setoran Tahfizh', 'sub' => [
            ['kode' => 'MG5.1', 'nama' => 'API Tahfizh', 'butir' => [
                'sudah' => [
                    ['Tabel setoran tahfizh', ['target', 'setoran', 'rekap']],
                ],
            ]],
            ['kode' => 'MG5.2', 'nama' => 'UI Setoran', 'butir' => [
                'ditunda' => [
                    ['Input setoran', ['ziyadah', 'murajaah', 'catatan']],
                    ['Rekap santri', ['per kelas', 'periode', 'unduh']],
                ],
            ]],
        ]],
        ['kode' => 'MG6', 'nama' => 'Pengampu & Kelas', 'sub' => [
            ['kode' => 'MG6.1', 'nama' => 'API Pengampu', 'butir' => [
                'sudah' => [
                    ['Pivot pengampu', ['kelas × mapel', 'guru', 'per TA']],
                ],
            ]],
            ['kode' => 'MG6.2', 'nama' => 'UI Pendampingan', 'butir' => [
                'akan' => [
                    ['Daftar kelas dan mapel', ['TA aktif', 'daftar siswa', 'filter']],
                    ['Catatan kelas', ['jurnal', 'tindak lanjut', 'riwayat']],
                ],
            ]],
        ]],
        ['kode' => 'MG7', 'nama' => 'Pengajuan & Izin', 'sub' => [
            ['kode' => 'MG7.1', 'nama' => 'Alur Pengajuan', 'butir' => [
                'akan' => [
                    ['Pengajuan izin guru', ['jenis', 'lampiran', 'atasan']],
                    ['Status pengajuan', ['riwayat', 'notifikasi', 'pembatalan']],
                ],
            ]],
        ]],
    ],

    'mobile-pimpinan' => [
        ['kode' => 'MP1', 'nama' => 'Akun & Login', 'sub' => [
            ['kode' => 'MP1.1', 'nama' => 'API Autentikasi', 'butir' => [
                'sudah' => [
                    ['Login pimpinan lewat API', ['Sanctum', 'multi-identifier', 'batas izin']],
                ],
            ]],
            ['kode' => 'MP1.2', 'nama' => 'UI Pimpinan', 'butir' => [
                'akan' => [
                    ['Login mobile pimpinan', ['email/HP', 'sesi perangkat', 'profil']],
                ],
            ]],
        ]],
        ['kode' => 'MP2', 'nama' => 'Dashboard Eksekutif', 'sub' => [
            ['kode' => 'MP2.1', 'nama' => 'API Ringkasan', 'butir' => [
                'sudah' => [
                    ['Ringkasan lintas modul', ['dashboard/ringkasan', 'izin per blok', 'null bila tak berizin']],
                ],
            ]],
            ['kode' => 'MP2.2', 'nama' => 'UI KPI', 'butir' => [
                'akan' => [
                    ['KPI dan tren', ['per lembaga', 'periode', 'perbandingan']],
                ],
                'ditunda' => [
                    ['Statistik pimpinan lanjutan', ['modul 504', 'ekspor', 'jadwal kirim']],
                ],
            ]],
        ]],
        ['kode' => 'MP3', 'nama' => 'Statistik Keuangan', 'sub' => [
            ['kode' => 'MP3.1', 'nama' => 'API Keuangan', 'butir' => [
                'sudah' => [
                    ['Data tagihan dan pembayaran', ['tagihan', 'terbayar', 'tunggakan']],
                ],
            ]],
            ['kode' => 'MP3.2', 'nama' => 'UI Keuangan', 'butir' => [
                'akan' => [
                    ['Tren keuangan', ['per lembaga', 'per kas', 'periode']],
                ],
            ]],
        ]],
        ['kode' => 'MP4', 'nama' => 'Statistik Santri & PSB', 'sub' => [
            ['kode' => 'MP4.1', 'nama' => 'API Santri & PSB', 'butir' => [
                'sudah' => [
                    ['Data santri dan PSB', ['jumlah aktif', 'funnel PSB', 'per lembaga']],
                ],
            ]],
            ['kode' => 'MP4.2', 'nama' => 'UI Santri', 'butir' => [
                'akan' => [
                    ['Statistik santri', ['per jenjang', 'siklus', 'mutasi']],
                ],
            ]],
        ]],
        ['kode' => 'MP5', 'nama' => 'Statistik Akademik', 'sub' => [
            ['kode' => 'MP5.1', 'nama' => 'API Akademik', 'butir' => [
                'sudah' => [
                    ['Data nilai dan kehadiran', ['nilai', 'jadwal', 'presensi']],
                ],
            ]],
            ['kode' => 'MP5.2', 'nama' => 'UI Akademik', 'butir' => [
                'akan' => [
                    ['Distribusi nilai dan kehadiran', ['per kelas', 'per mapel', 'peringatan']],
                ],
            ]],
        ]],
        ['kode' => 'MP6', 'nama' => 'Laporan & Ekspor', 'sub' => [
            ['kode' => 'MP6.1', 'nama' => 'Laporan', 'butir' => [
                'akan' => [
                    ['Laporan PDF/Excel', ['periode', 'per lembaga', 'filter']],
                    ['Jadwal kirim laporan', ['email/WA', 'rekap berkala', 'riwayat']],
                ],
            ]],
        ]],
        ['kode' => 'MP7', 'nama' => 'Notifikasi & Alert', 'sub' => [
            ['kode' => 'MP7.1', 'nama' => 'Alert', 'butir' => [
                'akan' => [
                    ['Ambang batas otomatis', ['tunggakan', 'kehadiran', 'nilai']],
                    ['Push dan riwayat alert', ['peristiwa', 'penerima', 'tindak lanjut']],
                ],
            ]],
        ]],
    ],

    'mobile-kasir' => [
        ['kode' => 'MK1', 'nama' => 'Akun & Login', 'sub' => [
            ['kode' => 'MK1.1', 'nama' => 'API Autentikasi', 'butir' => [
                'sudah' => [
                    ['Login kasir lewat API', ['Sanctum', 'multi-identifier', 'batas izin']],
                ],
            ]],
            ['kode' => 'MK1.2', 'nama' => 'UI Kasir', 'butir' => [
                'akan' => [
                    ['Login dan profil kasir', ['role kasir', 'perangkat', 'shift']],
                ],
            ]],
        ]],
        ['kode' => 'MK2', 'nama' => 'Kasir Harian', 'sub' => [
            ['kode' => 'MK2.1', 'nama' => 'API Kasir', 'butir' => [
                'sudah' => [
                    ['Pembayaran dan pembatalan', ['kasir', 'saldo terkunci', 'batal/hapus']],
                ],
            ]],
            ['kode' => 'MK2.2', 'nama' => 'UI Kasir', 'butir' => [
                'akan' => [
                    ['Cari santri dan pilih tagihan', ['pencarian', 'filter', 'rincian']],
                    ['Bayar dan cetak', ['metode', 'konfirmasi', 'kwitansi']],
                ],
            ]],
        ]],
        ['kode' => 'MK3', 'nama' => 'Kwitansi', 'sub' => [
            ['kode' => 'MK3.1', 'nama' => 'API Kwitansi', 'butir' => [
                'sudah' => [
                    ['Kwitansi dan cetak ulang', ['nomor', 'data bayar', 'riwayat']],
                ],
            ]],
            ['kode' => 'MK3.2', 'nama' => 'UI Kwitansi', 'butir' => [
                'akan' => [
                    ['Cetak thermal dan bagikan', ['thermal', 'PDF', 'WhatsApp']],
                    ['Nomor kwitansi runut', ['per kas', 'per tahun', 'format final']],
                ],
            ]],
        ]],
        ['kode' => 'MK4', 'nama' => 'Tunggakan', 'sub' => [
            ['kode' => 'MK4.1', 'nama' => 'API Tunggakan', 'butir' => [
                'sudah' => [
                    ['Crosstab tunggakan', ['per santri/kelas', 'total', 'terbayar']],
                ],
            ]],
            ['kode' => 'MK4.2', 'nama' => 'UI Tunggakan', 'butir' => [
                'akan' => [
                    ['Daftar tunggakan kasir', ['aging', 'surat', 'pengingat']],
                ],
            ]],
        ]],
        ['kode' => 'MK5', 'nama' => 'Tutup Buku & Rekap', 'sub' => [
            ['kode' => 'MK5.1', 'nama' => 'API Rekap', 'butir' => [
                'akan' => [
                    ['Rekap per posisi kas', ['tunai', 'bank', 'periode']],
                ],
            ]],
            ['kode' => 'MK5.2', 'nama' => 'UI Tutup Buku', 'butir' => [
                'akan' => [
                    ['Tutup buku harian', ['rekap', 'kunci', 'buka kunci']],
                ],
            ]],
        ]],
        ['kode' => 'MK6', 'nama' => 'Dispensasi', 'sub' => [
            ['kode' => 'MK6.1', 'nama' => 'API Dispensasi', 'butir' => [
                'sudah' => [
                    ['Dispensasi dan grup santri', ['disponsasi', 'grup custom', 'tagihan']],
                ],
            ]],
            ['kode' => 'MK6.2', 'nama' => 'UI Dispensasi', 'butir' => [
                'akan' => [
                    ['Pengajuan dan persetujuan', ['ajukan', 'setujui', 'riwayat']],
                ],
            ]],
        ]],
        ['kode' => 'MK7', 'nama' => 'Offline & Sinkronisasi', 'sub' => [
            ['kode' => 'MK7.1', 'nama' => 'Mode Offline', 'butir' => [
                'akan' => [
                    ['Cache data tagihan', ['santri', 'tagihan', 'saldo']],
                    ['Antrean transaksi', ['simpan lokal', 'retry', 'status']],
                ],
            ]],
            ['kode' => 'MK7.2', 'nama' => 'Sinkronisasi', 'butir' => [
                'akan' => [
                    ['Sinkron dan konflik', ['timestamp', 'konflik', 'audit']],
                ],
            ]],
        ]],
    ],

    'landing-pesantren' => [
        ['kode' => 'LP1', 'nama' => 'Profil & Identitas', 'sub' => [
            ['kode' => 'LP1.1', 'nama' => 'Struktur Halaman', 'butir' => [
                'akan' => [
                    ['Halaman profil pesantren', ['sejarah', 'visi-misi', 'struktur']],
                    ['Profil per lembaga', ['MI', 'MD', 'MTS', 'MLN']],
                ],
            ]],
            ['kode' => 'LP1.2', 'nama' => 'Konten Identitas', 'butir' => [
                'akan' => [
                    ['Fasilitas dan prestasi', ['fasilitas', 'prestasi', 'galeri']],
                ],
            ]],
        ]],
        ['kode' => 'LP2', 'nama' => 'PSB Online', 'sub' => [
            ['kode' => 'LP2.1', 'nama' => 'Formulir PSB', 'butir' => [
                'akan' => [
                    ['Formulir pendaftaran publik', ['jalur', 'data calon', 'unggah']],
                ],
            ]],
            ['kode' => 'LP2.2', 'nama' => 'Status & Biaya', 'butir' => [
                'akan' => [
                    ['Cek status dan biaya', ['status', 'biaya', 'konfirmasi']],
                ],
            ]],
        ]],
        ['kode' => 'LP3', 'nama' => 'Berita & Pengumuman', 'sub' => [
            ['kode' => 'LP3.1', 'nama' => 'CMS Berita', 'butir' => [
                'akan' => [
                    ['Kelola berita dan pengumuman', ['kategori', 'editor', 'jadwal terbit']],
                ],
            ]],
            ['kode' => 'LP3.2', 'nama' => 'Tampilan Publik', 'butir' => [
                'akan' => [
                    ['Daftar dan detail berita', ['daftar', 'detail', 'pencarian']],
                ],
            ]],
        ]],
        ['kode' => 'LP4', 'nama' => 'Galeri & Fasilitas', 'sub' => [
            ['kode' => 'LP4.1', 'nama' => 'Album', 'butir' => [
                'akan' => [
                    ['Album foto dan video', ['kategori', 'lazy load', 'caption']],
                ],
            ]],
            ['kode' => 'LP4.2', 'nama' => 'Virtual Tour', 'butir' => [
                'akan' => [
                    ['Tur 360 dan peta', ['360', 'peta', 'aksesibilitas']],
                ],
            ]],
        ]],
        ['kode' => 'LP5', 'nama' => 'Kontak & WhatsApp', 'sub' => [
            ['kode' => 'LP5.1', 'nama' => 'Kontak', 'butir' => [
                'akan' => [
                    ['Form kontak dan lokasi', ['form', 'maps', 'jam layanan']],
                ],
            ]],
            ['kode' => 'LP5.2', 'nama' => 'WhatsApp', 'butir' => [
                'akan' => [
                    ['WhatsApp dan antispam', ['deep link', 'template', 'antispam']],
                ],
            ]],
        ]],
        ['kode' => 'LP6', 'nama' => 'SEO & Analytics', 'sub' => [
            ['kode' => 'LP6.1', 'nama' => 'SEO Teknis', 'butir' => [
                'akan' => [
                    ['Metadata dan sitemap', ['metadata', 'sitemap', 'schema.org']],
                ],
            ]],
            ['kode' => 'LP6.2', 'nama' => 'Analytics', 'butir' => [
                'akan' => [
                    ['Analytics dan consent', ['GA4', 'event PSB', 'consent']],
                ],
            ]],
        ]],
        ['kode' => 'LP7', 'nama' => 'Multi-lembaga & Bahasa', 'sub' => [
            ['kode' => 'LP7.1', 'nama' => 'Multi-lembaga', 'butir' => [
                'akan' => [
                    ['Halaman per lembaga', ['jenjang', 'navigasi', 'konten']],
                ],
            ]],
            ['kode' => 'LP7.2', 'nama' => 'Bahasa & Aksesibilitas', 'butir' => [
                'akan' => [
                    ['Bahasa dan aksesibilitas', ['ID/EN', 'kontras', 'keyboard']],
                ],
            ]],
        ]],
        ['kode' => 'LP8', 'nama' => 'Keamanan & Performa', 'sub' => [
            ['kode' => 'LP8.1', 'nama' => 'Keamanan', 'butir' => [
                'akan' => [
                    ['Keamanan publik', ['HTTPS', 'anti-spam', 'rate limit']],
                ],
            ]],
            ['kode' => 'LP8.2', 'nama' => 'Performa', 'butir' => [
                'akan' => [
                    ['Performa halaman', ['cache', 'gambar', 'Lighthouse']],
                ],
            ]],
        ]],
    ],
];

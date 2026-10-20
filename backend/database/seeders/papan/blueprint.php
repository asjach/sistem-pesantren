<?php

/**
 * Cetak biru workflow Board per aplikasi.
 *
 * Format tiap poin: [deskripsi, [subpoin...]]. Setiap poin wajib punya
 * minimal satu subpoin. Status `done` otomatis menandai seluruh subpoinnya
 * selesai; status lain belum selesai.
 *
 * Urutan aplikasi mengikuti PapanService::APLIKASI. Modul dan sub-modul
 * diurutkan sesuai urutan array.
 */
return [
    'desktop-admin' => [
        ['kode' => 'DA1', 'nama' => 'Fondasi & Infrastruktur', 'sub' => [
            ['kode' => 'DA1.1', 'nama' => 'Setup & Runtime', 'butir' => [
                'done' => [
                    ['Proyek Laravel 13, Vite, dan Tauri berjalan', ['API-first', 'Sanctum', 'SQLite/MySQL siap']],
                    ['Konfigurasi dev dan produksi terdokumentasi', ['.env contoh', 'CORS localhost', 'perintah artisan/npm']],
                ],
            ]],
            ['kode' => 'DA1.2', 'nama' => 'Skema Database', 'butir' => [
                'done' => [
                    ['Migrasi dan skema pesantren terkendali', ['84 file migrasi', '126 tabel termasuk framework', 'SCHEMA.md']],
                    ['Database papan terpisah dari database pesantren', ['koneksi papan', 'migrasi path papan', 'tidak ikut migrate:fresh']],
                ],
            ]],
            ['kode' => 'DA1.3', 'nama' => 'Referensi & Master', 'butir' => [
                'done' => [
                    ['Kamus referensi per lembaga', ['34 tabel kamus', 'RefService ber-cache', 'fan-out']],
                    ['CRUD Lembaga, Tahun Ajaran, dan Kelas', ['scope tenant', 'validasi jenjang', 'kode unik']],
                ],
            ]],
            ['kode' => 'DA1.4', 'nama' => 'Pengaturan Aplikasi Desktop', 'butir' => [
                'done' => [
                    ['Pengaturan server dan sesi aman', ['URL API tersimpan', 'Uji koneksi', 'Token di keychain dengan fallback memori']],
                    ['Folder arsip dan mode dokumen', ['Pilih folder arsip', 'Mode dokumen', 'Peringatan bila akses folder ditolak']],
                ],
            ]],
        ]],
        ['kode' => 'DA2', 'nama' => 'Autentikasi & Pengguna', 'sub' => [
            ['kode' => 'DA2.1', 'nama' => 'Login & Sesi', 'butir' => [
                'done' => [
                    ['Login multi-identifier', ['email/HP/username', 'throttle 6/menit', 'login_audits']],
                    ['Kunci diri dan anti-eskalasi', ['tidak bisa hapus diri', 'role tidak naik sendiri', 'kebijakan izin']],
                ],
            ]],
            ['kode' => 'DA2.2', 'nama' => 'Peran & Izin', 'butir' => [
                'done' => [
                    ['Lima peran efektif dan matriks izin', ['super_admin/admin/guru/orang_tua/santri', 'IzinKatalog', 'PermissionSeeder']],
                    ['Mode lembaga dan pesantren', ['X-Lembaga-Aktif', 'scope tenant', 'act-as']],
                ],
            ]],
            ['kode' => 'DA2.3', 'nama' => 'Akun PTK', 'butir' => [
                'todo' => [
                    ['Undangan dan aktivasi akun guru', ['email/WA', 'token sekali pakai', 'reset kata sandi']],
                    ['Sinkron akun dengan data pegawai', ['tautan pegawai_id', 'peran guru/kasir', 'nonaktif otomatis']],
                ],
            ]],
        ]],
        ['kode' => 'DA3', 'nama' => 'PSB & Santri', 'sub' => [
            ['kode' => 'DA3.1', 'nama' => 'PSB', 'butir' => [
                'done' => [
                    ['Master kegiatan, gelombang, dan kuota', ['per lembaga', 'anti-tumpang', 'kuota']],
                    ['Pendaftaran dua jalur dan tahapan', ['langsung/seleksi', 'verifikasi', 'daftar ulang/ACC/undur']],
                    ['Aksi massal dan impor', ['promosi calon', 'dokumen', 'impor']],
                ],
            ]],
            ['kode' => 'DA3.2', 'nama' => 'Santri', 'butir' => [
                'done' => [
                    ['CRUD santri dan NIS', ['SantriPolicy', 'impor satu pintu', 'samakan NIS massal']],
                    ['Foto dan dokumen santri', ['unggah', 'jenis dokumen', 'viewer']],
                ],
            ]],
            ['kode' => 'DA3.3', 'nama' => 'Siklus Santri', 'butir' => [
                'done' => [
                    ['Naik kelas, pindah, mutasi, lulus', ['massal/otomatis', 'arsip', 'MI-MD']],
                    ['Roster dan status global', ['riwayat_belajar', 'status turunan', 'beku kelas']],
                ],
            ]],
            ['kode' => 'DA3.4', 'nama' => 'Presensi Santri', 'butir' => [
                'backlog' => [
                    ['UI presensi dan pelanggaran', ['input per sesi', 'rekap kehadiran', 'poin pelanggaran']],
                ],
                'todo' => [
                    ['Pencatatan presensi harian lewat API', ['Sesi presensi per kelas', 'Input kehadiran massal', 'Status hadir/sakit/izin/alpa', 'Rekap kehadiran per santri']],
                    ['Poin pelanggaran dan tindak lanjut', ['Kategori dan bobot pelanggaran', 'Poin otomatis dari kejadian', 'Riwayat dan tindak lanjut']],
                ],
                'done' => [
                    ['Tabel presensi dan pelanggaran', ['sesi_presensi', 'presensi_santri', 'pelanggaran_santri']],
                ],
            ]],
            ['kode' => 'DA3.5', 'nama' => 'Asrama', 'butir' => [
                'backlog' => [
                    ['Fondasi asrama', ['tabel asrama/kamar/penghuni', 'peran asrama', 'pivot user_asrama']],
                    ['Alur izin pulang dan kegiatan', ['pengajuan', 'persetujuan', 'kalender kegiatan']],
                    ['Kamar dan penempatan santri', ['Data kamar dan kapasitas', 'Penempatan dan mutasi kamar', 'Pembina per kamar']],
                ],
            ]],
        ]],
        ['kode' => 'DA4', 'nama' => 'Kepegawaian', 'sub' => [
            ['kode' => 'DA4.1', 'nama' => 'Pegawai', 'butir' => [
                'done' => [
                    ['Master pegawai global', ['EMIS', 'keaktifan_pegawai', 'sertifikasi']],
                    ['Walas dan akun PTK', ['setWalas tiga lapis', 'penautan akun', 'dokumen']],
                ],
            ]],
            ['kode' => 'DA4.2', 'nama' => 'Presensi Pegawai', 'butir' => [
                'backlog' => [
                    ['UI absensi guru', ['input harian', 'koreksi', 'izin/cuti']],
                ],
                'todo' => [
                    ['Pencatatan presensi pegawai lewat API', ['Absen masuk dan pulang', 'Izin dan cuti', 'Rekap kehadiran per pegawai']],
                ],
                'done' => [
                    ['Tabel presensi pegawai', ['presensi_pegawai', 'status harian', 'rekap']],
                ],
            ]],
        ]],
        ['kode' => 'DA5', 'nama' => 'Kurikulum', 'sub' => [
            ['kode' => 'DA5.1', 'nama' => 'Mata Pelajaran', 'butir' => [
                'for_review' => [
                    ['Salin daftar mapel antar kelas (TA sama) dengan pratinjau', ['Sumber hanya kelas pada tahun ajaran yang sama', 'Pratinjau mapel yang akan ditambahkan vs dilewati', 'Hindari duplikat: mapel yang sudah ada tidak disalin ulang', 'Verifikasi: KurikulumModulTest 9/9 (169 asersi) + suite FE 1427/1427 + npm run typecheck']],
                ],
                'done' => [
                    ['Master mapel dan KKM', ['per jenjang', 'kelompok formal/pesantren', 'urutan rapor']],
                ],
            ]],
            ['kode' => 'DA5.2', 'nama' => 'Pengampu', 'butir' => [
                'backlog' => [
                    ['Tes komponen halaman Pengampu', ['tes render', 'tes validasi', 'tes izin']],
                ],
                'done' => [
                    ['Pivot kelas × mapel → guru', ['validasi bentrok', 'guru aktif', 'per TA']],
                ],
            ]],
            ['kode' => 'DA5.3', 'nama' => 'Jadwal Pelajaran', 'butir' => [
                'todo' => [
                    ['Jadwal dari sudut guru', ['agenda mengajar', 'filter guru', 'tampilan mobile']],
                    ['Cetak/unduh jadwal', ['PDF', 'Excel', 'kop']],
                ],
                'for_review' => [
                    ['Salin jadwal pelajaran dari tahun ajaran lain (sejenjang)', ['Pilih TA sumber; tujuan = TA aktif; lembaga/jenjang harus sama', 'Pratinjau: kelas, slot, pengampu, dan sel jadwal yang akan disalin atau dilewati', 'Hanya kelas yang sudah ada di TA tujuan; kelas lain dilewati dan dilaporkan', 'Slot, pengampu, dan sel jadwal ikut disalin; guru tanpa keaktifan di TA tujuan dikosongkan', 'Sel jadwal yang sudah terisi di TA tujuan tidak ditimpa', 'Verifikasi: KurikulumModulTest 9/9 (169 asersi) + suite FE 1427/1427 + npm run typecheck']],
                    ['Status Jadwal Pelajaran', ['Status per kelas: "Draft", "Pembahasan", "Final"', 'Status lembaga + tahun ajaran turunan: Final bila SELURUH kelas Final; selain itu Draft/Pembahasan', 'Jadwal kelas Final tidak bisa diubah; harus diubah dulu menjadi Draft', 'Jadwal hasil salin dari tahun ajaran sebelumnya berstatus Draft', 'Verifikasi: KurikulumModulTest 10/10 (192 asersi) + suite FE 1427/1427 + npm run typecheck; ERD divalidasi (9 blok, 0 masalah)']],
                    ['Varian Jadwal Pelajaran', ['Simpan varian manual: snapshot slot, pengampu, dan sel jadwal + nama', 'Riwayat varian: daftar berisi waktu, pembuat, status, dan ringkasan isi', 'Varian aktif yang dipakai; hanya satu aktif per tahun ajaran + lembaga', 'Mengaktifkan varian memulihkan jadwal dari snapshot (kelas Final dilewati)', 'Verifikasi: KurikulumModulTest 11/11 (215 asersi) + suite FE 1427/1427 + typecheck; ERD 116 entitas/154 hubungan, 0 masalah']],
                ],
                'done' => [
                    ['Slot per jenjang dan anti bentrok', ['bentrok kelas', 'bentrok guru', 'grid mingguan']],
                    ['Jadwal per kelas', ['template', 'salin', 'cetak']],
                ],
            ]],
            ['kode' => 'DA5.4', 'nama' => 'Struktur Kurikulum', 'butir' => [
                'for_review' => [
                    ['tabel struktur kurikulum', ['Halaman baru Kurikulum → Struktur Kurikulum', 'Struktur per VARIAN jadwal; combobox memilih varian, termasuk yang tidak aktif', 'Baris = mapel aktif jenjang; kolom = tingkat jenjang', 'JP per minggu dihitung otomatis dari snapshot varian (terbanyak antar kelas satu tingkat); JP per tahun = JP/minggu × minggu efektif', 'Baris terakhir = jumlah per tingkat; combobox menampilkan JP per minggu atau per tahun', 'Minggu efektif per jenjang + tahun ajaran; tabel baca-saja dan hanya referensi (tidak mengunci jadwal)', 'Verifikasi: tes backend + frontend + typecheck; SCHEMA/ERD diselaraskan']],
                ],
            ]],
        ]],
        ['kode' => 'DA6', 'nama' => 'Penilaian', 'sub' => [
            ['kode' => 'DA6.1', 'nama' => 'Nilai & Peristiwa', 'butir' => [
                'backlog' => [
                    ['Bobot UJIAN final', ['UM 60', 'rata-rata rapor 40', 'kebijakan pesantren']],
                ],
                'todo' => [
                    ['Kunci dan buka kunci nilai', ['kunci setelah cetak', 'alasan buka', 'log audit']],
                ],
                'done' => [
                    ['Nilai per peristiwa', ['PTS/ASAS/ASAT/UJIAN/UAP', 'komponen/bobot', 'sumber nilai']],
                    ['Leger crosstab dan rapor', ['ekspor Excel', 'cetak per santri/kelas', 'rekap']],
                    ['Impor nilai', ['empat template', 'import-potong', 'validasi']],
                ],
            ]],
            ['kode' => 'DA6.2', 'nama' => 'Cetak Rapor', 'butir' => [
                'todo' => [
                    ['Cetak massal satu kelas', ['sekali klik', 'peringkat per batch', 'snapshot penanda tangan']],
                    ['Absensi otomatis', ['sesi_presensi', 'override leger', 'rekap kehadiran']],
                ],
                'done' => [
                    ['Rapor per santri/kelas', ['kop', 'identitas', 'nilai + terbilang']],
                    ['Validasi kelengkapan', ['kelas lengkap', 'tombol cetak terkunci', 'halaman 2']],
                ],
            ]],
            ['kode' => 'DA6.3', 'nama' => 'Tahfizh', 'butir' => [
                'backlog' => [
                    ['UI tahfizh', ['ziyadah', 'murajaah', 'rekap per santri']],
                ],
                'todo' => [
                    ['Target dan setoran tahfizh lewat API', ['Target per santri', 'Setoran ziyadah dan murajaah', 'Rekap capaian per periode']],
                ],
                'done' => [
                    ['Tabel tahfizh', ['target_tahfiz', 'setoran_tahfiz', 'rekap_tahfiz_santri']],
                ],
            ]],
            ['kode' => 'DA6.X', 'nama' => 'Cetak Kartu Peserta', 'butir' => [
                'todo' => [
                    ['cetak kartu peserta peristiwa', []],
                    ['ukuran (tinggi dan lebar) bisa dicustom', []],
                ],
            ]],
        ]],
        ['kode' => 'DA7', 'nama' => 'Keuangan', 'sub' => [
            ['kode' => 'DA7.1', 'nama' => 'Tagihan & Tarif', 'butir' => [
                'todo' => [
                    ['Kartu piutang per santri', ['lintas TA', 'surat tagihan', 'cetak']],
                ],
                'done' => [
                    ['Master jenis tagihan dan tarif', ['per lembaga/TA', 'bulanan', 'dispensasi']],
                    ['Generate tagihan', ['anti duplikat', 'terbayar dilewati', 'kuota']],
                    ['Crosstab tagihan', ['dispensasi', 'grup custom', 'ekspor']],
                ],
            ]],
            ['kode' => 'DA7.2', 'nama' => 'Kasir & Kwitansi', 'butir' => [
                'todo' => [
                    ['Nomor kwitansi runut', ['per lembaga/kas/tahun', 'format final', 'tidak ada hex acak']],
                    ['Split payment', ['gabungan metode', 'sub-bayar', 'rincian']],
                ],
                'done' => [
                    ['Kasir harian', ['pembayaran', 'saldo terkunci', 'batal/hapus']],
                    ['Kwitansi', ['cetak', 'cetak ulang', 'dialog/tabel']],
                ],
            ]],
            ['kode' => 'DA7.3', 'nama' => 'Rekap & Tutup Buku', 'butir' => [
                'backlog' => [
                    ['Tarif per asrama', ['menunggu modul asrama', 'tarif kamar', 'penghuni']],
                ],
                'todo' => [
                    ['Rekap per posisi kas', ['tunai TU', 'bank lembaga', 'bank pesantren']],
                    ['Mutasi kas harian', ['arus masuk', 'per hari', 'filter']],
                    ['Tutup buku', ['tolak mundur', 'buka kunci', 'alasan']],
                ],
            ]],
            ['kode' => 'DA7.4', 'nama' => 'Tunggakan', 'butir' => [
                'backlog' => [
                    ['Tren penerimaan', ['bulanan', 'per TA', 'dasbor']],
                ],
                'todo' => [
                    ['Aging 30/60/90', ['jatuh tempo', 'surat tagihan', 'ekspor']],
                    ['Pengingat WhatsApp', ['template', 'antrean kirim', 'log']],
                ],
                'done' => [
                    ['Crosstab tunggakan', ['per santri/kelas', 'total tagihan', 'terbayar']],
                ],
            ]],
            ['kode' => 'DA7.5', 'nama' => 'Audit & Kontrol', 'butir' => [
                'todo' => [
                    ['Jejak audit transaksi', ['siapa', 'kapan', 'alasan']],
                    ['Maker-checker', ['pencatat', 'penyetuju', 'konflik peran']],
                    ['Ekspor laporan', ['Excel', 'PDF', 'crosstab/harian/rekap']],
                ],
            ]],
        ]],
        ['kode' => 'DA8', 'nama' => 'Portal & Integrasi', 'sub' => [
            ['kode' => 'DA8.1', 'nama' => 'Portal Wali', 'butir' => [
                'todo' => [
                    ['Dashboard portal wali', ['ringkasan anak', 'tagihan', 'pengumuman']],
                    ['Aktor santri', ['peran santri', 'rute portal', 'batas data']],
                    ['Portal tagihan dan pembayaran anak', ['Ringkasan tagihan per anak', 'Riwayat pembayaran', 'Unduh kwitansi']],
                    ['Portal akademik dan tahfizh anak', ['Nilai dan rapor', 'Presensi harian', 'Capaian tahfizh']],
                ],
                'done' => [
                    ['Jalur PSB lanjutan dan pengajuan biodata', ['satu aktif per santri', 'batal', 'riwayat keluarga']],
                ],
            ]],
            ['kode' => 'DA8.2', 'nama' => 'API Mobile & Publik', 'butir' => [
                'todo' => [
                    ['Kontrak API mobile', ['versi API', 'token per device', 'dokumentasi']],
                    ['Endpoint publik landing', ['profil', 'berita', 'PSB']],
                    ['Rate limit dan observability', ['throttle', 'log', 'metrics']],
                    ['Izin bawaan peran guru', ['Jadwal dan kelas yang diampu', 'Input nilai', 'Presensi pegawai', 'Setoran tahfizh']],
                ],
            ]],
            ['kode' => 'DA8.3', 'nama' => 'Notifikasi & Gateway', 'butir' => [
                'todo' => [
                    ['Gateway WhatsApp dan email', ['Penyedia dan kredensial', 'Antrean pengiriman', 'Status dan percobaan ulang']],
                    ['Push notification mobile', ['Pendaftaran perangkat', 'Topik per peran', 'Preferensi pengguna']],
                    ['Riwayat dan status notifikasi', ['Log pengiriman', 'Status dibaca', 'Penanganan gagal kirim']],
                ],
            ]],
        ]],
        ['kode' => 'DA9', 'nama' => 'Production & Operasional', 'sub' => [
            ['kode' => 'DA9.1', 'nama' => 'Deploy', 'butir' => [
                'backlog' => [
                    ['Deploy VPS dan production', ['domain', 'TLS', 'queue/scheduler']],
                    ['Migrasi dan rollback', ['backup', 'urutan migrasi', 'rollback']],
                ],
            ]],
            ['kode' => 'DA9.2', 'nama' => 'Backup & Restore', 'butir' => [
                'todo' => [
                    ['Backup terjadwal', ['DB pesantren', 'DB papan', 'retensi']],
                    ['Uji restore', ['RTO/RPO', 'dokumentasi', 'simulasi']],
                ],
            ]],
            ['kode' => 'DA9.3', 'nama' => 'Monitoring & Log', 'butir' => [
                'todo' => [
                    ['Log aplikasi dan error', ['Laravel log', 'error tracking', 'rotasi']],
                    ['Monitoring uptime', ['health check', 'disk/DB', 'alert']],
                ],
            ]],
            ['kode' => 'DA9.4', 'nama' => 'Rilis & Distribusi', 'butir' => [
                'backlog' => [
                    ['Paket rilis desktop', ['DMG macOS', 'Installer Windows', 'Versi dan changelog']],
                    ['Tanda tangan dan pembaruan otomatis', ['Signing', 'Notarization', 'Auto-update']],
                ],
                'todo' => [
                    ['Build otomatis lintas sistem', ['CI backend', 'CI desktop', 'Artefak rilis tersimpan']],
                ],
            ]],
        ]],
        ['kode' => 'DA10', 'nama' => 'Dashboard & Laporan', 'sub' => [
            ['kode' => 'DA10.1', 'nama' => 'Dashboard Ringkas', 'butir' => [
                'done' => [
                    ['Ringkasan lintas modul', ['lembaga/santri/pegawai', 'keuangan/siklus/PSB', 'izin per blok']],
                ],
            ]],
            ['kode' => 'DA10.2', 'nama' => 'Statistik Pimpinan', 'butir' => [
                'backlog' => [
                    ['Dashboard eksekutif', ['KPI', 'tren', 'perbandingan lembaga']],
                    ['Ekspor laporan pimpinan', ['PDF/Excel', 'jadwal kirim', 'filter periode']],
                ],
            ]],
            ['kode' => 'DA10.3', 'nama' => 'Laporan Terpusat', 'butir' => [
                'todo' => [
                    ['Katalog laporan lintas modul', ['Santri dan siklus', 'Akademik dan rapor', 'Keuangan dan tunggakan', 'Kepegawaian dan PSB']],
                    ['Ekspor dan pengiriman terjadwal', ['Ekspor PDF dan Excel', 'Jadwal kirim', 'Riwayat pengiriman']],
                ],
            ]],
        ]],
        ['kode' => 'DA11', 'nama' => 'Kerangka UI & Tampilan', 'sub' => [
            ['kode' => 'DA11.1', 'nama' => 'Tabel & Grid', 'butir' => [
                'done' => [
                    ['Grid tabel bergaya Excel', ['Seleksi blok dan salin/tempel TSV', 'Autofit dan atur lebar kolom', 'Header beku dan scrollbar melayang', 'Simpan otomatis per sel']],
                    ['Preset kolom, urutan, dan toolbar', ['Preset kolom per pengguna', 'Urutan dan visibilitas kolom', 'Toolbar preset dan komponen input custom']],
                ],
            ]],
            ['kode' => 'DA11.2', 'nama' => 'Navigasi & Pencarian', 'butir' => [
                'done' => [
                    ['Command palette dan pencarian global', ['Pintasan membuka palette', 'Pencarian halaman dan tabel', 'Pencarian cepat di topbar']],
                    ['Tab halaman dan jendela terpisah', ['Tab halaman gabungan', 'Preferensi tab terakhir', 'Profil santri di jendela lepas']],
                    ['Filter dan visibilitas per halaman', ['Pilihan filter yang tampil', 'Visibilitas kolom per tabel', 'Tersimpan per halaman']],
                ],
            ]],
            ['kode' => 'DA11.3', 'nama' => 'Tampilan & Aksesibilitas', 'butir' => [
                'todo' => [
                    ['Bantuan keyboard dan pembaca layar', ['Overlay peta pintasan', 'Navigasi VoiceOver di halaman utama', 'Uji aksesibilitas dan kontras']],
                ],
                'done' => [
                    ['Tema, density, dan mode navigasi', ['Terang/gelap/sistem', 'Density dan radius sudut', 'Sidebar/menubar dan sembilan set ikon']],
                ],
            ]],
            ['kode' => 'DA11.4', 'nama' => 'Halaman Board', 'butir' => [
                'done' => [
                    ['Kolom status tanpa sub-modul terlipat saat Board dibuka', ['Kolom tanpa sub-modul tertutup saat halaman Board dibuka', 'Kolom yang punya sub-modul terbuka', 'Kolom Selesai (Done) selalu tertutup secara default', 'Bukaan manual pengguna tetap setelah data disegarkan', 'Verifikasi: 27 tes komponen Board lulus + npm run typecheck']],
                    ['Rail modul menandai modul yang punya pekerjaan For Review', ['Modul dengan poin For Review berlatar warna berbeda di rail modul', 'Modul tanpa For Review tetap netral', 'Warna tetap terbaca saat modul itu sedang aktif', 'Verifikasi: tes pustaka + typecheck + pratinjau visual']],
                ],
            ]],
        ]],
        ['kode' => 'DA12', 'nama' => 'Dokumen & Berkas', 'sub' => [
            ['kode' => 'DA12.1', 'nama' => 'Arsip Dokumen', 'butir' => [
                'done' => [
                    ['Dokumen santri, pegawai, dan lembaga', ['Tiga jenis pemilik dokumen', 'Unggah dan unduh berkas', 'Penampil PDF dan gambar', 'Status kelengkapan berkas wajib']],
                    ['Arsip lokal desktop dan sinkron dokumen', ['Folder arsip lokal', 'Pindai dan garis panduan', 'Sinkron dokumen massal', 'Pilihan mode penyimpanan']],
                ],
            ]],
            ['kode' => 'DA12.2', 'nama' => 'Impor & Ekspor Berkas', 'butir' => [
                'done' => [
                    ['Impor XLSX bertahap dengan pratinjau', ['Unduh template per modul', 'Pratinjau baris sebelum simpan', 'Potong baris dan unduh daftar galat', 'Batal dan pulihkan hasil impor']],
                    ['Ekspor tabel ke XLSX dan TSV', ['Ekspor mengikuti filter aktif', 'Salin blok sebagai TSV', 'Simpan berkas lewat dialog desktop']],
                ],
            ]],
        ]],
    ],
    'mobile-orang-tua' => [
        ['kode' => 'MO0', 'nama' => 'Fondasi & Rilis', 'sub' => [
            ['kode' => 'MO0.1', 'nama' => 'Kerangka & Distribusi', 'butir' => [
                'backlog' => [
                    ['Kerangka aplikasi mobile', ['Pilihan stack dan struktur proyek', 'Navigasi dan tema dasar', 'Konfigurasi API dan sesi']],
                    ['Build dan distribusi rilis', ['Build debug dan rilis', 'Distribusi uji internal', 'Tanda tangan dan rilis toko']],
                ],
            ]],
        ]],
        ['kode' => 'MO1', 'nama' => 'Akun & Onboarding', 'sub' => [
            ['kode' => 'MO1.1', 'nama' => 'API Autentikasi', 'butir' => [
                'done' => [
                    ['Login wali lewat API', ['Sanctum', 'multi-identifier', 'peran orang_tua']],
                ],
            ]],
            ['kode' => 'MO1.2', 'nama' => 'UI Mobile', 'butir' => [
                'todo' => [
                    ['Login dan onboarding wali', ['email/HP', 'OTP', 'pilih santri']],
                    ['Verifikasi relasi wali-santri', ['data wali', 'data santri', 'batas akses']],
                ],
            ]],
        ]],
        ['kode' => 'MO2', 'nama' => 'Profil Santri', 'sub' => [
            ['kode' => 'MO2.1', 'nama' => 'API Portal', 'butir' => [
                'done' => [
                    ['Rute portal wali', ['portal/*', 'role orang_tua', 'agregator baca']],
                ],
            ]],
            ['kode' => 'MO2.2', 'nama' => 'UI Profil', 'butir' => [
                'todo' => [
                    ['Biodata dan dokumen anak', ['lihat', 'unduh', 'pengajuan perubahan']],
                    ['Riwayat belajar', ['per lembaga', 'kelas', 'status aktif']],
                ],
            ]],
        ]],
        ['kode' => 'MO3', 'nama' => 'Tagihan & Pembayaran', 'sub' => [
            ['kode' => 'MO3.1', 'nama' => 'API Keuangan', 'butir' => [
                'todo' => [
                    ['API tagihan dan pembayaran untuk portal wali', ['Daftar tagihan per anak', 'Riwayat pembayaran', 'Sisa tunggakan per anak']],
                ],
            ]],
            ['kode' => 'MO3.2', 'nama' => 'UI Tagihan', 'butir' => [
                'todo' => [
                    ['Daftar tagihan per anak', ['jatuh tempo', 'status', 'filter']],
                    ['Pembayaran digital', ['metode', 'bukti', 'kwitansi']],
                    ['Tunggakan', ['aging', 'pengingat', 'riwayat']],
                ],
            ]],
        ]],
        ['kode' => 'MO4', 'nama' => 'Presensi & Perilaku', 'sub' => [
            ['kode' => 'MO4.1', 'nama' => 'API Presensi', 'butir' => [
                'done' => [
                    ['Tabel presensi santri', ['sesi', 'kehadiran', 'pelanggaran']],
                ],
            ]],
            ['kode' => 'MO4.2', 'nama' => 'UI Presensi', 'butir' => [
                'backlog' => [
                    ['Presensi harian anak', ['per sesi', 'izin/sakit', 'rekap']],
                    ['Pelanggaran', ['jenis', 'poin', 'tindak lanjut']],
                ],
            ]],
        ]],
        ['kode' => 'MO5', 'nama' => 'Tahfizh', 'sub' => [
            ['kode' => 'MO5.1', 'nama' => 'API Tahfizh', 'butir' => [
                'done' => [
                    ['Tabel target dan setoran', ['target', 'setoran', 'rekap']],
                ],
            ]],
            ['kode' => 'MO5.2', 'nama' => 'UI Tahfizh', 'butir' => [
                'backlog' => [
                    ['Target dan setoran', ['ziyadah', 'murajaah', 'grafik']],
                    ['Rekap tahfizh', ['periode', 'catatan guru', 'unduh']],
                ],
            ]],
        ]],
        ['kode' => 'MO6', 'nama' => 'PSB & Pengajuan', 'sub' => [
            ['kode' => 'MO6.1', 'nama' => 'API PSB', 'butir' => [
                'done' => [
                    ['Pendaftaran dan pengajuan', ['PSB', 'biodata', 'dokumen']],
                ],
            ]],
            ['kode' => 'MO6.2', 'nama' => 'UI PSB', 'butir' => [
                'todo' => [
                    ['PSB online', ['formulir', 'unggah dokumen', 'status']],
                    ['Pengajuan biodata', ['satu aktif', 'batal', 'verifikasi']],
                ],
            ]],
        ]],
        ['kode' => 'MO7', 'nama' => 'Notifikasi', 'sub' => [
            ['kode' => 'MO7.1', 'nama' => 'Push & WhatsApp', 'butir' => [
                'todo' => [
                    ['Notifikasi tagihan dan presensi', ['push', 'WhatsApp', 'deep link']],
                    ['Preferensi notifikasi', ['jenis', 'jam tenang', 'per anak']],
                ],
            ]],
        ]],
    ],
    'mobile-guru' => [
        ['kode' => 'MG0', 'nama' => 'Fondasi & Rilis', 'sub' => [
            ['kode' => 'MG0.1', 'nama' => 'Kerangka & Distribusi', 'butir' => [
                'backlog' => [
                    ['Kerangka aplikasi mobile', ['Pilihan stack dan struktur proyek', 'Navigasi dan tema dasar', 'Konfigurasi API dan sesi']],
                    ['Build dan distribusi rilis', ['Build debug dan rilis', 'Distribusi uji internal', 'Tanda tangan dan rilis toko']],
                ],
            ]],
        ]],
        ['kode' => 'MG1', 'nama' => 'Akun & Login', 'sub' => [
            ['kode' => 'MG1.1', 'nama' => 'API Autentikasi', 'butir' => [
                'done' => [
                    ['Login guru lewat API', ['Sanctum', 'multi-identifier', 'peran guru']],
                ],
            ]],
            ['kode' => 'MG1.2', 'nama' => 'UI Guru', 'butir' => [
                'todo' => [
                    ['Login mobile dan profil guru', ['email/HP', 'sesi perangkat', 'penempatan']],
                ],
            ]],
        ]],
        ['kode' => 'MG2', 'nama' => 'Jadwal Mengajar', 'sub' => [
            ['kode' => 'MG2.1', 'nama' => 'API Jadwal', 'butir' => [
                'done' => [
                    ['Jadwal per kelas', ['slot', 'anti bentrok', 'per TA']],
                ],
            ]],
            ['kode' => 'MG2.2', 'nama' => 'UI Jadwal', 'butir' => [
                'todo' => [
                    ['Agenda mengajar guru', ['hari ini', 'minggu', 'filter']],
                    ['Detail kelas', ['mapel', 'jam', 'ruang']],
                ],
            ]],
        ]],
        ['kode' => 'MG3', 'nama' => 'Input Nilai', 'sub' => [
            ['kode' => 'MG3.1', 'nama' => 'API Nilai', 'butir' => [
                'done' => [
                    ['Nilai per peristiwa', ['komponen', 'impor', 'leger']],
                ],
            ]],
            ['kode' => 'MG3.2', 'nama' => 'UI Input', 'butir' => [
                'todo' => [
                    ['Input nilai per kelas', ['mapel', 'komponen', 'validasi']],
                    ['Rekap dan submit nilai', ['kunci', 'status', 'koreksi']],
                ],
            ]],
        ]],
        ['kode' => 'MG4', 'nama' => 'Presensi Pegawai', 'sub' => [
            ['kode' => 'MG4.1', 'nama' => 'API Presensi', 'butir' => [
                'done' => [
                    ['Tabel presensi pegawai', ['status harian', 'rekap', 'koreksi']],
                ],
            ]],
            ['kode' => 'MG4.2', 'nama' => 'UI Presensi', 'butir' => [
                'backlog' => [
                    ['Absen harian guru', ['masuk/pulang', 'lokasi', 'riwayat']],
                    ['Izin dan cuti', ['pengajuan', 'persetujuan', 'lampiran']],
                ],
            ]],
        ]],
        ['kode' => 'MG5', 'nama' => 'Setoran Tahfizh', 'sub' => [
            ['kode' => 'MG5.1', 'nama' => 'API Tahfizh', 'butir' => [
                'done' => [
                    ['Tabel setoran tahfizh', ['target', 'setoran', 'rekap']],
                ],
            ]],
            ['kode' => 'MG5.2', 'nama' => 'UI Setoran', 'butir' => [
                'backlog' => [
                    ['Input setoran', ['ziyadah', 'murajaah', 'catatan']],
                    ['Rekap santri', ['per kelas', 'periode', 'unduh']],
                ],
            ]],
        ]],
        ['kode' => 'MG6', 'nama' => 'Pengampu & Kelas', 'sub' => [
            ['kode' => 'MG6.1', 'nama' => 'API Pengampu', 'butir' => [
                'done' => [
                    ['Pivot pengampu', ['kelas × mapel', 'guru', 'per TA']],
                ],
            ]],
            ['kode' => 'MG6.2', 'nama' => 'UI Pendampingan', 'butir' => [
                'todo' => [
                    ['Daftar kelas dan mapel', ['TA aktif', 'daftar siswa', 'filter']],
                    ['Catatan kelas', ['jurnal', 'tindak lanjut', 'riwayat']],
                ],
            ]],
        ]],
        ['kode' => 'MG7', 'nama' => 'Pengajuan & Izin', 'sub' => [
            ['kode' => 'MG7.1', 'nama' => 'Alur Pengajuan', 'butir' => [
                'todo' => [
                    ['Pengajuan izin guru', ['jenis', 'lampiran', 'atasan']],
                    ['Status pengajuan', ['riwayat', 'notifikasi', 'pembatalan']],
                ],
            ]],
        ]],
    ],
    'mobile-pimpinan' => [
        ['kode' => 'MP0', 'nama' => 'Fondasi & Rilis', 'sub' => [
            ['kode' => 'MP0.1', 'nama' => 'Kerangka & Distribusi', 'butir' => [
                'backlog' => [
                    ['Kerangka aplikasi mobile', ['Pilihan stack dan struktur proyek', 'Navigasi dan tema dasar', 'Konfigurasi API dan sesi']],
                    ['Build dan distribusi rilis', ['Build debug dan rilis', 'Distribusi uji internal', 'Tanda tangan dan rilis toko']],
                ],
            ]],
        ]],
        ['kode' => 'MP1', 'nama' => 'Akun & Login', 'sub' => [
            ['kode' => 'MP1.1', 'nama' => 'API Autentikasi', 'butir' => [
                'done' => [
                    ['Login pimpinan lewat API', ['Sanctum', 'multi-identifier', 'batas izin']],
                ],
            ]],
            ['kode' => 'MP1.2', 'nama' => 'UI Pimpinan', 'butir' => [
                'todo' => [
                    ['Login mobile pimpinan', ['email/HP', 'sesi perangkat', 'profil']],
                ],
            ]],
        ]],
        ['kode' => 'MP2', 'nama' => 'Dashboard Eksekutif', 'sub' => [
            ['kode' => 'MP2.1', 'nama' => 'API Ringkasan', 'butir' => [
                'done' => [
                    ['Ringkasan lintas modul', ['dashboard/ringkasan', 'izin per blok', 'null bila tak berizin']],
                ],
            ]],
            ['kode' => 'MP2.2', 'nama' => 'UI KPI', 'butir' => [
                'backlog' => [
                    ['Statistik pimpinan lanjutan', ['modul 504', 'ekspor', 'jadwal kirim']],
                ],
                'todo' => [
                    ['KPI dan tren', ['per lembaga', 'periode', 'perbandingan']],
                ],
            ]],
        ]],
        ['kode' => 'MP3', 'nama' => 'Statistik Keuangan', 'sub' => [
            ['kode' => 'MP3.1', 'nama' => 'API Keuangan', 'butir' => [
                'done' => [
                    ['Data tagihan dan pembayaran', ['tagihan', 'terbayar', 'tunggakan']],
                ],
            ]],
            ['kode' => 'MP3.2', 'nama' => 'UI Keuangan', 'butir' => [
                'todo' => [
                    ['Tren keuangan', ['per lembaga', 'per kas', 'periode']],
                ],
            ]],
        ]],
        ['kode' => 'MP4', 'nama' => 'Statistik Santri & PSB', 'sub' => [
            ['kode' => 'MP4.1', 'nama' => 'API Santri & PSB', 'butir' => [
                'done' => [
                    ['Data santri dan PSB', ['jumlah aktif', 'funnel PSB', 'per lembaga']],
                ],
            ]],
            ['kode' => 'MP4.2', 'nama' => 'UI Santri', 'butir' => [
                'todo' => [
                    ['Statistik santri', ['per jenjang', 'siklus', 'mutasi']],
                ],
            ]],
        ]],
        ['kode' => 'MP5', 'nama' => 'Statistik Akademik', 'sub' => [
            ['kode' => 'MP5.1', 'nama' => 'API Akademik', 'butir' => [
                'done' => [
                    ['Data nilai dan kehadiran', ['nilai', 'jadwal', 'presensi']],
                ],
            ]],
            ['kode' => 'MP5.2', 'nama' => 'UI Akademik', 'butir' => [
                'todo' => [
                    ['Distribusi nilai dan kehadiran', ['per kelas', 'per mapel', 'peringatan']],
                ],
            ]],
        ]],
        ['kode' => 'MP6', 'nama' => 'Laporan & Ekspor', 'sub' => [
            ['kode' => 'MP6.1', 'nama' => 'Laporan', 'butir' => [
                'todo' => [
                    ['Laporan PDF/Excel', ['periode', 'per lembaga', 'filter']],
                    ['Jadwal kirim laporan', ['email/WA', 'rekap berkala', 'riwayat']],
                ],
            ]],
        ]],
        ['kode' => 'MP7', 'nama' => 'Notifikasi & Alert', 'sub' => [
            ['kode' => 'MP7.1', 'nama' => 'Alert', 'butir' => [
                'todo' => [
                    ['Ambang batas otomatis', ['tunggakan', 'kehadiran', 'nilai']],
                    ['Push dan riwayat alert', ['peristiwa', 'penerima', 'tindak lanjut']],
                ],
            ]],
        ]],
    ],
    'mobile-kasir' => [
        ['kode' => 'MK0', 'nama' => 'Fondasi & Rilis', 'sub' => [
            ['kode' => 'MK0.1', 'nama' => 'Kerangka & Distribusi', 'butir' => [
                'backlog' => [
                    ['Kerangka aplikasi mobile', ['Pilihan stack dan struktur proyek', 'Navigasi dan tema dasar', 'Konfigurasi API dan sesi']],
                    ['Build dan distribusi rilis', ['Build debug dan rilis', 'Distribusi uji internal', 'Tanda tangan dan rilis toko']],
                ],
            ]],
        ]],
        ['kode' => 'MK1', 'nama' => 'Akun & Login', 'sub' => [
            ['kode' => 'MK1.1', 'nama' => 'API Autentikasi', 'butir' => [
                'done' => [
                    ['Login kasir lewat API', ['Sanctum', 'multi-identifier', 'batas izin']],
                ],
            ]],
            ['kode' => 'MK1.2', 'nama' => 'UI Kasir', 'butir' => [
                'todo' => [
                    ['Login dan profil kasir', ['role kasir', 'perangkat', 'shift']],
                ],
            ]],
            ['kode' => 'MK1.3', 'nama' => 'Peran & Izin Kasir', 'butir' => [
                'backlog' => [
                    ['Peran dan izin kasir untuk aplikasi mobile', ['Buat peran kasir', 'Izin kasir: pembayaran, kwitansi, tunggakan', 'Uji login dan akses kasir']],
                ],
            ]],
        ]],
        ['kode' => 'MK2', 'nama' => 'Kasir Harian', 'sub' => [
            ['kode' => 'MK2.1', 'nama' => 'API Kasir', 'butir' => [
                'done' => [
                    ['Pembayaran dan pembatalan', ['kasir', 'saldo terkunci', 'batal/hapus']],
                ],
            ]],
            ['kode' => 'MK2.2', 'nama' => 'UI Kasir', 'butir' => [
                'todo' => [
                    ['Cari santri dan pilih tagihan', ['pencarian', 'filter', 'rincian']],
                    ['Bayar dan cetak', ['metode', 'konfirmasi', 'kwitansi']],
                ],
            ]],
        ]],
        ['kode' => 'MK3', 'nama' => 'Kwitansi', 'sub' => [
            ['kode' => 'MK3.1', 'nama' => 'API Kwitansi', 'butir' => [
                'done' => [
                    ['Kwitansi dan cetak ulang', ['nomor', 'data bayar', 'riwayat']],
                ],
            ]],
            ['kode' => 'MK3.2', 'nama' => 'UI Kwitansi', 'butir' => [
                'todo' => [
                    ['Cetak thermal dan bagikan', ['thermal', 'PDF', 'WhatsApp']],
                    ['Nomor kwitansi runut', ['per kas', 'per tahun', 'format final']],
                ],
            ]],
        ]],
        ['kode' => 'MK4', 'nama' => 'Tunggakan', 'sub' => [
            ['kode' => 'MK4.1', 'nama' => 'API Tunggakan', 'butir' => [
                'done' => [
                    ['Crosstab tunggakan', ['per santri/kelas', 'total', 'terbayar']],
                ],
            ]],
            ['kode' => 'MK4.2', 'nama' => 'UI Tunggakan', 'butir' => [
                'todo' => [
                    ['Daftar tunggakan kasir', ['aging', 'surat', 'pengingat']],
                ],
            ]],
        ]],
        ['kode' => 'MK5', 'nama' => 'Tutup Buku & Rekap', 'sub' => [
            ['kode' => 'MK5.1', 'nama' => 'API Rekap', 'butir' => [
                'todo' => [
                    ['Rekap per posisi kas', ['tunai', 'bank', 'periode']],
                ],
            ]],
            ['kode' => 'MK5.2', 'nama' => 'UI Tutup Buku', 'butir' => [
                'todo' => [
                    ['Tutup buku harian', ['rekap', 'kunci', 'buka kunci']],
                ],
            ]],
        ]],
        ['kode' => 'MK6', 'nama' => 'Dispensasi', 'sub' => [
            ['kode' => 'MK6.1', 'nama' => 'API Dispensasi', 'butir' => [
                'done' => [
                    ['Dispensasi dan grup santri', ['disponsasi', 'grup custom', 'tagihan']],
                ],
            ]],
            ['kode' => 'MK6.2', 'nama' => 'UI Dispensasi', 'butir' => [
                'todo' => [
                    ['Pengajuan dan persetujuan', ['ajukan', 'setujui', 'riwayat']],
                ],
            ]],
        ]],
        ['kode' => 'MK7', 'nama' => 'Offline & Sinkronisasi', 'sub' => [
            ['kode' => 'MK7.1', 'nama' => 'Mode Offline', 'butir' => [
                'todo' => [
                    ['Cache data tagihan', ['santri', 'tagihan', 'saldo']],
                    ['Antrean transaksi', ['simpan lokal', 'retry', 'status']],
                ],
            ]],
            ['kode' => 'MK7.2', 'nama' => 'Sinkronisasi', 'butir' => [
                'todo' => [
                    ['Sinkron dan konflik', ['timestamp', 'konflik', 'audit']],
                ],
            ]],
        ]],
    ],
    'landing-pesantren' => [
        ['kode' => 'LP0', 'nama' => 'Fondasi & Peluncuran', 'sub' => [
            ['kode' => 'LP0.1', 'nama' => 'Fondasi Teknis', 'butir' => [
                'backlog' => [
                    ['Keputusan stack dan hosting', ['Pilihan framework/static site', 'Hosting dan CDN', 'Alur build dan rilis']],
                    ['Domain, HTTPS, dan email resmi', ['Domain dan DNS', 'Sertifikat HTTPS', 'Email resmi pesantren']],
                ],
                'todo' => [
                    ['Integrasi data publik', ['Profil pesantren dan lembaga', 'Formulir PSB publik', 'Berita dan pengumuman']],
                ],
            ]],
            ['kode' => 'LP0.2', 'nama' => 'Peluncuran', 'butir' => [
                'backlog' => [
                    ['Migrasi konten awal', ['Teks profil dan visi-misi', 'Foto fasilitas dan kegiatan', 'Daftar prestasi']],
                    ['Uji aksesibilitas dan performa', ['Kontras dan navigasi keyboard', 'Skor Lighthouse', 'Uji di perangkat mobile']],
                    ['Peluncuran dan pemantauan', ['Pemeriksaan akhir', 'Pemantauan uptime', 'Rencana perbaikan']],
                ],
            ]],
        ]],
        ['kode' => 'LP1', 'nama' => 'Profil & Identitas', 'sub' => [
            ['kode' => 'LP1.1', 'nama' => 'Struktur Halaman', 'butir' => [
                'todo' => [
                    ['Halaman profil pesantren', ['sejarah', 'visi-misi', 'struktur']],
                    ['Profil per lembaga', ['MI', 'MD', 'MTS', 'MLN']],
                ],
            ]],
            ['kode' => 'LP1.2', 'nama' => 'Konten Identitas', 'butir' => [
                'todo' => [
                    ['Fasilitas dan prestasi', ['fasilitas', 'prestasi', 'galeri']],
                ],
            ]],
        ]],
        ['kode' => 'LP2', 'nama' => 'PSB Online', 'sub' => [
            ['kode' => 'LP2.1', 'nama' => 'Formulir PSB', 'butir' => [
                'todo' => [
                    ['Formulir pendaftaran publik', ['jalur', 'data calon', 'unggah']],
                ],
                'done' => [
                    ['Prototipe formulir PSB publik berjalan', ['Pilihan lembaga dan paket', 'Data calon dan cek NIK', 'Unggah bukti transfer', 'Nomor pendaftaran']],
                ],
            ]],
            ['kode' => 'LP2.2', 'nama' => 'Status & Biaya', 'butir' => [
                'todo' => [
                    ['Cek status dan biaya', ['status', 'biaya', 'konfirmasi']],
                ],
            ]],
        ]],
        ['kode' => 'LP3', 'nama' => 'Berita & Pengumuman', 'sub' => [
            ['kode' => 'LP3.1', 'nama' => 'CMS Berita', 'butir' => [
                'todo' => [
                    ['Kelola berita dan pengumuman', ['kategori', 'editor', 'jadwal terbit']],
                ],
            ]],
            ['kode' => 'LP3.2', 'nama' => 'Tampilan Publik', 'butir' => [
                'todo' => [
                    ['Daftar dan detail berita', ['daftar', 'detail', 'pencarian']],
                ],
            ]],
        ]],
        ['kode' => 'LP4', 'nama' => 'Galeri & Fasilitas', 'sub' => [
            ['kode' => 'LP4.1', 'nama' => 'Album', 'butir' => [
                'todo' => [
                    ['Album foto dan video', ['kategori', 'lazy load', 'caption']],
                ],
            ]],
            ['kode' => 'LP4.2', 'nama' => 'Virtual Tour', 'butir' => [
                'todo' => [
                    ['Tur 360 dan peta', ['360', 'peta', 'aksesibilitas']],
                ],
            ]],
        ]],
        ['kode' => 'LP5', 'nama' => 'Kontak & WhatsApp', 'sub' => [
            ['kode' => 'LP5.1', 'nama' => 'Kontak', 'butir' => [
                'todo' => [
                    ['Form kontak dan lokasi', ['form', 'maps', 'jam layanan']],
                ],
            ]],
            ['kode' => 'LP5.2', 'nama' => 'WhatsApp', 'butir' => [
                'todo' => [
                    ['WhatsApp dan antispam', ['deep link', 'template', 'antispam']],
                ],
            ]],
        ]],
        ['kode' => 'LP6', 'nama' => 'SEO & Analytics', 'sub' => [
            ['kode' => 'LP6.1', 'nama' => 'SEO Teknis', 'butir' => [
                'todo' => [
                    ['Metadata dan sitemap', ['metadata', 'sitemap', 'schema.org']],
                ],
            ]],
            ['kode' => 'LP6.2', 'nama' => 'Analytics', 'butir' => [
                'todo' => [
                    ['Analytics dan consent', ['GA4', 'event PSB', 'consent']],
                ],
            ]],
        ]],
        ['kode' => 'LP7', 'nama' => 'Multi-lembaga & Bahasa', 'sub' => [
            ['kode' => 'LP7.1', 'nama' => 'Multi-lembaga', 'butir' => [
                'todo' => [
                    ['Halaman per lembaga', ['jenjang', 'navigasi', 'konten']],
                ],
            ]],
            ['kode' => 'LP7.2', 'nama' => 'Bahasa & Aksesibilitas', 'butir' => [
                'todo' => [
                    ['Bahasa dan aksesibilitas', ['ID/EN', 'kontras', 'keyboard']],
                ],
            ]],
        ]],
        ['kode' => 'LP8', 'nama' => 'Keamanan & Performa', 'sub' => [
            ['kode' => 'LP8.1', 'nama' => 'Keamanan', 'butir' => [
                'todo' => [
                    ['Keamanan publik', ['HTTPS', 'anti-spam', 'rate limit']],
                ],
            ]],
            ['kode' => 'LP8.2', 'nama' => 'Performa', 'butir' => [
                'todo' => [
                    ['Performa halaman', ['cache', 'gambar', 'Lighthouse']],
                ],
            ]],
        ]],
    ],
];

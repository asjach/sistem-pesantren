# Skema Database — SIMPES (dokumentasi, bukan kode)

> Sumber: vault `Backend/002_Skema_Database.md` + migration
> `2026_09_09_000001_create_all_tables_v1.php` (+ `0001_*_create_users_table.php`
> untuk tabel auth bawaan). Bahasa Indonesia persis DB. Tipe logis umum.
> Keputusan: single-pesantren via `lembaga` + pivot `user_lembaga` (no.40);
> 36 `ref_*` global+shadow (no.50); seed no.51; pitfall multi-NULL MySQL →
> dedup di service, bukan index (`002` catatan 9).

Urutan CREATE: `lembaga` → `ref_*` → `users` → `user_lembaga` →
`tahun_ajaran` → `pegawai` → `kelas` (`walas_id` inline) → santri/riwayat →
PSB → keuangan → kepegawaian → akademik → nilai → presensi → tahfizh → portal.
`down()` sebaliknya (dependent dulu). `migrate:fresh` boleh pre-production.

## Auth bawaan Laravel (`0001_*_create_users_table.php`)

`users`: `id` PK; `name`; `email`? unique (null boleh, multi-identifier);
`phone`? unique; `username`? unique; `email_verified_at`? (=now saat dibuat admin);
`password` (hashed); `last_login_at`?; `remember_token`; timestamps.
Tanpa kolom tenant — tenant = pivot `user_lembaga`.
`password_reset_tokens`, `sessions`: standar Laravel.

## BLOK 1 — Dasar & Referensi (Modul 003 Auth Login + 004 Referensi-Master)

### `lembaga`
- `id` PK
- `parent_id`: FK → lembaga [null, nullOnDelete] — null = root pesantren
- `nama`: string — PENYATUAN: bukan 'nama_lembaga'
- `nama_singkat`: string [null] — EMIS: nama singkatan
- `kode`: string(20) [null] — kode beku: PESANTREN (root), MI, MD, MTS, MUA (untuk no_pendaftaran + tampilan)
- `mudir_am`: string [null] — kepala lembaga (di root = pimpinan pesantren, di unit = kepala madrasah)
- `jenjang`: string [null] — free string (tidak di-enum)
- `status`: enum(negeri|swasta) [default 'swasta'] — EMIS: status madrasah
- `npsn`: string(20) [null, unique] — EMIS/Kemendikbud, global unique
- `nsm`: string(30) [null, unique] — EMIS/Kemenag 12 digit, global unique
- `npwp`: string [null] — EMIS/BOS
- UNIQUE(`kode`) — kode lembaga unik global (single-pesantren)
- `no_izin_operasional`: string [null] — Legalitas full EMIS:
- `tgl_izin`: date [null]
- `no_sk_pendirian`: string [null]
- `tgl_sk_pendirian`: date [null]
- `tahun_berdiri`: int [null]
- `no_sk_kemenkumham`: string [null]
- `akreditasi`: enum(A|B|C|belum) [null]
- `tgl_akreditasi`: date [null]
- `penyelenggara`: string [null] — yayasan/perorangan
- `provinsi`: string [null] — Wilayah pecah (ekspor EMIS) + alamat jalan/detail:
- `kab_kota`: string [null]
- `kecamatan`: string [null]
- `desa`: string [null]
- `rt`: string(3) [null] — string agar '01' utuh
- `rw`: string(3) [null]
- `kode_pos`: string(10) [null] — ejaan kode_pos selaras santri
- `alamat`: text [null] — jalan/detail
- `lintang`: decimal(10, 7) [null] — koordinat EMIS lokasi
- `bujur`: decimal(10, 7) [null]
- `telepon`: string [null] — Kontak + branding per lembaga (null = fallback ke pesantren):
- `email`: string [null]
- `website`: string [null]
- `logo_url`: string [null]
- `waktu_belajar`: enum(pagi|siang|pagi_siang) [null] — Operasional: / pagi_siang = "pagi dan siang"
- `mode_rapor`: enum(terpisah|digabung) [default 'digabung'] — Kolom Modul 202 (mode rapor):
- `template_rapor`: string [default 'default']
- `psb_butuh_seleksi_default`: bool [default false] — Kolom Modul 100 PSB (konfigurasi jalur fleksibel): / false = jalur langsung (A), true = jalur seleksi (B)
- `kelompok_psb`: enum(combo_mi_md|eksklusif_mts) [default 'combo_mi_md'] — aturan daftar ganda
- `is_active`: bool [default true] — nonaktifkan tanpa hapus
- `created_at`, `updated_at`

### `ref_agama`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`lembaga_id`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_cita_cita`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`lembaga_id`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_hobi`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`lembaga_id`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_pekerjaan`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`lembaga_id`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_pendidikan`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`lembaga_id`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_kebutuhan_khusus`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`lembaga_id`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_kota`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`lembaga_id`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_alamat`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `nama`: string — mis. 'Sekebolek'
- `provinsi`: string [null]
- `kab_kota`: string [null]
- `kecamatan`: string [null]
- `desa_kelurahan`: string [null]
- `alamat`: text [null]
- `rt`: string(3) [null]
- `rw`: string(3) [null]
- `kode_pos`: string(10) [null]
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`lembaga_id`, `nama`) — scope LEMBAGA, pola KEY sama dengan ref lain

### `ref_status_awal`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `kode`: string — santri_baru, naik_kelas, mengulang, pindahan (+ custom)
- `label`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`lembaga_id`, `kode`)

### `ref_status_akhir`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `kode`: string — aktif, naik, tidak_naik, pindah_keluar, lulus, tidak_lulus (+ custom, no.51)
- `label`: string
- `is_aktif_bawaan`: bool [default false] — Sifat logika (terkunci untuk baris sistem): / true HANYA untuk 'aktif' (is_aktif=true iff status_akhir aktif)
- `terminal_ke`: string [null] — null = bukan terminal (custom baru selalu null = non-aktif netral)
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`lembaga_id`, `kode`)

### `user_lembaga`
- `id` PK
- `user_id`: FK → users [cascade]
- `lembaga_id`: FK → lembaga [cascade]
- `created_at`, `updated_at`
- UNIQUE(`user_id`, `lembaga_id`)

### `login_audits`
- `id` PK
- `user_id`: FK → users [null, nullOnDelete]
- `identifier`: string — email/phone/username yang dicoba
- `ip`: ipAddress [null]
- `user_agent`: string [null]
- `sukses`: bool [default false]
- `created_at`: timestamp [null]

### `tahun_ajaran`
- `id` PK
- `lembaga_id`: FK → lembaga [cascade]
- `nama`: string — misal: '2025/2026' (PENYATUAN: bukan 'nama_tahun_ajaran')
- `tanggal_mulai`: date [null]
- `tanggal_selesai`: date [null]
- `is_aktif`: bool [default false]
- `created_at`, `updated_at`
- UNIQUE(`lembaga_id`, `nama`) — nama tahun unik per lembaga

### `pegawai`
- `id` PK
- `user_id`: FK → users [null, nullOnDelete] — akun login
- `nip`: string [null]
- `nik`: string(16) [null]
- `nama_lengkap`: string
- `gelar_depan`: string [null]
- `gelar_belakang`: string [null]
- `jenis_kelamin`: enum(L|P)
- `tempat_lahir`: string [null]
- `tanggal_lahir`: date [null]
- `no_hp`: string(20) [null]
- `email_pribadi`: string [null] — data saja (BUKAN link akun; jembatan akun hanya user_id)
- `email_gws`: string [null] — Google Workspace (data saja)
- `foto_url`: string [null]
- `npwp`: string [null]
- `no_kk`: string(16) [null]
- `status_pernikahan`: string [null] — ref_status_pernikahan
- `agama`: string [null] — ref_agama
- `no_bpjs`: string [null]
- `gol_darah`: string [null] — ref_gol_darah
- `status_tempat_tinggal`: string [null] — ref_status_tinggal
- `pendidikan_terakhir`: string [null] — ref_pendidikan
- `niat_npa`: string [null] — nomor keanggotaan Persatuan Islam (bebas, tanpa unique)
- `jenis_ptk`: string [null] — ref_jenis_ptk
- `jarak_ke_pesantren`: string [null] — ref_jarak
- `waktu_tempuh`: string [null] — ref_waktu_tempuh
- `transportasi`: string [null] — ref_transportasi
- `sertifikasi`: enum(sudah|belum) [default 'belum'] — ringkas; auto-sync baris pegawai_sertifikasi
- `provinsi`: string [null] — Alamat pecah selaras santri:
- `kab_kota`: string [null] — ref_kota saran
- `kecamatan`: string [null]
- `desa_kelurahan`: string [null]
- `rt`: string(3) [null]
- `rw`: string(3) [null]
- `kode_pos`: string [null]
- `alamat`: text [null] — jalan/detail
- `tgl_mulai_kerja`: date [null]
- `status_aktif`: enum(aktif|cuti|keluar) [default 'aktif']
- `created_at`, `updated_at`
- UNIQUE(`nip`)
- UNIQUE(`nik`)

### `kelas`
- `id` PK
- `lembaga_id`: FK → lembaga [cascade]
- `tahun_ajaran_id`: FK → tahun_ajaran [cascade]
- `walas_id`: FK → pegawai [null, nullOnDelete] — wali kelas → pegawai
- `tingkat`: string [null] — ref_tingkat ('7','8','9'); grouping saat kelas_id null di riwayat
- `nama_kelas`: string — 'VII-A'
- `kapasitas`: int [null]
- `created_at`, `updated_at`

### Pola `ref_*` (26 tabel loop + eksplisit `ref_agama/cita_cita/hobi/pekerjaan/pendidikan/kebutuhan_khusus/kota/alamat/status_awal/status_akhir`)
- Kolom: `id` PK; `lembaga_id`? FK → `lembaga` (null=global, terisi=milik lembaga); `nama`; `urutan` [default 0]; `is_active` [default true]; unique(`lembaga_id`,`nama`) — pitfall multi-NULL, dedup di `RefService`.
- `ref_alamat` tambahan: wilayah free string + snapshot autofill. `ref_status_akhir`: `is_aktif_bawaan`, `terminal_ke`.
- Tabel loop: `ref_penghasilan`, `ref_transportasi`, `ref_status_tinggal`, `ref_jarak`, `ref_waktu_tempuh`, `ref_bahasa_sehari_hari`, `ref_disabilitas`, `ref_tmp_lahir`, `ref_status_ortu`, `ref_yang_membiayai`, `ref_provinsi`, `ref_kecamatan`, `ref_desa_kelurahan`, `ref_alasan_mutasi`, `ref_jenis_dokumen_santri`, `ref_jenis_dokumen_pegawai`, `ref_status_pernikahan`, `ref_gol_darah`, `ref_jenis_ptk`, `ref_jenjang_sertifikasi`, `ref_tingkat`, `ref_tugas_utama`, `ref_tipe_pelanggaran`, `ref_kategori_kas`, `ref_metode_pembayaran`, `ref_jalur_sertifikasi`

## BLOK 2 — Santri & Riwayat (Modul 101 Santri Master + 102 Siklus Santri)

### `santri`
- `id` PK
- `lembaga_id`: FK → lembaga [cascade] — Relasi Lembaga & Kelas Saat Ini (Kondisi Aktif Terakhir)
- `kelas_id`: FK → kelas [null, nullOnDelete]
- `nama_lengkap`: string — Identitas Personal
- `nama_singkat`: string [null]
- `nik`: string(16) [null]
- `nisn`: string(10) [null]
- `nis`: string [null] — NIS aktif terakhir (kuitansi/rapor/leger/portal)
- `tmp_lahir`: string [null] — kamus ref_tmp_lahir
- `tgl_lahir`: date [null]
- `jk`: enum(L|P)
- `anak_ke`: int [null]
- `j_saudara`: int [null]
- `tipe_santri`: enum(asrama|non_asrama) [default 'non_asrama']
- `no_hp_santri`: string [null]
- `email_santri`: string [null]
- `agama`: string [null] — Relasi Tabel Kamus (string bebas nullable, TANPA FK — hanya saran combobox) / ref_agama
- `cita_cita`: string [null] — ref_cita_cita
- `hobi`: string [null] — ref_hobi
- `kebutuhan_khusus`: string [null] — ref_kebutuhan_khusus
- `kebutuhan_disabilitas`: string [null] — ref_disabilitas
- `nomor_kip`: string [null]
- `ayah_nama`: string [null]
- `ayah_nik`: string(16) [null]
- `ayah_tmp_lahir`: string [null] — ref_tmp_lahir
- `ayah_tgl_lahir`: date [null]
- `ayah_status`: string [null] — ref_status_ortu
- `ayah_pekerjaan`: string [null] — ref_pekerjaan
- `ayah_pendidikan`: string [null] — ref_pendidikan
- `ayah_penghasilan`: string [null] — ref_penghasilan
- `ayah_telp`: string [null]
- `ayah_alamat`: string [null]
- `ayah_status_tempat_tinggal`: string [null] — ref_status_tinggal
- `ibu_nama`: string [null]
- `ibu_nik`: string(16) [null]
- `ibu_tmp_lahir`: string [null] — ref_tmp_lahir
- `ibu_tgl_lahir`: date [null]
- `ibu_status`: string [null] — ref_status_ortu
- `ibu_pekerjaan`: string [null] — ref_pekerjaan
- `ibu_pendidikan`: string [null] — ref_pendidikan
- `ibu_penghasilan`: string [null] — ref_penghasilan
- `ibu_telp`: string [null]
- `ibu_alamat`: string [null]
- `ibu_status_tempat_tinggal`: string [null] — ref_status_tinggal
- `wali_nama`: string [null]
- `wali_nik`: string(16) [null]
- `wali_tmp_lahir`: string [null] — ref_tmp_lahir
- `wali_tgl_lahir`: date [null]
- `wali_status`: string [null] — ref_status_ortu
- `wali_pekerjaan`: string [null] — ref_pekerjaan
- `wali_pendidikan`: string [null] — ref_pendidikan
- `wali_penghasilan`: string [null] — ref_penghasilan
- `wali_telp`: string [null]
- `wali_alamat`: string [null]
- `wali_status_tempat_tinggal`: string [null] — ref_status_tinggal
- `yang_membiayai`: string [null] — ref_yang_membiayai
- `no_kk`: string(16) [null] — EMIS santri tambahan:
- `kewarganegaraan`: string [default 'WNI']
- `bahasa_sehari`: string [null] — ref_bahasa_sehari_hari
- `status_tempat_tinggal`: string [null] — ref_status_tinggal
- `jarak_ke_pesantren`: string [null] — ref_jarak
- `waktu_tempuh`: string [null] — ref_waktu_tempuh
- `transportasi`: string [null] — ref_transportasi
- `tanggal_masuk`: date [null] — arsip awal masuk (selain riwayat)
- `provinsi`: string [null] — Alamat keluarga (wilayah kamus via ref_provinsi/kota/kecamatan/desa) / ref_provinsi
- `kab_kota`: string [null] — ref_kota
- `kecamatan`: string [null] — ref_kecamatan
- `desa_kelurahan`: string [null] — ref_desa_kelurahan
- `rt`: string(3) [null]
- `rw`: string(3) [null]
- `alamat`: text [null]
- `kode_pos`: string [null]
- `foto_url`: string [null] — Flag pesantren: true = masih aktif di pesantren ini, false = tidak aktif. / Lulus/mutasi TIDAK disimpan di sini — dibaca dari tabel alumni / mutasi_keluar.
- `status_global`: bool [default true]
- `created_at`, `updated_at`
- INDEX(`nik`)
- INDEX(`nisn`)

### `riwayat_belajar`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `tahun_ajaran_id`: FK → tahun_ajaran [cascade]
- `lembaga_id`: FK → lembaga [cascade]
- `kelas_id`: FK → kelas [null, nullOnDelete] — null = belum ditempatkan (naik dulu, penempatan menyusul)
- `semester`: string(2) [default '1'] — '1' ganjil, '2' genap (selaras nilai_santri)
- `tgl_masuk`: date [null] — mulai per semester (ganjil=awal tahun, genap=awal semester 2)
- `no_absen`: int [null] — no urut rombel per semester; unique per kelas dicek di service
- `nis`: string [null] — arsip per tahun/lembaga; santri.nis = mirror terakhir lembaga primer
- `tingkat`: string [null] — ref_tingkat: target jenjang tahun ini ('7','8','9'); grouping saat kelas_id null
- `status_awal`: string [default 'santri_baru'] — Sumber masuk (string bebas, validasi ke ref_status_awal efektif per lembaga). / TERKUNCI: sama antara ganjil-genap dalam 1 tahun (genap copy ganjil).
- `status_akhir`: string [default 'aktif'] — Hasil semester ini (string bebas, validasi ke ref_status_akhir efektif).
- `is_aktif`: bool [default true] — Sedang berjalan. INVARIANT: true iff status_akhir='aktif'. Ditulis hanya via SiklusSantriService. / Ganjil→genap: ganjil ditutup (is_aktif=false, arsip), genap aktif — 1 aktif per santri-lembaga terjaga. / Berhenti satu jenjang (paket MD berhenti, MI lanjut): baris MD (is_aktif=false, status_akhir dipertahankan). / santri.status_global=false hanya jika SELURUH riwayat non-aktif (dihitung ulang di 102).
- `created_at`, `updated_at`
- UNIQUE(`santri_id`, `tahun_ajaran_id`, `lembaga_id`, `semester`, `uq_riwayat_belajar_stls`) — nama pendek: auto-name 68 char > limit MySQL 64
- INDEX(`kelas_id`, `tahun_ajaran_id`, `semester`, `no_absen`) — Performa cek bentrok no_absen (bukan unique: kelas_id/no_absen nullable, multi-NULL diizinkan MySQL).

### `mutasi_keluar`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `lembaga_id`: FK → lembaga [cascade]
- `kelas_terakhir_id`: FK → kelas [null, nullOnDelete]
- `tanggal_mutasi`: date
- `alasan_mutasi`: string [null] — kamus ref_alasan_mutasi (string bebas, tanpa FK)
- `no_surat`: string [null] — nomor surat keterangan pindah/keluar (arsip EMIS)
- `nama_sekolah_tujuan`: string [null]
- `npsn_sekolah_tujuan`: string(20) [null]
- `nsm_sekolah_tujuan`: string(30) [null]
- `alamat_sekolah_tujuan`: text [null]
- `keterangan`: text [null]
- `created_at`, `updated_at`

### `alumni`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `lembaga_lulus_id`: FK → lembaga [cascade]
- `tahun_ajaran_lulus_id`: FK → tahun_ajaran [cascade]
- `nomor_ijazah`: string [null]
- `no_surat_ijazah`: string [null] — nomor surat pengantar/SKHU
- `tanggal_lulus`: date
- `kegiatan_setelah_lulus`: string [null]
- `penyerahan_ijazah`: enum(sudah|belum) [default 'belum']
- `melanjutkan`: enum(ya|tidak) [null]
- `catatan`: text [null]
- `created_at`, `updated_at`
- UNIQUE(`santri_id`) — 1 santri = max 1 record alumni

## BLOK 3 — PSB (Modul 100 PSB Penerimaan)

### `psb_gelombang`
- `id` PK
- `tahun_ajaran_id`: FK → tahun_ajaran [cascade]
- `nama`: string — misal: 'Gelombang 1 2026/2027'
- `tgl_buka`: date [null]
- `tgl_tutup`: date [null]
- `is_aktif`: bool [default true]
- `created_at`, `updated_at`

### `psb_kuota_biaya`
- `id` PK
- `gelombang_id`: FK → psb_gelombang [cascade]
- `lembaga_id`: FK → lembaga [cascade]
- `tahun_ajaran_id`: FK → tahun_ajaran [cascade]
- `tipe_santri`: enum(semua|asrama|non_asrama) [default 'semua']
- `nominal_pendaftaran`: decimal(12, 2) [default 0]
- `nominal_pendaftaran_lanjutan`: decimal(12, 2) [null] — null = ikut nominal_pendaftaran
- `nominal_paket`: decimal(12, 2) [null] — harga paket MI-MD (di baris primer MI); null = paket tidak ditawarkan
- `nominal_masuk`: decimal(12, 2) [default 0] — biaya daftar ulang / masuk, boleh 0
- `kuota`: int [null]
- `membutuhkan_seleksi`: bool [null] — null = ikut lembaga.psb_butuh_seleksi_default
- `membutuhkan_pemberkasan`: bool [default true]
- `created_at`, `updated_at`
- UNIQUE(`gelombang_id`, `lembaga_id`, `tipe_santri`)

### `psb_calon_santri`
- `id` PK
- `lembaga_id`: FK → lembaga [cascade] — lembaga tujuan
- `gelombang_id`: FK → psb_gelombang [null, nullOnDelete]
- `tahun_ajaran_id`: FK → tahun_ajaran [null, nullOnDelete]
- `kelas_id`: FK → kelas [null, nullOnDelete]
- `santri_asal_id`: FK → santri [null, nullOnDelete] — Pendaftaran lanjutan (anak sudah santri): FK ke santri asal. Hasil konversi: santri_id.
- `santri_id`: FK → santri [null, nullOnDelete]
- `no_pendaftaran`: string — satuan: PSB_{tahun}_{kodeLembaga}_{noGelombang}_{seq4}; paket MI-MD: PSB_{tahun}_MIMD_{noGelombang}_{seq4} (1 nomor dipakai 2 baris MI+MD)
- `paket_grup_id`: string(40) [null] — Paket MI-MD: 2 baris berbagi paket_grup_id, lifecycle bergerak bersama (status tidak pernah divergen)
- `nik`: string(16)
- `nama_lengkap`: string
- `nama_singkat`: string [null]
- `jk`: enum(L|P) [null]
- `tgl_lahir`: date [null]
- `tmp_lahir`: string [null]
- `tipe_santri`: enum(asrama|non_asrama) [default 'non_asrama']
- `nisn`: string(10) [null]
- `anak_ke`: int [null]
- `j_saudara`: int [null]
- `agama`: string [null] — kamus: string bebas, tanpa FK
- `cita_cita`: string [null]
- `hobi`: string [null]
- `kebutuhan_khusus`: string [null]
- `kebutuhan_disabilitas`: string [null]
- `nomor_kip`: string [null]
- `no_hp_santri`: string [null]
- `email_santri`: string [null]
- `no_kk`: string(16) [null]
- `kewarganegaraan`: string [default 'WNI']
- `bahasa_sehari`: string [null]
- `status_tempat_tinggal`: string [null]
- `jarak_ke_pesantren`: string [null]
- `waktu_tempuh`: string [null]
- `transportasi`: string [null]
- `tanggal_masuk`: date [null]
- `alamat`: text [null]
- `provinsi`: string [null]
- `kab_kota`: string [null]
- `kecamatan`: string [null]
- `desa_kelurahan`: string [null]
- `rt`: string(3) [null]
- `rw`: string(3) [null]
- `kode_pos`: string [null]
- `ayah_nama`: string [null]
- `ayah_nik`: string(16) [null]
- `ayah_tmp_lahir`: string [null]
- `ayah_tgl_lahir`: date [null]
- `ayah_status`: string [null]
- `ayah_pendidikan`: string [null]
- `ayah_pekerjaan`: string [null]
- `ayah_penghasilan`: string [null]
- `ayah_telp`: string [null]
- `ayah_alamat`: string [null]
- `ayah_status_tempat_tinggal`: string [null]
- `ibu_nama`: string [null]
- `ibu_nik`: string(16) [null]
- `ibu_tmp_lahir`: string [null]
- `ibu_tgl_lahir`: date [null]
- `ibu_status`: string [null]
- `ibu_pendidikan`: string [null]
- `ibu_pekerjaan`: string [null]
- `ibu_penghasilan`: string [null]
- `ibu_telp`: string [null]
- `ibu_alamat`: string [null]
- `ibu_status_tempat_tinggal`: string [null]
- `wali_nama`: string [null]
- `wali_nik`: string(16) [null]
- `wali_tmp_lahir`: string [null]
- `wali_tgl_lahir`: date [null]
- `wali_status`: string [null]
- `wali_pendidikan`: string [null]
- `wali_pekerjaan`: string [null]
- `wali_penghasilan`: string [null]
- `wali_telp`: string [null]
- `wali_alamat`: string [null]
- `wali_status_tempat_tinggal`: string [null]
- `yang_membiayai`: string [null]
- `email_ortu`: string [null]
- `telp_ortu`: string [null]
- `foto_url`: string [null]
- `status_pendaftaran`: string [default 'baru'] — baru,terverifikasi,lolos,tidak_lolos,pemberkasan,ajukan_daftar_ulang,daftar_ulang,ditolak,waiting_list (tanpa status seleksi)
- `is_pendaftaran_paid`: bool [default false]
- `is_daftar_ulang_paid`: bool [default false]
- `is_duplikat_kontak`: bool [default false]
- `is_lanjutan`: bool [default false] — true jika santri_asal_id terisi
- `tanggal_daftar`: date [null]
- `catatan`: text [null] — catatan admin (manual)
- `catatan_sistem`: text [null] — auto: duplikat email/telp/nik
- `catatan_admin`: text [null]
- `created_at`, `updated_at`
- UNIQUE(`lembaga_id`, `no_pendaftaran`) — per-lembaga agar 1 nomor paket boleh dipakai 2 baris MI+MD
- INDEX(`gelombang_id`, `nik`)
- INDEX(`paket_grup_id`)
- INDEX(`lembaga_id`, `status_pendaftaran`, `updated_at`)

### `dokumen_santri`
- `id` PK
- `santri_id`: FK → santri [null, cascade]
- `psb_calon_santri_id`: FK → psb_calon_santri [null, cascade]
- `jenis_dokumen_santri`: string [null] — ref_jenis_dokumen_santri
- `path_file`: string
- `status_verifikasi`: enum(menunggu|valid|ditolak) [default 'menunggu']
- `catatan`: text [null]
- `created_at`, `updated_at`
- INDEX(`santri_id`, `jenis_dokumen_santri`)
- INDEX(`psb_calon_santri_id`, `jenis_dokumen_santri`)

### `dokumen_wajib_lembaga`
- `id` PK
- `lembaga_id`: FK → lembaga [cascade]
- `jenis_dokumen_santri`: string — ref_jenis_dokumen_santri
- `is_wajib`: bool [default true]
- `created_at`, `updated_at`
- UNIQUE(`lembaga_id`, `jenis_dokumen_santri`)

### `psb_log_status`
- `id` PK
- `psb_calon_santri_id`: FK → psb_calon_santri [cascade]
- `dari`: string [null]
- `ke`: string
- `oleh_user_id`: FK → users [null, nullOnDelete]
- `catatan`: text [null]
- `created_at`, `updated_at`

## BLOK 4 — Keuangan (Modul 103 Keuangan)

### `pos_keuangan`
- `id` PK
- `kode_pos`: string — SPP, SRGM, PSB_REG, DFR_ULANG
- `nama_pos`: string
- `tipe`: enum(bulanan|sekali_bayar|semesteran|tahunan)
- `keterangan`: text [null]
- `created_at`, `updated_at`
- UNIQUE(`kode_pos`) — UNIK GLOBAL (single-pesantren)

### `tarif_biaya`
- `id` PK
- `pos_keuangan_id`: FK → pos_keuangan [cascade]
- `lembaga_id`: FK → lembaga [cascade]
- `tahun_ajaran_id`: FK → tahun_ajaran [cascade]
- `tipe_santri`: enum(semua|asrama|non_asrama) [default 'semua']
- `nominal`: decimal(12, 2) [default 0]
- `nominal_paket`: decimal(12, 2) [null]
- `created_at`, `updated_at`
- UNIQUE(`pos_keuangan_id`, `lembaga_id`, `tahun_ajaran_id`, `tipe_santri`, `uq_tarif_biaya_pltt`) — nama pendek: auto-name 73 char > limit MySQL 64

### `tarif_khusus_santri`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `pos_keuangan_id`: FK → pos_keuangan [cascade]
- `nominal_diskon`: decimal(12, 2) [default 0]
- `nominal_akhir`: decimal(12, 2) [default 0]
- `catatan`: text [null]
- `created_at`, `updated_at`
- UNIQUE(`santri_id`, `pos_keuangan_id`)

### `tagihan`
- `id` PK
- `no_tagihan`: string
- `santri_id`: FK → santri [null, nullOnDelete]
- `psb_calon_santri_id`: FK → psb_calon_santri [null, nullOnDelete]
- `pos_keuangan_id`: FK → pos_keuangan [cascade]
- `tahun_ajaran_id`: FK → tahun_ajaran [cascade]
- `lembaga_id`: FK → lembaga [null, nullOnDelete] — Lembaga pemilik tagihan (Q8): santri primer / calon.lembaga / paket=primer. Otorisasi kasir (lembaganya).
- `periode`: string [null] — 'YYYY-MM'
- `paket_kode`: string(20) [null] — penanda kuitansi paket, misal 'MI-MD'; null = tagihan biasa
- `nominal_total`: decimal(12, 2) [default 0]
- `nominal_terbayar`: decimal(12, 2) [default 0]
- `sisa_tagihan`: decimal(12, 2) [default 0]
- `status`: enum(belum_bayar|mencicil|lunas) [default 'belum_bayar'] — Tanpa jatuh tempo/denda (Q6 drop).
- `created_at`, `updated_at`
- UNIQUE(`no_tagihan`)
- UNIQUE(`santri_id`, `pos_keuangan_id`, `periode`) — Idempotensi generate bulanan (Q3): 1 santri + 1 pos + 1 periode.

### `akun_kas`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `nama_kas`: string
- `kode_kas`: string [null]
- `saldo`: decimal(12, 2) [default 0]
- `created_at`, `updated_at`
- UNIQUE(`lembaga_id`, `kode_kas`)

### `pembayaran`
- `id` PK
- `no_kuitansi`: string
- `akun_kas_id`: FK → akun_kas [cascade]
- `user_id`: FK → users [null, nullOnDelete] — kasir
- `santri_id`: FK → santri [null, nullOnDelete]
- `psb_calon_santri_id`: FK → psb_calon_santri [null, nullOnDelete]
- `tgl_pembayaran`: timestamp [null]
- `total_bayar`: decimal(12, 2) [default 0]
- `metode_pembayaran`: string [default 'tunai'] — ref_metode_pembayaran (dulu enum tunai/transfer; string agar VA/QRIS bisa tambah via kamus)
- `catatan`: text [null]
- `created_at`, `updated_at`
- UNIQUE(`no_kuitansi`) — Unik global: barikade duplikat no_kuitansi (belt tambahan anti race condition)

### `pembayaran_detail`
- `id` PK
- `pembayaran_id`: FK → pembayaran [cascade]
- `tagihan_id`: FK → tagihan [cascade]
- `nominal_dibayar`: decimal(12, 2) [default 0]
- `created_at`, `updated_at`

### `jurnal_kas`
- `id` PK
- `akun_kas_id`: FK → akun_kas [cascade]
- `pembayaran_id`: FK → pembayaran [null, nullOnDelete]
- `tgl_transaksi`: date [null]
- `jenis`: enum(masuk|keluar) [default 'masuk']
- `nominal`: decimal(12, 2) [default 0]
- `kategori`: string [null] — ref_kategori_kas
- `keterangan`: text [null]
- `created_at`, `updated_at`

## BLOK 5 — Kepegawaian lanjutan (Modul 200 Kepegawaian)

### `pegawai_pendidikan`
- `id` PK
- `pegawai_id`: FK → pegawai [cascade]
- `tingkatan`: string [null] — S1, D4, dsb.
- `nama_institusi`: string [null]
- `tahun_selesai`: int [null]
- `catatan`: text [null]
- `created_at`, `updated_at`

### `pegawai_sertifikasi`
- `id` PK
- `pegawai_id`: FK → pegawai [cascade]
- `nrg`: string [null]
- `mapel`: string [null]
- `nomor_peserta`: string [null]
- `lptk_penyelenggara`: string [null]
- `nomor_sertifikat`: string [null]
- `tgl_kelulusan`: date [null]
- `tahun_sertifikasi`: int [null]
- `model_sertifikasi`: string [null]
- `jalur_sertifikasi`: string [null] — ref_jalur_sertifikasi
- `jenjang_sertifikasi`: string [null] — ref_jenjang_sertifikasi
- `nama_sertifikasi`: string [null]
- `institusi`: string [null]
- `tanggal_peroleh`: date [null]
- `file_path`: string [null]
- `created_at`, `updated_at`
- UNIQUE(`pegawai_id`)

### `keluarga_pegawai`
- `id` PK
- `pegawai_id`: FK → pegawai [cascade]
- `nama`: string
- `nik`: string(16) [null]
- `hubungan`: enum(suami|istri|anak|ayah|ibu|lainnya) [default 'lainnya']
- `tmp_lahir`: string [null]
- `tgl_lahir`: date [null]
- `pekerjaan`: string [null]
- `pendidikan`: string [null]
- `telp`: string [null]
- `created_at`, `updated_at`
- INDEX(`pegawai_id`, `hubungan`)

### `pegawai_dokumen`
- `id` PK
- `pegawai_id`: FK → pegawai [cascade]
- `jenis_dokumen_pegawai`: string [null] — ref_jenis_dokumen_pegawai
- `nama_file`: string [null] — label asli file (tetap dipertahankan)
- `path_file`: string [null]
- `status_verifikasi`: enum(menunggu|valid|ditolak) [default 'menunggu']
- `catatan`: text [null]
- `created_at`, `updated_at`
- INDEX(`pegawai_id`, `jenis_dokumen_pegawai`)

### `keaktifan_pegawai`
- `id` PK
- `pegawai_id`: FK → pegawai [cascade]
- `lembaga_id`: FK → lembaga [cascade]
- `tahun_ajaran_id`: FK → tahun_ajaran [cascade]
- `tugas_utama`: string [default 'Guru Pengampu'] — ref_tugas_utama
- `status_keaktifan`: enum(aktif|inaktif) [default 'aktif']
- `created_at`, `updated_at`
- UNIQUE(`pegawai_id`, `lembaga_id`, `tahun_ajaran_id`, `uq_keaktifan_pegawai_plt`) — nama pendek: auto-name 61 char, margin aman dari limit 64

### `presensi_pegawai`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `pegawai_id`: FK → pegawai [cascade]
- `tanggal`: date
- `jam_masuk`: time [null]
- `jam_keluar`: time [null]
- `status`: enum(hadir|izin|sakit|alpa) [default 'hadir']
- `sumber`: string [default 'mobile']
- `keterangan`: text [null]
- `foto_selfie`: string [null]
- `lokasi_gps`: string [null]
- `created_at`, `updated_at`
- UNIQUE(`pegawai_id`, `tanggal`)

## BLOK 6 — Kurikulum & Mapel (+Jadwal 502) (Modul 201 + 502)

### `pengaturan_hari_lembaga`
- `id` PK
- `lembaga_id`: FK → lembaga [cascade]
- `hari`: enum(senin|selasa|rabu|kamis|jumat|sabtu|minggu)
- `is_hari_libur`: bool [default false]
- `created_at`, `updated_at`
- UNIQUE(`lembaga_id`, `hari`)

### `kurikulum`
- `id` PK
- `lembaga_id`: FK → lembaga [cascade]
- `nama`: string
- `deskripsi`: text [null]
- `created_at`, `updated_at`
- UNIQUE(`lembaga_id`, `nama`)

### `mata_pelajaran`
- `id` PK
- `lembaga_id`: FK → lembaga [cascade]
- `nama_mapel`: string
- `kelompok`: enum(formal|pesantren) [default 'formal'] — Kolom darí Modul 202 (kelompok rapor):
- `kode_mapel`: string(20) [null]
- `created_at`, `updated_at`
- UNIQUE(`lembaga_id`, `nama_mapel`)

### `kelas_kurikulum`
- `id` PK
- `kelas_id`: FK → kelas [cascade]
- `kurikulum_id`: FK → kurikulum [cascade]
- `created_at`, `updated_at`
- UNIQUE(`kelas_id`, `kurikulum_id`)

### `kurikulum_mapel`
- `id` PK
- `kurikulum_id`: FK → kurikulum [cascade]
- `mata_pelajaran_id`: FK → mata_pelajaran [cascade]
- `tingkat`: string [null] — ref_tingkat: null = semua tingkat; '8'/'9' = khusus
- `kkm`: decimal(5, 2) [null] — null = predikat manual (202)
- `urutan`: int [default 0] — urutan tampil di rapor/leger
- `created_at`, `updated_at`
- UNIQUE(`kurikulum_id`, `mata_pelajaran_id`, `tingkat`, `uq_kurikulum_mapel_kmt`) — nama pendek: auto-name 61 char, margin aman dari limit 64

### `pengampu_mapel`
- `id` PK
- `kelas_id`: FK → kelas [cascade]
- `mata_pelajaran_id`: FK → mata_pelajaran [cascade]
- `keaktifan_pegawai_id`: FK → keaktifan_pegawai [null, nullOnDelete]
- `created_at`, `updated_at`
- UNIQUE(`kelas_id`, `mata_pelajaran_id`)

### `slot_jam_pelajaran`
- `id` PK
- `lembaga_id`: FK → lembaga [cascade]
- `nama_slot`: string [null] — 'Jam 1', 'Jam 2', dsb.
- `jam_mulai`: time [null]
- `jam_selesai`: time [null]
- `created_at`, `updated_at`

### `jadwal_pelajaran`
- `id` PK
- `pengampu_mapel_id`: FK → pengampu_mapel [cascade]
- `slot_jam_id`: FK → slot_jam_pelajaran [cascade]
- `hari`: enum(senin|selasa|rabu|kamis|jumat|sabtu|minggu)
- `ruangan`: string [null]
- `created_at`, `updated_at`
- UNIQUE(`pengampu_mapel_id`, `slot_jam_id`, `hari`) — Unik per slot/hari = backing constraint validasi bentrok

## BLOK 7 — Penilaian & Rapor (Modul 202 Nilai-Rapor)

### `nilai_santri`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `pengampu_mapel_id`: FK → pengampu_mapel [cascade]
- `tahun_ajaran_id`: FK → tahun_ajaran [cascade]
- `semester`: string(2) — '1' atau '2'
- `nilai_formatif`: decimal(5, 2) [default 0]
- `nilai_sumatif`: decimal(5, 2) [default 0]
- `nilai_akhir`: decimal(5, 2) [default 0]
- `predikat`: string(2) [null] — A, B, C, D
- `catatan_capaian`: text [null]
- `created_at`, `updated_at`
- UNIQUE(`santri_id`, `pengampu_mapel_id`, `tahun_ajaran_id`, `semester`, `unique_nilai_santri`)

### `rapor_catatan_wali`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `kelas_id`: FK → kelas [cascade]
- `tahun_ajaran_id`: FK → tahun_ajaran [cascade]
- `semester`: string(2)
- `sakit`: int [default 0]
- `izin`: int [default 0]
- `alpa`: int [default 0]
- `catatan_akademik`: text [null]
- `catatan_karakter`: text [null]
- `keputusan_kenaikan`: string [null] — 'Naik ke kelas X', 'Lulus', dsb.
- `created_at`, `updated_at`
- UNIQUE(`santri_id`, `kelas_id`, `tahun_ajaran_id`, `semester`, `unique_catatan_wali`)

## BLOK 8 — Presensi & Kedisiplinan (Modul 500 Presensi Santri)

### `sesi_presensi`
- `id` PK
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `nama_sesi`: string — 'KBM Pagi', 'Shalat Subuh Jamaah'
- `kategori`: enum(kbm|kegiatan_asrama|shalat)
- `jam_mulai`: time [null]
- `jam_selesai`: time [null]
- `is_active`: bool [default true]
- `created_at`, `updated_at`

### `presensi_santri`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `kelas_id`: FK → kelas [cascade]
- `sesi_presensi_id`: FK → sesi_presensi [cascade]
- `tanggal`: date
- `status`: enum(hadir|sakit|izin|alpa) [default 'hadir']
- `keterangan`: text [null]
- `recorded_by`: FK → users [null, nullOnDelete]
- `created_at`, `updated_at`
- UNIQUE(`santri_id`, `sesi_presensi_id`, `tanggal`)

### `pelanggaran_santri`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `lembaga_id`: FK → lembaga [null, nullOnDelete]
- `tanggal`: date [null]
- `tipe_pelanggaran`: string [null] — ref_tipe_pelanggaran
- `deskripsi`: text [null]
- `poin`: int [default 0] — dipakai portal wali (total poin)
- `recorded_by`: FK → users [null, nullOnDelete]
- `created_at`, `updated_at`

## BLOK 9 — Tahfizh (Modul 503 Tahfizh)

### `target_tahfiz`
- `id` PK
- `lembaga_id`: FK → lembaga [cascade]
- `nama_target`: string — 'Target Juz 30 Kelas 7'
- `juz_awal`: int
- `juz_akhir`: int
- `target_halaman`: int [null]
- `created_at`, `updated_at`

### `setoran_tahfiz`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `penguji_id`: FK → users [null, nullOnDelete]
- `tanggal`: date
- `jenis`: enum(ziyadah|muraaja_ah) [default 'ziyadah']
- `juz`: int — 1..30
- `surah_awal_id`: int — 1..114 (integer lookup, tanpa tabel)
- `ayat_awal`: int
- `surah_akhir_id`: int
- `ayat_akhir`: int
- `jumlah_halaman`: int [default 0]
- `nilai`: string(2) [null] — 'A','B','C','D'
- `kelancaran`: enum(lancar|kurang_lancar|mengulang) [default 'lancar']
- `catatan`: text [null]
- `created_at`, `updated_at`

### `rekap_tahfiz_santri`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `total_juz_mutqin`: int [default 0]
- `total_juz_ziyadah`: int [default 0]
- `juz_terakhir`: int [null]
- `surah_terakhir_id`: int [null]
- `ayat_terakhir`: int [null]
- `created_at`, `updated_at`
- UNIQUE(`santri_id`)

## BLOK 10 — Portal Wali (Modul 203 Portal Orang Tua)

### `wali_santri_relasi`
- `id` PK
- `user_id`: FK → users [cascade] — akun login wali
- `santri_id`: FK → santri [cascade]
- `hubungan`: enum(ayah|ibu|wali) [default 'ayah']
- `is_utama`: bool [default true]
- `is_active`: bool [default true]
- `created_at`, `updated_at`
- UNIQUE(`user_id`, `santri_id`)

### `wali_portal_logs`
- `id` PK
- `user_id`: FK → users [cascade]
- `santri_id`: FK → santri [null, cascade]
- `action`: string — 'view_dashboard', 'download_rapor', 'bayar_spp'
- `ip_address`: ipAddress [null]
- `device_info`: string [null]
- `created_at`, `updated_at`

### `pengajuan_biodata_santri`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `wali_user_id`: FK → users [cascade]
- `perubahan_json`: json — {field: {lama, baru}}; nama field SAMA PERSIS dengan kolom santri
- `status`: enum(diajukan|disetujui|ditolak|dibatalkan) [default 'diajukan']
- `diproses_oleh`: FK → users [null, nullOnDelete]
- `catatan_admin`: text [null]
- `cancelled_at`: timestamp [null]
- `created_at`, `updated_at`
- INDEX(`santri_id`, `status`)

### Pola `ref_*` (26 tabel loop + eksplisit `ref_agama/cita_cita/hobi/pekerjaan/pendidikan/kebutuhan_khusus/kota/alamat/status_awal/status_akhir`)
- Kolom: `id` PK; `lembaga_id`? FK → `lembaga` (null=global, terisi=milik lembaga); `nama`; `urutan` [default 0]; `is_active` [default true]; unique(`lembaga_id`,`nama`) — pitfall multi-NULL, dedup di `RefService`.
- `ref_alamat` tambahan: wilayah free string + snapshot autofill. `ref_status_akhir`: `is_aktif_bawaan`, `terminal_ke`.
- Tabel loop: `ref_penghasilan`, `ref_transportasi`, `ref_status_tinggal`, `ref_jarak`, `ref_waktu_tempuh`, `ref_bahasa_sehari_hari`, `ref_disabilitas`, `ref_tmp_lahir`, `ref_status_ortu`, `ref_yang_membiayai`, `ref_provinsi`, `ref_kecamatan`, `ref_desa_kelurahan`, `ref_alasan_mutasi`, `ref_jenis_dokumen_santri`, `ref_jenis_dokumen_pegawai`, `ref_status_pernikahan`, `ref_gol_darah`, `ref_jenis_ptk`, `ref_jenjang_sertifikasi`, `ref_tingkat`, `ref_tugas_utama`, `ref_tipe_pelanggaran`, `ref_kategori_kas`, `ref_metode_pembayaran`, `ref_jalur_sertifikasi`


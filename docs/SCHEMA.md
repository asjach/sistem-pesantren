# Skema Database — SIMPES (dokumentasi, bukan kode)

> Sumber: 29 file migrasi (+ `lembaga_santri`, `preset_tabel`,
> `pengaturan_tampilan`, `alumni.kelas_lulus_id`, `label_kolom`, `urut_preset`). Bahasa Indonesia persis DB. Tipe logis umum.
> Keputusan: single-pesantren via `lembaga` + pivot `user_lembaga` (no.40);
> 34 `ref_*` global+shadow (no.50); seed no.51; pitfall multi-NULL MySQL →
> dedup di service, bukan index (`002` catatan 9). Matriks izin (v2.38):
> aksi = `permissions`/`role_has_permissions`, cakupan tetap pivot.
> Import gabungan siswa (v2.39): satu file menulis `santri` + `lembaga_santri`
> (tanpa migrasi; cocok `santri_id`/NIK/NIS, baris luar tenant ditolak).
> Beku kelas arsip (v2.52): `alumni.kelas_lulus_id` + `mutasi_keluar.kelas_terakhir_id`
> snapshot dari riwayat aktif terakhir.

Urutan CREATE: `lembaga` → `ref_*` → `users` → `user_lembaga` →
`tahun_ajaran` → `pegawai` → `kelas` (`walas_id` inline) → santri/riwayat →
PSB → kepegawaian → akademik → nilai → presensi → asrama → tahfizh → portal.
`down()` sebaliknya (dependent dulu). `migrate:fresh` boleh pre-production.

> Keputusan desain (v1.10, gambaran umum — masih bisa berubah):
> 1. `santri` tidak menyimpan kolom lembaga (identitas murni); sumber kebenaran
>    lembaga = `riwayat_belajar`/`lembaga_santri` (FK `jenjang`).
>    **v2.0: kolom lembaga di `santri` dihapus total — legacy = santri tanpa riwayat.**
> 2. `santri.is_active_pst` turunan murni (default 'Tidak'): 'Ya' iff punya ≥1
>    `riwayat_belajar.is_active_riwayat='Ya'`. **Sudah diimplementasikan (v1.10.2 + backfill).**
> 3. Asrama = entitas sendiri (BLOK 10), peran `asrama` (7 peran) + pivot
>    `user_asrama`. Penanda keuangan asrama ditetapkan saat modul keuangan
>    dirumuskan ulang.
>    **Implementasi asrama = pasca production** (belum dibuat sekarang).

## Auth bawaan Laravel (`0001_*_create_users_table.php`)

`users`: `id` PK; `name`; `email`? unique (null boleh, multi-identifier);
`phone`? unique; `username`? unique; `email_verified_at`? (=now saat dibuat admin);
`password` (hashed); `last_login_at`?; `remember_token`; timestamps.
Tanpa kolom tenant — tenant = pivot `user_lembaga`.
`password_reset_tokens`, `sessions`: standar Laravel.

## BLOK 1 — Dasar & Referensi (Modul 003 Auth Login + 004 Referensi-Master)

### `lembaga`
- `jenjang` PK: string(20) — kunci alami lembaga, pola `^[A-Z0-9]{1,20}$` (mis. `MI`, `MD`, `MTS`, `MLN`); **imutabel** setelah dibuat
- `nama`: string — PENYATUAN: bukan 'nama_lembaga'
- `nama_singkat`: string [null] — EMIS: nama singkatan
- `mudir_am`: string [null] — kepala madrasah/unit
- `status`: enum(negeri|swasta) [default 'swasta'] — EMIS: status madrasah
- `npsn`: string(20) [null, unique] — EMIS/Kemendikbud, global unique
- `nsm`: string(30) [null, unique] — EMIS/Kemenag 12 digit, global unique
- `npwp`: string [null] — EMIS/BOS
- PK(`jenjang`) — satu baris per jenjang (single-pesantren, tanpa hierarki/root)
- CATATAN: asrama **bukan** lembaga — entitas + peran + pivot sendiri (BLOK 10).
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
- `is_seleksi`: bool [default false] — lembaga ber-seleksi (kuota `membutuhkan_seleksi` null ikut nilai ini; daftar ulang wajib kirim status lolos)
- `kelompok_psb`: enum(combo_mi_md|eksklusif) [default 'eksklusif'] — combo khusus MI/MD (pool kuota & daftar ganda gabungan); selain itu eksklusif (pool & aturan ganda sendiri)
- `is_active`: bool [default true] — nonaktifkan tanpa hapus
- `created_at`, `updated_at`

### `ref_agama`
- `id` PK
- `jenjang`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`jenjang`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_cita_cita`
- `id` PK
- `jenjang`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`jenjang`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_hobi`
- `id` PK
- `jenjang`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`jenjang`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_pekerjaan`
- `id` PK
- `jenjang`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`jenjang`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_pendidikan`
- `id` PK
- `jenjang`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`jenjang`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_kebutuhan_khusus`
- `id` PK
- `jenjang`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`jenjang`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_kota`
- `id` PK
- `jenjang`: FK → lembaga [null, nullOnDelete]
- `nama`: string
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`jenjang`, `nama`) — PITFALL: MySQL unique membolehkan duplikat NULL — duplikasi baris global dicegah di service (RefService), bukan andalkan index

### `ref_alamat`
- `id` PK
- `jenjang`: FK → lembaga [null, nullOnDelete]
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
- UNIQUE(`jenjang`, `nama`) — scope LEMBAGA, pola KEY sama dengan ref lain

### `ref_status_awal`
- `id` PK
- `jenjang`: FK → lembaga [null, nullOnDelete]
- `kode`: string — santri_baru, naik_kelas, mengulang, pindahan (+ custom); NILAI yang disimpan konsumen
- `nama`: string — teks tampilan (seragam dengan tabel ref lain; dulu bernama `label`)
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`jenjang`, `kode`)

### `ref_status_akhir`
- `id` PK
- `jenjang`: FK → lembaga [null, nullOnDelete]
- `kode`: string — aktif, naik, tidak_naik, pindah_keluar, lulus, tidak_lulus (+ custom, no.51); NILAI yang disimpan konsumen
- `nama`: string — teks tampilan (seragam dengan tabel ref lain; dulu bernama `label`)
- `is_aktif_bawaan`: bool [default false] — Sifat logika (terkunci untuk baris sistem): / true HANYA untuk 'aktif' (is_aktif=true iff status_akhir aktif)
- `terminal_ke`: string [null] — null = bukan terminal (custom baru selalu null = non-aktif netral)
- `urutan`: int [default 0]
- `is_active`: bool [default true]
- UNIQUE(`jenjang`, `kode`)

### `user_lembaga`
- `id` PK
- `user_id`: FK → users [cascade]
- `jenjang`: FK → lembaga [cascade]
- `created_at`, `updated_at`
- UNIQUE(`user_id`, `jenjang`)

### Izin matriks (Spatie, guard `sanctum`)
Izin = AKSI (`modul.aksi`, katalog `IzinKatalog::MODUL_AKSI`); pivot `user_lembaga` = CAKUPAN data.
- `permissions`: `id` PK — `name` string (unik per guard) — `guard_name` string
- `role_has_permissions`: `permission_id` FK [cascade] — `role_id` FK [cascade] — PRIMARY(`permission_id`, `role_id`)
- `model_has_permissions`: penugasan izin langsung ke user (tak dipakai; izin selalu lewat role) — `permission_id` FK [cascade] — `model_type` — `model_id` [bigint] — PRIMARY(`permission_id`, `model_id`, `model_type`)

### `user_asrama`
Penugasan pengurus asrama (peran `asrama`, ditetapkan super_admin saja). **Pasca production — belum dibuat sekarang**; dibuat bersama BLOK 10 (setelah presensi).
- `id` PK
- `user_id`: FK → users [cascade]
- `asrama_id`: FK → asrama [cascade]
- `created_at`, `updated_at`
- UNIQUE(`user_id`, `asrama_id`)

### `login_audits`
- `id` PK
- `user_id`: FK → users [null, nullOnDelete]
- `identifier`: string — email/phone/username yang dicoba
- `ip`: ipAddress [null]
- `user_agent`: string [null]
- `sukses`: bool [default false]
- `created_at`: timestamp [null]

### `tahun_ajaran`
- `nama` PK varchar(9) — kunci alami, misal: '2025/2026' (WAJIB pola `YYYY/YYYY`)
- `tanggal_mulai`: date [null]
- `tanggal_selesai`: date [null]
- `is_aktif`: bool [default false] — TA berjalan (satu, global)
- `created_at`, `updated_at`
- Tanpa `id`/`jenjang`/`is_active`: TA murni global; visibilitas per lembaga lewat pivot `lembaga_tahun_ajaran`.

### `lembaga_tahun_ajaran` (pivot visibilitas TA per lembaga)
- `id` PK
- `jenjang`: FK → lembaga [cascade]
- `tahun_ajaran`: varchar(9) FK → tahun_ajaran.nama [cascade update + delete]
- `is_active`: bool [default true] — tampil/tidak untuk lembaga ini (sembunyikan = baris nonaktif)
- `created_at`, `updated_at`
- UNIQUE(`jenjang`, `tahun_ajaran`)


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
- `jenjang`: FK → lembaga [cascade]
- `tahun_ajaran`: varchar(9) FK → tahun_ajaran.nama [cascade update + delete]
- `walas_id`: FK → pegawai [null, nullOnDelete] — wali kelas → pegawai
- `tingkat`: string [null] — ref_tingkat ('7','8','9'); grouping saat kelas_id null di riwayat
- `nama_kelas`: string — 'VII-A'; dinormalisasi model (trim + rapat spasi)
- `kapasitas`: int [null]
- `created_at`, `updated_at`
- UNIQUE(`jenjang`, `tahun_ajaran`, `nama_kelas`) — satu nama kelas hanya sekali per lembaga + tahun ajaran (kolasi CI; migrasi mem-dedupe + merapikan spasi lebih dulu)

### Pola `ref_*` (24 tabel loop + eksplisit `ref_agama/cita_cita/hobi/pekerjaan/pendidikan/kebutuhan_khusus/kota/alamat/status_awal/status_akhir`)
- Kolom: `id` PK; `jenjang` FK → `lembaga` (nullable teknis, tanpa baris global; `null` = sisa legacy); `nama`; `urutan` [default 0]; `is_active` [default true]; unique(`jenjang`,`nama`) — pitfall multi-NULL, dedup di `RefService`.
- Urut tampil (v1.10.7): `urutan` ASC, tie-break `nama` ASC — termasuk `ref_status_awal/akhir` (kode = nilai, nama = tampilan).
- `ref_alamat` tambahan: wilayah free string + snapshot autofill. `ref_status_akhir`: `is_aktif_bawaan`, `terminal_ke`.
- Tabel loop: `ref_penghasilan`, `ref_transportasi`, `ref_status_tinggal`, `ref_jarak`, `ref_waktu_tempuh`, `ref_bahasa_sehari_hari`, `ref_disabilitas`, `ref_tmp_lahir`, `ref_status_ortu`, `ref_yang_membiayai`, `ref_provinsi`, `ref_kecamatan`, `ref_desa_kelurahan`, `ref_alasan_mutasi`, `ref_jenis_dokumen_santri`, `ref_jenis_dokumen_pegawai`, `ref_status_pernikahan`, `ref_gol_darah`, `ref_jenis_ptk`, `ref_jenjang_sertifikasi`, `ref_tingkat`, `ref_tugas_utama`, `ref_tipe_pelanggaran`, `ref_jalur_sertifikasi`

## BLOK 2 — Santri & Riwayat (Modul 101 Santri Master + 102 Siklus Santri)

### `santri`
**Buku induk: identitas murni** — tanpa relasi riwayat (lembaga/kelas/TA tidak ada di sini).
- `id` PK
- `nama_lengkap`: string — Identitas Personal
- `nama_singkat`: string [null]
- `nik`: string(16) [null] — index (boleh fiktif/ganda; dedup nik+nama+tgl_lahir di service)
- `nisn`: string(10) [null] — berlaku RA–S3 (nasional)
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
- `foto_url`: string [null]
- `kepala_keluarga`: string [null] — nama kepala keluarga
- `status_global` → **`is_active_pst`**: enum('Ya','Tidak') [default 'Tidak'] — TURUNAN murni: 'Ya' iff punya ≥1 `riwayat_belajar.is_active_riwayat='Ya'`. Bukan input manual; dihitung ulang tiap transisi (ACC/penerimaan, penempatan kelas, naik, mutasi, lulus, berhenti). Lulus/mutasi tidak disimpan di sini — dibaca dari tabel alumni / mutasi_keluar. Santri legacy tanpa riwayat tetap 'Tidak' (nonaktif) sampai ditempatkan.
- CATATAN visibilitas: santri legacy (tanpa riwayat) boleh dilihat/dikelola pemegang `santri.lihat`; guru/wali tetap lewat jalur masing-masing (bukan endpoint admin).
- `created_at`, `updated_at`
- INDEX(`nik`)
- INDEX(`nisn`)

### `lembaga_santri`
**Keanggotaan santri per lembaga** (bukan pivot murni): NIS lokal/kemenag + status + rentang keanggotaan. Multi-lembaga paralel diizinkan (mis. MI+MD); maks 1 baris `is_active_lembaga='Ya'` per (santri, lembaga) — invariant aplikasi.
- `id` PK
- `santri_id`: FK → santri [cascade]
- `jenjang`: FK → lembaga [cascade]
- `nis_lokal`: string(20) [null] — NIS per lembaga, unik per lembaga
- `nis_kemenag`: string(20) [null] — NISK manual: 12 digit NSM lembaga + 2 digit tahun diterima + 4 digit akhir `nis_lokal`; unik per lembaga
- `tahaj_masuk`: string(50) [null] — tahun pelajaran saat masuk (mis. "2026/2027"), bukan FK
- `tingkat_masuk`: string(20) [null] — tingkat saat pertama masuk lembaga
- `no_urut`: string(20) [null] — nomor urut masuk per lembaga (tidak unik; boleh sufiks huruf mis. `706x` untuk data ganda historis)
- `nama_sekolah_asal`, `npsn_sekolah_asal` (20), `nss_sekolah_asal` (30), `alamat_sekolah_asal` (text): [null] — detail sekolah asal
- `is_active_lembaga`: enum('Ya','Tidak') [default 'Ya'] — status keanggotaan
- `tgl_masuk`: date [null] — saat diterima (PSB/dialog/import); dulu `tgl_mulai`
- `tgl_selesai`: date [null] — saat kelulusan/mutasi
- `created_at`, `updated_at`
- UNIQUE(`jenjang`, `nis_lokal`) · UNIQUE(`jenjang`, `nis_kemenag`) [multi-NULL boleh] · INDEX(`santri_id`,`is_active_lembaga`) · INDEX(`jenjang`,`is_active_lembaga`)
- PENGECUALIAN PASANGAN MI↔MD (global sejak v2.61, timbal-balik): admin scoped pemegang MI/MD bisa baca-tulis sisi pasangannya di semua endpoint; non-pasangan tetap terisolasi, act-as tetap ketat.

### `riwayat_belajar`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `tahun_ajaran`: varchar(9) FK → tahun_ajaran.nama [cascade update + delete]
- `jenjang`: FK → lembaga [cascade]
- `kelas_id`: FK → kelas [null, nullOnDelete] — null = belum ditempatkan (naik dulu, penempatan menyusul)
- `semester`: string(2) [default '1'] — '1' ganjil, '2' genap (selaras nilai_santri)
- `tgl_masuk`: date [null] — mulai per semester (ganjil=awal tahun, genap=awal semester 2)
- `no_absen`: int [null] — no urut rombel per semester; unique per kelas dicek di service
- `tingkat`: string [null] — ref_tingkat: target jenjang tahun ini ('7','8','9'); grouping saat kelas_id null
- `status_awal`: string [default 'santri_baru'] — Sumber masuk (string bebas, validasi ke ref_status_awal efektif per lembaga). / TERKUNCI: sama antara ganjil-genap dalam 1 tahun (genap copy ganjil).
- `status_akhir`: string [default 'aktif'] — Hasil semester ini (string bebas, validasi ke ref_status_akhir efektif).
- `is_active_riwayat`: enum('Ya','Tidak') [default 'Ya'] — Sedang berjalan. INVARIANT: 'Ya' iff status_akhir='aktif'. Ditulis hanya via SiklusSantriService. / Ganjil→genap: ganjil ditutup (is_active_riwayat='Tidak', arsip), genap aktif — 1 aktif per santri-lembaga terjaga. / Berhenti satu jenjang (paket MD berhenti, MI lanjut): baris MD (is_active_riwayat='Tidak', status_akhir dipertahankan). / santri.is_active_pst='Tidak' hanya jika SELURUH riwayat non-aktif (dihitung ulang di 102).
- `created_at`, `updated_at`
- UNIQUE(`santri_id`, `tahun_ajaran`, `jenjang`, `semester`, `uq_riwayat_belajar_stls`) — nama pendek: auto-name 68 char > limit MySQL 64
- INDEX(`kelas_id`, `tahun_ajaran`, `semester`, `no_absen`) — Performa cek bentrok no_absen (bukan unique: kelas_id/no_absen nullable, multi-NULL diizinkan MySQL).

### `mutasi_keluar`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `jenjang`: FK → lembaga [cascade]
- `kelas_terakhir_id`: FK → kelas [null, nullOnDelete] — beku otomatis dari riwayat aktif terakhir; input manual menang bila diisi
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
- `lembaga_lulus`: FK → lembaga [cascade]
- `kelas_lulus_id`: FK → kelas [null, nullOnDelete] — snapshot beku kelas terakhir saat lulus
- `tahun_ajaran_lulus`: varchar(9) FK → tahun_ajaran.nama [cascade update + delete]
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

### `psb_kegiatan`
- `id` PK
- `tahun_ajaran`: varchar(9) FK → tahun_ajaran.nama [cascade update + delete] — TA global (data pesantren)
- `nama`: string — misal 'PSB 2026/2027'
- `is_aktif`: bool [default true] — hanya satu kegiatan aktif (aturan aplikasi)
- `created_at`, `updated_at`
- UNIQUE(`tahun_ajaran`) — satu tahun ajaran hanya boleh punya satu kegiatan PSB

### `psb_gelombang`
- `id` PK
- `psb_kegiatan_id`: FK → psb_kegiatan [null, nullOnDelete]
- `nomor`: int [null] — urutan gelombang dalam kegiatan (dipakai nomor pendaftaran)
- `nama`: string — misal: 'Gelombang 1 2026/2027'
- `tgl_buka`: date [null]
- `tgl_tutup`: date [null]
- `created_at`, `updated_at`
- Aturan: rentang gelombang dalam satu kegiatan tidak boleh tumpang tindih; gelombang untuk pendaftaran publik dipilih otomatis MURNI dari tanggal (`tgl_buka <= hari ini <= tgl_tutup`) — pendaftar tidak memilih, tidak ada kolom status

### `psb_kuota_biaya`
- `id` PK
- `gelombang_id`: FK → psb_gelombang [cascade]
- `jenjang`: FK → lembaga [cascade]
- `tipe_santri`: enum(semua|asrama|non_asrama) [default 'semua']
- `paket_tersedia`: bool [default false] — paket MI-MD ditawarkan (di baris primer MI)
- `kuota`: int [null] — pool gabungan per kelompok PSB; hanya dibaca dari baris **lembaga primer kelompok** (combo_mi_md → MI). null = tanpa batas
- `membutuhkan_seleksi`: bool [null] — null = ikut lembaga.is_seleksi
- `membutuhkan_pemberkasan`: bool [default true]
- `created_at`, `updated_at`
- UNIQUE(`gelombang_id`, `jenjang`, `tipe_santri`)

### `psb_calon_santri`
- `id` PK
- `jenjang`: FK → lembaga [cascade] — lembaga tujuan
- `gelombang_id`: FK → psb_gelombang [null, nullOnDelete]
- `tahun_ajaran`: varchar(9) FK → tahun_ajaran.nama [null, nullOnDelete]
- `kelas_id`: FK → kelas [null, nullOnDelete]
- `santri_asal_id`: FK → santri [null, nullOnDelete] — Pendaftaran lanjutan (anak sudah santri): FK ke santri asal. Hasil konversi: santri_id.
- `santri_id`: FK → santri [null, nullOnDelete]
- `no_pendaftaran`: string — satuan: PSB_{tahun}_{kodeLembaga}_{noGelombang}_{seq4}; paket MI-MD: PSB_{tahun}_MIMD_{noGelombang}_{seq4} (1 calon = 1 nomor)
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
- `status_pendaftaran`: string [default 'baru'] — baru,terverifikasi,lolos,tidak_lolos,pemberkasan,ajukan_daftar_ulang,daftar_ulang,mengundurkan_diri,ditolak,waiting_list (tanpa status seleksi)
- `is_duplikat_kontak`: bool [default false]
- `is_lanjutan`: bool [default false] — true jika santri_asal_id terisi
- `tanggal_daftar`: date [null]
- `catatan`: text [null] — catatan admin (manual)
- `catatan_sistem`: text [null] — auto: duplikat email/telp/nik
- `catatan_admin`: text [null]
- `deleted_at`: timestamp [null] — soft delete (hapus dari antrean/kuota)
- `deleted_by`: bigint [null] — user yang menghapus (referensi lunak ke users)
- `created_at`, `updated_at`
- UNIQUE(`no_pendaftaran`) — 1 calon = 1 nomor
- INDEX(`gelombang_id`, `nik`)
- INDEX(`jenjang`, `status_pendaftaran`, `updated_at`)

### `psb_calon_lembaga`
Detail lembaga tujuan per calon (1 baris = 1 lembaga): satuan 1 baris `primer`; paket MI-MD 2 baris (`primer` MI + `anggota` MD).
- `id` PK
- `psb_calon_santri_id`: FK → psb_calon_santri [cascade]
- `jenjang`: FK → lembaga [cascade]
- `peran`: string(10) [default 'primer'] — primer | anggota
- `masuk_tingkat`: string(2) [null] — tingkat per lembaga (paket MI-MD = 1 & 1)
- `created_at`, `updated_at`
- UNIQUE(`psb_calon_santri_id`, `jenjang`)
- INDEX(`jenjang`)
- Catatan kuota: angka pool gabungan dibaca dari `psb_kuota_biaya.kuota` baris **lembaga primer kelompok** (combo_mi_md → MI); pemakaian = calon aktif yang punya baris di kelompok tsb

### `dokumen_santri`
- `id` PK
- `santri_id`: FK → santri [null, cascade]
- `psb_calon_santri_id`: FK → psb_calon_santri [null, cascade]
- `jenis_dokumen_santri`: string [null] — ref_jenis_dokumen_santri
- `path_file`: string [null] — null = baris checklist (belum ada file)
- `status_verifikasi`: enum(menunggu|valid|ditolak) [default 'menunggu']
- `tidak_memiliki`: bool [default false] — centang "tidak memiliki dokumen" (penekanan; tidak menahan proses)
- `catatan`: text [null]
- `created_at`, `updated_at`
- INDEX(`santri_id`, `jenis_dokumen_santri`)
- INDEX(`psb_calon_santri_id`, `jenis_dokumen_santri`)
- Alur: file calon PINDAH ke santri saat ACC; baris checklist (path null) dibuat otomatis dari ketentuan kegiatan × lembaga (wajib & opsional)

### `dokumen_wajib_lembaga`
- `id` PK
- `psb_kegiatan_id`: FK → psb_kegiatan [cascade] — syarat diikat ke satu kegiatan PSB
- `jenjang`: FK → lembaga [cascade]
- `jenis_dokumen_santri`: string — ref_jenis_dokumen_santri
- `is_wajib`: bool [default true] — penekanan saja, TIDAK menahan pengajuan daftar ulang
- `created_at`, `updated_at`
- UNIQUE(`psb_kegiatan_id`, `jenjang`, `jenis_dokumen_santri`)

### `psb_log_status`
- `id` PK
- `psb_calon_santri_id`: FK → psb_calon_santri [cascade]
- `dari`: string [null]
- `ke`: string
- `oleh_user_id`: FK → users [null, nullOnDelete]
- `catatan`: text [null]
- `created_at`, `updated_at`

## BLOK 3b — Preset Tampilan Tabel (lintas modul)

### `preset_tabel`
- `id` PK
- `jenjang`: FK → lembaga [null, cascade] — preset milik satu lembaga. Saat membuat, admin dapat men-generate ke satu/beberapa lembaga sekaligus; tiap lembaga dapat mengedit salinannya. `null` = sisa data lama (tidak dibuat lagi).
- `table_key`: string(60) — kunci tabel (mis. `psb`, `kegiatan_psb_dokumen`)
- `nama`: string(50) — nama preset (mis. 'default', 'nama saja'); 'lengkap' dipakai bawaan sistem
- `kolom`: json — array key kolom yang ditampilkan **berurutan** (urutan array = urutan tampil kolom, mis. `["nama","lembaga"]`); tiap preset boleh beda urutan
- `dibuat_oleh`: FK → users [null, nullOnDelete]
- `created_at`, `updated_at`
- INDEX(`jenjang`, `table_key`)
- Unik `(jenjang, table_key, nama)` dicek di aplikasi (MySQL mengizinkan banyak NULL)

### `preset_tabel_aktif`
- `id` PK
- `user_id`: FK → users [cascade]
- `table_key`: string(60)
- `preset_id`: FK → preset_tabel [null, cascade] — null = Lengkap
- `created_at`, `updated_at`
- UNIQUE(`user_id`, `table_key`) — ingatan pilihan preset terakhir per user per tabel

### `urut_preset`
- `id` PK
- `table_key`: string(60) [unik] — kunci tabel grid (mis. `santri`, `keanggotaan`)
- `opsi`: json — daftar opsi urut `[{ kode: string[], label, arah: 'naik'|'turun'|null, bawaan: bool }]`; `kode` = allowlist backend (`UrutKatalog`), `bawaan` maks satu
- `dibuat_oleh`: FK → users [null, nullOnDelete]
- `created_at`, `updated_at`
- UNIQUE(`table_key`) — satu daftar opsi global per tabel

### `pengaturan_tampilan`
Standar tampilan per lembaga (tema/tipografi/grid/preset aktif), disebar super_admin; `versi` naik tiap perubahan agar klien memantau & memuat ulang.
- `id` PK
- `jenjang`: FK → lembaga [unique, cascade] — satu baris per lembaga
- `data`: json — isi standar tampilan
- `versi`: int unsigned [default 1]
- `diubah_oleh`: FK → users [null, nullOnDelete]
- `created_at`, `updated_at`

## BLOK 4 — Kepegawaian lanjutan (Modul 200 Kepegawaian)

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
- `jenjang`: FK → lembaga [cascade]
- `tahun_ajaran`: varchar(9) FK → tahun_ajaran.nama [cascade update + delete]
- `tugas_utama`: string [default 'Guru Pengampu'] — ref_tugas_utama
- `status_keaktifan`: enum(aktif|inaktif) [default 'aktif']
- `created_at`, `updated_at`
- UNIQUE(`pegawai_id`, `jenjang`, `tahun_ajaran`, `uq_keaktifan_pegawai_plt`) — nama pendek: auto-name 61 char, margin aman dari limit 64

### `presensi_pegawai`
- `id` PK
- `jenjang`: FK → lembaga [null, nullOnDelete]
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

## BLOK 5 — Kurikulum & Mapel (+Jadwal 502) (Modul 201 + 502)

### `pengaturan_hari_lembaga`
- `id` PK
- `jenjang`: FK → lembaga [cascade]
- `hari`: enum(senin|selasa|rabu|kamis|jumat|sabtu|minggu)
- `is_hari_libur`: bool [default false]
- `created_at`, `updated_at`
- UNIQUE(`jenjang`, `hari`)

### `kurikulum`
- `id` PK
- `jenjang`: FK → lembaga [cascade]
- `nama`: string
- `deskripsi`: text [null]
- `created_at`, `updated_at`
- UNIQUE(`jenjang`, `nama`)

### `mata_pelajaran`
- `id` PK
- `jenjang`: FK → lembaga [cascade]
- `nama_mapel`: string
- `kelompok`: enum(formal|pesantren) [default 'formal'] — Kolom darí Modul 202 (kelompok rapor):
- `kode_mapel`: string(20) [null]
- `created_at`, `updated_at`
- UNIQUE(`jenjang`, `nama_mapel`)

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
- `jenjang`: FK → lembaga [cascade]
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

## BLOK 6 — Penilaian & Rapor (Modul 202 Nilai-Rapor)

### `nilai_santri`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `pengampu_mapel_id`: FK → pengampu_mapel [cascade]
- `tahun_ajaran`: varchar(9) FK → tahun_ajaran.nama [cascade update + delete]
- `semester`: string(2) — '1' atau '2'
- `nilai_formatif`: decimal(5, 2) [default 0]
- `nilai_sumatif`: decimal(5, 2) [default 0]
- `nilai_akhir`: decimal(5, 2) [default 0]
- `predikat`: string(2) [null] — A, B, C, D
- `catatan_capaian`: text [null]
- `created_at`, `updated_at`
- UNIQUE(`santri_id`, `pengampu_mapel_id`, `tahun_ajaran`, `semester`, `unique_nilai_santri`)

### `rapor_catatan_wali`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `kelas_id`: FK → kelas [cascade]
- `tahun_ajaran`: varchar(9) FK → tahun_ajaran.nama [cascade update + delete]
- `semester`: string(2)
- `sakit`: int [default 0]
- `izin`: int [default 0]
- `alpa`: int [default 0]
- `catatan_akademik`: text [null]
- `catatan_karakter`: text [null]
- `keputusan_kenaikan`: string [null] — 'Naik ke kelas X', 'Lulus', dsb.
- `created_at`, `updated_at`
- UNIQUE(`santri_id`, `kelas_id`, `tahun_ajaran`, `semester`, `unique_catatan_wali`)

## BLOK 7 — Presensi & Kedisiplinan (Modul 500 Presensi Santri)

> TBD asrama: `sesi_presensi.kategori` sudah punya `kegiatan_asrama`, tetapi
> `presensi_santri.kelas_id` masih NOT NULL — presensi asrama (tanpa kelas)
> menunggu penyesuaian; lihat Lampiran C PRD. Ditunda dulu.

### `sesi_presensi`
- `id` PK
- `jenjang`: FK → lembaga [null, nullOnDelete]
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
- `jenjang`: FK → lembaga [null, nullOnDelete]
- `tanggal`: date [null]
- `tipe_pelanggaran`: string [null] — ref_tipe_pelanggaran
- `deskripsi`: text [null]
- `poin`: int [default 0] — dipakai portal wali (total poin)
- `recorded_by`: FK → users [null, nullOnDelete]
- `created_at`, `updated_at`

## BLOK 8 — Tahfizh (Modul 503 Tahfizh)

### `target_tahfiz`
- `id` PK
- `jenjang`: FK → lembaga [cascade]
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

## BLOK 9 — Portal Wali (Modul 203 Portal Orang Tua)

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

### Pola `ref_*` (24 tabel loop + eksplisit `ref_agama/cita_cita/hobi/pekerjaan/pendidikan/kebutuhan_khusus/kota/alamat/status_awal/status_akhir`)
- Kolom: `id` PK; `jenjang` FK → `lembaga` (nullable teknis, tanpa baris global; `null` = sisa legacy); `nama`; `urutan` [default 0]; `is_active` [default true]; unique(`jenjang`,`nama`) — pitfall multi-NULL, dedup di `RefService`.
- Urut tampil (v1.10.7): `urutan` ASC, tie-break `nama` ASC — termasuk `ref_status_awal/akhir` (kode = nilai, nama = tampilan).
- `ref_alamat` tambahan: wilayah free string + snapshot autofill. `ref_status_akhir`: `is_aktif_bawaan`, `terminal_ke`.
- Tabel loop: `ref_penghasilan`, `ref_transportasi`, `ref_status_tinggal`, `ref_jarak`, `ref_waktu_tempuh`, `ref_bahasa_sehari_hari`, `ref_disabilitas`, `ref_tmp_lahir`, `ref_status_ortu`, `ref_yang_membiayai`, `ref_provinsi`, `ref_kecamatan`, `ref_desa_kelurahan`, `ref_alasan_mutasi`, `ref_jenis_dokumen_santri`, `ref_jenis_dokumen_pegawai`, `ref_status_pernikahan`, `ref_gol_darah`, `ref_jenis_ptk`, `ref_jenjang_sertifikasi`, `ref_tingkat`, `ref_tugas_utama`, `ref_tipe_pelanggaran`, `ref_jalur_sertifikasi`

## BLOK 10 — Asrama (Modul 505 Asrama)

> **Pasca production** — tidak ada tabel/peran/pivot asrama yang dibuat sekarang.
> Blok ini arah desain agar keputusan sekarang tidak menutup jalan.
>
> Asrama = entitas sendiri, **bukan** `lembaga`. Kepengurusan & gedung terpisah;
> akses pengurus lewat peran `asrama` + pivot `user_asrama`. Daftar per jenjang /
> jenis kelamin = query dari `asrama_penghuni` ⋈ `santri` ⋈ riwayat akademik
> (tanpa kolom baru). `santri.tipe_santri` tetap sebagai flag kasar (PSB).
> Presensi/kegiatan asrama ditunda — lihat catatan BLOK 7.

### `asrama`
- `id` PK
- `kode`: string [null, unique] — mis. 'ASR_PA', 'ASR_PI'
- `nama`: string
- `jenis_kelamin`: enum(L|P) — putra/putri (beda gedung & pengurus); validasi aplikasi: harus cocok `santri.jk`
- `gedung`: string [null] — lokasi/gedung
- `pengasuh`: string [null] — nama pengasuh/mudir asrama
- `telepon`: string [null]
- `is_active`: bool [default true]
- `created_at`, `updated_at`

### `asrama_kamar`
- `id` PK
- `asrama_id`: FK → asrama [cascade]
- `nama`: string — mis. 'Kamar 01'
- `kapasitas`: int [null]
- `is_active`: bool [default true]
- `created_at`, `updated_at`
- UNIQUE(`asrama_id`, `nama`)

### `asrama_penghuni`
Lifecycle mandiri (tidak lewat `riwayat_belajar`); masuk/keluar bisa kapan saja.
- `id` PK
- `santri_id`: FK → santri [cascade]
- `asrama_id`: FK → asrama [cascade]
- `kamar_id`: FK → asrama_kamar [null, nullOnDelete] — kamar boleh menyusul
- `tanggal_masuk`: date
- `tanggal_keluar`: date [null]
- `status_akhir`: string [default 'aktif']
- `is_aktif`: bool [default true] — INVARIANT: true iff `status_akhir='aktif'`
- `catatan`: text [null]
- `created_at`, `updated_at`
- INDEX(`santri_id`, `is_aktif`); INDEX(`asrama_id`, `is_aktif`)

### `asrama_izin_pulang`
- `id` PK
- `santri_id`: FK → santri [cascade]
- `asrama_id`: FK → asrama [cascade]
- `tanggal_keluar`: date — rencana pulang
- `rencana_kembali`: date [null]
- `kembali_pada`: date [null] — realisasi; null = belum kembali
- `tujuan`: string [null]
- `alasan`: text [null]
- `status`: enum(diajukan|disetujui|ditolak|kembali) [default 'diajukan']
- `diproses_oleh`: FK → users [null, nullOnDelete]
- `catatan`: text [null]
- `created_at`, `updated_at`
- INDEX(`asrama_id`, `status`); INDEX(`santri_id`)

### `asrama_kegiatan`
- `id` PK
- `asrama_id`: FK → asrama [cascade]
- `nama`: string — mis. 'Shalat Subuh Jamaah', 'Muhadharah'
- `jadwal`: string [null] — hari/jam bebas
- `is_active`: bool [default true]
- `created_at`, `updated_at`

### Aturan izin keuangan asrama (mengikuti perumusan ulang modul keuangan)
- Prinsip: tagihan dibuat dari **lembaga**; pengurus **asrama** boleh membayar dan membaca keuangan santri asramanya; ubah terbatas lingkup asrama; hapus **hanya admin lembaga**.
- Mekanisme penanda (dulu `pos_keuangan.kategori`) ditetapkan saat modul keuangan dirumuskan ulang.


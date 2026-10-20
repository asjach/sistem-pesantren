# Diagram Hubungan Entitas (Entity Relationship Diagram/ERD) — SIMPES

Dokumen ini adalah gambaran visual hubungan antartabel yang dirangkum dari
[SCHEMA.md](SCHEMA.md). Rincian kolom, aturan validasi, indeks, nilai bawaan,
dan keputusan rancangan tetap mengikuti `SCHEMA.md`. Jika terdapat perbedaan,
`SCHEMA.md` adalah sumber utama.

Setiap perubahan pada `SCHEMA.md` wajib diikuti pembuatan ulang diagram yang
terdampak di berkas ini dalam pekerjaan dan commit yang sama. Aturan lengkapnya
tercantum pada bagian sinkronisasi skema dan ERD di [`AGENTS.md`](../AGENTS.md).

Diagram dibagi per bidang agar tetap terbaca. Nama kolom yang ditampilkan hanya
kunci utama (Primary Key/PK), kunci asing (Foreign Key/FK), dan beberapa kunci
penting yang membantu memahami hubungan.

Keterangan hubungan:

- `||` berarti tepat satu.
- `o|` berarti nol atau satu.
- `o{` berarti nol atau banyak.
- Tabel `REF_PER_LEMBAGA` adalah ringkasan visual untuk seluruh tabel
  referensi `ref_*` di `SCHEMA.md`, bukan nama tabel fisik.
- Bagian Asrama masih berupa rancangan dan belum dibuat di basis data
  (database/DB), sesuai catatan di `SCHEMA.md`.

## 1. Dasar, pengguna, dan referensi

```mermaid
erDiagram
    USERS {
        bigint id PK
        string email
        string phone
        string username
    }
    LEMBAGA {
        string jenjang PK
        string nama
        boolean is_active
    }
    REF_PER_LEMBAGA {
        bigint id PK
        string jenjang FK
        string nama
        boolean is_active
    }
    USER_LEMBAGA {
        bigint id PK
        bigint user_id FK
        string jenjang FK
        string role
    }
    LOGIN_AUDITS {
        bigint id PK
        bigint user_id FK
        boolean sukses
    }
    TAHUN_AJARAN {
        string nama PK
        boolean is_aktif
    }
    LEMBAGA_TAHUN_AJARAN {
        bigint id PK
        string jenjang FK
        string tahun_ajaran FK
        boolean is_active
    }
    SEMESTER_AKTIF {
        bigint id PK
        string jenjang FK
        bigint diubah_oleh FK
        string semester
    }
    PEGAWAI {
        bigint id PK
        bigint user_id FK
        string nipp
        string nama_lengkap
    }
    KELAS {
        bigint id PK
        string jenjang FK
        string tahun_ajaran FK
        bigint walas_id FK
        string nama_kelas
        string status_jadwal
    }
    IMPORT_SESI {
        bigint id PK
        bigint user_id FK
        string status
    }
    PERMISSIONS {
        bigint id PK
        string name
        string guard_name
    }
    ROLES {
        bigint id PK
        string name
        string guard_name
    }
    ROLE_HAS_PERMISSIONS {
        bigint permission_id PK,FK
        bigint role_id PK,FK
    }
    MODEL_HAS_PERMISSIONS {
        bigint permission_id PK,FK
        bigint model_id PK
        string model_type PK
    }

    USERS ||--o{ USER_LEMBAGA : "memiliki cakupan"
    LEMBAGA ||--o{ USER_LEMBAGA : "mencakup pengguna"
    USERS o|--o{ LOGIN_AUDITS : "tercatat pada"
    LEMBAGA o|--o{ REF_PER_LEMBAGA : "memiliki referensi"
    LEMBAGA ||--o{ LEMBAGA_TAHUN_AJARAN : "menampilkan"
    TAHUN_AJARAN ||--o{ LEMBAGA_TAHUN_AJARAN : "tersedia untuk"
    LEMBAGA ||--o| SEMESTER_AKTIF : "memiliki semester berjalan"
    USERS o|--o{ SEMESTER_AKTIF : "mengubah"
    USERS o|--o{ PEGAWAI : "menjadi akun"
    LEMBAGA ||--o{ KELAS : "memiliki"
    TAHUN_AJARAN ||--o{ KELAS : "mencakup"
    PEGAWAI o|--o{ KELAS : "menjadi wali kelas"
    USERS ||--o{ IMPORT_SESI : "membuat"
    PERMISSIONS ||--o{ ROLE_HAS_PERMISSIONS : "dipasang ke"
    ROLES ||--o{ ROLE_HAS_PERMISSIONS : "memiliki"
    PERMISSIONS ||--o{ MODEL_HAS_PERMISSIONS : "diberikan langsung"
```

`REF_PER_LEMBAGA` mewakili tabel eksplisit seperti `ref_agama`,
`ref_cita_cita`, `ref_hobi`, `ref_pekerjaan`, `ref_pendidikan`,
`ref_kebutuhan_khusus`, `ref_kota`, `ref_alamat`, `ref_status_awal`, dan
`ref_status_akhir`, beserta tabel `ref_*` lain yang dicantumkan di
`SCHEMA.md`.

## 2. Santri, riwayat belajar, dan penerimaan santri baru

```mermaid
erDiagram
    USERS {
        bigint id PK
    }
    LEMBAGA {
        string jenjang PK
    }
    TAHUN_AJARAN {
        string nama PK
    }
    KELAS {
        bigint id PK
        string jenjang FK
        string tahun_ajaran FK
        string status_jadwal
    }
    SANTRI {
        bigint id PK
        string nik
        string nisn
        string nama_lengkap
    }
    LEMBAGA_SANTRI {
        bigint id PK
        bigint santri_id FK
        string jenjang FK
        string nis_lokal
    }
    RIWAYAT_BELAJAR {
        bigint id PK
        bigint santri_id FK
        string tahun_ajaran FK
        string jenjang FK
        bigint kelas_id FK
        string semester
    }
    MUTASI_KELUAR {
        bigint id PK
        bigint santri_id FK
        string jenjang FK
        bigint kelas_terakhir_id FK
    }
    ALUMNI {
        bigint id PK
        bigint santri_id FK
        string lembaga_lulus FK
        bigint kelas_lulus_id FK
        string tahun_ajaran_lulus FK
    }
    PSB_KEGIATAN {
        bigint id PK
        string tahun_ajaran FK
        string nama
    }
    PSB_GELOMBANG {
        bigint id PK
        bigint psb_kegiatan_id FK
        string nama
    }
    PSB_KUOTA_BIAYA {
        bigint id PK
        bigint gelombang_id FK
        string jenjang FK
        string tipe_santri
    }
    PSB_CALON_SANTRI {
        bigint id PK
        string jenjang FK
        bigint gelombang_id FK
        string tahun_ajaran FK
        bigint kelas_id FK
        bigint santri_asal_id FK
        bigint santri_id FK
        string no_pendaftaran
    }
    PSB_CALON_LEMBAGA {
        bigint id PK
        bigint psb_calon_santri_id FK
        string jenjang FK
        string peran
    }
    DOKUMEN_SANTRI {
        bigint id PK
        bigint santri_id FK
        bigint psb_calon_santri_id FK
        string lembaga FK
    }
    DOKUMEN_LEMBAGA {
        bigint id PK
        string jenjang FK
    }
    DOKUMEN_WAJIB_LEMBAGA {
        bigint id PK
        bigint psb_kegiatan_id FK
        string jenjang FK
    }
    PSB_LOG_STATUS {
        bigint id PK
        bigint psb_calon_santri_id FK
        bigint oleh_user_id FK
        string ke
    }

    SANTRI ||--o{ LEMBAGA_SANTRI : "terdaftar pada"
    LEMBAGA ||--o{ LEMBAGA_SANTRI : "memiliki santri"
    SANTRI ||--o{ RIWAYAT_BELAJAR : "memiliki riwayat"
    TAHUN_AJARAN ||--o{ RIWAYAT_BELAJAR : "mencakup"
    LEMBAGA ||--o{ RIWAYAT_BELAJAR : "menjadi tempat belajar"
    KELAS o|--o{ RIWAYAT_BELAJAR : "menempatkan"
    SANTRI ||--o{ MUTASI_KELUAR : "memiliki mutasi"
    LEMBAGA ||--o{ MUTASI_KELUAR : "mencatat"
    KELAS o|--o{ MUTASI_KELUAR : "menjadi kelas terakhir"
    SANTRI ||--o{ ALUMNI : "memiliki arsip kelulusan"
    LEMBAGA ||--o{ ALUMNI : "meluluskan"
    KELAS o|--o{ ALUMNI : "menjadi kelas lulus"
    TAHUN_AJARAN ||--o{ ALUMNI : "menjadi tahun lulus"
    TAHUN_AJARAN ||--o| PSB_KEGIATAN : "memiliki kegiatan"
    PSB_KEGIATAN o|--o{ PSB_GELOMBANG : "memiliki"
    PSB_GELOMBANG ||--o{ PSB_KUOTA_BIAYA : "mengatur kuota"
    LEMBAGA ||--o{ PSB_KUOTA_BIAYA : "menerima kuota"
    LEMBAGA ||--o{ PSB_CALON_SANTRI : "menjadi tujuan utama"
    PSB_GELOMBANG o|--o{ PSB_CALON_SANTRI : "menerima pendaftaran"
    TAHUN_AJARAN o|--o{ PSB_CALON_SANTRI : "menjadi tahun masuk"
    KELAS o|--o{ PSB_CALON_SANTRI : "menjadi kelas tujuan"
    SANTRI o|--o{ PSB_CALON_SANTRI : "menjadi santri asal"
    SANTRI o|--o{ PSB_CALON_SANTRI : "menjadi hasil konversi"
    PSB_CALON_SANTRI ||--o{ PSB_CALON_LEMBAGA : "memilih lembaga"
    LEMBAGA ||--o{ PSB_CALON_LEMBAGA : "menjadi pilihan"
    SANTRI o|--o{ DOKUMEN_SANTRI : "memiliki dokumen"
    PSB_CALON_SANTRI o|--o{ DOKUMEN_SANTRI : "mengunggah dokumen"
    LEMBAGA o|--o{ DOKUMEN_SANTRI : "memberi konteks"
    LEMBAGA ||--o{ DOKUMEN_LEMBAGA : "memiliki dokumen"
    PSB_KEGIATAN ||--o{ DOKUMEN_WAJIB_LEMBAGA : "mensyaratkan"
    LEMBAGA ||--o{ DOKUMEN_WAJIB_LEMBAGA : "menerapkan syarat"
    PSB_CALON_SANTRI ||--o{ PSB_LOG_STATUS : "memiliki riwayat status"
    USERS o|--o{ PSB_LOG_STATUS : "mencatat"
```

## 3. Pengaturan tabel dan tampilan

```mermaid
erDiagram
    USERS {
        bigint id PK
    }
    LEMBAGA {
        string jenjang PK
    }
    PRESET_TABEL {
        bigint id PK
        string jenjang FK
        string table_key
        bigint dibuat_oleh FK
    }
    PRESET_TABEL_AKTIF {
        bigint id PK
        bigint user_id FK
        bigint preset_id FK
        string table_key
    }
    URUT_PRESET {
        bigint id PK
        string table_key
        bigint dibuat_oleh FK
    }
    TOOLBAR_PRESET {
        bigint id PK
        string table_key
        bigint dibuat_oleh FK
    }
    KOMPONEN_CUSTOM {
        bigint id PK
        string table_key
        string komponen
        bigint dibuat_oleh FK
    }
    PENGATURAN_HALAMAN {
        bigint id PK
        string page_key
        bigint diubah_oleh FK
    }
    PENGATURAN_GLOBAL {
        bigint id PK
        string kunci
        bigint diubah_oleh FK
    }

    LEMBAGA o|--o{ PRESET_TABEL : "memiliki preset"
    USERS o|--o{ PRESET_TABEL : "membuat"
    USERS ||--o{ PRESET_TABEL_AKTIF : "memilih"
    PRESET_TABEL o|--o{ PRESET_TABEL_AKTIF : "dipakai sebagai pilihan"
    USERS o|--o{ URUT_PRESET : "membuat"
    USERS o|--o{ TOOLBAR_PRESET : "membuat"
    USERS o|--o{ KOMPONEN_CUSTOM : "membuat"
    USERS o|--o{ PENGATURAN_HALAMAN : "mengubah"
    USERS o|--o{ PENGATURAN_GLOBAL : "mengubah"
```

## 4. Pegawai dan penempatan

```mermaid
erDiagram
    LEMBAGA {
        string jenjang PK
    }
    TAHUN_AJARAN {
        string nama PK
    }
    PEGAWAI {
        bigint id PK
        bigint user_id FK
        string nipp
    }
    PEGAWAI_PENDIDIKAN {
        bigint id PK
        bigint pegawai_id FK
    }
    PEGAWAI_SERTIFIKASI {
        bigint id PK
        bigint pegawai_id FK
    }
    KELUARGA_PEGAWAI {
        bigint id PK
        bigint pegawai_id FK
    }
    DOKUMEN_PEGAWAI {
        bigint id PK
        bigint pegawai_id FK
    }
    KEAKTIFAN_PEGAWAI {
        bigint id PK
        bigint pegawai_id FK
        string jenjang FK
        string tahun_ajaran FK
    }
    LEMBAGA_PEGAWAI {
        bigint id PK
        bigint pegawai_id FK
        string jenjang FK
    }
    PRESENSI_PEGAWAI {
        bigint id PK
        string jenjang FK
        bigint pegawai_id FK
        date tanggal
    }

    PEGAWAI ||--o{ PEGAWAI_PENDIDIKAN : "memiliki pendidikan"
    PEGAWAI ||--o| PEGAWAI_SERTIFIKASI : "memiliki sertifikasi"
    PEGAWAI ||--o{ KELUARGA_PEGAWAI : "memiliki keluarga"
    PEGAWAI ||--o{ DOKUMEN_PEGAWAI : "memiliki dokumen"
    PEGAWAI ||--o{ KEAKTIFAN_PEGAWAI : "memiliki riwayat aktif"
    LEMBAGA ||--o{ KEAKTIFAN_PEGAWAI : "mencatat keaktifan"
    TAHUN_AJARAN ||--o{ KEAKTIFAN_PEGAWAI : "mencakup"
    PEGAWAI ||--o{ LEMBAGA_PEGAWAI : "ditempatkan"
    LEMBAGA ||--o{ LEMBAGA_PEGAWAI : "memiliki pegawai"
    PEGAWAI ||--o{ PRESENSI_PEGAWAI : "memiliki presensi"
    LEMBAGA o|--o{ PRESENSI_PEGAWAI : "menjadi lokasi"
```

## 5. Kurikulum dan jadwal

```mermaid
erDiagram
    LEMBAGA {
        string jenjang PK
    }
    KELAS {
        bigint id PK
        string jenjang FK
    }
    KEAKTIFAN_PEGAWAI {
        bigint id PK
        bigint pegawai_id FK
    }
    PENGATURAN_HARI_LEMBAGA {
        bigint id PK
        string jenjang FK
        string hari
    }
    MATA_PELAJARAN {
        bigint id PK
        string jenjang FK
        string nama_mapel
    }
    PENGAMPU_MAPEL {
        bigint id PK
        bigint kelas_id FK
        bigint mata_pelajaran_id FK
        bigint keaktifan_pegawai_id FK
    }
    SLOT_JAM_PELAJARAN {
        bigint id PK
        string jenjang FK
        bigint kelas_id FK
        string hari
    }
    JADWAL_PELAJARAN {
        bigint id PK
        bigint kelas_id FK
        bigint pengampu_mapel_id FK
        bigint keaktifan_pegawai_id FK
        bigint slot_jam_id FK
        string hari
    }
    TEMPLATE_JADWAL {
        bigint id PK
        string jenjang FK
        bigint kelas_id FK
        string nama
    }
    TEMPLATE_JADWAL_BARIS {
        bigint id PK
        bigint template_jadwal_id FK
        string hari
        int urutan_slot
    }
    VARIAN_JADWAL {
        bigint id PK
        string jenjang FK
        string tahun_ajaran FK
        string nama
        boolean is_active
        bigint dibuat_oleh FK
    }
    TAHUN_AJARAN {
        string nama PK
    }
    USERS {
        bigint id PK
    }
    STRUKTUR_KURIKULUM {
        bigint id PK
        string jenjang FK
        string tahun_ajaran FK
        string tingkat
        bigint mata_pelajaran_id FK
        int jp_per_minggu
    }
    STRUKTUR_KURIKULUM_PENGATURAN {
        bigint id PK
        string jenjang FK
        string tahun_ajaran FK
        int minggu_efektif
    }

    LEMBAGA ||--o{ PENGATURAN_HARI_LEMBAGA : "mengatur hari"
    LEMBAGA ||--o{ MATA_PELAJARAN : "memiliki mata pelajaran"
    KELAS ||--o{ PENGAMPU_MAPEL : "memiliki pengampu"
    MATA_PELAJARAN ||--o{ PENGAMPU_MAPEL : "diajarkan oleh"
    KEAKTIFAN_PEGAWAI o|--o{ PENGAMPU_MAPEL : "menjadi guru"
    LEMBAGA ||--o{ SLOT_JAM_PELAJARAN : "memiliki slot"
    KELAS o|--o{ SLOT_JAM_PELAJARAN : "memiliki susunan slot"
    KELAS ||--o{ JADWAL_PELAJARAN : "memiliki jadwal"
    PENGAMPU_MAPEL o|--o{ JADWAL_PELAJARAN : "mengisi"
    KEAKTIFAN_PEGAWAI o|--o{ JADWAL_PELAJARAN : "mengisi langsung"
    SLOT_JAM_PELAJARAN ||--o{ JADWAL_PELAJARAN : "dipakai pada"
    LEMBAGA ||--o{ TEMPLATE_JADWAL : "memiliki template"
    KELAS o|--o{ TEMPLATE_JADWAL : "membatasi template"
    TEMPLATE_JADWAL ||--o{ TEMPLATE_JADWAL_BARIS : "memiliki baris"
    LEMBAGA ||--o{ VARIAN_JADWAL : "memiliki varian"
    TAHUN_AJARAN ||--o{ VARIAN_JADWAL : "berlaku pada"
    USERS o|--o{ VARIAN_JADWAL : "dibuat oleh"
    LEMBAGA ||--o{ STRUKTUR_KURIKULUM : "memiliki struktur"
    TAHUN_AJARAN ||--o{ STRUKTUR_KURIKULUM : "berlaku pada"
    MATA_PELAJARAN ||--o{ STRUKTUR_KURIKULUM : "diatur JP-nya"
    LEMBAGA ||--o{ STRUKTUR_KURIKULUM_PENGATURAN : "memiliki pengaturan"
    TAHUN_AJARAN ||--o{ STRUKTUR_KURIKULUM_PENGATURAN : "berlaku pada"
```

## 6. Penilaian dan rapor

```mermaid
erDiagram
    LEMBAGA {
        string jenjang PK
    }
    TAHUN_AJARAN {
        string nama PK
    }
    SANTRI {
        bigint id PK
    }
    KELAS {
        bigint id PK
    }
    PENGAMPU_MAPEL {
        bigint id PK
    }
    PERISTIWA_NILAI {
        bigint id PK
        string jenjang FK
        string tahun_ajaran FK
        string kode
    }
    KOMPONEN_NILAI {
        bigint id PK
        bigint peristiwa_id FK
        bigint peristiwa_sumber_id FK
    }
    KKM_KEGIATAN {
        bigint id PK
        bigint peristiwa_id FK
    }
    RENTANG_PREDIKAT {
        bigint id PK
        bigint peristiwa_id FK
    }
    NILAI_KOMPONEN {
        bigint id PK
        bigint santri_id FK
        bigint pengampu_mapel_id FK
        string tahun_ajaran FK
        bigint komponen_nilai_id FK
    }
    NILAI_SANTRI {
        bigint id PK
        bigint santri_id FK
        bigint pengampu_mapel_id FK
        string tahun_ajaran FK
        bigint peristiwa_id FK
    }
    RAPOR_CATATAN_WALI {
        bigint id PK
        bigint santri_id FK
        bigint kelas_id FK
        string tahun_ajaran FK
    }
    EKSTRAKURIKULER {
        bigint id PK
        string jenjang FK
        string tahun_ajaran FK
    }
    NILAI_EKSTRAKURIKULER {
        bigint id PK
        bigint santri_id FK
        string tahun_ajaran FK
        bigint ekstrakurikuler_id FK
    }
    PRESTASI_SANTRI {
        bigint id PK
        bigint santri_id FK
        string tahun_ajaran FK
    }
    PREDIKAT_EKSKUL {
        bigint id PK
        string jenjang FK
        string predikat
    }

    LEMBAGA ||--o{ PERISTIWA_NILAI : "memiliki peristiwa"
    TAHUN_AJARAN ||--o{ PERISTIWA_NILAI : "mencakup"
    PERISTIWA_NILAI ||--o{ KOMPONEN_NILAI : "memiliki komponen"
    PERISTIWA_NILAI o|--o{ KOMPONEN_NILAI : "menjadi sumber komponen"
    PERISTIWA_NILAI ||--o{ KKM_KEGIATAN : "memiliki KKM"
    PERISTIWA_NILAI ||--o{ RENTANG_PREDIKAT : "memiliki rentang"
    SANTRI ||--o{ NILAI_KOMPONEN : "memperoleh skor"
    PENGAMPU_MAPEL ||--o{ NILAI_KOMPONEN : "memberi skor"
    TAHUN_AJARAN ||--o{ NILAI_KOMPONEN : "mencakup"
    KOMPONEN_NILAI ||--o{ NILAI_KOMPONEN : "dinilai melalui"
    SANTRI ||--o{ NILAI_SANTRI : "memperoleh nilai akhir"
    PENGAMPU_MAPEL ||--o{ NILAI_SANTRI : "memberi nilai akhir"
    TAHUN_AJARAN ||--o{ NILAI_SANTRI : "mencakup"
    PERISTIWA_NILAI ||--o{ NILAI_SANTRI : "menghasilkan"
    SANTRI ||--o{ RAPOR_CATATAN_WALI : "memiliki catatan rapor"
    KELAS ||--o{ RAPOR_CATATAN_WALI : "memiliki catatan wali"
    TAHUN_AJARAN ||--o{ RAPOR_CATATAN_WALI : "mencakup"
    LEMBAGA ||--o{ EKSTRAKURIKULER : "memiliki kegiatan"
    TAHUN_AJARAN ||--o{ EKSTRAKURIKULER : "mencakup"
    SANTRI ||--o{ NILAI_EKSTRAKURIKULER : "memperoleh nilai"
    TAHUN_AJARAN ||--o{ NILAI_EKSTRAKURIKULER : "mencakup"
    EKSTRAKURIKULER ||--o{ NILAI_EKSTRAKURIKULER : "memiliki peserta"
    SANTRI ||--o{ PRESTASI_SANTRI : "memiliki prestasi"
    TAHUN_AJARAN ||--o{ PRESTASI_SANTRI : "mencakup"
    LEMBAGA o|--o{ PREDIKAT_EKSKUL : "memiliki predikat"
```

## 7. Presensi santri, kedisiplinan, Tahfizh, dan portal wali

```mermaid
erDiagram
    USERS {
        bigint id PK
    }
    LEMBAGA {
        string jenjang PK
    }
    SANTRI {
        bigint id PK
    }
    KELAS {
        bigint id PK
    }
    SESI_PRESENSI {
        bigint id PK
        string jenjang FK
        string nama_sesi
    }
    PRESENSI_SANTRI {
        bigint id PK
        bigint santri_id FK
        bigint kelas_id FK
        bigint sesi_presensi_id FK
        bigint recorded_by FK
    }
    PELANGGARAN_SANTRI {
        bigint id PK
        bigint santri_id FK
        string jenjang FK
        bigint recorded_by FK
    }
    TARGET_TAHFIZ {
        bigint id PK
        string jenjang FK
    }
    SETORAN_TAHFIZ {
        bigint id PK
        bigint santri_id FK
        bigint penguji_id FK
    }
    REKAP_TAHFIZ_SANTRI {
        bigint id PK
        bigint santri_id FK
    }
    WALI_SANTRI_RELASI {
        bigint id PK
        bigint user_id FK
        bigint santri_id FK
    }
    WALI_PORTAL_LOGS {
        bigint id PK
        bigint user_id FK
        bigint santri_id FK
    }
    PENGAJUAN_BIODATA_SANTRI {
        bigint id PK
        bigint santri_id FK
        bigint wali_user_id FK
        bigint diproses_oleh FK
    }

    LEMBAGA o|--o{ SESI_PRESENSI : "memiliki sesi"
    SANTRI ||--o{ PRESENSI_SANTRI : "memiliki presensi"
    KELAS ||--o{ PRESENSI_SANTRI : "mencatat presensi"
    SESI_PRESENSI ||--o{ PRESENSI_SANTRI : "dipakai pada"
    USERS o|--o{ PRESENSI_SANTRI : "mencatat"
    SANTRI ||--o{ PELANGGARAN_SANTRI : "memiliki pelanggaran"
    LEMBAGA o|--o{ PELANGGARAN_SANTRI : "menjadi konteks"
    USERS o|--o{ PELANGGARAN_SANTRI : "mencatat"
    LEMBAGA ||--o{ TARGET_TAHFIZ : "memiliki target"
    SANTRI ||--o{ SETORAN_TAHFIZ : "melakukan setoran"
    USERS o|--o{ SETORAN_TAHFIZ : "menguji"
    SANTRI ||--o| REKAP_TAHFIZ_SANTRI : "memiliki rekap"
    USERS ||--o{ WALI_SANTRI_RELASI : "menjadi wali"
    SANTRI ||--o{ WALI_SANTRI_RELASI : "memiliki wali"
    USERS ||--o{ WALI_PORTAL_LOGS : "mengakses portal"
    SANTRI o|--o{ WALI_PORTAL_LOGS : "diakses datanya"
    SANTRI ||--o{ PENGAJUAN_BIODATA_SANTRI : "diajukan perubahannya"
    USERS ||--o{ PENGAJUAN_BIODATA_SANTRI : "mengajukan sebagai wali"
    USERS o|--o{ PENGAJUAN_BIODATA_SANTRI : "memproses"
```

## 8. Asrama — rancangan, belum diimplementasikan

```mermaid
erDiagram
    USERS {
        bigint id PK
    }
    SANTRI {
        bigint id PK
    }
    ASRAMA {
        bigint id PK
        string kode
        string nama
    }
    USER_ASRAMA {
        bigint id PK
        bigint user_id FK
        bigint asrama_id FK
    }
    ASRAMA_KAMAR {
        bigint id PK
        bigint asrama_id FK
    }
    ASRAMA_PENGHUNI {
        bigint id PK
        bigint santri_id FK
        bigint asrama_id FK
        bigint kamar_id FK
    }
    ASRAMA_IZIN_PULANG {
        bigint id PK
        bigint santri_id FK
        bigint asrama_id FK
        bigint diproses_oleh FK
    }
    ASRAMA_KEGIATAN {
        bigint id PK
        bigint asrama_id FK
    }

    USERS ||--o{ USER_ASRAMA : "memiliki cakupan"
    ASRAMA ||--o{ USER_ASRAMA : "memiliki pengurus"
    ASRAMA ||--o{ ASRAMA_KAMAR : "memiliki kamar"
    SANTRI ||--o{ ASRAMA_PENGHUNI : "menjadi penghuni"
    ASRAMA ||--o{ ASRAMA_PENGHUNI : "menampung"
    ASRAMA_KAMAR o|--o{ ASRAMA_PENGHUNI : "ditempati"
    SANTRI ||--o{ ASRAMA_IZIN_PULANG : "mengajukan izin"
    ASRAMA ||--o{ ASRAMA_IZIN_PULANG : "mencatat izin"
    USERS o|--o{ ASRAMA_IZIN_PULANG : "memproses"
    ASRAMA ||--o{ ASRAMA_KEGIATAN : "memiliki kegiatan"
```

## 9. Keuangan

```mermaid
erDiagram
    USERS {
        bigint id PK
    }
    LEMBAGA {
        string jenjang PK
    }
    TAHUN_AJARAN {
        string nama PK
    }
    SANTRI {
        bigint id PK
    }
    JENIS_TAGIHAN {
        bigint id PK
        string nama
        string jenjang
    }
    TARIF_TAGIHAN {
        bigint id PK
        bigint jenis_id FK
        string jenjang
        string tahun_ajaran
    }
    DISPENSASI {
        bigint id PK
        string tahun_ajaran FK
        string jenjang FK
        string nama
    }
    DISPENSASI_ATURAN {
        bigint id PK
        bigint dispensasi_id FK
        bigint jenis_id FK
    }
    SANTRI_DISPENSASI {
        bigint id PK
        bigint dispensasi_id FK
        bigint santri_id FK
    }
    GRUP_SANTRI_CUSTOM {
        bigint id PK
        string nama
        string jenjang
        string tahun_ajaran
    }
    ANGGOTA_GRUP_SANTRI_CUSTOM {
        bigint id PK
        bigint grup_id FK
        bigint santri_id FK
    }
    TAGIHAN {
        bigint id PK
        bigint santri_id FK
        bigint jenis_id FK
        string periode
    }
    TRANSAKSI_PEMBAYARAN {
        bigint id PK
        bigint diterima_oleh FK
        string no_kwitansi
    }
    PEMBAYARAN {
        bigint id PK
        bigint tagihan_id FK
        bigint transaksi_id FK
    }

    JENIS_TAGIHAN ||--o{ TARIF_TAGIHAN : "memiliki tarif"
    TAHUN_AJARAN ||--o{ DISPENSASI : "mencakup"
    LEMBAGA o|--o{ DISPENSASI : "membatasi lingkup"
    DISPENSASI ||--o{ DISPENSASI_ATURAN : "memiliki aturan"
    JENIS_TAGIHAN o|--o{ DISPENSASI_ATURAN : "dibatasi oleh"
    DISPENSASI ||--o{ SANTRI_DISPENSASI : "diberikan kepada"
    SANTRI ||--o{ SANTRI_DISPENSASI : "menerima"
    GRUP_SANTRI_CUSTOM ||--o{ ANGGOTA_GRUP_SANTRI_CUSTOM : "memiliki anggota"
    SANTRI ||--o{ ANGGOTA_GRUP_SANTRI_CUSTOM : "menjadi anggota"
    SANTRI ||--o{ TAGIHAN : "memiliki"
    JENIS_TAGIHAN ||--o{ TAGIHAN : "menentukan jenis"
    TAGIHAN ||--o{ PEMBAYARAN : "dibayar melalui"
    TRANSAKSI_PEMBAYARAN o|--o{ PEMBAYARAN : "mengelompokkan"
    USERS o|--o{ TRANSAKSI_PEMBAYARAN : "menerima pembayaran"
```

Catatan: `jenis_tagihan.jenjang`, `tarif_tagihan.jenjang`,
`tarif_tagihan.tahun_ajaran`, serta lingkup pada `grup_santri_custom` masih
berupa nilai teks tanpa kunci asing (Foreign Key/FK). Karena itu, hubungan
fisiknya tidak digambar sebagai relasi ke `lembaga` atau `tahun_ajaran`.

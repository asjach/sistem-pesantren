# DAFTAR MODUL BELUM BERTES — SIMPES

> Dibuat: sesi audit. **Status tes: AKTIF kembali** (suspend dicabut 2026-10-13;
> bagian "SUSPEND TES" di `AGENTS.md` root ditandai NON-AKTIF, isinya disimpan
> sebagai arsip bila pengguna mau men-suspend lagi).
> Dokumen ini **daftar kerja**, bukan perintah menjalankan tes. Tes dijalankan
> seperti biasa sekarang; berkas ini tinggal inventaris modul yang belum
> punya test untuk dibereskan berdasarkan prioritas.
>
> Cara pakai: saat pengguna minta "buatkan test X", cari X di daftar ini,
> ambil "Logika yang perlu diuji" + "Failure mode", lalu tulis test tersempit.

## Ringkasan angka

| Cakupan | Sudah ada test | Total modul | Belum ada test |
|---|---|---|---|
| Backend — Service | 2 (implisit) | 27 | **25** |
| Backend — Support/helper | 6 (`JatuhTempo`, `NikFlag`, `NamaBerkasDokumen`, `Tanggal`, `Telepon`) | 6 | **0** ✅ |
| Backend — Import/Export | 8 (via Feature) | 8 + 12 | sebagian |
| Backend — Console command | 1 (`DevReset`) | 3 | **2** |
| Frontend — `src/api` | 4 | 20 | **16** |
| Frontend — `src/lib` | 14 | 17 | **3** |
| Frontend — `src/hooks` | 2 | 6 | **4** |

---

# BAGIAN A — BACKEND

## A1. Service tanpa test sama sekali (prioritas tertinggi)

### ✅ A1-1. `PsbGelombangService.php`
File: `backend/app/Services/PsbGelombangService.php`
Test: `tests/Feature/PsbGelombangServiceTest.php` (15 tes) — `cekBukaDanKuota`,
`gelombangAktif` (prioritas kegiatan aktif, batas tanggal, filter kegiatan),
`validasiRentang` (rentang terbalik, tumpang tindih, abaikan diri sendiri, batas kegiatan).
- **Logika belum diuji:**
  - `sisaKuota()` (baris 77) — hitung sisa kuota gelombang; pool gabungan MI↔MD;
    `tipeSantri='semua'`; kuota `null` = tak terbatas.
  - `cekBukaDanKuota()` (13) — tolak bila gelombang tutup / kuota habis / waiting list.
  - `gelombangAktif()` (33) — pilih gelombang aktif dari rentang tanggal.
  - `validasiRentang()` (50) — tolak rentang tanggal tumpang tindih antar gelombang.
- **Failure mode penting:** dua pendaftar paralel sama-sama lolos (race);
  kuota habis tapi tetap masuk; gelombang `null` diperlakukan sebagai terbuka.
- **Catatan audit:** `sisaKuota()` TIDAK memakai `lockForUpdate` → over-quota.
  Test ini idealnya juga membuktikan perbaikannya nanti.

### A1-2. `NisKemenagService.php`
File: `backend/app/Services/NisKemenagService.php`
- **Logika:** `generate()` (24) — susun NIS Kemenag dari NSM + tahun; 
  `tahunDiterimaYY()` (61) — ambil 2 digit tahun diterima, fallback `tgl_mulai_tahun`.
- **Failure mode:** NSM lembaga kosong/invalid; `nis_lokal` kosong; tahun masuk null;
  NIS bentrok (unique) saat generate massal. **Sudah ada `NiskBulkTest.php`** untuk bulk,
  tetapi unit `generate()` sendiri belum tersentuh edge case.

### A1-3. `PenerimaanService.php`
File: `backend/app/Services/PenerimaanService.php`
- **Logika:** `terima()` (163) buat riwayat belajar; `pastikanKeanggotaan()` (88);
  `samakanNisSatu()` (30) + `salinNis()` (64) — samakan NIS paket MI↔MD, mode pratinjau vs eksekusi;
  `tahunAjaranBerikut()` (242) — hitung TA lanjut saat naik.
- **Failure mode:** pratinjau (`eksekusi=false`) ternyata menulis; TA berikut tidak ada → null;
  keanggotaan ganda saat dipanggil dua kali. **`SamakanNisTest.php` ada**, tapi cakupannya
  lewat endpoint, bukan unit.

### A1-4. `KelasService.php`
File: `backend/app/Services/KelasService.php`
- **Logika:** `tetapkanWalas()` (24); `cekKelayakan()` (67) — walas harus pegawai
  aktif di lembaga yang sama; `cariPegawai()` (47) — resolusi pegawai dari nilai bebas.
- **Failure mode:** walas dari lembaga lain lolos; pegawai nonaktif jadi walas;
  satu pegawai jadi walas di dua kelas sejenis. **`KelasWalasTest.php` ada** — perlu
  dicek apakah menutup ketiga failure mode ini.

### ✅ A1-5. `SinkronIzin.php`
File: `backend/app/Services/SinkronIzin.php`
Test: `tests/Feature/SinkronIzinTest.php` (7 tes) — termasuk sifat ADITIF
(izin yang dipangkas admin tidak dihidupkan ulang) dan idempotensi.
- **Logika:** sinkronkan katalog izin (`IzinKatalog`) ke tabel `permissions`/`role_has_permissions`.
- **Failure mode:** izin baru di katalog belum ada di DB → semua rute `permission:` menolak
  SEMUA peran. Ini pitfall yang **sudah tercatat** di komentar `routes/api.php:318-321`,
  jadi justru paling layak dikunci test.

### A1-6. `PsbSummaryNotificationService.php` — ✅ SELESAI (1 bug diperbaiki)
File: `backend/app/Services/PsbSummaryNotificationService.php`
Test: `tests/Feature/PsbSummaryNotificationServiceTest.php` (5 tes).
- **BUG ditemukan & diperbaiki:** `scopeTenant()` menyaring `s.jenjang` padahal tabel
  `santri` **tidak punya kolom `jenjang`** (lembaga = keanggotaan `lembaga_santri`).
  Setiap admin ber-scope memicu `SQLSTATE[HY000]: no such column: s.jenjang`.
  Kini memakai subquery `lembaga_santri` + pengecualian tanpa-keanggotaan (arsip
  pusat), mengikuti pola `PengajuanBiodataController`. Service dorman (belum ada
  pemanggil), jadi dampaknya laten — tapi meledak begitu dipanggil.
- **Logika:** `refreshBiodata()` (19), `refreshDaftarUlang()` (33) — hitung & kirim notifikasi;
  `scopeTenant()` (53) + `scopeCalon()` — batasi hitungan ke tenant admin.
- **Catatan:** `admin` tanpa pivot = admin full (sengaja lintas lembaga), BUKAN nol.

### A1-7. `RefService.php` — ✅ DIPERIKSA (sudah cukup tercakup)
File: `backend/app/Services/RefService.php`
- Cabang berlogika (cache efektif per jenjang, overrid lembaga, `kodeAktif()`
  menyaring baris non-aktif, `sifatStatusAkhir()`) sudah tersentuh
  `tests/Feature/ReferensiCrudTest.php` + `GlobalFilterTest.php`.
- Sisanya murni CRUD/passthrough — tidak ada failure mode baru yang layak test.

## A2. Support/helper

| File | Status |
|---|---|
| `Support/NikFlag.php` | ✅ `tests/Unit/NikFlagTest.php` (9 tes) |
| `Support/Tanggal.php` | ✅ `tests/Unit/TanggalTest.php` (15 tes) |
| `Support/Telepon.php` | ✅ `tests/Unit/TeleponTest.php` (17 tes) |
| `Support/NamaBerkasDokumen.php` | ✅ `tests/Unit/NamaBerkasDokumenTest.php` (23 tes) — termasuk pembuktian `jalur()` menahan path traversal |
| `Support/JatuhTempo.php` | ✅ `tests/Unit/JatuhTempoTest.php` |

Sisa satu: `NamaBerkasDokumen` — paling layak karena menyentuh nama berkas di disk
(path traversal & bentrok nama).

## A3. Import / Export

**Importer (8) — sebagian tercakup lewat Feature test potong:**

| Importer | Test terkait | Celah |
|---|---|---|
| `SantriLengkapImport` | `SantriLembagaImportTest`, `ImportPotongTest` | dedup identitas `nik+nama+tgl_lahir`; baris luar tenant |
| `AlumniImport` | `AlumniImportTest` | — |
| `KelasImport` | `KelasImportTest`, `KelasImportNamaTest` | — |
| `MutasiKeluarImport` | `MutasiKeluarImportTest` | — |
| `RiwayatBelajarImport` | `ImportPotongSiklusTest` | baris bentrok no_absen |
| `UsersImport` | `ImportPotongPenggunaTest` | anti-eskalasi role saat import |
| `PsbImport` | `ImportPotongPsbTest` | regenerate nomor saat bentrok 1062 |
| `DokumenImport` | `DokumenHalamanTest` | — |

**Exporter (12) — ✅ KONTRAK HEADER DIKUNCI** (`tests/Feature/TemplateHeaderKontrakTest.php`,
9 tes / 122 asersi). Empat yang sebelumnya **nol** cakupan kini bertes:
`DokumenTemplateExport` (kolom per tipe + heading + baris contoh sejajar),
`KeaktifanTemplateExport`, `PenempatanPegawaiTemplateExport`, `SantriTemplateExport`.
Sisanya sudah bertes lewat `TemplateWarnaTest`/`DataExistingJsonTest`/test modulnya.
→ Kontrak: header = daftar kolom, kolom wajib ⊆ kolom, baris contoh sejajar kolom —
semuanya gagal-terlihat bila urutan berubah tanpa sengaja.

**Service impor per-entitas tanpa test unit:**
`AlumniImporService`, `DokumenImporService`, `KeaktifanImporService`, `KelasImporService`,
`MutasiKeluarImporService`, `PegawaiImporService`, `PenempatanPegawaiImporService`,
`PenggunaImporService`, `RiwayatBelajarImporService`, `SantriImporService`, `PsbImporService`,
`ImporPotongan` (inti mekanisme potong).
→ ✅ **Selesai untuk intinya:** `ImporPotongan` kini bertes
(`tests/Unit/ImporPotonganTest.php`, 10 tes): penomoran absolut, mode kering tanpa
transaksi, dan mode tulis yang menggulung seluruh potongan saat galat.
Layanan turunan (`*ImporService`) tetap belum bertes sendiri.

## A4. Console command

| Command | Status |
|---|---|
| `DevReset` | ✅ ada (`DevResetCommandTest`) |
| `SinkronAktifRiwayat` | ✅ `tests/Feature/SinkronAktifRiwayatCommandTest.php` (7 tes) — invarian maks-1-aktif per (santri,jenjang), status ganjil→`lanjut`, opsi `--santri`/`--jenjang`, idempoten |
| `DokumenRapikanNama` | ✅ **DIHAPUS 2026-10-15.** Dulu menyaring `whereNotNull('path_file')` padahal kolom `path_file` sudah **dicabut** (diverifikasi langsung dari skema DB: `dokumen_santri`/`dokumen_pegawai`/`dokumen_lembaga` hanya punya `nama_file`; tak ada migrasi mana pun yang pernah punya `path_file`), sehingga perintah **pasti** galat `SQLSTATE[42S22] Unknown column 'path_file'`. Tak ada pemanggil (scheduler/rute) dan tak ada tes. Backfill satu-kali-nya sudah selesai; logikanya kini digantikan rename di `DokumenController`. File dihapus; tak ada entri tes yang perlu dibuat. |

## A5. Policy & middleware

| Modul | Status |
|---|---|
| `SantriPolicy` (`viewAny/view/create/update/mutasi`) | ⚠️ tersentuh lewat `SantriFlowTest`, tapi cabang `mutasi()` (66) belum spesifik |
| `UserPolicy` (`viewAny/view/create/update/delete`) | ⚠️ tersentuh lewat `UserRoleGuardTest` |
| `Http/Middleware/AktifLembaga` | ⚠️ tersentuh `BertindakLembagaTest` |
| `Konteks/LembagaAktif` (singleton per-request) | ❌ belum langsung — penting karena `bolehPesantren()` bergantung padanya |

## A6. Endpoint controller yang belum tersentuh test

Berdasarkan endpoint yang muncul di test vs daftar rute, **belum terlihat tersentuh**:

| Controller | Endpoint belum teruji |
|---|---|
| `SiklusController` (17 aksi) | `naik-kelas-otomatis`, `ringkasan-pindah-genap`, `salin-genap`, `batal-salin-massal`, `berhenti-jenjang`, `mutasi` |
| `RiwayatBelajarController` (16) | `belum-masuk`, `belum-genap`, `pindah-kelas`, `set-kelas`, `keluar-kelas` |
| `TagihanController` (8) | `kandidat`, `pratinjau` (sebagian), `update`, `destroy` |
| `DokumenController` (14) | `sinkron-unggah`, `tandai-sinkron`, `status-berkas`, `unduh` |
| `PegawaiController` (15) | `generate-akun`, `tautkan-akun`, `buatkan-akun`, `foto` |
| `MiMdController` (5) | `daftarkan-md`, `hapus-md` (via `MiMdTest` sebagian) |
| `KeaktifanPegawaiController` (10) | `aktifkan-massal`, `nonaktifkan` |
| `PortalController` (`PsbPortalController`) | `lanjutan`, `lengkapi`, `ajukan-daftar-ulang`, `riwayat-keluarga` |
| `PengajuanBiodataController` | `ajukan`, `batalkan`, `setujui`, `tolak` |
| `SemesterAktifController` | `upsert` |
| `TahunAjaranController` | `set-aktif`, `sembunyikan`, `tampilkan` |
| `PembayaranController` | `batal` (⚠️ ada temuan lost-update), `destroy` |
| `PenilaianController` (31 aksi, **baru 2026-10-16**) | Sebagian sudah bertes: `tests/Feature/PenilaianModulTest.php` (6 tes — bawaan 4 peristiwa, MD tanpa UJIAN, saringan cakupan tingkat akhir di leger, hitung dari komponen, lewat baris impor kecuali paksa, rapor per peristiwa) + tes unit murni (`TerbilangTest`, `NilaiRaporTest`, 29 tes). **Belum tersentuh**: impor potong 4 template (resolusi santri↔pengampu, komponen otomatis rapor), `template` (kontrak header kolom dinamis), ekskul/prestasi CRUD, `raporKelas` kelengkapan. |

## A7. Validasi & keamanan (butuh test kontrak)

- ✅ **Tenant choke-point `tenantScope()`** — `tests/Feature/TenantScopeFailClosedTest.php`
  (12 tes). Dikunci: peran non-admin → nol di Lembaga/Kelas/Alumni/MutasiKeluar;
  admin scoped hanya jenjangnya (MTS tak bocor); pasangan MI↔MD memang saling terlihat
  (`lembagaIdsDenganPasangan`); admin tanpa data → nol; Santri menyertakan arsip pusat
  (tanpa keanggotaan) tapi bukan lembaga lain; daftar pengguna 403 untuk non-admin
  (dijaga middleware izin `pengguna.lihat`) dan dibatasi tenant untuk admin scoped.
- ✅ **Catatan penting (bukan bug):** `LembagaPegawai::tenantScope` sengaja TIDAK
  memaksa nol untuk non-admin — penempatan adalah data dirinya sendiri dan tetap
  tersaring ke jenjangnya; gerbang aksesnya di lapisan izin, bukan di scope.
- **`PsbPublikController::cekNik`** — harus tetap membalas boolean saja (anti-enumerasi NIK).
- **`AuthController::login`** — peran non-admin ditolak device `admin-desktop-tauri`;
  audit `LoginAudit` tertulis baik sukses maupun gagal.
- **Throttle** — `login` 6/menit; **perhatikan** `Limit::none()` saat `isLocal()`.
- **Mass assignment** — model dengan `guarded = ['id']` pada jalur import.

---

# BAGIAN B — FRONTEND

## B1. `src/api` — 17 dari 20 file tanpa test

| File | Export | Yang layak diuji |
|---|---|---|
| `siklus.ts` | 55 | normalisasi respons siklus; query param filter; aksi massal (`naikKelasMassal`, `batalSalinMassal`) |
| `master.ts` | 48 | `normLembaga` dkk — normalisasi bentuk respons; null handling |
| `psb.ts` | 47 | kontrak bulk (`bulkSeleksi`, `bulkVerifikasi`); paginasi antrean |
| `pegawai.ts` | 44 | penempatan; generate akun |
| `keuangan.ts` | 43 | generate tagihan; pembayaran; dispensasi |
| `santri.ts` | 25 | upload foto/dokumen; dedup |
| `dokumen.ts` | 20 | status berkas; sinkron unggah |
| `users.ts` | 9 | assign/remove role |
| `auth.ts` | 9 | login; logout-all |
| `urutPreset.ts` | 8 | simpan/hapus preset urut |
| `toolbarPreset.ts` | 6 | baca/tulis visibilitas |
| `preset.ts` | 6 | preset tabel |
| `pengaturanTabel.ts` | 6 | mode filter |
| `pengajuan.ts` | 4 | ajukan/batalkan pengajuan biodata |
| `izin.ts` | 4 | baca/ubah matriks izin |
| `semesterAktif.ts` | 3 | upsert |
| ~~`query.ts`~~ | ✅ | `query.test.ts` — 10 tes (array `kunci[]`, `set` vs `append`, 0 tetap dikirim) |

*Sudah ada:* `client.test.ts`, `filterSemua.test.ts`, `komponenCustom.test.ts`, `query.test.ts`.

## B0. ✅ BUG ditemukan & SUDAH DIPERBAIKI

Keduanya di `formatNilai(v, 'angka')` (`src/lib/nilaiTampil.ts`), ditemukan saat
menulis test pertama. Perbaikannya lewat helper `angkaDari()`.

**B0-1. Titik salah dibaca sebagai desimal** — dulu `Rp 2.500` → `2.500` →
`Number` 2.5 → tampil `2,5` (nominal 2500 tampil 1000× lebih kecil).
Kini titik = pemisah RIBUAN (`2.500`), koma = desimal (`1,5`).

**B0-2. Teks tanpa digit jadi "0"** — dulu `abc` → `Number('')` = 0 → tampil
`0`. Kini dikembalikan apa adanya lewat `null` sebagai penanda gagal parse.

**Ambiguitas yang diputuskan:** `20.5` → **205** (titik = ribuan), mengikuti
locale `id-ID` yang dipakai seluruh aplikasi. Angka desimal ditulis dengan koma
(`20,5`). Ini pilihan sadar, bukan kelalaian — dikunci di test.

**Catatan dampak:** saat diperbaiki, TIDAK ADA kolom yang memakai
`format: 'angka'` (dicek di kode FE & DB), jadi perbaikan ini belum mengubah
satu pun tampilan yang ada — risikonya nol, tapi bugnya nyata bila nanti dipakai.

**Dikunci di:** `src/lib/nilaiTampil.test.ts` (21 tes, termasuk uji idempoten:
keluaran `1.234.567` diformat ulang tetap `1.234.567`).

### ☑ B0-3. TIGA BUG di `useDaftarTabel.ts` (ditemukan & diperbaiki)
File: `frontend/admin-desktop-tauri/src/hooks/useDaftarTabel.ts`
Ditemukan saat menulis `useDaftarTabel.test.tsx`. Ketiganya nyata dan berdampak
ke SEMUA halaman tabel (hook ini dipakai bersama).

**B0-3a. Halaman tersimpan selalu ditendang ke 1.**
Efek live-search (dulu baris 164-171) memanggil `pager.goFirst()` dan
bergantung pada `pager.perPage`. `usePager` memuat per-baris tersimpan
secara ASYNC, jadi `perPage` bergerak `50` → nilai tersimpan sesaat setelah
mount; transisi itu menjalankan ulang efek lalu mereset halaman. Akibatnya
membuka tabel dengan `per_baris` non-bawaan SELALU mulai dari halaman 1,
walau pengguna sedang di halaman 9. Diperbaiki dua tahap: dependensi
`pager.perPage` dibuang (perubahan perPage sudah ditangani `usePager`), lalu
`goFirst()` dilewati pada pemanggilan pertama (mount) - tak ada pencarian yang
berubah saat mount, jadi tak ada alasan mereset.
Terbukti: `dipanggil: [9,2]` → `pager.page: 1` (dulu) menjadi `2` (kini).

**B0-3b. Pencarian tak di-trim sebelum dikirim ke API.**
`searchEfektif.trim()` hanya dipakai MENGHITUNG JEDA, lalu nilai MENTAH
disimpan (`setSearchTertunda(searchEfektif)`). Akibatnya `"budi  "` dan
`"budi"` dianggap berbeda, tiap perubahan spasi memicu permintaan yang isinya
sama, dan query spasi (`"   "`) ikut terkirim ke backend. Kini yang disimpan
versi ter-trim, sehingga state kanonis dan `setState` pada nilai yang sama
tak menghasilkan render - permintaan sia-sia ikut hilang.
Terbukti: `awal=1 akhir=2` (dulu) menjadi `awal=1 akhir=1` (kini).

**B0-3c. Dua tes `KeuanganPage` yang lama gagal ternyata bug tes, bukan app.**
Keduanya mencari `getByPlaceholderText(/Cari nama/i)`, padahal `TopBarSearch`
TIDAK memasang atribut `placeholder` - teksnya dipasang sebagai `aria-label`,
dan inputnya di-PORTAL ke TopBar sehingga butuh provider + slot tiruan.
Tes diperbaiki: dibungkus `CariGlobalProvider` + `TopBarSearchProvider` +
`SlotCari`, dan pencarian lewat `getByLabelText`. `KeuanganPage.test.tsx`
kini 27/27 - FE hijau penuh (938/938) untuk pertama kalinya.

## B2. `src/lib` — 3 dari 17 tanpa test

✅ Selesai: `useDaftarTabel.ts` (`useDaftarTabel.test.tsx`, 14 tes — 3 bug diperbaiki, B0-3),
`nilaiTampil.ts` (`nilaiTampil.test.ts`, 21 tes — 2 bug diperbaiki),
`urut.ts` (`urut.test.ts`, 12 tes). ✅ `api/query.ts` (`query.test.ts`, 10 tes).

| File | Export | Yang layak diuji |
|---|---|---|
| ~~`nilaiTampil.ts`~~ | ✅ `nilaiTampil.test.ts` — 18 tes (2 bug ditemukan, lihat B0) |
| ~~`urut.ts`~~ | ✅ `urut.test.ts` — 12 tes |
| `utils.ts` | (periksa — mungkin `cn` kelas Tailwind, nilai rendah) | — |

*Sudah ada:* `arsipDokumen`, `clipboard`, `dispensasi`, `excelDataExisting`, `filterHalaman`,
`halaman`, `konversiHeic`, `labelKolom`, `olahGambar`, `sinkronDokumen`, `tabBaru`, `tanggal`.

## B3. `src/hooks` — 4 dari 6 tanpa test

| File | Yang layak diuji |
|---|---|
| ~~`useDaftarTabel.ts`~~ | ✅ `useDaftarTabel.test.tsx` (14 tes) — **3 bug ditemukan & diperbaiki**, lihat B0-3 |
| `useFilterGlobalAktif.ts` | `targetTunggal()` (59) — 0/1/banyak nilai; resolusi target filter |
| `useCariGlobal.tsx` | provider + konsumen; pencarian global lintas halaman |

*Sudah ada:* `usePager.test.tsx`, `useDaftarTabelNilaiAwal.test.tsx`.

## B4. Duplikasi logika tanpa test (kandidat ekstraksi + test)

1. **Parsing header Excel 3×** — `ImportBertahapDialog.tsx:73-90`,
   `ImportBertahapUmumDialog.tsx:154-170`, `ImportSantriBertahapPanel.tsx:88-97`.
2. **Dedup referensi 2×** — `useHalamanDokumen.ts:326-338` vs
   `TambahDokumenPegawaiDialog.tsx:78-90`.
3. **Format Rupiah 20+ tempat** — campur `'id'` vs `'id-ID'`.
4. **Debounce 8 implementasi** — 250/300/350/400 ms.
→ Setelah diekstrak ke `src/lib`, **satu test menggantikan banyak**.

---

# URUTAN PENGERJAAN YANG DISARANKAN

Saat pengguna meminta tes, kerjakan dari atas ke bawah (dampak ÷ usaha):

1. ✅ `src/lib/nilaiTampil.ts` + `src/lib/urut.ts` — 30 tes. **2 bug ditemukan** (B0).
2. ✅ `src/api/query.ts` — 10 tes.
3. ✅ `Support/NikFlag`, `Support/Telepon`, `Support/Tanggal`, `NamaBerkasDokumen` —
   64 tes. **Seluruh `Support/*` tuntas.**
4. ✅ `PsbGelombangService` — 15 tes (`cekBukaDanKuota`, `gelombangAktif`,
   `validasiRentang`). Catatan: `sisaKuota` sudah dikunci lebih dulu lewat
   test kunci baris kuota (lihat riwayat commit).
5. ✅ `SinkronIzin` — 7 tes (pitfall "izin katalog belum di DB" + sifat aditif).
6. ✅ `ImporPotongan` — 10 tes (mode kering, transaksi per potongan).
7. ✅ `hooks/useDaftarTabel.ts` — 14 tes. **3 bug ditemukan & diperbaiki** (B0-3).
8. ✅ `NisKemenagService.generate` (13 tes) + `PenerimaanService` (15 tes) +
   `KelasService::cariPegawai` (5 tes).
9. ✅ Exporter template — kontrak header kolom (`TemplateHeaderKontrakTest`, 9 tes).
10. ✅ `Console/Commands/SinkronAktifRiwayat` (7 tes); `DokumenRapikanNama` ✅ dihapus (kode mati, lihat tabel A)
    kode mati (`path_file` sudah dicabut) — usul hapus, bukan dites.
11. ✅ `PsbSummaryNotificationService` — **1 bug ditemukan & diperbaiki** + 5 tes.
    (Bonus A7: `tenantScope` fail-closed — 12 tes.)
12. Sisa `src/api/*` — kontrak respons, dilakukan bertahap per modul.

---

# CATATAN

- Daftar ini hasil **pembacaan kode & pemetaan file**, bukan hasil menjalankan tes.
- "Sudah ada test" = ada file test yang menyentuh area itu, **bukan** jaminan cakupan penuh.
- Beberapa modul bertanda ⚠️ tersentuh tidak langsung lewat Feature test; saat membuat test,
  periksa dulu apakah cabang spesifiknya sudah tercakup agar tidak duplikat.
- Angka "belum tersentuh" pada BAGIAN A6 bersifat indikatif: diturunkan dari perbandingan
  daftar rute dengan endpoint yang muncul di file test.

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
| Backend — Support/helper | 1 (`JatuhTempo`) | 5 | **4** |
| Backend — Import/Export | 8 (via Feature) | 8 + 12 | sebagian |
| Backend — Console command | 1 (`DevReset`) | 3 | **2** |
| Frontend — `src/api` | 3 | 20 | **17** |
| Frontend — `src/lib` | 12 | 17 | **5** |
| Frontend — `src/hooks` | 2 | 6 | **4** |

---

# BAGIAN A — BACKEND

## A1. Service tanpa test sama sekali (prioritas tertinggi)

### A1-1. `PsbGelombangService.php`
File: `backend/app/Services/PsbGelombangService.php`
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

### A1-5. `SinkronIzin.php`
File: `backend/app/Services/SinkronIzin.php`
- **Logika:** sinkronkan katalog izin (`IzinKatalog`) ke tabel `permissions`/`role_has_permissions`.
- **Failure mode:** izin baru di katalog belum ada di DB → semua rute `permission:` menolak
  SEMUA peran. Ini pitfall yang **sudah tercatat** di komentar `routes/api.php:318-321`,
  jadi justru paling layak dikunci test.

### A1-6. `PsbSummaryNotificationService.php`
File: `backend/app/Services/PsbSummaryNotificationService.php`
- **Logika:** `refreshBiodata()` (19), `refreshDaftarUlang()` (33) — hitung & kirim notifikasi;
  `scopeTenant()` (54) + `scopeCalon()` (65) — batasi hitungan ke tenant admin.
- **Failure mode:** **kebocoran tenant** — admin lembaga A menerima hitungan lembaga B.

### A1-7. `RefService.php` — periksa isi, kemungkinan CRUD referensi murni
File: `backend/app/Services/RefService.php` (tidak punya `public function` terdeteksi pola umum — cek manual).
- Sudah ada `ReferensiCrudTest.php`; tentukan apakah service ini punya cabang yang belum tercakup.

## A2. Support/helper tanpa test

| File | Fungsi | Failure mode yang perlu diuji |
|---|---|---|
| `Support/NikFlag.php` | `tandai()` (14), `valid()` (27) | NIK fiktif ditandai `X-...`; string kosong; angka murni 16 digit; tanda jadi ganda |
| `Support/NamaBerkasDokumen.php` | `slug()` (27), `buat()` (35), `unik()` (53), `direktori()` (73), `jalur()` (82), `simpan()` (94) | nama bentrok → harus jadi unik; karakter ilegal; `direktori` untuk tipe asing; path traversal |
| `Support/Tanggal.php` | `adalahTanggalNol()` (15), `parse()` (29) | `0000-00-00`; format Indonesia; input null; **catatan:** `parse()` menelan exception tanpa log |
| `Support/Telepon.php` | `normalisasi()` (19), `varian()` (55) | `08xx` → `62xx`; spasi/strip; kode negara; input non-nomor |

*Sudah ada:* `JatuhTempo` (via `tests/Unit/JatuhTempoTest.php`).

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

**Exporter (12) — TIDAK ada test:** `AlumniTemplateExport`, `DokumenTemplateExport`,
`KeaktifanTemplateExport`, `KelasNamaExport`, `KelasTemplateExport`,
`MutasiKeluarTemplateExport`, `PegawaiTemplateExport`, `PenempatanPegawaiTemplateExport`,
`PsbTemplateExport`, `RiwayatBelajarTemplateExport`, `SantriLembagaTemplateExport`, `SantriTemplateExport`.
→ **Yang layak diuji:** header kolom template stabil (kontrak dengan pengguna Excel),
dan jumlah/urutan kolom tidak berubah tanpa sengaja.

**Service impor per-entitas tanpa test unit:**
`AlumniImporService`, `DokumenImporService`, `KeaktifanImporService`, `KelasImporService`,
`MutasiKeluarImporService`, `PegawaiImporService`, `PenempatanPegawaiImporService`,
`PenggunaImporService`, `RiwayatBelajarImporService`, `SantriImporService`, `PsbImporService`,
`ImporPotongan` (inti mekanisme potong).
→ **Celah nyata:** `ImporPotongan` adalah inti semua import bertahap tapi belum ada test unit
khusus untuk mode kering, transaksi per potongan, dan resume setelah batal.

## A4. Console command

| Command | Status |
|---|---|
| `DevReset` | ✅ ada (`DevResetCommandTest`) |
| `SinkronAktifRiwayat` | ❌ belum — sinkronkan `santri.is_active_pst` turunan dari riwayat aktif |
| `DokumenRapikanNama` | ❌ belum — rapikan nama berkas dokumen; risiko rename massal merusak referensi |

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

## A7. Validasi & keamanan (butuh test kontrak)

- **`PsbPublikController::cekNik`** — harus tetap membalas boolean saja (anti-enumerasi NIK).
- **`AuthController::login`** — peran non-admin ditolak device `admin-desktop-tauri`;
  audit `LoginAudit` tertulis baik sukses maupun gagal.
- **Throttle** — `login` 6/menit; **perhatikan** `Limit::none()` saat `isLocal()`.
- **Tenant choke-point `TenantGuard`** — `scopeLembaga` fail-closed (`1 = 0`) saat tanpa lembaga.
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
| `query.ts` | 2 | **paling mudah** — builder query param (`appendQueryParam`) |

*Sudah ada:* `client.test.ts`, `filterSemua.test.ts`, `komponenCustom.test.ts`.

## B2. `src/lib` — 5 dari 17 tanpa test

| File | Export | Yang layak diuji |
|---|---|---|
| `nilaiTampil.ts` | `formatNilai` (2), `formatStatus` (27), `namaTahunAjaran` (37), `namaLembaga` (47) | null/undefined; format kosong; objek tahun ajaran/lembaga tak lengkap |
| `urut.ts` | `tokenUrut` (11), `jenjangTampilSantri` (20), `urutSantriFilter` (36) | **logika bercabang** — urutan token, arah kolom, santri lintas jenjang |
| `utils.ts` | (periksa — mungkin `cn` kelas Tailwind, nilai rendah) | — |

*Sudah ada:* `arsipDokumen`, `clipboard`, `dispensasi`, `excelDataExisting`, `filterHalaman`,
`halaman`, `konversiHeic`, `labelKolom`, `olahGambar`, `sinkronDokumen`, `tabBaru`, `tanggal`.

## B3. `src/hooks` — 4 dari 6 tanpa test

| File | Yang layak diuji |
|---|---|
| `useDaftarTabel.ts` (214 baris) | **prioritas** — debounce 400 ms (166), AbortController + token request (103), 
  penjaga balapan balasan, dependency yang sengaja dikunci (183-184) |
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

1. `src/lib/nilaiTampil.ts` + `src/lib/urut.ts` — murni, cepat, bercabang.
2. `src/api/query.ts` — builder query, trivial.
3. `Support/NikFlag`, `Support/Telepon`, `Support/Tanggal` — helper murni.
4. `PsbGelombangService.sisaKuota` — logika bisnis paling berisiko (race kuota).
5. `SinkronIzin` — pitfall "izin katalog belum di DB".
6. `ImporPotongan` — inti semua import bertahap.
7. `hooks/useDaftarTabel.ts` — debounce + race, inti semua halaman tabel.
8. `NisKemenagService.generate` + `PenerimaanService.samakanNisSatu`.
9. Exporter template — kontrak header kolom.
10. `Console/Commands/SinkronAktifRiwayat` + `DokumenRapikanNama`.
11. `PsbSummaryNotificationService` — kebocoran tenant.
12. Sisa `src/api/*` — kontrak respons, dilakukan bertahap per modul.

---

# CATATAN

- Daftar ini hasil **pembacaan kode & pemetaan file**, bukan hasil menjalankan tes.
- "Sudah ada test" = ada file test yang menyentuh area itu, **bukan** jaminan cakupan penuh.
- Beberapa modul bertanda ⚠️ tersentuh tidak langsung lewat Feature test; saat membuat test,
  periksa dulu apakah cabang spesifiknya sudah tercakup agar tidak duplikat.
- Angka "belum tersentuh" pada BAGIAN A6 bersifat indikatif: diturunkan dari perbandingan
  daftar rute dengan endpoint yang muncul di file test.

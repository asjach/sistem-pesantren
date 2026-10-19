import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Pager from '@/components/Pager';
import type { PerPage } from '@/prefs';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { Info, Plus, Settings, MoreVertical, Pencil, Check } from '@/icons';
import { cn } from '@/lib/utils';

/** Tab "ExcelTable" di halaman Komponen: peta hidup komponen ExcelTable.
 *
 *  Tujuan: menjawab "fitur apa saja yang sebenarnya ada di ExcelTable dan di
 *  mana letaknya" tanpa harus membaca 2436 baris sumbernya. Isinya tiga blok:
 *
 *  1. DENAH  — replika visual ExcelTable yang setiap areanya bisa diklik untuk
 *              melihat prop/Komponen sumbernya (bukan tabel hidup: ini peta).
 *  2. PENGATURAN — lima jalan masuk pengaturan + isi 4 tab dialog Kelola Tabel.
 *  3. CAKUPAN — klasifikasi pengaturan: global / halaman / tabel ini.
 *  4. SUMBU — lima sumbu klasifikasi lain (siapa, di mana, objek, kapan, sifat).
 *  5. VISUAL — sumbu mana yang perlu penanda visual, plus usulannya.
 *  6. USULAN — bentuk pengaturan 3 rumah (Aplikasi / Halaman / Tabel) + aturannya.
 *  7. BENTUK GLOBAL — lima pilihan bentuk rumah global + saran hibrida.
 *  8. KLASIFIKASI — inventaris penuh tiap pengaturan: kunci -> rumah -> status.
 *  9. REKOMENDASI — temuan membingungkan + bukti kode + usulan perbaikan.
 * 10. INVENTARIS — tabel prop -> area -> jumlah halaman yang memakainya.
 * 11. CONTOH — ExcelTable sungguhan dengan data dummy, plus sakelar untuk
 *              menyalakan/mematikan prop opsional supaya bedanya terlihat.
 *
 *  Daftar di sini SENGAJA ditulis tangan (bukan diturunkan dari tipe): ia
 *  memuat info yang tak ada di tipe, yaitu "dipakai di berapa halaman".
 *
 *  ANGGKA PENGGUNAAN — periksa ulang tiap kali prop ExcelTable berubah:
 *    cd frontend/admin-desktop-tauri
 *    grep -rlE '^[[:space:]]+<prop>(=|\{|[[:space:]]*$)' src/pages src/components \
 *      --include='*.tsx' | grep -v '\.test\.' | grep -v 'components/ExcelTable.tsx'
 *  (pakai [A-Za-z0-9_] POSIX, bukan \s — grep BSD tak mengenal \s pada ERE.)
 *  Angka di bawah hasil periksa 2026-10-19; sebut "titik render" untuk jumlah
 *  pemakaian dan "halaman" untuk jumlah berkas yang memakainya — beda, karena
 *  satu berkas bisa merender beberapa tabel.
 */

interface AreaDenah {
  /** Nomor urut di denah (juga jadi kunci React). */
  no: number;
  /** Nama area dalam Bahasa Indonesia. */
  nama: string;
  /** Prop / komponen yang mewujudkan area ini. */
  sumber: string;
  /** Keterangan singkat: apa fungsinya & kapan muncul. */
  keterangan: string;
}

/** Kotak berlabel nomor di dalam denah; diklik untuk membuka keterangan. */
function TandaArea({ area, className }: { area: AreaDenah; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={`denah_excel_area_${area.no}`}
          aria-label={`Keterangan area ${area.no}: ${area.nama}`}
          title={`${area.no}. ${area.nama}`}
          className={cn(
            'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full',
            'border border-primary/50 bg-primary/15 px-1 text-[9px] font-bold tabular-nums text-primary',
            'transition-colors hover:bg-primary hover:text-primary-foreground',
            className,
          )}
        >
          {area.no}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 border border-foreground/30 p-2">
        <p className="text-xs font-semibold">{area.no}. {area.nama}</p>
        <p className="pt-0.5 font-mono text-[10px] break-all text-primary">{area.sumber}</p>
        <p className="pt-1 text-xs text-muted-foreground">{area.keterangan}</p>
      </PopoverContent>
    </Popover>
  );
}

/** Kotak abu-abu di denah — tiruan kontrol tanpa fungsi (murni denah). */
function Tiruan({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-sm border border-dashed border-muted-foreground/40',
        'bg-muted/40 px-1.5 text-[10px] text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Denah ExcelTable: meniru susunan tiga bagian (toolbar / tabel / footer).
 *  Setiap angka membuka keterangan area di popover. */
function Denah({ areas }: { areas: AreaDenah[] }) {
  const a = (no: number) => areas.find((x) => x.no === no)!;
  return (
    <div className="rounded-md border border-border bg-background p-2">

      <p className="pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Toolbar — <span className="font-mono lowercase">JudulTabel.tsx</span>
      </p>
      <div className="flex min-h-8 items-center justify-between gap-2 rounded-sm border border-border bg-card px-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TandaArea area={a(1)} />
          <Tiruan className="max-w-[8rem] truncate">judul tabel</Tiruan>
          <TandaArea area={a(2)} />
          <Tiruan className="max-w-[7rem] truncate">info (tengah)</Tiruan>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto">
          <TandaArea area={a(3)} />
          <Tiruan>filter</Tiruan>
          <TandaArea area={a(4)} />
          <Tiruan>aksi massal</Tiruan>
          <TandaArea area={a(5)} />
          <Tiruan>awalan/akhir</Tiruan>
          <TandaArea area={a(6)} />
          <Tiruan>Urutkan</Tiruan>
          <TandaArea area={a(7)} />
          <Tiruan>Kolom</Tiruan>
          <TandaArea area={a(8)} />
          <Tiruan>
            <MoreVertical size={10} /> Aksi
          </Tiruan>

          <TandaArea area={a(21)} />
          <Tiruan>
            <Settings size={10} />
          </Tiruan>
        </div>
      </div>

      <p className="pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Tabel — <span className="font-mono lowercase">DataSheetGrid</span>
      </p>
      <div className="flex gap-2">
        <div className="hidden w-24 shrink-0 rounded-sm border border-dashed border-muted-foreground/40 bg-muted/20 p-1 sm:block">
          <div className="flex items-center gap-1 pb-1">
            <TandaArea area={a(9)} />
            <span className="text-[10px] text-muted-foreground">FilterRail</span>
          </div>
          <p className="text-[9px] leading-tight text-muted-foreground/70">
            rel Tingkat/Kelas di kiri grid
          </p>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto rounded-sm border border-border bg-card">

          <div className="flex items-stretch border-b border-border bg-muted/40 text-[10px]">
            <span className="flex w-8 shrink-0 items-center justify-center border-r border-border">
              <TandaArea area={a(10)} />
            </span>
            <span className="flex w-9 shrink-0 items-center justify-center border-r border-border">
              <TandaArea area={a(11)} />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-1 px-1.5 py-1">
              <TandaArea area={a(12)} />
              <Tiruan className="border-solid">header kolom + gagang lebar</Tiruan>
            </span>
            <span className="flex w-20 shrink-0 items-center gap-1 border-l border-border px-1.5 py-1">
              <TandaArea area={a(14)} />
              <Tiruan className="border-solid">Aksi</Tiruan>
            </span>
          </div>

          {[1, 2, 3].map((r) => (
            <div key={r} className={cn('flex items-stretch border-b border-border text-[10px]', r === 1 && 'bg-primary/5')}>
              <span className="flex w-8 shrink-0 items-center justify-center border-r border-border text-muted-foreground tabular-nums">
                {r}
              </span>
              <span className="flex w-9 shrink-0 items-center justify-center border-r border-border">
                <span className={cn('size-3 rounded-sm border border-muted-foreground/60', r === 1 && 'border-primary bg-primary')} />
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1 px-1.5 py-1">
                {r === 1 && <TandaArea area={a(13)} />}
                <span className="truncate text-muted-foreground">sel data (text / select / toggle / static)</span>
              </span>
              <span className="flex w-20 shrink-0 items-center justify-center gap-1 border-l border-border">
                {r === 1 && <TandaArea area={a(15)} />}
                <Settings size={10} />
                <Pencil size={10} />
                <Plus size={10} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Footer — <span className="font-mono lowercase">kaki_tabel</span>
      </p>
      <div className="flex items-center rounded-sm border border-border bg-card px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 py-1">
          <TandaArea area={a(16)} />
          <Tiruan>10 | 50 | 100 | 500 | Semua</Tiruan>
          <Tiruan>‹ Hal 1 / 1 ›</Tiruan>
        </div>
        <div className="flex shrink-0 items-center gap-1 py-1">
          <TandaArea area={a(19)} />
          <Tiruan>
            <Plus size={10} />
          </Tiruan>
          <TandaArea area={a(20)} />
          <Tiruan>
            <Pencil size={10} />
          </Tiruan>
        </div>
      </div>

      <p className="pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Di luar kaki tabel — <span className="font-mono lowercase">TopBar · dialog Kelola Tabel</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5 rounded-sm border border-dashed border-muted-foreground/40 px-2 py-1.5">
        <TandaArea area={a(17)} />
        <Tiruan>
          <Settings size={10} /> TopBar
        </Tiruan>
        <TandaArea area={a(18)} />
        <Tiruan>
          <Settings size={10} /> Kelola Tabel → Umum
        </Tiruan>
        <span className="text-[10px] text-muted-foreground">
          Setelan GLOBAL (17) dan per-perangkat (18) tak lagi diletakkan di kaki tabel.
        </span>
      </div>
      <p className="pt-2 text-[10px] text-muted-foreground">
        Klik angka untuk keterangan area. Kotak putus-putus = tiruan kontrol (denah saja, bukan kontrol asli).
      </p>
    </div>
  );
}

interface BarisPengaturan {
  /** Di mana kontrolnya berada (bila ada di layar). */
  tempat: string;
  /** Komponen berkasnya. */
  sumber: string;
  /** Isi yang bisa diatur di sana. */
  isi: string;
  /** Siapa yang boleh membukanya. */
  akses: string;
}

/** LIMA jalan masuk pengaturan + isi masing-masing.
 *
 *  Ada DUA DialogKelolaTabel yang bisa terbuka, komponen yang sama tapi beda
 *  sifat: dari gerigi bilah judul ExcelTable (kanan sekali) tampil NON-MODAL
 *  supaya tabel di belakang tetap terlihat & hidup, sedangkan dari TopBar (menu
 *  "Kelola tabel", untuk memilih tabel lebih dulu) tetap modal karena tak ada
 *  tabel di belakang yang layak dilihat.
 *
 *  Setelan TAMPILAN GLOBAL (tinggi/huruf/warna) tidak lagi punya tombol di kaki
 *  tabel — gerigi footer sudah dihapus, sisa satu pintu: TopBar → "Pengaturan
 *  tampilan". */
const PENGATURAN: BarisPengaturan[] = [
  {
    tempat: 'TopBar → "Pengaturan tampilan"',
    sumber: 'pengaturan/SheetPengaturanTampilan.tsx (+ IsiPengaturanTampilan)',
    isi: 'Tinggi sel bawaan & tinggi header; font/ukuran/warna huruf & latar untuk HEADER dan SEL. Tiap nilai punya tombol reset. Semuanya GLOBAL.',
    akses: 'semua pengguna',
  },
  {
    tempat: 'Gerigi di ujung kanan bilah judul tabel',
    sumber: 'tombolPengaturanTampil (excel/JudulTabel.tsx)',
    isi: 'Tombol terlihat "Pengaturan tabel ini" → membuka panel samping non-modal berisi 4 tab. Dulu pintunya hanya klik kanan.',
    akses: 'super_admin efektif',
  },
  {
    tempat: 'Bilah judul — dropdown Kolom / Urutkan',
    sumber: 'PresetKolom.tsx · PresetUrut.tsx',
    isi: 'Pilih preset kolom tampilan (Lengkap / preset tersimpan) dan preset urutan. Sekadar memakai preset, bukan menyuntingnya.',
    akses: 'semua pengguna',
  },
  {
    tempat: 'Klik kanan header/baris',
    sumber: 'excel/konteksMenu.tsx',
    isi: 'Bekukan kolom, AutoFit, perataan, tinggi baris, salin TSV, Kelola Tabel, plus aksi blok sel (isi blok / kosongkan blok) saat Mode Ubah menyala.',
    akses: 'Kelola Tabel: super_admin efektif',
  },
  {
    tempat: 'TopBar — menu "Kelola tabel"',
    sumber: 'TopBar.tsx → DialogKelolaTabel',
    isi: 'Dialog yang SAMA, dibuka dari bilah atas (modal). Bila halaman punya >1 tabel, muncul dialog pemilih tabel dulu.',
    akses: 'super_admin efektif',
  },
];

/** Isi tab di dalam DialogKelolaTabel — tepat EMPAT tab, tersendiri-sendiri.
 *
 *  Tab "Umum" mengambil banyak hal: visibilitas komponen + identitas tabel +
 *  tampilan perangkat + kembalikan bawaan. Dulu LEBIH BANYAK tab — "Filter
 *  Tabel" sudah dilebur ke Kelola Halaman (sakelar filter toolbar itu sebenarnya
 *  sakelar komponen tabel), dan "Nama & Perataan" dilebur ke "Kolom" karena
 *  keduanya setelan per TABEL, jadi satu penanda saja. */
const TAB_KELOLA: BarisPengaturan[] = [
  { tempat: 'Tab "Umum" → Visibilitas komponen tabel', sumber: 'TabVisibilitasKomponen.tsx', isi: 'Sakelar tampil/sembunyi per komponen, dikelompokkan: Bilah judul (judul tabel, info tengah, filter, pencarian, keaktifan, urutan, kolom, tombol aksi utama, tombol Pengaturan tabel) · Kepala tabel (header kolom, rel filter) · Kolom tetap (kolom centang, kolom Aksi) · Kaki tabel (pager, tombol tambah baris, tombol Mode Ubah). Sakelar komponen yang tak ada di halaman ini tak ditampilkan. Kontrol milik halaman (awalan/akhir toolbar, aksi massal) tak punya sakelar.', akses: 'super_admin efektif' },
  { tempat: 'Tab "Umum" → Tampilan di perangkat ini', sumber: 'TabUmum.tsx', isi: 'Identitas tabel (kunci, preset aktif/bawaan); kolom beku, stepper "Tinggi baris" 18..240px (+ ↺), sakelar "Baris ikut isi", sakelar "Tabel mengisi lebar"; kembalikan bawaan total (server + perangkat). Semua pref perangkat, tapi hanya untuk tabel ini.', akses: 'info & perangkat: semua pengguna; reset server: super_admin efektif' },
  { tempat: 'Tab "Info"', sumber: 'TabInfo.tsx', isi: 'Keterangan/HTML bebas yang tampil sebagai info milik tabel (toolbar_preset.info_html), plus editor penuhnya (mengisi sisa tinggi panel).', akses: 'super_admin efektif' },
  { tempat: 'Tab "Kolom"', sumber: 'TabKolom.tsx', isi: 'Simpan preset kolom (baru/duplikat/hapus), pilih kolom mana yang tampil, jadikan preset bawaan. Nama header & perataan (kiri/tengah/kanan) diatur per kolom di barisnya — keduanya setelan PER TABEL, jadi tetap walau preset berganti, dan tersedia juga untuk kolom TERSEMBUNYI (grupnya bisa dilipat, bawaan TERTUTUP, pilihan diingat per perangkat). Barisnya sendiri bisa diseret untuk menggeser urutan.', akses: 'super_admin efektif' },
  { tempat: 'Tab "Urutan"', sumber: 'TabUrutan.tsx', isi: 'Preset urutan: kolom yang bisa diurutkan, urutan berlapis (maks 3), dan arah naik/turun.', akses: 'super_admin efektif' },
];

function TabelPengaturan({ baris, kolomTempat }: { baris: BarisPengaturan[]; kolomTempat: string }) {
  return (
    <div className="overflow-auto rounded-md border border-border">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-muted/60 text-left">
          <tr>
            <th className="border-b border-border px-2 py-1.5 font-semibold">{kolomTempat}</th>
            <th className="border-b border-border px-2 py-1.5 font-semibold">Komponen sumber</th>
            <th className="border-b border-border px-2 py-1.5 font-semibold">Yang bisa diatur</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.tempat} className="odd:bg-muted/20">
              <td className="border-b border-border px-2 py-1 font-medium">{b.tempat}</td>
              <td className="border-b border-border px-2 py-1 font-mono text-[10px] text-primary">
                {b.sumber}
                <span className="mt-0.5 block font-sans text-[10px] text-muted-foreground">{b.akses}</span>
              </td>
              <td className="border-b border-border px-2 py-1 text-muted-foreground">{b.isi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cakupan berlakunya sebuah pengaturan — inilah yang paling sering
 *  membingungkan: kontrol yang tampak sama bisa berlaku berbeda. */
type Cakupan = 'global' | 'halaman' | 'tabel';

interface BarisCakupan {
  /** Apa yang diatur (nama kontrol / nilai). */
  apa: string;
  /** Di mana kontrolnya berada. */
  kontrol: string;
  /** Di mana nilainya disimpan (bukti teknis). */
  simpan: string;
  /** Catatan praktis: kapan terasa berdampak. */
  catatan: string;
}

const CAKUPAN_INFO: Record<Cakupan, { label: string; arti: string; warna: string }> = {
  global: {
    label: 'GLOBAL',
    arti: 'Sekali ubah, berubah untuk SELURUH tabel di semua halaman.',
    warna: 'border-destructive/50 bg-destructive/10 text-destructive',
  },
  halaman: {
    label: 'HALAMAN',
    arti: 'Mengikuti halaman yang sedang dibuka; halaman lain tak terpengaruh.',
    warna: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  tabel: {
    label: 'TABEL INI',
    arti: 'Hanya tabel ini (dikenali lewat tableKey), halaman & tabel lain aman.',
    warna: 'border-emerald-600/50 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  },
};

/** Klasifikasi pengaturan per cakupan. Tiap baris menyebut tempat KONTROLnya
 *  dan tempat NILAI-nya disimpan — dua hal yang sering tertukar. */
const CAKUPAN: Record<Cakupan, BarisCakupan[]> = {
  global: [
    { apa: 'Bawaan tinggi baris sel', kontrol: 'TopBar → "Pengaturan tampilan" → stepper "Tinggi sel bawaan"', simpan: 'pref perangkat (useGridPrefs.setRowH) — standar server "standar pesantren" menang bila ada', catatan: 'Hanya bawaan: tabel yang punya tinggi sendiri di Kelola Tabel → Umum tidak ikut.' },
    { apa: 'Tinggi baris header', kontrol: 'TopBar → "Pengaturan tampilan" → "Tinggi header"', simpan: 'pref perangkat (useGridPrefs.setHeaderH)', catatan: 'Sama: global walau angkanya memengaruhi ketajaman semua tabel.' },
    { apa: 'Jenis huruf sel', kontrol: 'TopBar → "Pengaturan tampilan" → Sel → Font', simpan: 'pref perangkat (useGridPrefs.setFontFamily)', catatan: 'Berlaku semua tabel.' },
    { apa: 'Ukuran huruf sel', kontrol: 'TopBar → "Pengaturan tampilan" → Sel → Ukuran', simpan: 'pref perangkat (useGridPrefs.setFontPx)', catatan: 'Berlaku semua tabel.' },
    { apa: 'Jenis & ukuran huruf header', kontrol: 'TopBar → "Pengaturan tampilan" → Header → Font/Ukuran', simpan: 'tema bagian tabel_header (theme.tsx parts)', catatan: 'Ikut tema; berubah semua tabel.' },
    { apa: 'Warna huruf & latar header/sel', kontrol: 'TopBar → "Pengaturan tampilan" → Warna', simpan: 'tema per mode (terang/gelap) — theme.tsx parts', catatan: 'Nilai terpisah untuk mode terang vs gelap.' },
    { apa: 'Perataan kolom (standar)', kontrol: 'Klik kanan header → Kiri/Tengah/Kanan', simpan: 'SERVER — toolbar_preset.align per tabel (api/toolbarPreset.ts)', catatan: 'Per TABEL walau lewat menu konteks; satu sumber dengan dialog.' },
    { apa: 'Lebar kolom komponen toolbar', kontrol: 'Dialog — lebar LabeledCombobox/Stepper', simpan: 'SERVER — komponen_custom (global, bukan per tabel)', catatan: 'Menyetel lebar di satu halaman mengubahnya di mana pun.' },
    { apa: 'Jumlah baris per halaman', kontrol: 'Footer — grup "10|50|100|500|Semua"', simpan: 'pref perangkat (usePager.ts:8 KUNCI_PERPAGE_GLOBAL = "simpes_perpage")', catatan: 'Kunci "_GLOBAL" tapi ada jalur lama per tabel yang dimigrasi.' },
  ],
  halaman: [
    { apa: 'Filter mana yang tampil (topBar)', kontrol: 'Tak ada kontrol — ditentukan kode halaman', simpan: 'state sesi — lib/filterHalaman.ts (KONFIGURASI_FILTER_HALAMAN)', catatan: 'Lapisan DB-nya (pengaturan_tabel) sudah dihapus: tak pernah dipakai, semua barisnya kosong. Urutan & sembunyi TAB halaman baru yang punya DB — /admin/pengaturan-halaman.' },
    { apa: 'Mode filter (tunggal/jamak)', kontrol: 'Tak ada kontrol', simpan: 'state sesi — lib/filterHalaman.ts (mode kode)', catatan: 'Untuk filter berjenjang (tingkat/kelas).' },
    { apa: 'Urutan & visibilitas tab halaman gabungan', kontrol: 'TopBar → "Kelola Halaman"', simpan: 'SERVER — pengaturan_halaman (api/pengaturanHalaman.ts)', catatan: 'Hanya untuk halaman gabungan (yang punya tab).' },
    { apa: 'Tab terakhir yang dibuka', kontrol: '(otomatis, tanpa kontrol)', simpan: 'pref perangkat — simpes_<rute>_tab', catatan: 'Halaman gabungan mengingat tab terakhir.' },
  ],
  tabel: [
    { apa: 'Preset kolom tampilan', kontrol: 'Toolbar — dropdown Kolom', simpan: 'SERVER — preset per table_key', catatan: 'Daftar preset & kolom aktif.' },
    { apa: 'Urutan kolom tersimpan', kontrol: 'Dialog → tab Kolom (seret baris)', simpan: 'SERVER — toolbar_preset.urutan per tabel', catatan: 'Kolom yang tak ada di simpanan menempel di akhir.' },
    { apa: 'Nama header kustom per kolom', kontrol: 'Dialog → tab Kolom (kotak di tiap baris)', simpan: 'SERVER — toolbar_preset.label per table_key', catatan: 'Menimpa label mentah dari kode. Berlaku juga untuk kolom yang sedang TERSEMBUNYI.' },
    { apa: 'Preset urutan (opsi & arah)', kontrol: 'Dialog → tab Urutan', simpan: 'SERVER — urut_preset per table_key', catatan: 'Opsi dropdown Urutkan; maks 3 lapis.' },
    { apa: 'Pilih preset urutan aktif', kontrol: 'Toolbar — dropdown Urutkan', simpan: 'state halaman (onUrut → refetch)', catatan: 'Nilai urut aktif dikelola halaman, bukan persist tabel.' },
    { apa: 'Visibilitas komponen tabel (sakelar per komponen)', kontrol: 'Dialog Kelola Tabel → tab Umum → "Visibilitas komponen tabel"', simpan: 'SERVER — toolbar_preset.visibilitas per tabel', catatan: 'Menyembunyikan komponen tabel tertentu (judul tabel, filter, Urutan, Kolom, tombol aksi, tombol Pengaturan tabel, header kolom, rel filter, pager, tambah, edit). Kontrol milik halaman tak punya sakelar. Mematikan "Tombol Pengaturan tabel" = tabel kehilangan pintu Kelola Tabel dari dirinya sendiri.' },
    { apa: 'Info tabel', kontrol: 'Dialog Kelola Tabel → tab Info', simpan: 'SERVER — toolbar_preset.info_html per tabel', catatan: 'Keterangan/HTML bebas milik tabel; kolom tabel lain tak terpengaruh.' },
    { apa: 'Kolom beku (freeze pane)', kontrol: 'Klik kanan header → Bekukan kolom', simpan: 'pref perangkat — freezeKey(tableKey)', catatan: 'Per tabel, tersimpan per perangkat.' },
    { apa: 'Lebar kolom tersimpan', kontrol: 'Seret gagang / AutoFit', simpan: 'pref perangkat — widthsKey(tableKey)', catatan: 'Per tabel per perangkat; AutoFit mengukurnya ulang.' },
    { apa: 'Tabel mengisi lebar', kontrol: 'Dialog → tab Umum → sakelar "Tabel mengisi lebar"', simpan: 'pref perangkat — isiLebarKey(tableKey) (bawaan: prop isiLebarPenuh halaman)', catatan: 'Sakelar ini MENANG atas prop halaman, dan kebal dari reset perangkat kalau halaman memaksa.' },
    { apa: 'Tinggi baris dasar tabel ini', kontrol: 'Dialog → tab Umum → stepper "Tinggi baris" + ↺', simpan: 'pref perangkat — tinggiDasarKey(tableKey)', catatan: 'Batas 18..240px (bawaan 24px). null = ikut bawaan global; ↺ mengembalikan ke null.' },
    { apa: 'Baris ikut isi', kontrol: 'Dialog → tab Umum → sakelar "Baris ikut isi"', simpan: 'pref perangkat — autoBarisKey(tableKey)', catatan: 'Baris tinggi-menyesuaikan isi terpanjang vs tinggi tetap.' },
    { apa: 'Tinggi baris manual per baris', kontrol: '— (DIHAPUS: seret batas bawah baris)', simpan: 'pref perangkat — useTinggiBaris(tableKey)', catatan: 'Mengubah tinggi per baris kini hanya lewat Kelola Tabel → Umum (tinggi dasar). Nilai lama yang masih tersimpan tetap dipakai sampai direset dari menu klik kanan.' },
    { apa: 'Bawaan preset kolom halaman', kontrol: 'Dialog → tab Kolom → "jadikan bawaan"', simpan: 'SERVER — preset default per table_key', catatan: 'Preset yang dipakai saat tabel pertama dibuka.' },
    { apa: 'Halaman aktif (Pager)', kontrol: 'Footer — tombol ‹ ›', simpan: 'pref perangkat — simpes_page_<tableKey>', catatan: 'Per tabel, ikut halaman yang sedang dibuka; kembali ke halaman 1 saat filter berubah.' },
  ],
};

function BlokCakupan() {
  return (
    <div className="flex flex-col gap-2">

      <div className="grid gap-1.5 sm:grid-cols-3">
        {(Object.keys(CAKUPAN_INFO) as Cakupan[]).map((c) => (
          <div key={c} className="rounded-md border border-border p-2">
            <span className={cn('rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase', CAKUPAN_INFO[c].warna)}>
              {CAKUPAN_INFO[c].label}
            </span>
            <p className="pt-1 text-[11px] text-muted-foreground">{CAKUPAN_INFO[c].arti}</p>
            <p className="pt-0.5 text-[10px] text-muted-foreground/70">
              {CAKUPAN[c].length} pengaturan
            </p>
          </div>
        ))}
      </div>

      {(Object.keys(CAKUPAN_INFO) as Cakupan[]).map((c) => (
        <div key={c} className="flex flex-col gap-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className={cn('rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase', CAKUPAN_INFO[c].warna)}>
              {CAKUPAN_INFO[c].label}
            </span>
            {CAKUPAN_INFO[c].arti}
          </p>
          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="border-b border-border px-2 py-1.5 font-semibold">Yang diatur</th>
                  <th className="border-b border-border px-2 py-1.5 font-semibold">Kontrol</th>
                  <th className="border-b border-border px-2 py-1.5 font-semibold">Disimpan di</th>
                  <th className="border-b border-border px-2 py-1.5 font-semibold">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {CAKUPAN[c].map((b) => (
                  <tr key={b.apa} className="odd:bg-muted/20">
                    <td className="border-b border-border px-2 py-1 font-medium">{b.apa}</td>
                    <td className="border-b border-border px-2 py-1 text-muted-foreground">{b.kontrol}</td>
                    <td className="border-b border-border px-2 py-1 font-mono text-[10px] text-primary">{b.simpan}</td>
                    <td className="border-b border-border px-2 py-1 text-muted-foreground">{b.catatan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <p className="text-[10px] text-muted-foreground">
        Catatan penting: <strong>tempat kontrol</strong> dan <strong>cakupan</strong> tidak selalu sama.
        Tombol gerigi ada di setiap tabel, tetapi mengatur nilai GLOBAL; sebaliknya perataan
        kolom diatur lewat menu klik kanan tetapi tersimpan per TABEL di server.
      </p>
    </div>
  );
}

/** Sumbu klasifikasi SELAIN cakupan (global/halaman/tabel). Cakupan menjawab
 *  "seberapa luas", sumbu-sumbu ini menjawab pertanyaan lain yang sama
 *  pentingnya dan sering tertukar. */
interface Sumbu {
  nama: string;
  /** Pertanyaan yang dijawab sumbu ini. */
  tanya: string;
  /** Nilai-nilai yang mungkin. */
  nilai: { label: string; contoh: string }[];
  /** Kenapa penting. */
  kenapa: string;
}

const SUMBU: Sumbu[] = [
  {
    nama: 'Siapa yang boleh mengubah',
    tanya: 'Apakah pengguna biasa boleh menyetel ini?',
    nilai: [
      { label: 'semua pengguna', contoh: 'tinggi baris, huruf, lebar kolom, freeze, halaman' },
      { label: 'super_admin efektif', contoh: 'preset kolom, urutan, nama header, perataan, filter' },
      { label: 'hak halaman (canEdit)', contoh: 'mode Ubah, mode Input, toggle/select sel' },
    ],
    kenapa:
      'Tiga tingkat izin berbeda. Kontrol super_admin disembunyikan untuk pengguna biasa'
      + ' (bukan sekadar dinonaktifkan), jadi "saya tidak melihat tombolnya" sering berarti'
      + '"bukan hak saya", bukan "fiturnya tidak ada".',
  },
  {
    nama: 'Di mana nilainya disimpan',
    tanya: 'Apakah setelan ikut ke komputer lain?',
    nilai: [
      { label: 'server (DB)', contoh: 'preset kolom, urutan, perataan, filter, setelan komponen' },
      { label: 'perangkat (pref lokal)', contoh: 'tinggi baris, huruf, lebar kolom, freeze, halaman' },
      { label: 'sesi berjalan saja', contoh: 'urut aktif, seleksi baris, mode Ubah/Input, tab aktif' },
    ],
    kenapa:
      'Setelan server ikut ke semua komputer & pengguna. Setelan perangkat hanya di komputer'
      + ' itu — pindah komputer = kembali ke bawaan. Setelan sesi hilang saat halaman dimuat ulang.',
  },
  {
    nama: 'Objek yang diatur',
    tanya: 'Apakah setelannya menempel pada tabel atau pada komponen?',
    nilai: [
      { label: 'tabel (tableKey)', contoh: 'preset kolom, urutan, freeze, lebar, tinggi baris manual' },
      { label: 'komponen (tableKey + htmlFor)', contoh: 'lebar/tinggi kotak, label, nilai awal, langkah stepper' },
      { label: 'halaman (page_key)', contoh: 'filter halaman tanpa tabel' },
    ],
    kenapa:
      'Setelan komponen memakai kunci tableKey|komponen (komponenCustom.ts:33). Bila tableKey'
      + ' KOSONG, komponen di luar tabel (dialog/form) memakai setelan GLOBAL — jadi kotak yang'
      + ' sama tampil seragam di mana pun ia muncul.',
  },
  {
    nama: 'Kapan berlaku',
    tanya: 'Apakah langsung terlihat atau perlu tindakan lain?',
    nilai: [
      { label: 'langsung (optimistis)', contoh: 'tinggi baris, lebar kolom, toggle sel, freeze' },
      { label: 'tersimpan sendiri di dialog', contoh: 'preset kolom, nama header, urutan, filter' },
      { label: 'perlu refetch dari server', contoh: 'urut aktif (halaman memuat ulang data)' },
    ],
    kenapa:
      'Setelan dialog TIDAK lagi memakai tombol Simpan terpadu: tiap bagian tersimpan'
      + ' sendiri begitu nilainya berubah, jadi menutup dialog tak bisa membuang'
      + ' pekerjaan. Footer hanya menjadi STATUS (Menyimpan… / Semua perubahan'
      + ' tersimpan / gagal), bukan aksi.',
  },
  {
    nama: 'Sifat perubahan',
    tanya: 'Apakah setelan ini mengubah data atau hanya tampilan?',
    nilai: [
      { label: 'tampilan saja (aman)', contoh: 'hampir semua: lebar, huruf, warna, urutan, filter' },
      { label: 'mengubah DATA', contoh: 'mode Ubah (auto-save sel), mode Input (buat record), toggle' },
    ],
    kenapa:
      'Mode Ubah & Input menulis ke database secara otomatis — beda kelas dari setelan tampilan.'
      + ' Toggle sel pun langsung tersimpan tanpa mode Ubah (toggleTanpaEdit).',
  },
];

function BlokSumbu() {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">
        Tiga cakupan di atas hanya SATU sumbu. Pengaturan tabel sebenarnya tersebar di
        lima sumbu berbeda — dan banyak kebingungan muncul karena satu kontrol dinilai
        dengan sumbu yang salah.
      </p>
      {SUMBU.map((s) => (
        <div key={s.nama} className="rounded-md border border-border p-2">
          <p className="text-xs font-semibold">{s.nama}</p>
          <p className="text-[10px] text-muted-foreground italic">{s.tanya}</p>
          <ul className="flex flex-col gap-0.5 pt-1">
            {s.nilai.map((n) => (
              <li key={n.label} className="flex flex-wrap items-baseline gap-1.5 text-xs">
                <span className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">
                  {n.label}
                </span>
                <span className="text-muted-foreground">{n.contoh}</span>
              </li>
            ))}
          </ul>
          <p className="pt-1 text-[11px] text-muted-foreground">{s.kenapa}</p>
        </div>
      ))}
    </div>
  );
}

/** Penilaian tiap sumbu: apakah pengguna BUTUH tahu nilainya saat melihat
 *  kontrolnya, atau cukup dipahami sekali dari dokumentasi?
 *
 *  Kriterium "perlu visual" = pengguna bisa membuat kesalahan yang
 *  konsekuensinya TIDAK terlihat langsung dari layar. Kalau salah tebak
 *  berakibat fatal (data berubah / tabel lain ikut berubah), nilainya wajib
 *  tampak saat itu juga — bukan disimpan di tooltip atau dokumentasi. */
interface PenilaianVisual {
  sumbu: string;
  /** perlu = wajib tampak di UI; tidak = cukup dokumentasi/tooltip. */
  perlu: boolean;
  /** Seberapa mendesak (untuk prioritas pengerjaan). */
  prioritas: 'tinggi' | 'sedang' | 'rendah' | '—';
  /** Alasan berbasis konsekuensi salah paham. */
  alasan: string;
  /** Usulan wujud visualnya. */
  usulan: string;
  /** Bukti: apa yang SUDAH ada di kode (agar tidak mengulang pekerjaan). */
  sudah: string;
}

const VISUAL: PenilaianVisual[] = [
  {
    sumbu: 'Sifat perubahan (tampilan vs mengubah DATA)',
    perlu: true,
    prioritas: 'tinggi',
    alasan:
      'Konsekuensi terbesar & paling tak terlihat. Mode Ubah/Input menulis ke database '
      + 'secara otomatis, dan toggle sel tersimpan tanpa mode Ubah apa pun '
      + '(toggleTanpaEdit). Pengguna bisa mengira sedang menyetel tampilan padahal '
      + 'sedang mengubah data — dan tidak ada tombol "batal".',
    usulan:
      'Wajib tampak: penanda persisten di dekat judul/header ("Mode Ubah aktif — perubahan '
      + 'langsung tersimpan") yang TIDAK bisa dilewatkan, bukan badge kecil di pojok. '
      + 'Beri warna berbeda dari setelan tampilan, dan tombol keluar yang jelas.',
    sudah:
      'Sebagian: PillMode melayang kanan-bawah (ExcelTable.tsx:1563) saat mode aktif. '
      + 'Kekurangan: posisinya di pojok, mudah terlewat saat bekerja di kolom kiri.',
  },
  {
    sumbu: 'Cakupan (global / halaman / tabel)',
    perlu: true,
    prioritas: 'tinggi',
    alasan:
      'Salah paham berakibat fatal & senyap: mengubah tinggi baris di satu tabel ikut '
      + 'mengubah SEMUA tabel. Pengguna baru sadar setelah tabel lain "tiba-tiba berubah", '
      + 'dan saat itu sudah sulit melacak penyebabnya.',
    usulan:
      'Wajib tampak di kontrolnya sendiri: label kelompok "Berlaku semua tabel" vs '
      + '"Tabel ini saja" di dalam popover — bukan tooltip yang harus di-hover.',
    sudah:
      'TIDAK KONSISTEN: dari 9 kontrol di popover yang SEMUANYA global, hanya 3 yang '
      + 'menyebut "berlaku semua tabel" (dulu PopoverSettingTabel.tsx), dan itu pun '
      + 'hanya di title/tooltip. 6 lainnya (font+ukuran+2 warna header, 2 warna sel) '
      + 'diam-diam global. (Tombol tinggi baris di footer sudah dihapus; '
      + 'tinggi baris kini per tabel di Kelola Tabel → Umum.)',
  },
  {
    sumbu: 'Kapan berlaku (langsung vs perlu Simpan)',
    perlu: false,
    prioritas: '—',
    alasan:
      'Dulu pengguna bisa mengira perubahan sudah tersimpan padahal belum, lalu menutup '
      + 'dialog dan kehilangan pekerjaan.',
    usulan:
      'Tak ada lagi pekerjaan yang menunggu: setiap bagian tersimpan sendiri saat diubah, '
      + 'jadi tak ada yang bisa hilang saat dialog ditutup.',
    sudah:
      'Selesai: autosave per bagian (lapor() di DialogKelolaTabel menjalankan simpan '
      + 'bagian), footer jadi status aria-live, dan konfirmasi "buang perubahan" '
      + 'dihapus karena tak lagi ada perubahan tertunda.',
  },
  {
    sumbu: 'Siapa yang boleh mengubah',
    perlu: true,
    prioritas: 'sedang',
    alasan:
      'Bukan untuk mencegah kesalahan, tapi menghindari kebingungan "kok fiturnya tidak '
      + 'ada?". Kontrol super_admin disembunyikan, jadi pengguna biasa tak punya petunjuk '
      + 'apa pun bahwa fitur itu memang ada tapi bukan untuknya.',
    usulan:
      'Tampak: saat kontrol tersembunyi karena izin, tampilkan versi nonaktif dengan '
      + 'keterangan "butuh akses super_admin" — jangan hilangkan sama sekali dari menu.',
    sudah:
      'Sebagian: kontrol memang hilang total (bukan disabled) untuk non-super_admin '
      + '(konteksMenu.tsx:140, JudulTabel.tsx:120). Tidak ada petunjuk apa pun.',
  },
  {
    sumbu: 'Di mana nilainya disimpan (server vs perangkat)',
    perlu: false,
    prioritas: 'rendah',
    alasan:
      'Konsekuensinya baru terasa saat berpindah komputer, dan saat itu pengguna bisa '
      + 'memeriksanya tanpa risiko kehilangan data. Tidak perlu memenuhi layar.',
    usulan:
      'Cukup di dokumentasi/tooltip. Bila ingin, satu baris kecil di popover: '
      + '"Tersimpan di perangkat ini" — tanpa penekanan visual.',
    sudah: 'Tidak ada. Sesuai — tidak mendesak.',
  },
  {
    sumbu: 'Objek yang diatur (tabel vs komponen)',
    perlu: false,
    prioritas: '—',
    alasan:
      'Ini murni istilah teknis (tableKey, htmlFor). Pengguna tidak perlu tahu; yang ia '
      + 'butuh adalah hasilnya (kotak ini tampil seragam atau tidak). Menampilkannya '
      + 'justru menambah beban kognitif tanpa manfaat.',
    usulan: 'Jangan ditampilkan. Cukup di dokumen teknis seperti tab ini.',
    sudah: 'Tidak ada — dan memang seharusnya begitu.',
  },
];

function BlokVisual() {
  const perlu = VISUAL.filter((v) => v.perlu);
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border border-border bg-muted/30 p-2">
        <p className="text-xs">
          <strong>Kriterium:</strong> sebuah sumbu <strong>perlu tampak visual</strong> bila salah
          paham berakibat <em>senyap</em> — pengguna tidak bisa menyadarinya dari layar, dan
          konsekuensinya sulit dibatalkan (data berubah, atau tabel lain ikut berubah).
        </p>
        <p className="pt-1 text-xs text-muted-foreground">
          Dari 5 sumbu: <strong className="text-foreground">{perlu.length} perlu</strong> penanda
          visual, <strong className="text-foreground">{VISUAL.length - perlu.length} cukup
          dokumentasi</strong>.
        </p>
      </div>

      {VISUAL.map((v) => (
        <div key={v.sumbu} className="rounded-md border border-border p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn(
              'rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase',
              v.perlu
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-muted-foreground/40 bg-muted/40 text-muted-foreground',
            )}>
              {v.perlu ? 'perlu' : 'tidak perlu'}
            </span>
            <span className="text-xs font-semibold">{v.sumbu}</span>
            {v.perlu && (
              <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                prioritas {v.prioritas}
              </span>
            )}
          </div>
          <p className="pt-1 text-xs">
            <span className="font-semibold text-primary">Usulan visual: </span>
            {v.usulan}
          </p>
          <p className="pt-1 text-[11px] text-muted-foreground">
            <span className="font-semibold">Alasan: </span>{v.alasan}
          </p>
          <p className="pt-0.5 text-[11px] text-muted-foreground">
            <span className="font-semibold">Kondisi sekarang: </span>{v.sudah}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Usulan penataan ulang pengaturan menjadi 3 rumah yang tidak tumpang tindih.
 *
 *  MASALAH YANG DISELESAIKAN: saat ini pengaturan global (tinggi baris, huruf,
 *  warna) justru dikontrol dari DALAM ExcelTable lewat tombol gerigi di footer
 *  tiap tabel — padahal 8 dari 8 setelan di sana berlaku untuk SELURUH tabel di
 *  SEMUA halaman. Akibatnya satu setelan punya dua pintu (footer + tema), dan
 *  pengguna tak pernah tahu setelannya menyebar. */
interface Rumah {
  nama: string;
  /** Rute/usulan letak. */
  letak: string;
  /** Apa saja yang pindah ke sini. */
  isi: string[];
  /** Apa yang TIDAK boleh ada di sini (batas tegas). */
  bukan: string;
  /** Alasan pemisahan ini. */
  alasan: string;
}

const RUMAH: Rumah[] = [
  {
    nama: 'Pengaturan Aplikasi (global)',
    letak: 'Halaman sendiri, mis. /pengaturan · akses: semua pengguna (sebagian super_admin)',
    isi: [
      'Tinggi baris sel (sekarang: TopBar → Pengaturan tampilan)',
      'Tinggi baris header (sekarang: TopBar → Pengaturan tampilan)',
      'Jenis & ukuran huruf sel (sekarang: TopBar → Pengaturan tampilan)',
      'Jenis & ukuran huruf header (sekarang: TopBar → Pengaturan tampilan)',
      'Warna huruf & latar header/sel (sekarang: TopBar → Pengaturan tampilan)',
      'Tema, mode gelap/terang, kerapatan, radius, ikon (sudah ada di TopBar)',
      'Lebar sidebar, mode navigasi, jumlah baris per halaman',
      'Setelan komponen custom (lebar/tinggi kotak, label) — kunci global',
    ],
    bukan:
      'Apa pun yang berbeda antar tabel. Tidak ada "preset kolom", "urutan", "nama header" di sini.',
    alasan:
      'Setelan ini berlaku sama di mana pun. Menaruhnya di halaman sendiri membuat pengguna'
      + ' mengubahnya SEKALI di satu tempat, bukan tersandung di tabel mana pun yang kebetulan dibuka.',
  },
  {
    nama: 'Halaman (KODE, bukan DB)',
    letak: 'src/lib/filterHalaman.ts + <PengaturanHalaman tampil={...}> · tanpa dialog untuk filter',
    isi: [
      'Filter mana yang tampil di halaman (topBar)',
      'Mode filter (tunggal/jamak) — keadaan sesi, bukan simpanan',
      'Susunan filter berjenjang per halaman',
      'Daftar tabel halaman (untuk dialog Kelola Tabel)',
    ],
    bukan:
      'Kolom/urutan/nama header tabel. Halaman boleh punya banyak tabel; setelan per tabel'
      + ' BUKAN urusan halaman.',
    alasan:
      'Setelan halaman didefinisikan di KODE (KONFIGURASI_FILTER_HALAMAN), bukan disimpan.'
      + ' Lapisan DB-nya dulu bernama `pengaturan_tabel`, tak pernah dipakai (semua baris'
      + ' berisi filter kosong = identik dengan bawaan kode) dan sudah DIHAPUS. Yang masih'
      + ' punya DB adalah urutan & visibilitas TAB halaman gabungan, lewat endpoint'
      + ' `/admin/pengaturan-halaman` (api/pengaturanHalaman.ts).',
  },
  {
    nama: 'Kelola Tabel',
    letak: 'Dialog per tabel · akses: super_admin efektif',
    isi: [
      'Preset kolom (kolom mana tampil)',
      'Nama header kustom per kolom',
      'Perataan kolom',
      'Urutan kolom & preset urutan',
      'Sakelar visibilitas komponen tabel (judul, info tengah, filter, pencarian, keaktifan, urutan, kolom, tombol aksi, tombol pengaturan, header kolom, rel filter, centang, aksi, pager, tambah, edit)',
      'Info tabel (HTML bebas) — tab "Info"',
      'Tampilan per perangkat: kolom beku, tinggi baris 18..240px, baris ikut isi, tabel mengisi lebar',
      'Bawaan preset kolom halaman',
    ],
    bukan:
      'Tinggi baris bawaan, huruf, warna — itu global (Pengaturan Aplikasi). Juga bukan filter halaman (itu kode).',
    alasan:
      'Semua ini disimpan per tableKey di server (kecuali blok "Tampilan di perangkat ini" yang'
      + ' pref perangkat). Sudah beres sekarang — yang perlu dijaga hanya: jangan ada setelan'
      + ' global yang menyelinap masuk lewat kaki tabel.',
  },
];

/** Aturan supaya pengaturan tidak pernah ada di dua tempat. */
const ATURAN = [
  {
    aturan: 'Satu setelan, satu rumah',
    uji: 'Kalau nilainya disimpan per tableKey → Kelola Tabel. Per page_key → Kelola Halaman. Tanpa kunci (global) → Pengaturan Aplikasi.',
    kunci: 'Kunci penyimpanan menentukan rumahnya — bukan di mana tombolnya kebetulan diletakkan.',
  },
  {
    aturan: 'Toolbar tabel hanya MEMAKAI, tidak MENGATUR',
    uji: 'Dropdown Kolom/Urutkan memilih nilai yang sudah ada. Tidak ada tombol "tambah preset" di toolbar.',
    kunci: 'Sudah begitu sekarang (PresetKolom.tsx:32 — pengelolaan hanya lewat dialog). Pertahankan.',
  },
  {
    aturan: 'Menu klik kanan hanya JALAN PINTAS',
    uji: 'AutoFit, beku, seret lebar = aksi langsung pada tabel yang terlihat. Bukan tempat menyetel nilai tersimpan.',
    kunci: 'Beku & lebar tersimpan per perangkat — tidak perlu dialog. Bila nanti perlu, arahkan ke Kelola Tabel.',
  },
  {
    aturan: 'Global tidak boleh punya pintu di dalam tabel',
    uji: 'Setelan tinggi/huruf/warna cuma punya SATU pintu: TopBar → Pengaturan tampilan.',
    kunci: 'SUDAH DILAKUKAN: gerigi footer dihapus. 8 setelan global kini di satu tempat; kaki tabel tersisa pager, tambah baris, dan mode Ubah.',
  },
  {
    aturan: 'Yang mengubah DATA diberi rumah sendiri, bukan menu setelan',
    uji: 'Mode Ubah/Input bukan "pengaturan" — ia MODE kerja yang menulis ke database.',
    kunci: 'Tetap di toolbar tabel sebagai toggle mode, dengan penanda mencolok (bukan di menu pengaturan).',
  },
];

function BlokUsulan() {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border border-emerald-600/40 bg-emerald-600/5 p-2">
        <p className="text-xs">
          <strong>Status "3 rumah, 1 pintu masing-masing": SUDAH TERPASANG.</strong> Dulu{' '}
          <strong>8 setelan global</strong> (tinggi baris, huruf, warna) justru dikontrol dari{' '}
          <strong>dalam ExcelTable</strong> — gerigi di kaki <em>tiap</em> tabel, padahal
          nilainya berlaku untuk semua tabel. Akibatnya satu setelan punya pintu di N tempat dan
          pengguna tak pernah tahu setelannya menyebar. Sekarang pintu global hanya satu
          (TopBar → "Pengaturan tampilan"), pintu halaman di Kelola Halaman, dan pintu tabel di
          gerigi ujung kanan bilah judul + menu TopBar. Yang perlu dijaga ke depan: jangan ada
          setelan global yang menyelinap masuk lewat kaki tabel lagi.
        </p>
      </div>

      <div className="grid gap-1.5 lg:grid-cols-3">
        {RUMAH.map((r, i) => (
          <div key={r.nama} className="flex flex-col gap-1 rounded-md border border-border p-2">
            <div className="flex items-center gap-1.5">
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                {i + 1}
              </span>
              <span className="text-xs font-semibold">{r.nama}</span>
            </div>
            <p className="font-mono text-[10px] text-primary">{r.letak}</p>
            <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
              {r.isi.map((s) => <li key={s}>{s}</li>)}
            </ul>
            <p className="border-t border-border pt-1 text-[10px] text-muted-foreground">
              <span className="font-semibold text-destructive">Bukan di sini: </span>{r.bukan}
            </p>
            <p className="text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">Alasan: </span>{r.alasan}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold">Aturan supaya tidak ada pengaturan di dua tempat</p>
        <div className="overflow-auto rounded-md border border-border">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="border-b border-border px-2 py-1.5 font-semibold">Aturan</th>
                <th className="border-b border-border px-2 py-1.5 font-semibold">Cara menguji</th>
                <th className="border-b border-border px-2 py-1.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {ATURAN.map((a) => (
                <tr key={a.aturan} className="odd:bg-muted/20">
                  <td className="border-b border-border px-2 py-1 font-medium">{a.aturan}</td>
                  <td className="border-b border-border px-2 py-1 text-muted-foreground">{a.uji}</td>
                  <td className="border-b border-border px-2 py-1 text-muted-foreground">{a.kunci}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-2">
        <p className="text-xs font-semibold">Dampak bila diterapkan</p>
        <ul className="list-disc space-y-0.5 pt-1 pl-4 text-[11px] text-muted-foreground">
          <li><strong className="text-foreground">Footer tabel menyusut</strong> — tinggal pager, tinggi baris cepat, dan tombol mode (tambah/Edit). Tombol gerigi dihapus.</li>
          <li><strong className="text-foreground">22 halaman bertabel</strong> tak lagi menyimpan pintu global; 6 halaman tanpa tabel tetap punya Kelola Halaman.</li>
          <li><strong className="text-foreground">PopoverSettingTabel.tsx (290 baris)</strong> sudah dipindah ke IsiPengaturanTampilan di dalam Sheet (TopBar).</li>
          <li><strong className="text-foreground">Tidak ada perubahan data</strong> — kunci penyimpanan tetap sama (pref perangkat), jadi setelan pengguna tak hilang.</li>
        </ul>
      </div>
    </div>
  );
}

/** Satu baris inventaris pengaturan: apa, di mana SEKARANG, dan di mana
 *  SEHARUSNYA menurut aturan "kunci penyimpanan menentukan rumah". */
interface BarisKlasifikasi {
  /** Nama pengaturan. */
  apa: string;
  /** Nilai/kontrolnya seperti apa. */
  nilai: string;
  /** Kunci penyimpanan sebenarnya (bukti teknis). */
  kunci: string;
  /** Rumah yang seharusnya: global / halaman / tabel. */
  rumah: 'global' | 'halaman' | 'tabel';
  /** Apakah posisinya sekarang SUDAH benar. */
  status: 'benar' | 'pindah' | 'baru';
  /** Catatan bila perlu. */
  catatan?: string;
}

const KLASIFIKASI: BarisKlasifikasi[] = [
  /* ---------- GLOBAL ---------- */
  { apa: 'Tinggi baris sel (bawaan)', nilai: 'stepper, bawaan 24px', kunci: 'pref perangkat — useGridPrefs.setRowH', rumah: 'global', status: 'benar', catatan: 'Kontrol: TopBar → Pengaturan tampilan. Tinggi TABEL menang atasnya.' },
  { apa: 'Tinggi baris header', nilai: '20–120 px', kunci: 'pref perangkat — useGridPrefs.setHeaderH', rumah: 'global', status: 'benar', catatan: 'Kontrol: TopBar → Pengaturan tampilan.' },
  { apa: 'Jenis huruf sel', nilai: 'sistem / Aptos / Google (bundel)', kunci: 'tema bagian tabel_sel.gaya.font', rumah: 'global', status: 'benar' },
  { apa: 'Ukuran huruf sel', nilai: '9–24 px', kunci: 'tema bagian tabel_sel.gaya.size', rumah: 'global', status: 'benar' },
  { apa: 'Jenis huruf header', nilai: 'daftar sama dengan sel', kunci: 'tema bagian tabel_header.gaya.font', rumah: 'global', status: 'benar' },
  { apa: 'Ukuran huruf header', nilai: '9–24 px', kunci: 'tema bagian tabel_header.gaya.size', rumah: 'global', status: 'benar' },
  { apa: 'Warna huruf & latar header', nilai: 'pasangan fg/bg, per mode terang/gelap', kunci: 'tema bagian tabel_header.terang/.gelap', rumah: 'global', status: 'benar', catatan: 'Setelan terpisah untuk mode terang vs gelap.' },
  { apa: 'Warna huruf & latar sel', nilai: 'pasangan fg/bg, per mode', kunci: 'tema bagian tabel_sel.terang/.gelap', rumah: 'global', status: 'benar' },
  { apa: 'Tema & mode (gelap/terang/sistem)', nilai: 'daftar preset tema', kunci: 'pref perangkat — K.theme / K.mode', rumah: 'global', status: 'benar', catatan: 'Sudah di TopBar → menu pengguna.' },
  { apa: 'Set ikon', nilai: 'lucide / tabler / ph / heroicons / ri / iconoir / radix / bi / material', kunci: 'pref perangkat — K.iconSet', rumah: 'global', status: 'benar', catatan: 'Sudah di TopBar.' },
  { apa: 'Kaya warna UI', nilai: 'netral / aksen / kaya', kunci: 'pref perangkat — K.warnaUI', rumah: 'global', status: 'benar' },
  { apa: 'Mode navigasi', nilai: 'sidebar / menubar', kunci: 'pref perangkat — K.navigasi', rumah: 'global', status: 'benar' },
  { apa: 'Sudut membulat', nilai: '0–16 px', kunci: 'pref perangkat — K.radius', rumah: 'global', status: 'benar' },
  { apa: 'Kerapatan', nilai: 'ramping 20 / sedang 24 / nyaman 30 px', kunci: 'pref perangkat — K.density', rumah: 'global', status: 'benar', catatan: 'Menjadi nilai bawaan tinggi baris bila belum disetel manual.' },
  { apa: 'Lebar sidebar', nilai: '180–480 px (bisa diseret)', kunci: 'pref perangkat — K.sidebarLebar', rumah: 'global', status: 'benar' },
  { apa: 'Jumlah baris per halaman', nilai: '10 / 50 / 100 / 500 / Semua', kunci: 'pref perangkat — usePager.ts:8 KUNCI_PERPAGE_GLOBAL', rumah: 'global', status: 'benar', catatan: 'Kontrol di footer setiap Pager (semua tabel otomatis ikut). Ada juga jalur lama per tabel yang dimigrasi.' },
  { apa: 'Lebar/tinggi/label komponen custom', nilai: 'kotak, label, nilai awal, langkah', kunci: 'SERVER — komponen_custom, kunci `tableKey|komponen`', rumah: 'global', status: 'pindah', catatan: 'PENTING: bila tableKey KOSONG (dialog/form) = global; bila terisi = per tabel. Satu sistem, dua cakupan — inilah yang perlu penanda visual.' },
  { apa: 'Alamat API backend', nilai: 'URL + uji koneksi', kunci: 'pref perangkat — PengaturanServerPage', rumah: 'global', status: 'benar', catatan: 'Sudah punya halaman sendiri (/pengaturan/server).' },
  { apa: 'Mode penyimpanan dokumen & folder arsip', nilai: 'server / lokal / test', kunci: 'pref perangkat — PREF_MODE_DOKUMEN dll', rumah: 'global', status: 'benar', catatan: 'Halaman sama (/pengaturan/server).' },
  { apa: 'Matriks izin role × modul', nilai: 'centang per modul', kunci: 'SERVER — izin role', rumah: 'global', status: 'benar', catatan: 'Sudah punya halaman sendiri (/pengaturan/izin).' },

  { apa: 'Urutan & visibilitas tab halaman gabungan', nilai: 'urutan + tampil/sembunyi per tab', kunci: 'SERVER — pengaturan_halaman per page_key', rumah: 'halaman', status: 'benar', catatan: 'TopBar → Kelola Halaman. Halaman tanpa tab tak punya apa pun di sini.' },
  { apa: 'Filter topBar yang tampil', nilai: 'tampil/sembunyi per kunci filter', kunci: 'state sesi — lib/filterHalaman.ts (KONFIGURASI_FILTER_HALAMAN)', rumah: 'halaman', status: 'benar', catatan: 'Ditentukan kode, BUKAN pengaturan pengguna. Lapisan DB lama (pengaturan_tabel) sudah dihapus karena tak pernah dipakai.' },
  { apa: 'Mode filter (tunggal/jamak)', nilai: 'per filter berjenjang', kunci: 'state sesi — mode di kode', rumah: 'halaman', status: 'benar' },
  { apa: 'Tab terakhir yang dibuka', nilai: 'nama tab', kunci: 'pref perangkat — simpes_<rute>_tab', rumah: 'halaman', status: 'benar', catatan: 'Otomatis, tanpa kontrol UI.' },

  { apa: 'Preset kolom (kolom mana tampil)', nilai: 'daftar preset + preset aktif', kunci: 'SERVER — preset per table_key', rumah: 'tabel', status: 'benar' },
  { apa: 'Nama header kustom per kolom', nilai: 'teks pengganti label', kunci: 'SERVER — toolbar_preset.label per table_key', rumah: 'tabel', status: 'benar' },
  { apa: 'Perataan kolom', nilai: 'kiri / tengah / kanan (absen = tengah)', kunci: 'SERVER — toolbar_preset.align per table_key', rumah: 'tabel', status: 'benar', catatan: 'Ada DUA pintu: dialog tab Kolom dan menu klik kanan (jalan pintas).' },
  { apa: 'Urutan kolom', nilai: 'daftar key kolom', kunci: 'SERVER — toolbar_preset.urutan per table_key', rumah: 'tabel', status: 'benar' },
  { apa: 'Preset urutan (opsi & arah)', nilai: 'maks 3 kolom berlapis + arah', kunci: 'SERVER — urut_preset per table_key', rumah: 'tabel', status: 'benar' },
  { apa: 'Preset urutan aktif', nilai: 'satu pilihan', kunci: 'state halaman (bukan persist tabel)', rumah: 'tabel', status: 'benar', catatan: 'Dikelola halaman lewat onUrut; tidak tersimpan antar kunjungan.' },
  { apa: 'Sakelar visibilitas komponen tabel', nilai: 'tampil/sembunyi per komponen', kunci: 'SERVER — toolbar_preset.visibilitas per table_key', rumah: 'tabel', status: 'benar', catatan: 'Bilah judul: judul_tabel, info_tengah, filter, cari, keaktifan, urutan, kolom, tombol_aksi, tombol_pengaturan · Kepala tabel: header_kolom, rel_filter · Kolom tetap: kolom_centang, kolom_aksi · Kaki tabel: pager, tombol_tambah, tombol_edit. Berbagi peta dengan penanda versi lama (info/urut), jadi WAJIB merge saat menulis.' },
  { apa: 'Info tabel', nilai: 'HTML bebas', kunci: 'SERVER — toolbar_preset.info_html per table_key', rumah: 'tabel', status: 'benar', catatan: 'Terdiri tab "Info" sendiri di dialog, lengkap dengan editor penuh.' },
  { apa: 'Bawaan preset kolom tabel', nilai: 'satu preset ditandai bawaan', kunci: 'SERVER — preset default per table_key', rumah: 'tabel', status: 'benar' },
  { apa: 'Kolom beku (freeze pane)', nilai: 'jumlah kolom dari kiri', kunci: 'pref perangkat — freezeKey(tableKey)', rumah: 'tabel', status: 'benar', catatan: 'Per perangkat, bukan server.' },
  { apa: 'Lebar kolom', nilai: 'px per kolom + hasil AutoFit', kunci: 'pref perangkat — widthsKey(tableKey)', rumah: 'tabel', status: 'benar' },
  { apa: 'Tabel mengisi lebar', nilai: 'sakelar', kunci: 'pref perangkat — isiLebarKey(tableKey) (bawaan: prop isiLebarPenuh)', rumah: 'tabel', status: 'benar', catatan: 'Null = ikut prop halaman; angka menang atas prop.' },
  { apa: 'Baris ikut isi', nilai: 'sakelar', kunci: 'pref perangkat — autoBarisKey(tableKey)', rumah: 'tabel', status: 'benar' },
  { apa: 'Tinggi baris dasar tabel ini', nilai: 'stepper 18..240px + ↺ (null = bawaan)', kunci: 'pref perangkat — tinggiDasarKey(tableKey)', rumah: 'tabel', status: 'benar' },
  { apa: 'Tinggi baris manual per baris', nilai: 'px per id baris', kunci: 'pref perangkat — useTinggiBaris(tableKey)', rumah: 'tabel', status: 'benar', catatan: 'Pegangan seret sudah dihapus; sisa nilai lama tetap dipakai sampai direset lewat klik kanan.' },
  { apa: 'Halaman aktif (Pager)', nilai: 'nomor halaman', kunci: 'pref perangkat — simpes_page_<tableKey>', rumah: 'tabel', status: 'benar' },

  { apa: 'Mode Ubah (auto-save sel)', nilai: 'aktif/tidak', kunci: 'state sesi — tidak disimpan', rumah: 'tabel', status: 'benar', catatan: 'BUKAN pengaturan: ini MODE KERJA yang menulis ke database.' },
  { apa: 'Mode Input (buat record baru)', nilai: 'aktif/tidak', kunci: 'state sesi — tidak disimpan', rumah: 'tabel', status: 'benar', catatan: 'Sama: menulis data, bukan setelan.' },
  { apa: 'Seleksi baris tercentang', nilai: 'daftar id', kunci: 'state sesi', rumah: 'tabel', status: 'benar', catatan: 'Bukan pengaturan.' },
];

const RUMAH_WARNA: Record<BarisKlasifikasi['rumah'], string> = {
  global: 'border-destructive/50 bg-destructive/10 text-destructive',
  halaman: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  tabel: 'border-emerald-600/50 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
};

const STATUS_WARNA: Record<BarisKlasifikasi['status'], string> = {
  benar: 'text-emerald-700 dark:text-emerald-400',
  pindah: 'text-destructive',
  baru: 'text-amber-600 dark:text-amber-400',
};

const STATUS_LABEL: Record<BarisKlasifikasi['status'], string> = {
  benar: 'sudah tepat',
  pindah: 'perlu dipindah',
  baru: 'belum ada tempat',
};

function BlokKlasifikasiLengkap() {
  const hitung = (r: BarisKlasifikasi['rumah']) => KLASIFIKASI.filter((k) => k.rumah === r).length;
  const pindah = KLASIFIKASI.filter((k) => k.status === 'pindah').length;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid gap-1.5 sm:grid-cols-3">
        {(['global', 'halaman', 'tabel'] as const).map((r) => (
          <div key={r} className="rounded-md border border-border p-2">
            <span className={cn('rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase', RUMAH_WARNA[r])}>
              {r === 'tabel' ? 'tabel ini' : r}
            </span>
            <p className="pt-1 text-xs font-semibold tabular-nums">{hitung(r)} pengaturan</p>
            <p className="text-[10px] text-muted-foreground">
              {KLASIFIKASI.filter((k) => k.rumah === r && k.status === 'pindah').length} perlu dipindah
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Total {KLASIFIKASI.length} baris · <strong className="text-destructive">{pindah} perlu dipindah</strong> ·
        sisanya sudah di tempat yang benar.
      </p>

      {(['global', 'halaman', 'tabel'] as const).map((r) => (
        <div key={r} className="flex flex-col gap-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className={cn('rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase', RUMAH_WARNA[r])}>
              {r === 'tabel' ? 'tabel ini' : r}
            </span>
            <span className="font-normal text-muted-foreground">
              {r === 'global' && 'berlaku semua tabel di semua halaman → Pengaturan Aplikasi'}
              {r === 'halaman' && 'milik halaman (termasuk halaman tanpa tabel) → Kelola Halaman'}
              {r === 'tabel' && 'disimpan per tableKey → Kelola Tabel'}
            </span>
          </p>
          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="border-b border-border px-2 py-1.5 font-semibold">Pengaturan</th>
                  <th className="border-b border-border px-2 py-1.5 font-semibold">Nilai</th>
                  <th className="border-b border-border px-2 py-1.5 font-semibold">Kunci penyimpanan (bukti)</th>
                  <th className="border-b border-border px-2 py-1.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {KLASIFIKASI.filter((k) => k.rumah === r).map((k) => (
                  <tr key={k.apa} className={cn('odd:bg-muted/20', k.status === 'pindah' && 'bg-destructive/5')}>
                    <td className="border-b border-border px-2 py-1 font-medium">
                      {k.apa}
                      {k.catatan && (
                        <span className="block text-[10px] font-normal text-muted-foreground">{k.catatan}</span>
                      )}
                    </td>
                    <td className="border-b border-border px-2 py-1 text-muted-foreground">{k.nilai}</td>
                    <td className="border-b border-border px-2 py-1 font-mono text-[10px] text-primary">{k.kunci}</td>
                    <td className={cn('border-b border-border px-2 py-1 font-semibold whitespace-nowrap', STATUS_WARNA[k.status])}>
                      {STATUS_LABEL[k.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground">
        Baris berlatar merah muda = perlu dipindah. Perhatikan: hampir semua yang "perlu dipindah"
        adalah setelan GLOBAL yang sekarang dikontrol dari dalam tabel.
      </p>
    </div>
  );
}

/* ---------- Blok 1b-6: pilihan bentuk rumah global ---------- */

/** Alternatif bentuk UI untuk rumah GLOBAL, beserta penilaiannya.
 *
 *  PERTANYAAN: selain halaman khusus "Pengaturan Global", adakah bentuk yang
 *  lebih baik? Jawabannya bergantung pada JUMLAH & SIFAT setelannya —
 *  karena itu tiap opsi menyebut berapa kontrol yang harus ditampungnya. */
interface OpsiBentuk {
  nama: string;
  /** Bentuk UI-nya seperti apa. */
  bentuk: string;
  /** Berapa kontrol yang ditampung. */
  muatan: string;
  /** Kapan bentuk ini justru lebih baik. */
  cocokBila: string;
  /** Kelemahan jujur. */
  lemah: string;
  /** Penilaian akhir. */
  nilai: 'disarankan' | 'sebagian' | 'kurang';
}

const OPSI: OpsiBentuk[] = [
  {
    nama: 'A. Halaman khusus penuh',
    bentuk: 'Rute /pengaturan/tampilan, satu halaman dengan bagian bertab atau bergulir. Meniru pola PengaturanServerPage yang sudah ada.',
    muatan: '11 kontrol tabel + 8 kontrol aplikasi yang kini terpencar di menu TopBar.',
    cocokBila:
      'Jumlah kontrol banyak, dan pengguna perlu MELIHAT semuanya sekaligus untuk menilai hasilnya'
      + ' (mis. menyeimbangkan ukuran huruf vs tinggi baris).',
    lemah:
      'Terasa berat untuk perubahan kecil: menggeser tinggi baris 4px jadi perlu 3 klik navigasi.'
      + ' Pengguna yang ingin cepat akan tetap mencari tombol cepat di tabel.',
    nilai: 'sebagian',
  },
  {
    nama: 'B. Panel samping geser (sheet)',
    bentuk: 'Tombol ⚙ di TopBar membuka panel dari kanan. Panel tetap terbuka saat berpindah halaman, jadi hasilnya terlihat langsung di tabel mana pun.',
    muatan: 'Sama dengan A, tapi tertata sebagai panel sempit (satu kolom).',
    cocokBila:
      'Setelan bersifat "coba-coba lalu lihat hasilnya" — ini persis sifat tinggi baris & huruf.'
      + ' Pengguna melihat perubahan tanpa menutup panel.',
    lemah:
      'Panel sempit membatasi tata letak (kontrol lebar & pratinjau berbagi ruang). Bila isinya'
      + ' bertambah besar (mis. ditambah pengaturan komponen), panel jadi harus digulir panjang.',
    nilai: 'disarankan',
  },
  {
    nama: 'C. Perluas menu pengguna di TopBar',
    bentuk: 'Tambahkan submenu "Tampilan tabel" ke menu pengguna yang sudah ada (tempat Tema, Set ikon, Kerapatan).',
    muatan: 'Hanya 11 kontrol tabel; sisanya sudah ada di situ.',
    cocokBila: 'Ingin perubahan paling murah — nol halaman baru, nol rute, memakai pola menu yang sudah dikenal.',
    lemah:
      'Menu dropdown buruk untuk kontrol "geser & lihat hasil": menu menutup saat diklik di luar,'
      + ' dan pratinjau tabel tidak terlihat dari dalam menu. Warna (pemilih warna) juga sempit di menu.',
    nilai: 'kurang',
  },
  {
    nama: 'D. Dialog "Pengaturan Tampilan"',
    bentuk: 'Dialog modal dari TopBar, di tengah layar, dengan pratinjau mini tabel di dalamnya.',
    muatan: '11 kontrol tabel + pratinjau.',
    cocokBila:
      'Ingin memisahkan dengan tegas dari pengaturan aplikasi, dan ingin menyediakan pratinjau'
      + ' yang tidak bergantung pada halaman aktif.',
    lemah:
      'Modal menutupi tabel sehingga pengguna kehilangan konteks. Pratinjau mini harus dibuat'
      + ' terpisah — kerja tambahan, dan bisa berbeda dari tabel sungguhan.',
    nilai: 'sebagian',
  },
  {
    nama: 'E. Pertahankan di footer tabel (status quo)',
    bentuk: 'Tetap seperti sekarang: tombol gerigi di footer tiap tabel.',
    muatan: '11 kontrol, diulang di 22 halaman.',
    cocokBila: 'Tidak ada — inilah yang ingin diperbaiki.',
    lemah:
      '11 kontrol yang sama disalin ke 22 tempat. Setelah dipindah ke satu rumah, tak ada alasan'
      + ' mempertahankannya. Satu-satunya nilai: dekat dengan tabel yang sedang dilihat.',
    nilai: 'kurang',
  },
];

/** Saran akhir: hibrida yang mengambil kebaikan dua opsi. */
const SARAN_HIBRIDA = [
  {
    langkah: '1. Rumah utama: panel samping geser (opsi B)',
    alasan: '11 kontrol masuk ke satu tempat. Panel bisa dibuka dari TopBar, dan tetap terbuka saat berpindah halaman — jadi perubahan langsung terlihat pada tabel mana pun.',
    id: 'btn_pengaturan_tampilan',
  },
  {
    langkah: '2. Tetap ada jalan pintas di tabel, TAPI hanya 1 kontrol',
    alasan: 'Tombol tinggi baris cepat (siklus 20→24→28→32px) dipertahankan di footer. Ia aksi cepat sambil bekerja, bukan pengaturan — dan inilah satu-satunya yang masuk akal tetap dekat tabel.',
    id: 'btn_tinggi_baris_cepat',
  },
  {
    langkah: '3. Pengaturan aplikasi (tema, ikon, kerapatan) tetap di menu pengguna',
    alasan: 'Sudah di tempat yang benar dan tidak perlu pratinjau tabel. Jangan dipindah hanya demi keseragaman — memindahkannya malah menambah kerja pengguna.',
    id: 'menu_pengguna',
  },
  {
    langkah: '4. Halaman penuh (/pengaturan/tampilan) dibuat NANTI bila perlu',
    alasan: 'Bila jumlah setelan bertambah banyak (mis. pengaturan komponen custom digabung), barulah halaman penuh lebih pantas. Mulai dari panel dulu — naik ke halaman penuh selalu mungkin, sebaliknya sulit.',
    id: 'rute_pengaturan_tampilan',
  },
];

function BlokBentukGlobal() {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border border-border bg-muted/30 p-2">
        <p className="text-xs">
          <strong>Faktor penentu:</strong> 11 kontrol tabel yang perlu rumah bersifat
          <em> coba-lalu-lihat</em> (tinggi baris, huruf, warna) — pengguna perlu melihat tabelnya
          berubah. Bentuk yang memisahkan panel dari tabel dengan keras (modal/halaman penuh)
          memaksa pengguna bolak-balik.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {OPSI.map((o) => (
          <div
            key={o.nama}
            className={cn(
              'rounded-md border p-2',
              o.nilai === 'disarankan' ? 'border-primary/60 bg-primary/5' : 'border-border',
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn(
                'rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase',
                o.nilai === 'disarankan' && 'border-primary/50 bg-primary/15 text-primary',
                o.nilai === 'sebagian' && 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                o.nilai === 'kurang' && 'border-muted-foreground/40 bg-muted/40 text-muted-foreground',
              )}>
                {o.nilai}
              </span>
              <span className="text-xs font-semibold">{o.nama}</span>
            </div>
            <p className="pt-1 text-[11px] text-muted-foreground">{o.bentuk}</p>
            <p className="pt-0.5 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Muatan: </span>{o.muatan}
            </p>
            <p className="pt-0.5 text-[11px] text-muted-foreground">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Cocok bila: </span>{o.cocokBila}
            </p>
            <p className="pt-0.5 text-[11px] text-muted-foreground">
              <span className="font-semibold text-destructive">Kelemahan: </span>{o.lemah}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-2">
        <p className="text-xs font-semibold text-primary">Saran: hibrida (panel + 1 jalan pintas)</p>
        <ol className="flex flex-col gap-1 pt-1.5">
          {SARAN_HIBRIDA.map((s, i) => (
            <li key={s.langkah} className="flex gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                {i + 1}
              </span>
              <span>
                <span className="block text-xs font-medium">{s.langkah}</span>
                <span className="block text-[11px] text-muted-foreground">{s.alasan}</span>
                <span className="block font-mono text-[10px] text-primary">{s.id}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

interface Temuan {
  /** Judul singkat temuan. */
  judul: string;
  /** Tingkat keparahan. */
  tingkat: 'tinggi' | 'sedang' | 'rendah';
  /** Bukti di kode (path:baris). */
  bukti: string;
  /** Apa yang sebenarnya terjadi. */
  masalah: string;
  /** Usulan perbaikan yang konkret. */
  usulan: string;
  /** Bila sudah dikerjakan: apa yang berubah. Absen = belum dikerjakan. */
  selesai?: string;
}

/** Temuan dari pemetaan 2026-10-13, diperbarui 2026-10-19: hal-hal yang
 *  membingungkan di pengaturan tabel. Disusun dari bukti kode, bukan dugaan —
 *  tiap temuan menyebut path:baris supaya bisa diverifikasi ulang.
 *
 *  Catatan: tiga temuan pertama SUDAH selesai sejak gerigi footer dihapus dan
 *  gerigi "Pengaturan tabel" muncul di bilah judul. Disebut tetap (bukan
 *  dihapus) supaya alasan kenapa bentuk sekarang seperti ini tidak hilang. */
const TEMUAN: Temuan[] = [
  {
    judul: 'Dulu: setelan global tersembunyi di gerigi SETIAP tabel',
    tingkat: 'tinggi',
    bukti: 'ExcelTable.tsx:1940 (tombolPengaturanTampil) · TopBar.tsx:785 (SheetPengaturanTampilan)',
    masalah:
      'Tombol gerigi dulu ada di kaki SETIAP tabel, jadi tinggi header, jenis/ukuran huruf, '
      + 'warna, dan tinggi baris tampak seperti setelan per tabel — padahal GLOBAL untuk semua '
      + 'tabel. Mengubahnya di satu tabel diam-diam mengubah seluruh tabel lain; biasanya baru '
      + 'disadari setelah tabel lain "tiba-tiba berubah".',
    usulan:
      'Satu pintu untuk setelan global: TopBar → "Pengaturan tampilan".',
    selesai: 'SELESAI: setelan global hanya di TopBar; kaki tabel tak lagi punya tombol apa pun '
      + 'selain Pager, tambah baris, dan Mode Ubah. Yang tersisa di kaki tabel memang milik '
      + 'tabel itu sendiri.',
  },
  {
    judul: 'Dulu: jalan masuk kelola tabel hanya lewat klik kanan (tak terlihat)',
    tingkat: 'sedang',
    bukti: 'excel/JudulTabel.tsx:198-212 (btn_pengaturan_tabel) + :221 menu konteks · TopBar.tsx:483 btn_kelola_halaman',
    masalah:
      '"Kelola Tabel" dulu hanya muncul lewat KLIK KANAN — tak ada tombol terlihat, dan pintu '
      + 'kedua di TopBar hanya ikon NotebookTabs tanpa label, jadi pengguna harus menebak dari '
      + 'tooltip.',
    usulan:
      'Tombol terlihat berlabel di ujung bilah judul, plus menu overflow.',
    selesai: 'SELESAI: gerigi "Pengaturan tabel ini" (id btn_pengaturan_tabel_<tableKey>) kini '
      + 'ada di ujung paling kanan bilah judul tiap tabel, dan TopBar punya dua pintu '
      + 'berlabel: "Kelola Halaman" & "Kelola Tabel". Klik kanan tetap ada sebagai jalan pintas.',
  },
  {
    judul: 'Dulu: status "ada perubahan belum disimpan" mudah terlewat',
    tingkat: 'sedang',
    bukti: 'kelolaTabel/DialogKelolaTabel.tsx:410 (TERAPKAN LANGSUNG) · :370 kotorBagian',
    masalah:
      'Dialog dulu punya tombol Simpan terpadu + badge "kotor" per tab, tapi perubahan yang '
      + 'belum disimpan bisa hilang bila pengguna menutup dialog lewat Esc / klik luar.',
    usulan:
      'Simpan per bagian, tanpa tombol Simpan terpadu.',
    selesai: 'SELESAI: tiap bagian tersimpan sendiri (antrean `lib/antreSimpan`); footer '
      + 'konsisten: status Simpan & badge kotor per tab (TabBagian) tetap ada sebagai '
      + 'penanda, bukan lagi prasyarat menyimpan.',
  },
  {
    judul: 'Dulu: tab "Filter" menyesatkan',
    tingkat: 'rendah',
    bukti: 'excel/komponenTabel.ts:24-61 (kunci komponen) · DialogKelolaTabel.tsx:567 (4 tab)',
    masalah:
      'Dialog dulu punya tab "Filter" sendiri, padahal filter toolbar adalah KOMPONEN MILIK '
      + 'TABEL — sama kelasnya dengan sakelar urutan/kolom. Dua tab sekalian membuat '
      + 'pengguna mengira ada dua sistem penyimpanan berbeda.',
    usulan:
      'Satukan filter toolbar ke "Visibilitas komponen tabel" dan pindahkan filter MILIK '
      + 'HALAMAN ke Kelola Halaman.',
    selesai: 'SELESAI: tab "Filter" dihapus. Dialog kini 4 tab (Umum · Info · Kolom · '
      + 'Urutan); sakelar filter ada di tab Umum bersama sakelar komponen lain, dan filter '
      + 'halaman (topBar) diatur dari TopBar → Kelola Halaman.',
  },
];

const WARNA_TINGKAT: Record<Temuan['tingkat'], string> = {
  tinggi: 'border-destructive/50 bg-destructive/10 text-destructive',
  sedang: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rendah: 'border-muted-foreground/40 bg-muted/40 text-muted-foreground',
};

function BlokRekomendasi() {
  return (
    <div className="flex flex-col gap-1.5">
      {TEMUAN.map((t) => (
        <div key={t.judul} className="rounded-md border border-border p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase', WARNA_TINGKAT[t.tingkat])}>
              {t.tingkat}
            </span>
            <span className="text-xs font-semibold">{t.judul}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{t.bukti}</span>
          </div>
          <p className="pt-1 text-xs text-muted-foreground">{t.masalah}</p>
          <p className="pt-1 text-xs">
            <span className="font-semibold text-primary">Usulan: </span>
            {t.usulan}
          </p>
          {t.selesai ? (
            <p className="mt-1 rounded-sm border border-emerald-600/40 bg-emerald-600/5 px-1.5 py-1 text-[11px]">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                Status: </span>
              {t.selesai}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

interface BarisFitur {
  fitur: string;
  sumber: string;
  /** Jumlah halaman/komponen yang memakai; '—' = selalu aktif (bukan opsional). */
  dipakai: string;
  catatan?: string;
}

/** Prop ExcelTable yang benar-benar dipakai di repo.
 *
 *  Angka hasil periksa 2026-10-19 (cara periksa lihat catatan di atas):
 *  - "titik render" = berapa kali prop itu muncul di JSX; satu berkas bisa
 *    merender beberapa tabel, jadi jumlah titik render ≥ jumlah halaman.
 *  - "halaman" = jumlah berkas yang memakainya.
 *  Dua angka sengaja dibedakan: sebelumnya hanya satu angka ("N halaman"),
 *  dan itulah sumber kebingungan — prop yang muncul 2× di satu berkas terhitung
 *  sebagai halaman berbeda. */
const INVENTARIS: BarisFitur[] = [
  { fitur: 'Judul tabel', sumber: 'header ?? judulTabel(tableKey)', dipakai: 'selalu', catatan: 'Urutan: isian pengguna (Info) → prop header → kamus excel/judul.ts → kapitalisasi table_key.' },
  { fitur: 'Info di bilah judul', sumber: 'tengah', dipakai: '2 halaman', catatan: 'PembayaranPage & PenampilBerkas. Digerbang sakelar `info_tengah`.' },
  { fitur: 'Filter toolbar', sumber: 'filter', dipakai: 'banyak halaman', catatan: 'Isi bebas: LabeledCombobox, input cari, dll.' },
  { fitur: 'Aksi massal baris tercentang', sumber: 'renderBulkActions', dipakai: '7 halaman (8 titik render)', catatan: 'Hanya muncul saat ada baris dicentang.' },
  { fitur: 'Kontrol awalan toolbar', sumber: 'awalanToolbar', dipakai: '1 halaman', catatan: 'GenerateTagihanDialog (Kari + Status).' },
  { fitur: 'Kontrol akhir toolbar', sumber: 'akhirToolbar', dipakai: '1 halaman', catatan: 'TabelRingkas menaruh aksi di kanan bilah judul.' },
  { fitur: 'Urutkan (preset urut)', sumber: 'onUrut + urutAktif + arahUrut', dipakai: 'banyak halaman', catatan: 'Bisa dimatikan per tabel (sakelar `urutan`) lewat Kelola Tabel → Umum.' },
  { fitur: 'Kolom (preset tampilan)', sumber: 'PresetKolom (internal)', dipakai: 'banyak halaman', catatan: 'Dimatikan lewat hidePreset (4 titik render) atau sakelar `kolom`.' },
  { fitur: 'Tombol aksi utama', sumber: 'addButton + addButtonLangsung', dipakai: '19 halaman; 5 langsung', catatan: 'Dibungkus menu hamburger kecuali addButtonLangsung (7 titik render).' },
  { fitur: 'Gerigi "Pengaturan tabel"', sumber: 'tombolPengaturanTampil → DialogKelolaTabel', dipakai: 'selalu (sakelar tombol_pengaturan)', catatan: 'Tombol terlihat di ujung kanan bilah judul; dulu hanya lewat klik kanan.' },
  { fitur: 'Rel filter Tingkat/Kelas', sumber: 'rail', dipakai: '12 halaman (13 titik render)', catatan: 'Maksimal satu per halaman; memberi ruang di kiri grid sejajar judul kolom.' },
  { fitur: 'Gutter nomor baris', sumber: 'gutterColumn (GUTTER_W = 36)', dipakai: 'selalu', catatan: 'Tidak bisa dimatikan.' },
  { fitur: 'Kolom centang + pilih semua', sumber: 'hideCheckbox', dipakai: '13 halaman mematikan (24 titik render)', catatan: 'CheckAllCell di header. Sakelar tabel `kolom_centang` menambah penyembunyian (prop halaman menang dulu).' },
  { fitur: 'Kolom Aksi per baris', sumber: 'renderActions / renderActionsKonteks', dipakai: 'selalu', catatan: 'Dropdown hamburger otomatis bila aksi > 3. sakelar `kolom_aksi` bisa menyembunyikannya.' },
  { fitur: 'Aksi hanya di klik kanan', sumber: 'renderActionsKonteks', dipakai: '1 halaman (2 titik render)', catatan: 'MutasiKeluarPage (tabel aktif + arsip): untuk aksi yang tak perlu ikon tiap baris.' },
  { fitur: 'Ikon aksi selalu tampil', sumber: 'aksiLangsung', dipakai: '8 halaman (11 titik render)', catatan: 'Menimpa status ringkas warisan tableKey.' },
  { fitur: 'Sembunyikan centang / Aksi', sumber: 'hideCheckbox / hideActions', dipakai: 'hideActions: 6 halaman', catatan: 'TabelRingkas memakai keduanya + hidePreset (tabel ringkas baca-saja).' },
  { fitur: 'Klik baris memilih (bukan centang)', sumber: 'onBarisKlik + barisAktifId', dipakai: '3 halaman', catatan: 'ReferensiPage (pilih kamus), PembayaranPage, tabKeuangan DispensasiTab. Baris terpilih disorot.' },
  { fitur: 'Freeze pane kiri', sumber: 'klik kanan header → Bekukan kolom', dipakai: 'per pemakaian', catatan: 'Disimpan per tableKey (freezeKey).' },
  { fitur: 'AutoFit lebar kolom', sumber: 'menu konteks → AutoFit', dipakai: 'per pemakaian', catatan: 'Min 50px, maks 480px.' },
  { fitur: 'Perataan kolom', sumber: 'menu konteks → Kiri/Tengah/Kanan', dipakai: 'standar DB per tabel', catatan: 'Bawaan tengah; disimpan di server.' },
  { fitur: 'Tinggi baris (manual per baris)', sumber: '— (DIHAPUS: seret batas bawah baris)', dipakai: '—', catatan: 'Pegangan seret dihapus; sisa nilai lama masih tersimpan dan bisa direset lewat klik kanan → "Kembalikan tinggi baris".' },
  { fitur: 'Kartu hover sel', sumber: 'ExcelField.kartuHover', dipakai: 'kolom static tertentu', catatan: 'Untuk rincian yang tak muat di kolom.' },
  { fitur: 'Baris input (buat record)', sumber: 'onCreateRow + inputRowValues', dipakai: '7 halaman (9 titik render)', catatan: 'ID baris sintetis __input__. Kolom static bisa ikut terisi lewat inputKind.' },
  { fitur: 'Mode Ubah (auto-save sel)', sumber: 'canEdit + onCommit + onSaved', dipakai: 'halaman CRUD', catatan: 'Mode Ubah & Input saling eksklusif. Antrean simpan per baris: perubahan beruntun di satu baris digabung, satu reload + satu toast setelah antrean habis.' },
  { fitur: 'Mode Ubah tanpa canEdit (fitur blok)', sumber: 'onSeretIsi / onSalinBlok / onTempelBlok / onIsiBlok / onKosongkanBlok', dipakai: '1 halaman (KurikulumJadwalPage)', catatan: 'Tabel read-saja tetap menampilkan tombol Mode Ubah bila punya fitur manipulasi — sel tak bisa diketik, tooltip-nya membedakan keduanya. Contoh: matriks jadwal (kolom static, isi lewat dialog).' },
  { fitur: 'Sakelar gestur di bilah Mode Ubah', sumber: 'sakelarMode (GRUP_SERET_ISI / GRUP_SUSUNAN_KOLOM)', dipakai: 'selalu saat mode aktif', catatan: 'Dua sakelar: "Seret isi sel" (copy/move) dan "Geser judul kolom". Geser mati sendiri bila isiLebarPenuh menyala.' },
  { fitur: 'Batas tinggi N baris', sumber: 'maxRows', dipakai: '2 halaman (3 titik render)', catatan: 'Tanpa maxRows = tabel mengisi penuh ruang.' },
  { fitur: 'Susunan kolom dari luar', sumber: 'presetLuar', dipakai: '1 halaman', catatan: 'GenerateTagihanDialog: menimpa preset internal sepenuhnya (termasuk label & id preset).' },
  { fitur: 'Judul di bilah ExcelTable', sumber: 'prop `header`', dipakai: 'TabelRingkas + tabel gerbang', catatan: 'TabelRingkas tak menggambar <header> sendiri; judulnya diserahkan ke bilah judul ExcelTable supaya gerigi Pengaturan tabel tetap ada di ujung kanan.' },
  { fitur: 'Lebar dropdown Kolom', sumber: 'presetKolomClassName', dipakai: '0 halaman (belum dipakai)', catatan: 'Bawaan w-44; bisa ditimpa untuk tabel sempit.' },
  { fitur: 'Tabel asal kolom (toolbar Kolom)', sumber: 'sumberTabel', dipakai: '13 halaman', catatan: 'Menentukan tabel DB milik kolom: kolom tanpa `sumber` dianggap dari tabel ini. Hanya berpengaruh pada toolbar Kolom.' },
  { fitur: 'Lebar mengisi pembungkus', sumber: 'isiLebarPenuh', dipakai: '2 titik render (ReferensiPage)', catatan: 'Rasio = (lebar wadah − kolom tetap) / total lebar kolom data, dikali ke tiap kolom. Wadah diukur dari .dsg-container sehingga lebar scrollbar vertikal sudah dipotong. Geser judul kolom otomatis mati saat aktif. Sakelar pengguna (Kelola Tabel → Umum "Tabel mengisi lebar") MENANG atas prop ini.' },
  { fitur: 'Seleksi tercentang dikabarkan', sumber: 'onCheckedChange', dipakai: '10 halaman', catatan: 'Halaman memakai daftar id tercentang (mis. untuk aksi massal).' },
  { fitur: 'Paginasi di kaki', sumber: 'pager', dipakai: '20 halaman (21 titik render)', catatan: 'ExcelTable tak menghitung halaman; halaman meng-inject <Pager/>. Sakelar `pager` bisa mematikannya.' },
  { fitur: 'Pengaturan tampilan tabel', sumber: 'TopBar → "Pengaturan tampilan"', dipakai: 'selalu (dibuka dari TopBar)', catatan: 'Tinggi sel/header, font/ukuran/warna header & sel. Semua GLOBAL. Gerigi footer sudah DIHAPUS — ini satu-satunya pintunya.' },
  { fitur: 'Tombol tinggi baris di kaki', sumber: '— (dihapus)', dipakai: '—', catatan: 'Tombol siklus di kaki tabel dihapus; tinggi baris per tabel diatur di Kelola Tabel → Umum (18..240px).' },
  { fitur: 'Panel Kelola Tabel', sumber: 'DialogKelolaTabel', dipakai: 'halaman berregistrasi', catatan: 'Dibuka dari 2 tempat: gerigi paling kanan bilah judul (Sheet non-modal) & menu TopBar (modal). 4 tab (Umum · Info · Kolom · Urutan), tiap bagian tersimpan sendiri.' },
  { fitur: 'Menu klik kanan 4 area', sumber: 'MenuKonteksGrid', dipakai: 'selalu', catatan: 'Tabel / Kolom / Baris / sudut — isi berbeda per area.' },
  { fitur: 'Salin TSV (baris/sel/kolom/semua)', sumber: 'useSalinTabel + Ctrl+C', dipakai: 'selalu', catatan: 'Termasuk tombol salin di corner button.' },
  { fitur: 'Scrollbar melayang', sumber: 'ScrollbarMelayang ×2', dipakai: 'selalu', catatan: 'Mengganti scrollbar bawaan yang disembunyikan.' },
  { fitur: 'Badge mode Ubah / Input', sumber: 'PillMode', dipakai: 'selalu', catatan: 'Melayang kanan-bawah saat mode aktif.' },
];

function TabelInventaris() {
  return (
    <div className="overflow-auto rounded-md border border-border">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-muted/60 text-left">
          <tr>
            <th className="border-b border-border px-2 py-1.5 font-semibold">Fitur</th>
            <th className="border-b border-border px-2 py-1.5 font-semibold">Prop / Komponen sumber</th>
            <th className="border-b border-border px-2 py-1.5 font-semibold whitespace-nowrap">Dipakai</th>
            <th className="border-b border-border px-2 py-1.5 font-semibold">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {INVENTARIS.map((b) => (
            <tr key={b.fitur} className="odd:bg-muted/20">
              <td className="border-b border-border px-2 py-1 font-medium">{b.fitur}</td>
              <td className="border-b border-border px-2 py-1 font-mono text-[10px] text-primary">{b.sumber}</td>
              <td className="border-b border-border px-2 py-1 whitespace-nowrap text-muted-foreground">{b.dipakai}</td>
              <td className="border-b border-border px-2 py-1 text-muted-foreground">{b.catatan ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ContohBaris {
  id: number;
  nama: string;
  nis: string;
  jenjang: string;
  status: 'Aktif' | 'Tidak aktif';
}

const CONTOH_BARIS: ContohBaris[] = [
  { id: 1, nama: 'Ahmad Fauzi', nis: '2024001', jenjang: 'MTs', status: 'Aktif' },
  { id: 2, nama: 'Bilqis Aulia', nis: '2024002', jenjang: 'MA', status: 'Aktif' },
  { id: 3, nama: 'Cahyo Nugroho', nis: '2024003', jenjang: 'MI', status: 'Tidak aktif' },
  { id: 4, nama: 'Dewi Lestari', nis: '2024004', jenjang: 'MTs', status: 'Aktif' },
  { id: 5, nama: 'Eko Prasetyo', nis: '2024005', jenjang: 'MA', status: 'Tidak aktif' },
];

const CONTOH_FIELDS: ExcelField[] = [
  { key: 'nama', label: 'Nama', kind: 'static', width: 180, kartuHover: (r) => String(r.nama ?? '') },
  { key: 'nis', label: 'NIS', kind: 'text', maxLength: 12, width: 110 },
  { key: 'jenjang', label: 'Jenjang', kind: 'select', choices: ['MI', 'MTs', 'MA'].map((v) => ({ value: v, label: v })), width: 100 },
  { key: 'status', label: 'Aktif', kind: 'toggle', width: 90 },
  { key: 'catatan', label: 'Catatan', kind: 'text', width: 200 },
];

/** Sakelar satu prop opsional; label + keterangan singkat. */
function Sakelar({ id, label, aktif, onUbah, keterangan }: {
  id: string;
  label: string;
  aktif: boolean;
  onUbah: (v: boolean) => void;
  keterangan: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2 rounded-sm border border-border p-1.5">
      <Switch id={id} checked={aktif} onCheckedChange={onUbah} className="mt-0.5 shrink-0" />
      <span className="min-w-0">
        <span className="block font-mono text-[11px] font-medium">{label}</span>
        <span className="block text-[10px] leading-tight text-muted-foreground">{keterangan}</span>
      </span>
    </label>
  );
}

/** Contoh hidup: ExcelTable sungguhan dengan data dummy + sakelar prop. */
function ContohHidup() {
  const [baris, setBaris] = useState<ContohBaris[]>([...CONTOH_BARIS]);
  const [hideCheckbox, setHideCheckbox] = useState(false);
  const [hideActions, setHideActions] = useState(false);
  const [hidePreset, setHidePreset] = useState(false);
  const [rail, setRail] = useState(false);
  const [maxRows, setMaxRows] = useState(false);
  const [pager, setPager] = useState(true);
  const [tercentang, setTercentang] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(10);

  const rows = useMemo(() => baris, [baris]);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        <Sakelar id="contoh_excel_hide_checkbox" label="hideCheckbox" aktif={hideCheckbox} onUbah={setHideCheckbox}
          keterangan="Sembunyikan kolom centang (tabel baca-saja)." />
        <Sakelar id="contoh_excel_hide_actions" label="hideActions" aktif={hideActions} onUbah={setHideActions}
          keterangan="Sembunyikan kolom Aksi." />
        <Sakelar id="contoh_excel_hide_preset" label="hidePreset" aktif={hidePreset} onUbah={setHidePreset}
          keterangan="Sembunyikan dropdown Kolom di toolbar." />
        <Sakelar id="contoh_excel_rail" label="rail" aktif={rail} onUbah={setRail}
          keterangan="Rel Tingkat/Kelas di kiri grid (maks 1 per halaman)." />
        <Sakelar id="contoh_excel_max_rows" label="maxRows" aktif={maxRows} onUbah={setMaxRows}
          keterangan="Batasi tinggi 3 baris (tanpa = mengisi penuh ruang)." />
        <Sakelar id="contoh_excel_pager" label="pager" aktif={pager} onUbah={setPager}
          keterangan="Paginasi di kaki tabel (di-inject halaman)." />
      </div>

      <p className="text-[10px] text-muted-foreground">
        Baris tercentang: <span id="contoh_excel_tercentang" className="font-semibold text-foreground">{tercentang}</span>.
        Klik ganda sel untuk masuk mode Ubah; klik kanan header/baris untuk menu konteks.
      </p>

      <div className="flex min-h-0 flex-col" style={{ height: maxRows ? undefined : '22rem' }}>
        <ExcelTable<ContohBaris>
          tableKey="komponen_excel_demo"
          fields={CONTOH_FIELDS}
          rows={rows}
          getValues={(r) => ({
            nama: r.nama,
            nis: r.nis,
            jenjang: r.jenjang,
            status: r.status === 'Aktif' ? 'ya' : 'tidak',
            catatan: null,
          })}
          canEdit
          onCommit={async (id, fields) => {
            setBaris((prev) => prev.map((b) => {
              if (b.id !== id) return b;
              const next = { ...b };
              if (fields.nis !== undefined && fields.nis !== null) next.nis = fields.nis;
              if (fields.jenjang !== undefined && fields.jenjang !== null) next.jenjang = fields.jenjang;
              if (fields.status !== undefined && fields.status !== null) next.status = fields.status === 'ya' ? 'Aktif' : 'Tidak aktif';
              return next;
            }));
          }}
          onSaved={() => {}}
          renderActions={(r) => (
            <span className="flex items-center gap-0.5">
              <Button id={`contoh_excel_lihat_${r.id}`} variant="ghost" size="icon-sm" aria-label={`Lihat ${r.nama}`} title="Lihat">
                <Info size={14} />
              </Button>
              <Button id={`contoh_excel_ubah_${r.id}`} variant="ghost" size="icon-sm" aria-label={`Ubah ${r.nama}`} title="Ubah">
                <Pencil size={14} />
              </Button>
            </span>
          )}
          renderBulkActions={(checked) => (
            <span className="flex items-center gap-1">
              <Button id="contoh_excel_verifikasi" variant="outline" size="sm">
                <Check size={14} /> Verifikasi {checked.length}
              </Button>
            </span>
          )}
          filter={<span className="text-[11px] text-muted-foreground">filter contoh</span>}
          addButton={<Button id="contoh_excel_tambah" size="sm"><Plus size={14} /> Tambah</Button>}
          maxRows={maxRows ? 3 : undefined}
          hideCheckbox={hideCheckbox}
          hideActions={hideActions}
          hidePreset={hidePreset}
          rail={rail}
          onCheckedChange={(r) => setTercentang(r.length)}
          header="Contoh ExcelTable"
          pager={pager ? (
            <Pager page={page} lastPage={1} total={rows.length} onPage={setPage} perPage={perPage} onPerPage={setPerPage} />
          ) : undefined}
        />
      </div>
    </div>
  );
}

/** Daftar area denah (nomor harus sama dengan yang dipakai di <Denah/>). */
const DENAH: AreaDenah[] = [
  { no: 1, nama: 'Area judul', sumber: 'header ?? judulTabel(tableKey)', keterangan: 'Nama tabel. Halaman boleh menimpanya lewat prop header; tanpa itu dipakai kamus judul internal (excel/judul.ts).' },
  { no: 2, nama: 'Info tengah', sumber: 'tengah', keterangan: 'Info ringkas di kanan judul, dibungkus pil. Digerbang sakelar visibilitas toolbar. Belum dipakai halaman mana pun.' },
  { no: 3, nama: 'Filter', sumber: 'filter', keterangan: 'Kontrol filter dari halaman (LabeledCombobox, input cari, dll). Bisa dimatikan per tabel lewat Kelola Tabel → Toolbar.' },
  { no: 4, nama: 'Aksi massal', sumber: 'renderBulkActions(checkedRows, clearSelection)', keterangan: 'Muncul HANYA saat ada baris tercentang. Dipakai 5 halaman.' },
  { no: 5, nama: 'Awalan / akhir toolbar', sumber: 'awalanToolbar / akhirToolbar', keterangan: 'Slot bebas di area kontrol. Tersedia, belum dipakai halaman.' },
  { no: 6, nama: 'Urutkan', sumber: 'onUrut + urutAktif + arahUrut', keterangan: 'Dropdown PresetUrut; opsinya dari endpoint urut-preset. Menyembunyikan diri bila tabel belum punya preset.' },
  { no: 7, nama: 'Kolom', sumber: 'PresetKolom (internal)', keterangan: 'Dropdown preset kolom tampilan (Lengkap / preset tersimpan). Nilai aktif disimpan per pengguna.' },
  { no: 8, nama: 'Tombol aksi utama', sumber: 'addButton + addButtonLangsung', keterangan: 'Tombol aksi halaman. Secara bawaan dibungkus menu hamburger "Aksi" (MenuAksiToolbar) bila lebih dari satu.' },
  { no: 9, nama: 'Rel filter kiri', sumber: 'rail', keterangan: 'FilterRail Tingkat/Kelas di kiri grid, sejajar judul kolom. Maksimal satu per halaman (3 halaman memakainya).' },
  { no: 10, nama: 'Gutter', sumber: 'gutterColumn — GUTTER_W = 36', keterangan: 'Kolom nomor baris. Selalu ada; klik kanannya = menu salin seluruh tabel.' },
  { no: 11, nama: 'Centang + pilih semua', sumber: 'hideCheckbox · CheckAllCell', keterangan: 'Kolom checkbox (CHECK_W = 36) dengan pilih-semua di header. Dimatikan TabelRingkas lewat hideCheckbox.' },
  { no: 12, nama: 'Header kolom', sumber: 'HeaderTitle — geser lebar, AutoFit', keterangan: 'Judul kolom + gagang seret lebar & AutoFit. Perataan dari standar global tabel di server.' },
  { no: 13, nama: 'Sel data', sumber: 'ExcelField.kind: text | select | toggle | static', keterangan: 'Empat jenis sel. static selalu baca-saja (kecuali mode Input + inputKind); toggle & select bisa hidup tanpa mode Ubah (toggleTanpaEdit / selectTanpaEdit). Sel bisa dikunci PER BARIS lewat bolehToggle / bolehSelect. Kolom select memakai Select Radix; `format` (angka/tanggal/ya_tidak) hanya memengaruhi lebar & tampilan, bukan nilai tersimpan. Kartu hover (kartuHover) & renderCell kustom mengganti isi sel statis.' },
  { no: 14, nama: 'Kolom Aksi', sumber: 'renderActions (sticky kanan)', keterangan: 'Judul kolom Aksi, menempel di kanan saat grid digulir horizontal (freeze pane sisi kanan).' },
  { no: 15, nama: 'Aksi per baris', sumber: 'renderActions(row) — ikon Lihat/Ubah/Hapus', keterangan: 'Isi kolom Aksi tiap baris. Bila jumlah aksi > 3, otomatis diganti satu tombol hamburger (aksiRingkas).' },
  { no: 16, nama: 'Paginasi', sumber: 'pager (slot dari halaman)', keterangan: 'ExcelTable TIDAK menghitung jumlah baris/halaman — halaman meng-inject <Pager/>. Dipakai 19 halaman.' },
  { no: 17, nama: 'Pengaturan tampilan (di luar tabel)', sumber: 'TopBar → "Pengaturan tampilan" (pengaturan/SheetPengaturanTampilan.tsx)', keterangan: 'Tinggi sel bawaan & tinggi header, jenis/ukuran/warna huruf + latar untuk HEADER dan SEL — semua GLOBAL. BUKAN lagi tombol di kaki tabel: gerigi footer sudah dihapus, panel ini hanya dibuka dari TopBar.' },
  { no: 18, nama: 'Tinggi baris & lebar isi (di luar tabel)', sumber: 'Kelola Tabel → Umum → "Tampilan di perangkat ini" (kelolaTabel/TabUmum.tsx)', keterangan: 'Stepper "Tinggi baris" 18..240px (bawaan 24px) + tombol ↺, sakelar "Baris ikut isi", dan sakelar "Tabel mengisi lebar" (isiLebarPenuh). Semua pref PERANGKAT, tapi berlaku untuk tabel ini saja. Tombol siklus di kaki tabel & pegangan seret batas baris sudah dihapus.' },
  { no: 19, nama: 'Tambah baris', sumber: 'onCreateRow + setInputMode(true)', keterangan: 'Tampil hanya bila halaman menyediakan onCreateRow (7 halaman). Menyalakan mode Input.' },
  { no: 20, nama: 'Mode Ubah', sumber: 'canEdit (atau onSeretIsi/onSalinBlok/onTempelBlok) + setModeUbah(true)', keterangan: 'Sakelar tunggal untuk editing sel + manipulasi tabel. Tampil bila tabel writable (canEdit) ATAU punya fitur blok. Saat menyala, bilah pil mengangkat dua sakelar gestur: "Seret isi sel untuk copy/move" dan "Geser judul kolom" (mati sendiri bila tabel mengisi lebar). Ctrl/Cmd+C & V untuk salin/tempel blok. Mode Ubah & Input saling eksklusif; Esc keluar.' },
  { no: 21, nama: 'Gerigi "Pengaturan tabel"', sumber: 'tombolPengaturanTampil (excel/JudulTabel.tsx:198)', keterangan: 'Tombol terlihat di ujung paling kanan bilah judul — pintu utama dialog Kelola Tabel dari tabel ini. Sama-sama ada dengan item "Kelola Tabel" di menu klik kanan bilah judul; hidangkan hanya untuk super_admin efektif. Sakelar visibilitas `tombol_pengaturan` bisa mematikannya.' },
];

/** Isi tab "ExcelTable": denah, inventaris fitur, lalu contoh hidup. */
export default function TabExcelTable() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-2">
      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">1. Denah ExcelTable</h2>
        <p className="text-xs text-muted-foreground">
          Susunan tiga bagian komponen beserta area di dalamnya. Klik angka untuk melihat prop/Komponen sumbernya.
        </p>
        <Denah areas={DENAH} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">2. Di mana pengaturannya?</h2>
        <p className="text-xs text-muted-foreground">
          Ada <strong>lima jalan masuk</strong> ke pengaturan tabel — salah satunya membuka
          gerigi yang membawa dialog, dua di antaranya modal & non-modal dari dialog yang sama.
          Yang paling terlupakan: pengaturan tidak hanya di footer.
        </p>
      </div>
      <TabelPengaturan baris={PENGATURAN} kolomTempat="Jalan masuk" />
        <div className="flex flex-col gap-1 pl-2">
          <p className="text-[11px] font-semibold text-muted-foreground">
            Isi dialog "Kelola Tabel" — 4 tab:
          </p>
          <TabelPengaturan baris={TAB_KELOLA} kolomTempat="Tab" />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">3. Cakupan pengaturan: global / halaman / tabel</h2>
          <p className="text-xs text-muted-foreground">
            Klasifikasi tiap pengaturan menurut luas berlakunya — inilah sumber kebingungan
            terbesar: kontrol yang tampak sama bisa berlaku sangat berbeda.
          </p>
        </div>
        <BlokCakupan />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">4. Sumbu klasifikasi lain (selain cakupan)</h2>
          <p className="text-xs text-muted-foreground">
            Cakupan (global/halaman/tabel) bukan satu-satunya cara mengelompokkan pengaturan.
            Lima sumbu berikut menjawab pertanyaan yang berbeda.
          </p>
        </div>
        <BlokSumbu />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">5. Sumbu mana yang perlu ditampilkan visual?</h2>
          <p className="text-xs text-muted-foreground">
            Tidak semua sumbu layak memenuhi layar. Yang perlu ditampilkan adalah yang
            salah pahamnya berakibat <em>senyap</em> dan sulit dibatalkan.
          </p>
        </div>
        <BlokVisual />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">6. Usulan bentuk pengaturan: 3 rumah, 1 pintu masing-masing</h2>
          <p className="text-xs text-muted-foreground">
            Pemisahan global / halaman / tabel hanya berguna bila tiap setelan punya
            <strong> satu</strong> tempat mengaturnya. Inilah bentuk yang saya usulkan.
          </p>
        </div>
        <BlokUsulan />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">7. Bentuk rumah GLOBAL: halaman, panel, menu, atau dialog?</h2>
          <p className="text-xs text-muted-foreground">
            Lima pilihan bentuk untuk menampung pengaturan global, dengan kelemahan masing-masing.
          </p>
        </div>
        <BlokBentukGlobal />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">8. Klasifikasi lengkap: mana ke mana</h2>
          <p className="text-xs text-muted-foreground">
            Inventaris <strong>seluruh</strong> pengaturan yang menyentuh ExcelTable, berikut
            kunci penyimpanannya sebagai bukti dan rumah yang seharusnya.
          </p>
        </div>
        <BlokKlasifikasiLengkap />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">9. Rekomendasi perbaikan</h2>
          <p className="text-xs text-muted-foreground">
            Temuan dari pemetaan di atas — hal yang membingungkan di pengaturan tabel,
            beserta bukti kode dan usulannya.
          </p>
        </div>
        <BlokRekomendasi />
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">10. Inventaris fitur</h2>
        <p className="text-xs text-muted-foreground">
          Seluruh fitur yang sudah tertanam di ExcelTable, prop pengendalinya, dan seberapa luas dipakai.
          Kolom "Dipakai" terakhir diperiksa 2026-10-19 (cara periksa ada di catatan kepala berkas).
        </p>
        <TabelInventaris />
      </section>

      <section className="flex flex-col gap-1 pb-2">
        <h2 className="text-sm font-semibold">11. Contoh hidup</h2>
        <p className="text-xs text-muted-foreground">
          ExcelTable sungguhan dengan data contoh. Nyalakan sakelar untuk melihat pengaruh tiap prop opsional.
        </p>
        <ContohHidup />
      </section>
    </div>
  );
}

<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ToolbarPresetHapusRequest;
use App\Http\Requests\Admin\ToolbarPresetIndexRequest;
use App\Http\Requests\Admin\ToolbarPresetSimpanRequest;
use App\Models\ToolbarPreset;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

/**
 * Setelan TABEL per `table_key` (satu baris): visibilitas kontrol toolbar,
 * urutan kolom, perataan kolom, dan label kolom. Baca bebas (semua admin,
 * agar semua peramban merender sama); semuanya ditulis super_admin.
 *
 * Perataan DAN label sengaja per TABEL, bukan per preset: yang berubah saat
 * preset berganti hanyalah kolom mana yang TAMPIL, sedangkan cara kolom
 * dinamai & diratakan tidak ikut berubah.
 *
 * Ukuran kotak kontrol (tinggi/lebar/label/kontrol), warna label, nilai awal
 * combobox, dan tipe input TIDAK lagi lewat endpoint ini: semuanya milik
 * komponen dan disimpan di `KomponenCustomController` (tabel `komponen_custom`).
 */
class ToolbarPresetController extends Controller
{
    /** Kunci visibilitas yang dikenal frontend (di luar ini ditolak).
     *
     *  Peta ini dipakai DUA fitur di sisi FE yang berbagi satu kolom JSON:
     *  - Filter toolbar → `filterTabel.ts` (`KunciFilterToolbar`):
     *    `cari`, `urutan`, `kolom`, `keaktifan`.
     *  - Visibilitas bagian tabel → `bagianTabel.ts` (`KunciBagianTabel`):
     *    `bilah_judul`, `info_tengah`, `header_kolom`, `rel_filter`, `kaki_tabel`.
     *
     *  Kunci versi lama (`info`, `urut`, `filter`) sengaja DIJAGA: pembacaan
     *  memetakan utuh isi kolom ke FE, dan saat menulis FE melakukan MERGE di
     *  atas peta server — jadi kunci lama yang masih tersimpan ikut terkirim.
     *  Kalau tidak ada di daftar ini, satu penanda lama membuat setiap
     *  penyimpanan tabel tersebut ditolak 422 selamanya.
     */
    public const KUNCI = [
        // Versi lama (tetap dibaca & ditulis, tapi tak lagi dihasilkan FE).
        'info',
        'urut',
        'filter',
        // Filter toolbar tabel.
        'cari',
        'urutan',
        'kolom',
        'keaktifan',
        // Visibilitas bagian tabel (tab Umum Kelola Tabel).
        'bilah_judul',
        'info_tengah',
        'header_kolom',
        'rel_filter',
        'kaki_tabel',
    ];

    /** Setelan yang dulu diterima endpoint ini; kini milik komponen
     *  (`komponen_custom`) dan DITOLAK dengan pesan yang menunjuk ke sana
     *  (lihat migrasi `pindahkan_setelan_komponen_dari_toolbar_preset` dan
     *  `pindahkan_lebar_urut_kolom_ke_komponen_custom`). */
    public const SETELAN_KOMPONEN_PINDAH = ['lebar', 'tinggi', 'nilai_default'];

    /** GET /api/admin/toolbar-preset?table_key=santri */
    public function index(ToolbarPresetIndexRequest $request): JsonResponse
    {
        $data = $request->validated();

        $row = ToolbarPreset::where('table_key', $data['table_key'])->first();

        return response()->json([
            'pesan' => 'Setelan toolbar dimuat.',
            'data' => [
                'table_key' => $data['table_key'],
                'visibilitas' => $row?->visibilitas ?? [],
                // Peta lama: masih dikembalikan agar klien lama tak rusak,
                // tapi sudah kosong sejak migrasi ke `komponen_custom`.
                'lebar' => $row?->lebar ?? [],
                'tinggi' => $row?->tinggi ?? [],
                'urutan' => $row?->urutan ?? [],
                'align' => $row?->align ?? [],
                // Label kolom per TABEL (bukan per preset): tetap walau preset
                // berganti, sejalan dengan `align`.
                'label' => $row?->label ?? [],
                'nilai_default' => $row?->nilai_default ?? [],
            ],
        ]);
    }

    /** PUT /api/admin/toolbar-preset — upsert gabung: hanya kunci yang
     *  dikirim yang ditimpa (visibilitas/urutan/align independen). */
    public function simpan(ToolbarPresetSimpanRequest $request): JsonResponse
    {
        $data = $request->validated();

        /* Ukuran kotak & nilai awal komponen sudah pindah ke
           `KomponenCustomController` (tabel `komponen_custom`): endpoint ini
           hanya menyimpan apa yang milik tabel. Cek ini duluan supaya pesannya
           tepat (bukan "kirim minimal satu setelan"). */
        foreach (self::SETELAN_KOMPONEN_PINDAH as $kunci) {
            if (array_key_exists($kunci, $data)) {
                throw ValidationException::withMessages([
                    $kunci => 'Ukuran & nilai awal komponen kini milik komponen (tabel komponen_custom), bukan tabel.',
                ]);
            }
        }

        if (! array_key_exists('visibilitas', $data) && ! array_key_exists('urutan', $data) && ! array_key_exists('align', $data) && ! array_key_exists('label', $data)) {
            throw ValidationException::withMessages([
                'table_key' => 'Kirim minimal satu dari visibilitas, urutan, align, atau label.',
            ]);
        }

        // Hanya setelan TABEL yang boleh ditulis, dan semuanya khusus
        // super_admin (visibilitas/urutan/perataan dikelola dari dialog Kelola
        // Tabel; setelan komponen lewat `komponen-custom`).
        if (! $request->user()->bolehSuperAdmin()) {
            abort(403, 'Setelan tabel hanya dapat diubah super_admin.');
        }

        $row = ToolbarPreset::firstOrNew(['table_key' => $data['table_key']]);

        // Kolom visibilitas NOT NULL: baris baru tanpa visibilitas = semua tampil.
        if ($row->visibilitas === null) {
            $row->visibilitas = [];
        }

        if (array_key_exists('visibilitas', $data)) {
            $normal = [];
            foreach ($data['visibilitas'] as $kunci => $nilai) {
                if (! in_array($kunci, self::KUNCI, true)) {
                    throw ValidationException::withMessages([
                        'visibilitas' => "Kunci kontrol \"{$kunci}\" tidak dikenal.",
                    ]);
                }
                $normal[$kunci] = (bool) $nilai;
            }
            $row->visibilitas = $normal;
        }

        if (array_key_exists('urutan', $data)) {
            $urutan = [];
            foreach ($data['urutan'] as $kunci) {
                $kunci = strtolower(trim((string) $kunci));
                if ($kunci !== '' && ! in_array($kunci, $urutan, true)) {
                    $urutan[] = $kunci;
                }
            }
            $row->urutan = $urutan === [] ? null : $urutan;
        }

        if (array_key_exists('align', $data)) {
            $align = [];
            foreach ($data['align'] as $kunci => $nilai) {
                if (preg_match('/^[a-z0-9_]{1,60}$/', (string) $kunci) !== 1) {
                    throw ValidationException::withMessages([
                        'align' => "Kunci perataan \"{$kunci}\" tidak dikenal.",
                    ]);
                }
                $align[$kunci] = $nilai;
            }
            $row->align = $align === [] ? null : $align;
        }

        if (array_key_exists('label', $data)) {
            $label = [];
            foreach ($data['label'] as $kunci => $nilai) {
                if (preg_match('/^[a-z0-9_]{1,60}$/', (string) $kunci) !== 1) {
                    throw ValidationException::withMessages([
                        'label' => "Kunci label \"{$kunci}\" tidak dikenal.",
                    ]);
                }
                // Label kosong = hapus override (kembali ke label bawaan kode).
                $teks = trim((string) $nilai);
                if ($teks !== '') {
                    $label[$kunci] = mb_substr($teks, 0, 100);
                }
            }
            $row->label = $label === [] ? null : $label;
        }

        $row->dibuat_oleh = $request->user()->id;
        $row->save();

        return response()->json(['pesan' => 'Setelan tabel disimpan.', 'data' => $row]);
    }

    /** DELETE /api/admin/toolbar-preset?table_key=santri — kembali tampil semua. */
    public function hapus(ToolbarPresetHapusRequest $request): JsonResponse
    {
        $data = $request->validated();

        ToolbarPreset::where('table_key', $data['table_key'])->delete();

        return response()->json(['pesan' => 'Setelan toolbar dikembalikan ke bawaan (semua tampil).']);
    }
}

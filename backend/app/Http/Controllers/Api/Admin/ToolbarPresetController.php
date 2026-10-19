<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ToolbarPresetHapusRequest;
use App\Http\Requests\Admin\ToolbarPresetIndexRequest;
use App\Http\Requests\Admin\ToolbarPresetSimpanRequest;
use App\Models\ToolbarPreset;
use App\Support\HtmlInfo;
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
 * Info tabel (`info_html`) juga per `table_key` dan dibaca semua pengguna,
 * ditulis super_admin — sama seperti judul: isinya cuma keterangan tabel,
 * bukan setelan yang boleh berbeda antar pengguna.
 *
 * Ukuran kotak kontrol (tinggi/lebar/label/kontrol), warna label, nilai awal
 * combobox, dan tipe input TIDAK lagi lewat endpoint ini: semuanya milik
 * komponen dan disimpan di `KomponenCustomController` (tabel `komponen_custom`).
 */
class ToolbarPresetController extends Controller
{
    /** Kunci visibilitas yang dikenal frontend (di luar ini ditolak).
     *
     *  Satu peta JSON dipakai FE untuk sakelar VISIBILITAS KOMPONEN TABEL
     *  (registri `components/excel/komponenTabel.ts`, section "Visibilitas
     *  komponen tabel" di tab Umum Kelola Tabel):
     *  - Bilah judul: judul_tabel, info_tengah, filter, cari, keaktifan,
     *    urut, kolom, tombol_aksi, tombol_pengaturan.
     *  - Kepala tabel: header_kolom, rel_filter.
     *  - Kaki tabel: pager, tombol_tambah, tombol_edit.
     *
     *  Kunci lama (`info`, `urut`, `bilah_judul`, `kaki_tabel`,
     *  `tombol_tinggi_baris`) SENGAJA DIJAGA meski tak lagi dihasilkan FE:
     *  pembacaan memetakan utuh isi kolom ke FE, dan saat menulis FE melakukan
     *  MERGE di atas peta server — kunci lama yang masih tersimpan ikut
     *  terkirim. Kalau ditutup, satu penanda lama membuat setiap penyimpanan
     *  tabel tersebut ditolak 422 selamanya. `tombol_tinggi_baris` berasal dari
     *  tombol tinggi baris di kaki tabel yang kini sudah dihapus (tinggi baris
     *  diatur di Kelola Tabel → Umum).
     */
    public const KUNCI = [

        'info',
        'urut',
        'bilah_judul',
        'kaki_tabel',

        'judul_tabel',
        'info_tengah',
        'filter',
        'cari',
        'keaktifan',
        'urutan',
        'kolom',
        'tombol_aksi',
        'tombol_pengaturan',

        'header_kolom',
        'rel_filter',

        'kolom_centang',
        'kolom_aksi',

        'pager',
        'tombol_tambah',
        'tombol_edit',
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

                'lebar' => $row?->lebar ?? [],
                'tinggi' => $row?->tinggi ?? [],
                'urutan' => $row?->urutan ?? [],
                'align' => $row?->align ?? [],

                'label' => $row?->label ?? [],

                'judul' => $row?->judul,

                'info_html' => $row?->info_html,
                'nilai_default' => $row?->nilai_default ?? [],
            ],
        ]);
    }

    /** PUT /api/admin/toolbar-preset — upsert gabung: hanya kunci yang
     *  dikirim yang ditimpa (visibilitas/urutan/align independen). */
    public function simpan(ToolbarPresetSimpanRequest $request): JsonResponse
    {
        $data = $request->validated();

        foreach (self::SETELAN_KOMPONEN_PINDAH as $kunci) {
            if (array_key_exists($kunci, $data)) {
                throw ValidationException::withMessages([
                    $kunci => 'Ukuran & nilai awal komponen kini milik komponen (tabel komponen_custom), bukan tabel.',
                ]);
            }
        }

        if (! array_key_exists('visibilitas', $data) && ! array_key_exists('urutan', $data) && ! array_key_exists('align', $data) && ! array_key_exists('label', $data) && ! array_key_exists('judul', $data) && ! array_key_exists('info_html', $data)) {
            throw ValidationException::withMessages([
                'table_key' => 'Kirim minimal satu dari visibilitas, urutan, align, label, judul, atau info_html.',
            ]);
        }

        if (! $request->user()->bolehSuperAdmin()) {
            abort(403, 'Setelan tabel hanya dapat diubah super_admin.');
        }

        $row = ToolbarPreset::firstOrNew(['table_key' => $data['table_key']]);

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

                $teks = trim((string) $nilai);
                if ($teks !== '') {
                    $label[$kunci] = mb_substr($teks, 0, 100);
                }
            }
            $row->label = $label === [] ? null : $label;
        }

        if (array_key_exists('info_html', $data)) {
            $row->info_html = HtmlInfo::bersihkan($data['info_html']);
        }

        if (array_key_exists('judul', $data)) {

            $teks = trim((string) $data['judul']);
            $row->judul = $teks === '' ? null : mb_substr($teks, 0, 100);
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

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
 * Visibilitas & ukuran kontrol toolbar generik, GLOBAL per `table_key`
 * (satu baris = peta kontrol → boolean/px). Baca bebas (semua admin, agar
 * semua peramban merender sama). Visibilitas tetap khusus super_admin;
 * LEBAR/TINGGI kotak kontrol boleh ditulis semua pengguna karena diatur
 * langsung dari popover klik-kanan combobox.
 */
class ToolbarPresetController extends Controller
{
    /** Kunci kontrol yang dikenal frontend (di luar ini ditolak).
     *  Kotak cari tidak ada lagi (pencarian tunggal di topBar). */
    public const KUNCI = ['info', 'urut', 'kolom', 'filter'];

    /** Kunci kontrol yang punya pengaturan ukuran (lebar & tinggi, px). */
    public const KUNCI_UKURAN = ['urut', 'kolom'];

    /** Sufiks lebar label/kontrol terkunci di peta `lebar` + batas atasnya
     *  (batas bawah 40px ikut aturan `lebar.*`; selaras frontend). */
    public const SUFIKS_UKURAN = ['label' => 400, 'kontrol' => 1200];

    /** Normalisasi peta ukuran (lebar/tinggi): hanya kunci kontrol yang
     *  dikenal — `urut`, `kolom`, atau `filter.<htmlFor>` — yang diterima;
     *  peta kosong disimpan sebagai NULL (kembali ke bawaan komponen).
     *  Peta `lebar` juga menerima kunci sufiks `<kunci>.label` /
     *  `<kunci>.kontrol` untuk lebar label & kontrol yang dikunci terpisah
     *  dari popover klik-kanan combobox. */
    private static function normalisasiUkuran(array $peta, string $nama): ?array
    {
        $hasil = [];
        foreach ($peta as $kunci => $nilai) {
            $kunci = (string) $kunci;
            $sufiks = null;
            $dasar = $kunci;
            if ($nama === 'lebar' && preg_match('/^(.*)\.(label|kontrol)$/', $kunci, $m) === 1) {
                $dasar = $m[1];
                $sufiks = $m[2];
            }
            $isFilter = preg_match('/^filter\.[a-z0-9_]{1,60}$/', $dasar) === 1;
            if (! in_array($dasar, self::KUNCI_UKURAN, true) && ! $isFilter) {
                throw ValidationException::withMessages([
                    $nama => "Kunci {$nama} \"{$kunci}\" tidak dikenal.",
                ]);
            }
            $nilai = (int) $nilai;
            if ($sufiks !== null && $nilai > self::SUFIKS_UKURAN[$sufiks]) {
                throw ValidationException::withMessages([
                    "{$nama}.{$kunci}" => "Lebar {$sufiks} \"{$kunci}\" maksimal ".self::SUFIKS_UKURAN[$sufiks].'px.',
                ]);
            }
            $hasil[$kunci] = $nilai;
        }

        return $hasil === [] ? null : $hasil;
    }

    /** GET /api/admin/toolbar-preset?table_key=santri */
    public function index(ToolbarPresetIndexRequest $request): JsonResponse
    {
        $data = $request->validated();

        $row = ToolbarPreset::where('table_key', $data['table_key'])->first();

        return response()->json([
            'pesan' => 'Visibilitas toolbar dimuat.',
            'data' => [
                'table_key' => $data['table_key'],
                'visibilitas' => $row?->visibilitas ?? [],
                'lebar' => $row?->lebar ?? [],
                'tinggi' => $row?->tinggi ?? [],
                'urutan' => $row?->urutan ?? [],
                'align' => $row?->align ?? [],
            ],
        ]);
    }

    /** PUT /api/admin/toolbar-preset — upsert gabung: hanya kunci yang
     *  dikirim yang ditimpa (visibilitas/lebar/urutan/align independen). */
    public function simpan(ToolbarPresetSimpanRequest $request): JsonResponse
    {
        $data = $request->validated();

        if (! array_key_exists('visibilitas', $data) && ! array_key_exists('lebar', $data) && ! array_key_exists('tinggi', $data) && ! array_key_exists('urutan', $data) && ! array_key_exists('align', $data)) {
            throw ValidationException::withMessages([
                'table_key' => 'Kirim minimal satu dari visibilitas, lebar, tinggi, urutan, atau align.',
            ]);
        }

        // Hanya LEBAR/TINGGI kotak kontrol yang dibuka untuk semua pengguna
        // (diatur dari popover klik-kanan combobox). Visibilitas, urutan
        // kolom, dan perataan tetap khusus super_admin.
        $khususSuperAdmin = array_intersect(['visibilitas', 'urutan', 'align'], array_keys($data));
        if ($khususSuperAdmin !== [] && ! $request->user()->bolehSuperAdmin()) {
            abort(403, 'Hanya ukuran (lebar/tinggi) kotak kontrol yang dapat diubah pengguna biasa.');
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

        if (array_key_exists('lebar', $data)) {
            $row->lebar = self::normalisasiUkuran($data['lebar'], 'lebar');
        }

        if (array_key_exists('tinggi', $data)) {
            $row->tinggi = self::normalisasiUkuran($data['tinggi'], 'tinggi');
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

        $row->dibuat_oleh = $request->user()->id;
        $row->save();

        return response()->json(['pesan' => 'Toolbar disimpan.', 'data' => $row]);
    }

    /** DELETE /api/admin/toolbar-preset?table_key=santri — kembali tampil semua. */
    public function hapus(ToolbarPresetHapusRequest $request): JsonResponse
    {
        $data = $request->validated();

        ToolbarPreset::where('table_key', $data['table_key'])->delete();

        return response()->json(['pesan' => 'Visibilitas toolbar dikembalikan ke bawaan (semua tampil).']);
    }
}

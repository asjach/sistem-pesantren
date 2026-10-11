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
     *  (batas bawah 40px untuk semua jenis; selaras frontend). */
    public const SUFIKS_UKURAN = ['label' => 400, 'kontrol' => 1200];

    /** Sufiks penanda boolean di peta `lebar` (`0`/`1`): label mengembang
     *  dan label transparan. */
    public const SUFIKS_PENANDA = ['expand', 'labeltransparan'];

    /** Normalisasi peta ukuran (lebar/tinggi): hanya kunci kontrol yang
     *  dikenal — `urut`, `kolom`, atau `filter.<htmlFor>` — yang diterima;
     *  peta kosong disimpan sebagai NULL (kembali ke bawaan komponen).
     *  Peta `lebar` juga menerima kunci sufiks `<kunci>.label` /
     *  `<kunci>.kontrol` (lebar terkunci, 40px sampai batas sufiks) dan
     *  penanda `<kunci>.expand` / `<kunci>.labeltransparan` (= 1) dari
     *  popover klik-kanan combobox. Rentang per jenis kunci dijaga di sini
     *  agar kunci galatnya tetap `lebar.<kunci>`. */
    private static function normalisasiUkuran(array $peta, string $nama): ?array
    {
        $hasil = [];
        foreach ($peta as $kunci => $nilai) {
            $kunci = (string) $kunci;
            $sufiks = null;
            $dasar = $kunci;
            if ($nama === 'lebar' && preg_match('/^(.*)\.(label|kontrol|expand|labeltransparan)$/', $kunci, $m) === 1) {
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
            if (in_array($sufiks, self::SUFIKS_PENANDA, true)) {
                if (! in_array($nilai, [0, 1], true)) {
                    throw ValidationException::withMessages([
                        "{$nama}.{$kunci}" => "Penanda \"{$kunci}\" harus 0 atau 1.",
                    ]);
                }
            } elseif ($nama === 'lebar') {
                // Rentang peta `tinggi` dijaga aturan request (`tinggi.*`).
                $maks = $sufiks === null ? 1200 : self::SUFIKS_UKURAN[$sufiks];
                if ($nilai < 40 || $nilai > $maks) {
                    throw ValidationException::withMessages([
                        "{$nama}.{$kunci}" => "Lebar \"{$kunci}\" harus 40–{$maks}px.",
                    ]);
                }
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
                'nilai_default' => $row?->nilai_default ?? [],
            ],
        ]);
    }

    /** PUT /api/admin/toolbar-preset — upsert gabung: hanya kunci yang
     *  dikirim yang ditimpa (visibilitas/lebar/urutan/align independen). */
    public function simpan(ToolbarPresetSimpanRequest $request): JsonResponse
    {
        $data = $request->validated();

        if (! array_key_exists('visibilitas', $data) && ! array_key_exists('lebar', $data) && ! array_key_exists('tinggi', $data) && ! array_key_exists('nilai_default', $data) && ! array_key_exists('urutan', $data) && ! array_key_exists('align', $data)) {
            throw ValidationException::withMessages([
                'table_key' => 'Kirim minimal satu dari visibilitas, lebar, tinggi, nilai_default, urutan, atau align.',
            ]);
        }

        // Hanya LEBAR/TINGGI/NILAI AWAL kotak kontrol yang dibuka untuk semua
        // pengguna (diatur dari popover klik-kanan combobox). Visibilitas,
        // urutan kolom, dan perataan tetap khusus super_admin.
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

        if (array_key_exists('nilai_default', $data)) {
            $nilaiAwal = [];
            foreach ($data['nilai_default'] as $kunci => $nilai) {
                $kunci = (string) $kunci;
                $isFilter = preg_match('/^filter\.[a-z0-9_]{1,60}$/', $kunci) === 1;
                if (! in_array($kunci, self::KUNCI_UKURAN, true) && ! $isFilter) {
                    throw ValidationException::withMessages([
                        'nilai_default' => "Kunci nilai default \"{$kunci}\" tidak dikenal.",
                    ]);
                }
                $teks = trim((string) $nilai);
                if ($teks === '') {
                    continue;
                }
                $nilaiAwal[$kunci] = mb_substr($teks, 0, 100);
            }
            $row->nilai_default = $nilaiAwal === [] ? null : $nilaiAwal;
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

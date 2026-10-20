<?php

namespace App\Services;

use App\Models\Papan\PapanButir;
use App\Models\Papan\PapanItem;
use App\Models\Papan\PapanModul;
use App\Models\Papan\PapanRiwayat;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Operasi baca-tulis papan perkembangan proyek (koneksi `papan`).
 *
 * Satu pintu supaya aturan berikut berlaku di semua jalur (command artisan
 * maupun API):
 * - status hanya boleh salah satu dari {@see self::STATUS};
 * - status yang BERARTI ada di POIN (butir), bukan di sub-modul;
 * - status sub-modul adalah TURUNAN dari poin-poinnya, bukan kolom tersendiri;
 * - perpindahan status selalu meninggalkan jejak di `papan_riwayat`;
 * - kode sub-modul (mis. "E.3") unik per modul.
 *
 * Catatan model: sub-modul sengaja TIDAK menyimpan statusnya sendiri. Kalau
 * status ada di dua tempat, keduanya bisa saling bertentangan (sub-modul
 * bilang "sudah" padahal masih ada poin "akan"), dan tidak jelas mana yang
 * benar. Dengan hanya poin yang berstatus, papan selalu konsisten.
 */
class PapanService
{
    public const STATUS = ['sudah', 'sedang', 'akan', 'ditunda'];

    /** Aplikasi klien pada Board; urutan di sini = urutan tab horizontal. */
    public const APLIKASI = [
        'desktop-admin' => 'Desktop Admin',
        'mobile-orang-tua' => 'Mobile Orang Tua',
        'mobile-guru' => 'Mobile Guru',
        'mobile-pimpinan' => 'Mobile Pimpinan',
        'mobile-kasir' => 'Mobile Kasir',
        'landing-pesantren' => 'Landing Page Pesantren',
    ];

    /**
     * Status sub-modul yang DITURUNKAN dari status poin-poinnya.
     *
     * Aturannya, berurutan:
     * 1. belum punya poin        -> `akan` (belum dikerjakan);
     * 2. ada poin `sedang`        -> `sedang` (sedang berjalan);
     * 3. ada poin `akan`          -> `akan` (masih ada sisa);
     * 4. ada poin `ditunda`       -> `ditunda` (ada bagian yang ditunda);
     * 5. selain itu (semua sudah) -> `sudah`.
     *
     * Urutan ini penting: satu poin `akan` saja sudah membuat sub-modul
     * tidak dianggap selesai, walau mayoritas poinnya `sudah`.
     *
     * @param  array<int, array<string, mixed>>  $butir
     */
    public static function statusTurunan(array $butir): string
    {
        if ($butir === []) {
            return 'akan';
        }

        $ada = array_count_values(array_map(fn (array $b) => (string) $b['status'], $butir));

        if (($ada['sedang'] ?? 0) > 0) {
            return 'sedang';
        }

        if (($ada['akan'] ?? 0) > 0) {
            return 'akan';
        }

        if (($ada['ditunda'] ?? 0) > 0) {
            return 'ditunda';
        }

        return 'sudah';
    }

    /**
     * Ringkasan seluruh papan: modul -> sub-modul -> butir.
     *
     * Status sub-modul di sini adalah hasil turunan, bukan kolom database.
     *
     * @return array<int, array<string, mixed>>
     */
    public function semua(): array
    {
        return PapanModul::query()
            ->with(['item.butir'])
            ->orderBy('urutan')
            ->get()
            ->map(fn (PapanModul $m) => [
                'kode' => $m->kode,
                'nama' => $m->nama,
                'aplikasi' => $m->aplikasi,
                'urut' => (int) $m->urutan,
                'catatan' => $m->catatan,
                'sub' => $m->item->map(function (PapanItem $i) {
                    $butir = $i->butir->map(fn (PapanButir $b) => [
                        'id' => $b->id,
                        'status' => $b->status,
                        'deskripsi' => $b->deskripsi,
                        'subpoin' => $b->subpoin ?? [],
                    ])->all();

                    return [
                        'kode' => $i->kode,
                        'nama' => $i->nama,
                        'status' => self::statusTurunan($butir),
                        'rujukan' => $i->rujukan,
                        'butir' => $butir,
                    ];
                })->all(),
            ])
            ->all();
    }

    /**
     * Seluruh modul dikelompokkan per aplikasi, urut sesuai tab.
     *
     * @return array<int, array{kode: string, nama: string, modul: array<int, array<string, mixed>>}>
     */
    public function semuaAplikasi(): array
    {
        $hasil = [];

        foreach (self::APLIKASI as $kode => $nama) {
            $hasil[$kode] = ['kode' => $kode, 'nama' => $nama, 'modul' => []];
        }

        foreach ($this->semua() as $modul) {
            $hasil[$modul['aplikasi']]['modul'][] = $modul;
        }

        return array_values($hasil);
    }

    /**
     * Status timeline: hanya saat `Aktif` Board boleh dipakai sebagai rujukan.
     */
    public function timelineAktif(): bool
    {
        $baris = DB::connection('papan')
            ->table('papan_pengaturan')
            ->where('kunci', 'timeline_aktif')
            ->first();

        return $baris !== null && (string) $baris->nilai === '1';
    }

    public function setTimelineAktif(bool $aktif): void
    {
        DB::connection('papan')->table('papan_pengaturan')->updateOrInsert(
            ['kunci' => 'timeline_aktif'],
            ['nilai' => $aktif ? '1' : '0'],
        );
    }

    /**
     * Cari sub-modul lewat kodenya (mis. "E.3").
     *
     * @throws InvalidArgumentException bila kode tidak dikenal
     */
    public function item(string $kode): PapanItem
    {
        $item = PapanItem::query()->with(['modul', 'butir'])->where('kode', $kode)->first();

        if ($item === null) {
            $tersedia = PapanItem::query()->orderBy('kode')->pluck('kode')->implode(', ');

            throw new InvalidArgumentException(
                "Sub-modul `{$kode}` tidak ada. Yang tersedia: {$tersedia}."
            );
        }

        return $item;
    }

    /**
     * Cari satu poin (butir) lewat id-nya, sekaligus sub-modul induknya.
     *
     * @return array{butir: PapanButir, item: PapanItem}
     *
     * @throws InvalidArgumentException bila kode sub-modul atau id poin tidak ada
     */
    public function butir(string $kode, int $butirId): array
    {
        $item = $this->item($kode);

        $butir = PapanButir::query()
            ->where('item_id', $item->id)
            ->where('id', $butirId)
            ->first();

        if ($butir === null) {
            throw new InvalidArgumentException(
                "Poin `#{$butirId}` tidak ada di sub-modul `{$kode}`."
            );
        }

        return ['butir' => $butir, 'item' => $item];
    }

    /**
     * Pindahkan status sebuah POIN dan catat jejaknya.
     *
     * Ini satu-satunya operasi yang mengubah status: sub-modul mengikuti
     * secara turunan, jadi tidak ada yang perlu disinkronkan manual.
     *
     * @param  string  $kode  kode sub-modul induk, mis. "E.3"
     * @param  int  $butirId  id poin
     * @param  string  $status  salah satu {@see self::STATUS}
     * @param  string  $oleh  pencatat: `agent` atau `pengguna`
     * @param  string|null  $catatan  alasan singkat perpindahan
     *
     * @throws InvalidArgumentException bila status, kode, atau id tidak sah
     */
    public function pindahButir(
        string $kode,
        int $butirId,
        string $status,
        string $oleh = 'agent',
        ?string $catatan = null,
    ): PapanButir {
        $this->pastikanStatus($status);

        ['butir' => $butir, 'item' => $item] = $this->butir($kode, $butirId);
        $asal = $butir->status;

        if ($status === 'sudah' && ! self::semuaSubpoinSelesai($butir->subpoin ?? [])) {
            throw ValidationException::withMessages([
                'status' => 'Selesaikan semua subpoin sebelum menandai poin sudah.',
            ]);
        }

        if ($asal === $status && $catatan === null) {
            return $butir;
        }

        DB::connection('papan')->transaction(function () use ($butir, $item, $asal, $status, $oleh, $catatan) {
            $butir->update(['status' => $status]);

            PapanRiwayat::create([
                'item_id' => $item->id,
                'butir_id' => $butir->id,
                'dari_status' => $asal,
                'ke_status' => $status,
                'catatan' => $catatan,
                'diubah_oleh' => $oleh,
                'waktu' => now(),
            ]);
        });

        return $butir->refresh();
    }

    /**
     * Tambah poin di bawah sebuah sub-modul.
     *
     * @param  string  $status  status poin, salah satu {@see self::STATUS}
     */
    public function tambahButir(string $kode, string $status, string $deskripsi, array $subpoin = []): PapanButir
    {
        $this->pastikanStatus($status);

        $subpoin = self::normalisasiSubpoin($subpoin);

        if ($status === 'sudah' && ! self::semuaSubpoinSelesai($subpoin)) {
            throw ValidationException::withMessages([
                'status' => 'Selesaikan semua subpoin sebelum menandai poin sudah.',
            ]);
        }

        $item = $this->item($kode);

        $urutan = (int) PapanButir::query()->where('item_id', $item->id)->max('urutan');

        return PapanButir::create([
            'item_id' => $item->id,
            'status' => $status,
            'deskripsi' => $deskripsi,
            'subpoin' => $subpoin,
            'urutan' => $urutan + 1,
        ]);
    }

    /**
     * Hapus satu poin milik sebuah sub-modul.
     *
     * @return bool true bila terhapus, false bila tidak ada / bukan milik kode itu
     */
    public function hapusButir(string $kode, int $butirId): bool
    {
        $item = $this->item($kode);

        return PapanButir::query()
            ->where('item_id', $item->id)
            ->where('id', $butirId)
            ->delete() > 0;
    }

    /**
     * Riwayat perpindahan status POIN, terbaru lebih dulu.
     *
     * @return array<int, array<string, mixed>>
     */
    public function riwayat(?string $kode = null, int $batas = 20): array
    {
        return PapanRiwayat::query()
            ->with(['item', 'butir'])
            ->when($kode !== null, fn ($q) => $q->whereHas('item', fn ($w) => $w->where('kode', $kode)))
            ->orderByDesc('waktu')
            ->orderByDesc('id')
            ->limit($batas)
            ->get()
            ->map(fn (PapanRiwayat $r) => [
                'kode' => $r->item?->kode,
                'butir' => $r->butir?->deskripsi,
                'dari' => $r->dari_status,
                'ke' => $r->ke_status,
                'catatan' => $r->catatan,
                'oleh' => $r->diubah_oleh,
                'waktu' => $r->waktu?->format('Y-m-d H:i'),
            ])
            ->all();
    }

    /**
     * Hitung jumlah POIN per status, plus jumlah sub-modul per status turunan.
     *
     * @return array{butir: array<string, int>, sub: array<string, int>}
     */
    public function ringkasan(): array
    {
        $butir = array_fill_keys(self::STATUS, 0);

        foreach (PapanButir::query()->selectRaw('status, count(*) as jumlah')->groupBy('status')->get() as $baris) {
            $butir[$baris->status] = (int) $baris->jumlah;
        }

        $sub = array_fill_keys(self::STATUS, 0);

        foreach ($this->semua() as $modul) {
            foreach ($modul['sub'] as $s) {
                $sub[$s['status']] += 1;
            }
        }

        return ['butir' => $butir, 'sub' => $sub];
    }

    /**
     * Ubah isi satu poin: deskripsi dan/atau status.
     *
     * Status TIDAK wajib ikut berubah. Kalau status berubah, jejaknya
     * dicatat di `papan_riwayat` persis seperti {@see pindahButir} - kalau
     * tidak, riwayat tidak ditambah supaya tidak dipenuhi baris palsu
     * "sudah -> sudah" hanya karena teksnya disunting.
     *
     * @param  string|null  $status  status baru; null = biarkan apa adanya
     *
     * @throws InvalidArgumentException bila status tidak dikenal
     */
    public function ubahButir(
        string $kode,
        int $butirId,
        ?string $deskripsi = null,
        ?string $status = null,
        string $oleh = 'agent',
        ?string $catatan = null,
        ?array $subpoin = null,
    ): PapanButir {
        if ($status !== null) {
            $this->pastikanStatus($status);
        }

        $butir = $this->butir($kode, $butirId)['butir'];
        $statusLama = $butir->status;

        if ($deskripsi !== null) {
            $butir->deskripsi = $deskripsi;
        }

        if ($subpoin !== null) {
            $butir->subpoin = self::normalisasiSubpoin($subpoin);
        }

        if ($status === 'sudah' && ! self::semuaSubpoinSelesai($butir->subpoin ?? [])) {
            throw ValidationException::withMessages([
                'status' => 'Selesaikan semua subpoin sebelum menandai poin sudah.',
            ]);
        }

        // Poin yang sudah `sudah` tidak boleh tetap di sana bila ada subpoin
        // yang dibuka kembali atau subpoin baru yang belum selesai.
        $statusBaru = $status;
        $catatanRiwayat = $catatan;

        if ($statusBaru === null && $statusLama === 'sudah' && ! self::semuaSubpoinSelesai($butir->subpoin ?? [])) {
            $statusBaru = 'sedang';
            $catatanRiwayat ??= 'Subpoin dibuka kembali.';
        }

        if ($statusBaru !== null) {
            $butir->status = $statusBaru;
        }

        $butir->save();

        if ($statusBaru !== null && $statusBaru !== $statusLama) {
            PapanRiwayat::create([
                'item_id' => $butir->item_id,
                'butir_id' => $butir->id,
                'dari_status' => $statusLama,
                'ke_status' => $statusBaru,
                'catatan' => $catatanRiwayat,
                'diubah_oleh' => $oleh,
                'waktu' => now(),
            ]);
        }

        return $butir->refresh();
    }

    /**
     * Samakan bentuk subpoin: selalu daftar {teks, selesai}.
     *
     * Data lama masih berupa daftar teks; migrasi mengubahnya, tetapi fungsi
     * ini tetap menerima string agar jalur command/test lama tidak pecah.
     *
     * @param  array<int, array{teks?: string, selesai?: bool}|string>  $subpoin
     * @return array<int, array{teks: string, selesai: bool}>
     */
    private static function normalisasiSubpoin(array $subpoin): array
    {
        return array_values(array_map(function ($item): array {
            if (is_string($item)) {
                return ['teks' => trim($item), 'selesai' => false];
            }

            return [
                'teks' => trim((string) ($item['teks'] ?? '')),
                'selesai' => (bool) ($item['selesai'] ?? false),
            ];
        }, $subpoin));
    }

    /**
     * @param  array<int, array{teks?: string, selesai?: bool}|string>  $subpoin
     */
    private static function semuaSubpoinSelesai(array $subpoin): bool
    {
        foreach ($subpoin as $item) {
            $selesai = is_array($item) ? (bool) ($item['selesai'] ?? false) : false;

            if (! $selesai) {
                return false;
            }
        }

        return true;
    }

    /**
     * Geser satu poin naik/turun di dalam sub-modulnya.
     *
     * Urutan ditulis ulang rapat (1..n) setelah pertukaran supaya tidak
     * ada lubang yang membuat pengurutan jadi tidak stabil.
     *
     * @param  int  $arah  -1 = naik, 1 = turun
     * @return bool false bila sudah di ujung (tidak ada yang berubah)
     */
    public function geserButir(string $kode, int $butirId, int $arah): bool
    {
        $item = $this->item($kode);

        $daftar = PapanButir::query()
            ->where('item_id', $item->id)
            ->orderBy('urutan')
            ->orderBy('id')
            ->get()
            ->values();

        $kini = $daftar->search(fn (PapanButir $b) => $b->id === $butirId);

        if ($kini === false) {
            return false;
        }

        $tujuan = $kini + $arah;

        if ($tujuan < 0 || $tujuan >= $daftar->count()) {
            return false;
        }

        $urut = $daftar->all();
        [$urut[$kini], $urut[$tujuan]] = [$urut[$tujuan], $urut[$kini]];

        DB::connection('papan')->transaction(function () use ($urut) {
            foreach ($urut as $posisi => $b) {
                $b->urutan = $posisi + 1;
                $b->save();
            }
        });

        return true;
    }

    /**
     * Tambah sub-modul baru di bawah sebuah modul.
     *
     * Kode sengaja TIDAK dibuat otomatis: kode dipakai di command, di
     * rujukan, dan (lewat judul) di markdown, jadi pemiliknya yang
     * menentukan supaya tetap bisa dibaca manusia.
     *
     * @throws InvalidArgumentException bila modul tidak ada atau kode sudah dipakai
     */
    /**
     * Tambah modul baru di akhir urutan.
     *
     * Kode disimpan dalam huruf besar dan unik tanpa peduli besar-kecil.
     *
     * @throws InvalidArgumentException bila kode sudah dipakai
     */
    public function tambahModul(string $aplikasi, string $kode, string $nama): PapanModul
    {
        if (! array_key_exists($aplikasi, self::APLIKASI)) {
            throw new InvalidArgumentException("Aplikasi `{$aplikasi}` tidak dikenal.");
        }

        $kode = strtoupper(trim($kode));

        $sudahAda = PapanModul::query()
            ->whereRaw('UPPER(kode) = ?', [$kode])
            ->exists();

        if ($sudahAda) {
            throw new InvalidArgumentException("Kode modul `{$kode}` sudah dipakai.");
        }

        $urutan = (int) PapanModul::query()->where('aplikasi', $aplikasi)->max('urutan');

        return PapanModul::create([
            'aplikasi' => $aplikasi,
            'kode' => $kode,
            'nama' => trim($nama),
            'urutan' => $urutan + 1,
        ]);
    }

    /**
     * Tambah sub-modul baru di bawah sebuah modul.
     *
     * @throws InvalidArgumentException bila modul tidak ada atau kode sub-modul kembar
     */
    public function tambahItem(string $kodeModul, string $kode, string $nama): PapanItem
    {
        $modul = $this->modul($kodeModul);

        $sudahAda = PapanItem::query()
            ->where('modul_id', $modul->id)
            ->where('kode', $kode)
            ->exists();

        if ($sudahAda) {
            throw new InvalidArgumentException("Kode sub-modul `{$kode}` sudah dipakai di modul {$kodeModul}.");
        }

        $urutan = (int) PapanItem::query()->where('modul_id', $modul->id)->max('urutan');

        return PapanItem::create([
            'modul_id' => $modul->id,
            'kode' => $kode,
            'nama' => $nama,
            'urutan' => $urutan + 1,
        ]);
    }

    /**
     * Ubah nama dan/atau kode sebuah sub-modul.
     *
     * Poin-poinnya TIDAK disentuh - ini beda penting dari seed ulang,
     * yang menghapus lalu membuat ulang poin sehingga id dan status
     * tanda-tangannya hilang.
     *
     * @throws InvalidArgumentException bila kode baru sudah dipakai
     */
    public function ubahItem(string $kodeModul, string $kode, ?string $kodeBaru = null, ?string $nama = null): PapanItem
    {
        $item = $this->item($kode);

        if ($kodeBaru !== null && $kodeBaru !== $item->kode) {
            $bentrok = PapanItem::query()
                ->where('modul_id', $item->modul_id)
                ->where('kode', $kodeBaru)
                ->where('id', '!=', $item->id)
                ->exists();

            if ($bentrok) {
                throw new InvalidArgumentException("Kode sub-modul `{$kodeBaru}` sudah dipakai di modul {$kodeModul}.");
            }

            $item->kode = $kodeBaru;
        }

        if ($nama !== null) {
            $item->nama = $nama;
        }

        $item->save();

        return $item->refresh();
    }

    /**
     * Hapus sebuah sub-modul BESERTA seluruh poinnya.
     *
     * Penghapusan sengaja tidak meminta konfirmasi di sini: keputusan itu
     * milik pemanggil (UI menampilkan dialog, command meminta --yakin).
     * Poin ikut terhapus lewat cascade di level model.
     */
    public function hapusItem(string $kode): bool
    {
        return $this->item($kode)->delete();
    }

    /** @throws InvalidArgumentException bila modul tidak ada */
    private function modul(string $kode): PapanModul
    {
        $modul = PapanModul::query()->where('kode', $kode)->first();

        if ($modul === null) {
            throw new InvalidArgumentException("Modul `{$kode}` tidak ditemukan di papan.");
        }

        return $modul;
    }

    /** @throws InvalidArgumentException bila status tidak dikenal */
    private function pastikanStatus(string $status): void
    {
        if (! in_array($status, self::STATUS, true)) {
            throw new InvalidArgumentException(
                "Status `{$status}` tidak dikenal. Pakai salah satu: ".implode(', ', self::STATUS).'.'
            );
        }
    }
}

<?php

namespace App\Services;

use App\Models\Papan\PapanButir;
use App\Models\Papan\PapanItem;
use App\Models\Papan\PapanModul;
use App\Models\Papan\PapanRiwayat;
use Illuminate\Support\Facades\DB;
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

    /**
     * Status sub-modul yang DITURUNKAN dari status poin-poinnya.
     *
     * Aturannya, berurutan:
     * 1. belum punya poin        -> `akan` (belum dikerjakan);
     * 2. ada poin `sedang`        -> `sedang` (sedang berjalan);
     * 3. ada poin `akan`          -> `akan` (masih ada sisa);
     * 4. semua poin `ditunda`     -> `ditunda`;
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

        if (($ada['sudah'] ?? 0) === 0) {
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
                'urut' => (int) $m->urutan,
                'catatan' => $m->catatan,
                'sub' => $m->item->map(function (PapanItem $i) {
                    $butir = $i->butir->map(fn (PapanButir $b) => [
                        'id' => $b->id,
                        'status' => $b->status,
                        'deskripsi' => $b->deskripsi,
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
    public function tambahButir(string $kode, string $status, string $deskripsi): PapanButir
    {
        $this->pastikanStatus($status);

        $item = $this->item($kode);

        $urutan = (int) PapanButir::query()->where('item_id', $item->id)->max('urutan');

        return PapanButir::create([
            'item_id' => $item->id,
            'status' => $status,
            'deskripsi' => $deskripsi,
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

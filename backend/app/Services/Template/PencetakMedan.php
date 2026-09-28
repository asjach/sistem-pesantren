<?php

namespace App\Services\Template;

use App\Models\AsetDokumen;
use App\Models\TemplateDokumen;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Bagian yang sama antara renderer PDF eksternal dan renderer HTML.
 *
 * Dua mesin mencetak definisi medan yang sama ke dua platform berbeda, jadi
 * cara membaca nilai, memuat asset, dan menamai berkas tidak boleh diulang dua
 * kali. Kalau diulang, perbaikan pada satu renderer tidak ikut ke yang lain dan
 * dokumen yang sama bisa tercetak berbeda.
 */
abstract class PencetakMedan
{
    public function __construct(
        protected readonly TemplateDokumen $template,
        protected readonly PengisiNilai $pengisi,
        protected readonly KonteksCetak $konteks,
    ) {}

    /** Hasil PDF dalam bentuk byte. */
    abstract public function hasil(): string;

    public function namaBerkas(string $akhiran = '.pdf'): string
    {
        $dasar = Str::slug($this->template->nama);

        return ($dasar !== '' ? $dasar : 'template').'-'.now()->format('Ymd-His').$akhiran;
    }

    /**
     * Nilai medan dalam bentuk teks, sudah menerapkan huruf besar dan batas
     * panjang supaya satu nilai anomalous tidak merusak dokumen.
     *
     * @param  array<string, mixed>  $medan
     */
    protected function teks(array $medan): string
    {
        $nilai = $this->nilaiMedan($medan);

        if ($nilai === null) {
            return '';
        }

        $teks = $nilai instanceof \BackedEnum ? (string) $nilai->value : (string) $nilai;
        $gaya = $medan['gaya'];

        if ($gaya['huruf_besar']) {
            $teks = mb_strtoupper($teks);
        }

        return mb_substr($teks, 0, 4000);
    }

    /** @param array<string, mixed> $medan */
    protected function nilaiMedan(array $medan): mixed
    {
        $sumber = (string) ($medan['sumber'] ?? '');
        $kunci = (string) ($medan['kunci'] ?? '');

        if ($sumber === '' || $kunci === '' || ! KatalogNilai::dikenal($sumber)) {
            return null;
        }

        $nilai = $this->pengisi->untuk($sumber, $this->idUntukSumber($sumber));

        return $nilai[$kunci] ?? null;
    }

    /** Sumber yang menunjuk satu record memakai id yang dikontekskan. */
    protected function idUntukSumber(string $sumber): ?int
    {
        $pilih = KatalogNilai::sumber()[$sumber]['pilih_data'] ?? null;

        return match ($pilih) {
            'santri' => $this->konteks->idSantri,
            'pegawai' => $this->konteks->idPegawai,
            'lembaga' => $this->konteks->jenjang !== null ? 1 : null,
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $medan
     */
    protected function jalurGambarMedan(array $medan): ?string
    {
        $sumber = (string) ($medan['sumber'] ?? '');

        // Aset dibaca dari pustaka aset, bukan dari nilai medan. Kuncinya
        // "aset:<id>" sehingga gambar tetap milik template walau tabelnya
        // berubah.
        if ($sumber === 'aset') {
            $id = KatalogNilai::idAsetDariKunci((string) ($medan['kunci'] ?? ''));

            if ($id === null) {
                return null;
            }

            $aset = AsetDokumen::find($id);

            if ($aset === null) {
                return null;
            }

            $penuh = Storage::disk(AsetGambar::DISK)->path($aset->path);

            return is_file($penuh) ? $penuh : null;
        }

        $nilai = $this->nilaiMedan($medan);

        if ($nilai === null || $nilai === '') {
            return null;
        }

        $penuh = Storage::disk(AsetGambar::DISK)->path((string) $nilai);

        return is_file($penuh) ? $penuh : null;
    }

    /**
     * @param  array<string, mixed>  $kolom
     * @param  array<string, mixed>  $baris
     */
    protected function teksKolom(array $kolom, array $baris, int $urut): string
    {
        $sumber = (string) ($kolom['sumber'] ?? 'baris');
        $kunci = (string) ($kolom['kunci'] ?? '');

        // 'tetap' berarti isi kolom tidak bergantung pada baris data; kunci
        // no_urut diisi nomor baris supaya tabel selalu bertanggal.
        if ($sumber === 'tetap') {
            return $kunci === 'no_urut' ? (string) $urut : $kunci;
        }

        $mentah = $baris[$kunci] ?? null;

        return $mentah === null ? '' : (string) $mentah;
    }

    /**
     * Nama font yang dipahami dompdf, diturunkan dari gaya medan.
     *
     * Nama huruf_family diapit kutip tunggal karena gaya ini disisipkan ke
     * dalam atribut style yang diapit kutip ganda. Kutip ganda di dalamnya
     * akan memutus atribut dan membuat seluruh medan hilang diam-diam.
     *
     * @param  array<string, mixed>  $gaya
     */
    protected function fontCss(array $gaya): string
    {
        $keluarga = match ((string) $gaya['font']) {
            'times' => "'DejaVu Serif', 'Times New Roman', serif",
            'courier' => "'DejaVu Sans Mono', 'Courier New', monospace",
            default => "'DejaVu Sans', 'Helvetica Neue', Arial, sans-serif",
        };

        return $keluarga.($gaya['tebal'] ? ' bold' : '').($gaya['miring'] ? ' italic' : '');
    }
}

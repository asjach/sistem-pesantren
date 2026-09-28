<?php

namespace App\Services\Template;

use App\Models\AsetDokumen;
use App\Models\TemplateDokumen;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Penyimpanan berkas template dan aset cetak.
 *
 * Nama berkas selalu diacak. Route penyajian disk lokal (/storage/{path}) tidak
 * dilindungi middleware auth, sehingga path berkas tidak boleh dapat ditebak
 * oleh pihak luar.
 */
class AsetGambar
{
    public const DISK = 'local';

    public const MAKS_UPLOAD_PDF = 20480;

    public const MAKS_UPLOAD_GAMBAR = 4096;

    /**
     * Simpan berkas template dan kembalikan path relatifnya.
     */
    public function simpanTemplate(UploadedFile $berkas): string
    {
        $path = 'template/pdf/'.Str::lower(Str::random(32)).'.pdf';

        Storage::disk(self::DISK)->put($path, (string) file_get_contents($berkas->getRealPath()));

        return $path;
    }

    /**
     * Simpan gambar aset (stempel, tanda tangan) beserta ukuran pikselnya.
     */
    public function simpanGambar(UploadedFile $berkas, ?string $jenjang, ?int $dibuatOleh): AsetDokumen
    {
        $path = 'template/aset/'.Str::lower(Str::random(32)).'.'.$berkas->guessExtension();
        Storage::disk(self::DISK)->put($path, (string) file_get_contents($berkas->getRealPath()));

        [$lebar, $tinggi] = $this->ukuranGambar($path);

        return AsetDokumen::create([
            'jenjang' => $jenjang,
            'nama' => pathinfo($berkas->getClientOriginalName(), PATHINFO_FILENAME),
            'path' => $path,
            'mime' => $berkas->getClientMimeType() ?? 'image/png',
            'lebar_px' => $lebar,
            'tinggi_px' => $tinggi,
            'ukuran_byte' => (int) $berkas->getSize(),
            'dibuat_oleh' => $dibuatOleh,
        ]);
    }

    public function hapusAset(AsetDokumen $aset): void
    {
        Storage::disk(self::DISK)->delete($aset->path);
        $aset->delete();
    }

    public function hapusTemplate(TemplateDokumen $template): void
    {
        if ($template->path_pdf !== null && $template->path_pdf !== '') {
            Storage::disk(self::DISK)->delete($template->path_pdf);
        }
    }

    /** @return array{0: int, 1: int} */
    private function ukuranGambar(string $path): array
    {
        $penuh = Storage::disk(self::DISK)->path($path);
        $info = @getimagesize($penuh);

        return [$info[0] ?? 0, $info[1] ?? 0];
    }
}

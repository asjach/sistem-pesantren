<?php

namespace Tests\Feature;

use App\Exports\KelasTemplateExport;
use App\Exports\PsbTemplateExport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use Tests\TestCase;

// Kode warna header template import (seragam template lain): kuning = wajib,
// biru = opsional. Template santri/riwayat sudah berwarna sejak awal.
class TemplateWarnaTest extends TestCase
{
    use RefreshDatabase;

    /** Proses terpisah: penulisan xlsx rapuh bila dijalankan setelah ratusan tes. */
    #[RunInSeparateProcess]
    public function test_header_wajib_kuning_opsional_biru(): void
    {
        $kasus = [
            [new KelasTemplateExport, ['A1' => 'FFFFE699', 'D1' => 'FFDCE6F1']],
            [new PsbTemplateExport, ['A1' => 'FFFFE699', 'C1' => 'FFDCE6F1']],
        ];

        foreach ($kasus as $i => [$export, $sel]) {
            $path = sys_get_temp_dir()."/warna-{$i}.xlsx";
            file_put_contents($path, Excel::raw($export, \Maatwebsite\Excel\Excel::XLSX));
            try {
                $sheet = IOFactory::load($path)->getActiveSheet();
                foreach ($sel as $cell => $argb) {
                    $this->assertSame(
                        $argb,
                        $sheet->getStyle($cell)->getFill()->getStartColor()->getARGB(),
                        get_class($export)." {$cell}"
                    );
                }
            } finally {
                @unlink($path);
            }
        }
    }
}

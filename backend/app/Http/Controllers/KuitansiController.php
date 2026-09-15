<?php

namespace App\Http\Controllers;

use App\Models\Lembaga;
use App\Models\Pembayaran;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class KuitansiController extends Controller
{
    protected function authorizeTenant(Request $request, Pembayaran $pembayaran): void
    {
        $actor = $request->user();
        if ($actor->bolehPesantren()) {
            return;
        }
        $pembayaran->loadMissing('detail.tagihan');
        $lembagaIds = $pembayaran->detail->map(fn ($d) => $d->tagihan?->lembaga_id)->filter()->unique()->all();
        foreach ($lembagaIds as $lid) {
            if (! $actor->canAccessLembaga((int) $lid)) {
                abort(403);
            }
        }
    }

    /**
     * Kop kuitansi: nama lembaga tagihan pertama; fallback root PESANTREN;
     * root null/absen = placeholder generik (Bab 2.2, tanpa nama hardcode).
     */
    protected function kopLembaga(Pembayaran $pembayaran): string
    {
        $pembayaran->loadMissing(['detail.tagihan.lembaga', 'akunKas.lembaga']);
        $lembaga = $pembayaran->detail->first()?->tagihan?->lembaga
            ?? $pembayaran->akunKas?->lembaga;
        if ($lembaga?->nama) {
            return $lembaga->nama;
        }
        $root = Lembaga::where('kode', 'PESANTREN')->first();

        return $root?->nama ?? 'PESANTREN';
    }

    // Cetak Kuitansi PDF (A4/A5)
    public function cetakPdf(Request $request, $pembayaranId)
    {
        $pembayaran = Pembayaran::with(['detail.tagihan.santri', 'detail.tagihan.psbCalonSantri', 'detail.tagihan.posKeuangan'])
            ->findOrFail($pembayaranId);
        $this->authorizeTenant($request, $pembayaran);
        $kop = $this->kopLembaga($pembayaran);

        $pdf = Pdf::loadView('keuangan.kuitansi-pdf', compact('pembayaran', 'kop'))
            ->setPaper('a5', 'landscape'); // A5 Landscape ideal untuk kuitansi

        // FIX-103C (pemblokir): no_kuitansi berformat KWT/{tahun}/{seq} mengandung '/'
        // sehingga stream() 500 (HeaderUtils menolak '/' di filename). Sanitasi nama
        // file unduhan saja; nilai no_kuitansi di DB tidak berubah.
        $namaFile = str_replace(['/', '\\'], '-', "Kuitansi-{$pembayaran->no_kuitansi}.pdf");

        return $pdf->stream($namaFile);
    }

    // Render HTML Struk Thermal (Untuk Web Print / WebView Desktop Kasir)
    public function cetakThermal(Request $request, $pembayaranId)
    {
        $pembayaran = Pembayaran::with(['detail.tagihan.santri', 'detail.tagihan.psbCalonSantri', 'detail.tagihan.posKeuangan'])
            ->findOrFail($pembayaranId);
        $this->authorizeTenant($request, $pembayaran);
        $kop = $this->kopLembaga($pembayaran);

        return view('keuangan.kuitansi-thermal', compact('pembayaran', 'kop'));
    }
}

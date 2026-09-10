<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Struk - {{ $pembayaran->no_kuitansi }}</title>
    <style>
        /* Mengatur ukuran kertas Thermal (Ubah 58mm ke 80mm jika memakai printer besar) */
        @page {
            size: 58mm auto;
            margin: 0;
        }
        body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 9px;
            width: 58mm;
            margin: 0;
            padding: 5px;
            color: #000;
            background: #fff;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .line { border-bottom: 1px dashed #000; margin: 4px 0; }
        .table-item { width: 100%; border-collapse: collapse; font-size: 8px; }
        .table-item td { padding: 1px 0; vertical-align: top; }

        @media print {
            .no-print { display: none; }
        }
    </style>
</head>
<body onload="window.print()">

    <div class="no-print" style="margin-bottom: 10px;">
        <button onclick="window.print()">Cetak Struk</button>
    </div>

    <div class="text-center">
        <span class="bold" style="font-size: 11px;">{{ $kop ?? 'PESANTREN' }}</span><br>
    </div>

    <div class="line"></div>

    <div>
        No.KWT : {{ $pembayaran->no_kuitansi }}<br>
        Tgl    : {{ date('d/m/y H:i', strtotime($pembayaran->tgl_pembayaran)) }}<br>
        Santri : {{ \Illuminate\Support\Str::limit($pembayaran->detail->first()->tagihan->santri->nama_lengkap ?? $pembayaran->detail->first()->tagihan->psbCalonSantri->nama_lengkap ?? '-', 20) }}<br>
        NIS    : {{ $pembayaran->detail->first()->tagihan->santri->nis ?? $pembayaran->detail->first()->tagihan->psbCalonSantri->nik ?? '-' }}
    </div>

    <div class="line"></div>

    <table class="table-item">
        @foreach($pembayaran->detail as $dt)
        <tr>
            <td colspan="2" class="bold">{{ $dt->tagihan->posKeuangan->nama_pos }} {{ $dt->tagihan->periode ? '('.$dt->tagihan->periode.')' : '' }}</td>
        </tr>
        <tr>
            <td style="padding-left: 5px;">
                @if($dt->tagihan->sisa_tagihan == 0)
                    [Lunas]
                @else
                    [Sisa: {{ number_format($dt->tagihan->sisa_tagihan, 0, ',', '.') }}]
                @endif
            </td>
            <td class="text-right">{{ number_format($dt->nominal_dibayar, 0, ',', '.') }}</td>
        </tr>
        @endforeach
    </table>

    <div class="line"></div>

    <table class="table-item bold">
        <tr>
            <td>TOTAL :</td>
            <td class="text-right" style="font-size: 10px;">Rp {{ number_format($pembayaran->total_bayar, 0, ',', '.') }}</td>
        </tr>
        <tr>
            <td>BAYAR :</td>
            <td class="text-right">{{ strtoupper($pembayaran->metode_pembayaran) }}</td>
        </tr>
    </table>

    <div class="line"></div>

    <div class="text-center" style="font-size: 8px; margin-top: 5px;">
        *** TERIMA KASIH ***<br>
        Simpan struk ini sebagai<br>bukti pembayaran sah.
    </div>

</body>
</html>

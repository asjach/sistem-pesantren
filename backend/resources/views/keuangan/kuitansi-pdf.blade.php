<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Kuitansi - {{ $pembayaran->no_kuitansi }}</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 10px; }
        .container { width: 100%; border: 1px solid #ddd; padding: 20px; box-sizing: border-box; }
        .header { text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; margin-bottom: 15px; }
        .header h2 { margin: 0; font-size: 18px; color: #2c3e50; text-transform: uppercase; }
        .header p { margin: 2px 0; font-size: 10px; color: #666; }

        .info-table, .item-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        .info-table td { padding: 4px 0; vertical-align: top; }
        .info-label { width: 25%; font-weight: bold; color: #555; }

        .item-table th { background-color: #f8f9fa; border-bottom: 2px solid #dee2e6; color: #333; text-align: left; padding: 8px; font-size: 11px; }
        .item-table td { border-bottom: 1px solid #eee; padding: 8px; font-size: 11px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }

        .total-box { font-size: 14px; font-weight: bold; background: #eef2f5; padding: 8px 12px; display: inline-block; border-radius: 4px; }

        .terbilang-box { background: #fdfefe; border-left: 3px solid #2c3e50; padding: 8px; font-style: italic; margin-bottom: 20px; font-size: 11px; }

        .footer-ttd { width: 100%; margin-top: 30px; }
        .footer-ttd td { text-align: center; width: 50%; vertical-align: bottom; }
        .ttd-space { height: 50px; }
    </style>
</head>
<body>

<div class="container">
    <div class="header">
        <h2>KUITANSI PEMBAYARAN</h2>
        <p><strong>{{ $kop ?? 'PESANTREN' }}</strong></p>
    </div>

    <table class="info-table">
        <tr>
            <td class="info-label">No. Kuitansi</td>
            <td>: <strong>{{ $pembayaran->no_kuitansi }}</strong></td>
            <td class="info-label">Tanggal</td>
            <td>: {{ date('d/m/Y H:i', strtotime($pembayaran->tgl_pembayaran)) }}</td>
        </tr>
        <tr>
            <td class="info-label">Nama Santri</td>
            <td>: {{ $pembayaran->detail->first()->tagihan->santri->nama_lengkap ?? $pembayaran->detail->first()->tagihan->psbCalonSantri->nama_lengkap ?? '-' }}</td>
            <td class="info-label">Metode Bayar</td>
            <td>: {{ strtoupper($pembayaran->metode_pembayaran) }}</td>
        </tr>
        <tr>
            <td class="info-label">NIS / ID</td>
            <td>: {{ $pembayaran->detail->first()->tagihan->santri->nis ?? $pembayaran->detail->first()->tagihan->psbCalonSantri->nik ?? '-' }}</td>
            <td class="info-label">Kasir</td>
            <td>: {{ $pembayaran->user_id ?? 'Admin' }}</td>
        </tr>
    </table>

    <table class="item-table">
        <thead>
            <tr>
                <th width="5%">#</th>
                <th>Rincian Pos Keuangan / Tagihan</th>
                <th class="text-center">Periode</th>
                <th class="text-right">Nominal Dibayar</th>
            </tr>
        </thead>
        <tbody>
            @foreach($pembayaran->detail as $index => $dt)
            <tr>
                <td>{{ $index + 1 }}</td>
                <td>
                    <strong>{{ $dt->tagihan->posKeuangan->nama_pos }}</strong>
                    @if($dt->tagihan->sisa_tagihan == 0)
                        <span style="color: green; font-size: 9px;">(LUNAS)</span>
                    @else
                        <span style="color: orange; font-size: 9px;">(Sisa: Rp {{ number_format($dt->tagihan->sisa_tagihan, 0, ',', '.') }})</span>
                    @endif
                </td>
                <td class="text-center">{{ $dt->tagihan->periode ?? '-' }}</td>
                <td class="text-right">Rp {{ number_format($dt->nominal_dibayar, 0, ',', '.') }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <table width="100%" style="margin-bottom: 15px;">
        <tr>
            <td width="60%">
                <div class="terbilang-box">
                    <strong>Terbilang:</strong> # {{ terbilang($pembayaran->total_bayar) }} Rupiah #
                </div>
            </td>
            <td width="40%" class="text-right">
                <div class="total-box">
                    Total Bayar: Rp {{ number_format($pembayaran->total_bayar, 0, ',', '.') }}
                </div>
            </td>
        </tr>
    </table>

    <table class="footer-ttd">
        <tr>
            <td>
                Pembayar/Santri
                <div class="ttd-space"></div>
                ( ..................................... )
            </td>
            <td>
                Kasir / Pengurus
                <div class="ttd-space"></div>
                ( <strong>{{ $pembayaran->user_id ?? 'Kasir' }}</strong> )
            </td>
        </tr>
    </table>
</div>

</body>
</html>

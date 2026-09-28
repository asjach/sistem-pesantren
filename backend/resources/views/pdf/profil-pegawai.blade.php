<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Profil Pegawai — {{ $pegawai->nama_lengkap }}</title>
<style>
  @page { margin: 26px 30px 46px 30px; }
  /* Font inti PDF (Helvetica) — tanpa embedding font: berkas ~6 KB, bukan ~880 KB,
     dan tetap aman untuk teks Latin (nama, alamat, keterangan berbahasa Indonesia). */
  body { font-family: Helvetica, sans-serif; font-size: 10px; color: #000; }
  .kop-nama { font-size: 15px; font-weight: bold; text-transform: uppercase; }
  .kop-baris { font-size: 9px; color: #222; }
  .garis { border-top: 2px solid #000; border-bottom: 1px solid #000; height: 2px; margin: 6px 0 10px 0; }
  .judul { text-align: center; font-size: 13px; font-weight: bold; letter-spacing: 1px; }
  .subjudul { text-align: center; font-size: 10px; margin: 2px 0 12px 0; }
  .blok { margin-bottom: 9px; }
  .blok-judul { font-weight: bold; font-size: 10.5px; background-color: #e8e8e8; padding: 3px 5px; }
  table { width: 100%; border-collapse: collapse; }
  table td, table th { border: 1px solid #7a7a7a; padding: 3px 5px; vertical-align: top; }
  table th { background-color: #f1f1f1; text-align: left; font-size: 9px; }
  table td.label { width: 24%; color: #333; }
  table td.nilai { font-weight: bold; }
  .kosong { color: #444; font-style: italic; margin: 3px 0 0 0; }
  .footer { position: fixed; bottom: -34px; left: 0; right: 0; border-top: 1px solid #999; padding-top: 3px; font-size: 8px; color: #444; }
</style>
</head>
<body>

{{-- Kop lembaga: hanya bila lembaga penempatan/param jenjang tersedia. --}}
@if ($kop)
  <div class="kop-nama">{{ $kop->nama }}</div>
  @php
    $kopBaris = array_filter([
      $kop->alamat,
      trim(implode(', ', array_filter([
        $kop->desa ? 'Desa '.$kop->desa : null,
        $kop->kecamatan ? 'Kec. '.$kop->kecamatan : null,
        $kop->kab_kota,
        $kop->provinsi,
      ]))),
      trim(implode(' · ', array_filter([
        $kop->telepon ? 'Telp. '.$kop->telepon : null,
        $kop->email,
        $kop->website,
      ]))),
      trim(implode(' · ', array_filter([
        $kop->nsm ? 'NSM '.$kop->nsm : null,
        $kop->npsn ? 'NPSN '.$kop->npsn : null,
        $kop->akreditasi ? 'Akreditasi '.$kop->akreditasi : null,
      ]))),
    ]);
  @endphp
  @foreach ($kopBaris as $baris)
    <div class="kop-baris">{{ $baris }}</div>
  @endforeach
@else
  <div class="kop-nama">SIMPES — Sistem Informasi Manajemen Pesantren</div>
@endif
<div class="garis"></div>

<div class="judul">PROFIL PEGAWAI</div>
<div class="subjudul">Buku Induk Guru &middot; dicetak {{ $tanggalCetak }}</div>

@foreach ($identitas as $blok)
  <div class="blok">
    <div class="blok-judul">{{ $blok['judul'] }}</div>
    <table>
      @foreach ($blok['baris'] as $baris)
        <tr>
          @foreach ($baris as $sel)
            <td class="label">{{ $sel[0] }}</td>
            <td class="nilai" @if (! empty($sel[2])) colspan="{{ $sel[2] }}" @endif>{{ $sel[1] }}</td>
          @endforeach
        </tr>
      @endforeach
    </table>
  </div>
@endforeach

@foreach ($seksi as $s)
  <div class="blok">
    <div class="blok-judul">{{ $s['judul'] }}</div>
    @if (count($s['baris']) === 0)
      <p class="kosong">Tidak ada data.</p>
    @else
      <table>
        <thead>
          <tr>
            @foreach ($s['kolom'] as $judulKolom)
              <th>{{ $judulKolom }}</th>
            @endforeach
          </tr>
        </thead>
        <tbody>
          @foreach ($s['baris'] as $baris)
            <tr>
              @foreach ($baris as $sel)
                <td>{{ $sel }}</td>
              @endforeach
            </tr>
          @endforeach
        </tbody>
      </table>
    @endif
  </div>
@endforeach

<div class="footer">
  Dicetak dari SIMPES oleh {{ $pencetak }}
</div>

</body>
</html>

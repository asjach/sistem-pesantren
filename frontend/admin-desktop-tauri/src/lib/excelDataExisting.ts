import * as XLSX from 'xlsx-js-style';

/** Payload data existing dari backend (kolom identik template import). */
export interface DataExistingPayload {
  kolom: string[];
  wajib: string[];
  baris: string[][];
}

/** Lebar kolom (karakter) — kolom teks panjang dibuat lega. */
function lebarKolom(nama: string): number {
  if (/nama|alamat|keterangan|alasan|sekolah|kegiatan/.test(nama)) return 28;
  if (/nis|nik|npsn|nsm|skhun|no_surat|ta_baru/.test(nama)) return 18;
  return 16;
}

const HEADER_BELUM = {
  font: { bold: true, sz: 10, color: { rgb: '1F2937' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: thin(),
};

/**
 * Susun + unduh berkas Excel data existing di browser. Gaya seragam dengan
 * template: header tebal — kuning = wajib diisi, biru = opsional — plus lebar
 * kolom, autofilter, dan zebra baris data. Freeze baris 1 tidak didukung
 * penulis SheetJS, jadi dilewati.
 */
export function unduhExcelDataExisting(
  data: DataExistingPayload,
  namaBerkas: string,
  judulSheet = 'Data',
): void {
  const wajib = new Set(data.wajib);
  const header = data.kolom.map((nama) => ({
    v: nama,
    s: {
      ...HEADER_BELUM,
      fill: { patternType: 'solid', fgColor: { rgb: wajib.has(nama) ? 'FFE699' : 'DCE6F1' } },
    },
  }));

  const baris = data.baris.map((baris, i) =>
    data.kolom.map((_, k) => {
      const nilai = baris[k] ?? '';
      return {
        v: nilai,
        s: {
          border: thin(),
          ...(i % 2 === 1 ? { fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } } } : {}),
        },
      };
    }),
  );

  const sheet = XLSX.utils.aoa_to_sheet([header, ...baris]);
  // `aoa_to_sheet` hanya menulis nilai; gaya sel dipasang ulang di bawah.
  for (let c = 0; c < data.kolom.length; c += 1) {
    const alamat = XLSX.utils.encode_cell({ r: 0, c });
    const sel = sheet[alamat] as XLSX.CellObject | undefined;
    if (sel) sel.s = header[c].s;
  }
  for (let r = 0; r < data.baris.length; r += 1) {
    for (let c = 0; c < data.kolom.length; c += 1) {
      const alamat = XLSX.utils.encode_cell({ r: r + 1, c });
      const sel = sheet[alamat] as XLSX.CellObject | undefined;
      if (sel) sel.s = baris[r][c].s;
    }
  }
  sheet['!cols'] = data.kolom.map((nama) => ({ wch: lebarKolom(nama) }));
  sheet['!rows'] = [{ hpt: 28 }];
  const lastCol = XLSX.utils.encode_col(data.kolom.length - 1);
  sheet['!autofilter'] = { ref: `A1:${lastCol}1` };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, judulSheet.slice(0, 31));
  XLSX.writeFile(book, namaBerkas);
}

function thin() {
  const side = { style: 'thin', color: { rgb: 'E5E7EB' } };
  return { top: side, bottom: side, left: side, right: side };
}

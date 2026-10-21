export interface ContohNomorPeserta {
  tahunAjaran: string;
  kodeKegiatanEvaluatif: string;
  semester: string;
  tingkat: string;
  urutan: number;
}

export function formatContohNomorPeserta(template: string, contoh: ContohNomorPeserta): string {
  const [tahunAwal = '', tahunAkhir = ''] = contoh.tahunAjaran.split('/', 2);
  const nilai: Record<string, string> = {
    '{ta_awal_2}': tahunAwal.slice(-2),
    '{ta_akhir_2}': tahunAkhir.slice(-2),
    '{kode_kegiatan_evaluatif}': contoh.kodeKegiatanEvaluatif,
    '{semester}': contoh.semester,
    '{tingkat}': contoh.tingkat,
    '{tingkat_2}': contoh.tingkat.padStart(2, '0'),
    '{nomor_3}': String(contoh.urutan).padStart(3, '0'),
    '{nomor_4}': String(contoh.urutan).padStart(4, '0'),
    '{nomor_5}': String(contoh.urutan).padStart(5, '0'),
  };

  return Object.entries(nilai).reduce(
    (hasil, [token, pengganti]) => hasil.replaceAll(token, pengganti),
    template.trim(),
  );
}

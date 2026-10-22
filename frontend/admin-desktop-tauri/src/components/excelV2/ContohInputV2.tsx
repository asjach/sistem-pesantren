import { useState } from 'react';
import ExcelTabelV2 from './ExcelTabelV2';
import type { ExcelField } from '@/components/excel/types';
import { Button } from '@/components/ui/button';

const FIELDS: ExcelField[] = [
  { key: 'kode', label: 'Kode', kind: 'static', inputKind: 'text', required: true, maxLength: 20 },
  { key: 'nama', label: 'Nama', kind: 'text', required: true, maxLength: 80 },
  { key: 'jenjang', label: 'Jenjang', kind: 'select', required: true, choices: [{ value: 'MI', label: 'MI' }, { value: 'MD', label: 'MD' }] },
  { key: 'aktif', label: 'Aktif', kind: 'toggle' },
];
type Baris = { id: number; kode: string | null; nama: string | null; jenjang: string | null; aktif: string | null };

/** Data demo hanya hidup dalam sesi halaman; tidak memanggil API bisnis. */
export default function ContohInputV2() {
  const [rows, setRows] = useState<Baris[]>([]);
  const [gagal, setGagal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kompak, setKompak] = useState(true);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" aria-pressed={gagal} onClick={() => setGagal(!gagal)}>Simulasi gagal simpan</Button>
        <Button type="button" size="sm" variant="outline" aria-pressed={loading} onClick={() => setLoading(!loading)}>Simulasi pemuatan</Button>
        <Button type="button" size="sm" variant="outline" aria-pressed={kompak} onClick={() => setKompak(!kompak)}>Batas 3 baris</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setRows([])}>Kosongkan data</Button>
      </div>
      <div className="flex min-h-0 flex-col" style={{ height: kompak ? undefined : 320 }}>
        <ExcelTabelV2
          tableKey="contoh_input_v2" judul="Contoh input ExcelTabelV2" fields={FIELDS}
          rows={rows} getValues={(r) => ({ kode: r.kode, nama: r.nama, jenjang: r.jenjang, aktif: r.aktif })}
          loading={loading} maxRows={kompak ? 3 : undefined} onApplyPreset={() => {}}
          inputRowValues={{ jenjang: 'MI', aktif: 'ya' }}
          onCreateRow={async (nilai) => {
            await new Promise((resolve) => setTimeout(resolve, 300));
            if (gagal) throw new Error('Simulasi gagal menyimpan. Draft tetap tersedia untuk dicoba lagi.');
            setRows((lama) => [...lama, {
              id: Math.max(0, ...lama.map((r) => r.id)) + 1,
              kode: nilai.kode, nama: nilai.nama, jenjang: nilai.jenjang, aktif: nilai.aktif,
            }]);
          }}
        />
      </div>
    </div>
  );
}

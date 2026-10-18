import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/api/client';
import { Save } from '@/icons';
import { daftarHariLibur, simpanHariLibur, HARI_LABEL } from '@/api/kurikulum';

/** Panel tab Hari Libur: centang hari libur mingguan per lembaga. */
export default function PanelHariLibur({ jenjang, canUbah, onSimpan }: {
  jenjang: string; canUbah: boolean; onSimpan: () => void;
}) {
  const [semua, setSemua] = useState<string[]>([]);
  const [libur, setLibur] = useState<string[]>([]);

  const muat = useCallback(async () => {
    if (jenjang === '') return;
    try {
      const r = await daftarHariLibur(jenjang);
      setSemua(r.semua_hari);
      setLibur(r.hari_libur);
    } catch (e) { toast.error(errorMessage(e)); }
  }, [jenjang]);

  useEffect(() => { void muat(); }, [muat]);

  const balik = (h: string) => {
    setLibur((v) => (v.includes(h) ? v.filter((x) => x !== h) : [...v, h]));
  };

  const simpan = async () => {
    try {
      const r = await simpanHariLibur({ jenjang, hari_libur: libur });
      setLibur(r.hari_libur);
      toast.success('Hari libur disimpan.');
      onSimpan();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 p-0">
      <p className="text-xs font-medium">Hari libur mingguan · {jenjang}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Hari yang dicentang tidak tampil di matriks jadwal dan tidak bisa diisi.
        Bila hari itu masih punya jadwal terisi, hapus/pindahkan dulu jadwalnya.
      </p>
      <div className="mt-3 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-3">
        {semua.map((h) => (
          <label key={h} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
            htmlFor={`cek_libur_${h}`}>
            <input
              type="checkbox" id={`cek_libur_${h}`} disabled={!canUbah}
              checked={libur.includes(h)} onChange={() => balik(h)}
            />
            <span>{HARI_LABEL[h] ?? h}</span>
            {libur.includes(h) && (
              <span className="ml-auto text-[10px] text-muted-foreground">Libur</span>
            )}
          </label>
        ))}
      </div>
      {canUbah && (
        <div className="mt-3">
          <Button type="button" variant="default" size="sm" id="btn_simpan_hari_libur" onClick={() => void simpan()}>
            <Save size={14} /> Simpan hari libur
          </Button>
        </div>
      )}
    </div>
  );
}

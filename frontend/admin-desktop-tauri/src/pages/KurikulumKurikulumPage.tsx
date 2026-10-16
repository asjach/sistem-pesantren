import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { Plus, Save, Trash2, X } from '@/icons';
import {
  buatKomposisi, buatKurikulum, daftarKomposisi, daftarKurikulum, hapusKomposisi,
  hapusKurikulum, ubahKomposisi, ubahKurikulum,
  type Kurikulum,
} from '@/api/kurikulum';

/** Halaman Kurikulum: daftar kurikulum per jenjang + komposisi mapel
 *  (mapel → kurikulum, berjangkar tingkat + KKM & urutan rapor). */
export default function KurikulumKurikulumPage() {
  const { jenjangs, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canTambah = bisa(user, 'kurikulum.tambah');
  const canUbah = bisa(user, 'kurikulum.ubah');
  const canHapus = bisa(user, 'kurikulum.hapus');

  const jenjang = targetTunggal(jenjangs);
  const [daftar, setDaftar] = useState<Kurikulum[]>([]);
  const [pilihId, setPilihId] = useState<number | ''>('');
  const [komposisi, setKomposisi] = useState<Awaited<ReturnType<typeof daftarKomposisi>> | null>(null);
  const [err, setErr] = useState('');

  const muatDaftar = useCallback(async () => {
    if (jenjang === null) { setDaftar([]); setPilihId(''); return; }
    try {
      const r = await daftarKurikulum(jenjang);
      setDaftar(r);
      setPilihId((v) => (r.some((k) => k.id === v) ? v : (r[0]?.id ?? '')));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [jenjang]);

  const muatKomposisi = useCallback(async () => {
    if (pilihId === '') { setKomposisi(null); return; }
    try {
      setKomposisi(await daftarKomposisi(pilihId));
    } catch (e) {
      setErr(errorMessage(e)); setKomposisi(null);
    }
  }, [pilihId]);

  useEffect(() => {
    if (filterLoading) return;
    setErr('');
    void muatDaftar();
  }, [filterLoading, muatDaftar]);

  useEffect(() => { void muatKomposisi(); }, [muatKomposisi]);

  const segarkan = useCallback(async () => {
    await muatDaftar(); await muatKomposisi();
  }, [muatDaftar, muatKomposisi]);

  const jalankan = useCallback(async (kerja: () => Promise<unknown>, sukses: string) => {
    try { await kerja(); toast.success(sukses); await segarkan(); }
    catch (e) { toast.error(errorMessage(e)); }
  }, [segarkan]);

  if (jenjang === null) {
    return (
      <div className={PAGE_SHELL}>
        <p className="p-4 text-xs text-muted-foreground">Pilih satu jenjang (lembaga) pada filter di atas.</p>
      </div>
    );
  }

  const kurikulumAktif = daftar.find((k) => k.id === pilihId) ?? null;

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      {/* Panel kiri: daftar kurikulum */}
      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr] divide-x divide-border">
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-xs font-medium">Kurikulum · {jenjang}</span>
            <div className="ml-auto">
              <Button type="button" variant="outline" size="sm" id="btn_tambah_kurikulum" disabled={!canTambah}
                onClick={() => void jalankan(
                  () => buatKurikulum({ jenjang, nama: 'Kurikulum Baru' }),
                  'Kurikulum ditambah.',
                )}>
                <Plus size={14} /> Tambah
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-xs" id="tabel_kurikulum">
              <tbody>
                {daftar.map((k) => (
                  <tr
                    key={k.id}
                    className={`cursor-pointer border-b border-border ${k.id === pilihId ? 'bg-accent' : 'hover:bg-muted/50'}`}
                    onClick={() => setPilihId(k.id)}
                  >
                    <td className="px-3 py-1.5">
                      <span className="font-medium">{k.nama}</span>
                      <span className="ml-1 text-muted-foreground">
                        ({k.mapel_count ?? 0} mapel · {k.kelas_count ?? 0} kelas)
                      </span>
                    </td>
                  </tr>
                ))}
                {daftar.length === 0 && (
                  <tr><td className="px-3 py-4 text-center text-muted-foreground">Belum ada kurikulum.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {kurikulumAktif && (
            <div className="border-t border-border p-2">
              {canUbah && (
                <Button type="button" variant="outline" size="sm" className="mr-2" id="btn_ubah_kurikulum"
                  onClick={() => {
                    const nama = window.prompt('Nama kurikulum', kurikulumAktif.nama);
                    if (nama === null) return;
                    void jalankan(() => ubahKurikulum(kurikulumAktif.id, { nama }), 'Kurikulum diubah.');
                  }}>
                  Ubah nama
                </Button>
              )}
              {canHapus && (
                <Button type="button" variant="outline" size="sm" id="btn_hapus_kurikulum"
                  onClick={() => void jalankan(() => hapusKurikulum(kurikulumAktif.id), 'Kurikulum dihapus.')}>
                  <Trash2 size={14} /> Hapus
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Panel kanan: komposisi mapel kurikulum terpilih */}
        <div className="flex min-h-0 flex-col">
          {kurikulumAktif === null ? (
            <p className="p-4 text-xs text-muted-foreground">Pilih kurikulum di kiri, atau buat baru.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Komposisi <strong>{kurikulumAktif.nama}</strong>
                  {kurikulumAktif.deskripsi && <> — {kurikulumAktif.deskripsi}</>}
                </span>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-border">
                {/* Tersedia */}
                <div className="flex min-h-0 flex-col">
                  <div className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    Mapel jenjang ini (belum masuk)
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    {komposisi?.tersedia.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 border-b border-border px-3 py-1">
                        <span className="min-w-0 flex-1 truncate text-xs" title={m.nama_mapel}>{m.nama_mapel}</span>
                        <span className="text-[10px] text-muted-foreground">{m.kelompok === 'formal' ? 'Formal' : 'Pesantren'}</span>
                        {canTambah && (
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Tambah ${m.nama_mapel}`}
                            onClick={() => void jalankan(
                              () => buatKomposisi({ kurikulum_id: kurikulumAktif.id, mata_pelajaran_id: m.id }),
                              `${m.nama_mapel} masuk kurikulum.`,
                            )}>
                            <Plus size={14} />
                          </Button>
                        )}
                      </div>
                    ))}
                    {komposisi?.tersedia.length === 0 && (
                      <p className="p-3 text-xs text-muted-foreground">Semua mapel jenjang ini sudah masuk kurikulum.</p>
                    )}
                  </div>
                </div>
                {/* Terpasang */}
                <div className="flex min-h-0 flex-col">
                  <div className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    Mapel dalam kurikulum ({komposisi?.baris.length ?? 0})
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="border border-border px-2 py-1 text-left">Mapel</th>
                          <th className="border border-border px-2 py-1 w-24 text-left">Tingkat</th>
                          <th className="border border-border px-2 py-1 w-20">KKM</th>
                          <th className="border border-border px-2 py-1 w-16">Urut</th>
                          <th className="border border-border px-2 py-1 w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {komposisi?.baris.map((b) => (
                          <BarisKomposisi
                            key={b.id}
                            b={b}
                            tingkatOpsi={komposisi.tingkat}
                            canUbah={canUbah}
                            canHapus={canHapus}
                            onSimpan={jalankan}
                          />
                        ))}
                        {komposisi?.baris.length === 0 && (
                          <tr><td colSpan={5} className="border border-border px-2 py-4 text-center text-muted-foreground">
                            Belum ada mapel — tambahkan dari panel kiri.
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Baris komposisi: tingkat (null = semua), KKM, urutan rapor. */
function BarisKomposisi({ b, tingkatOpsi, canUbah, canHapus, onSimpan }: {
  b: import('@/api/kurikulum').KomposisiBaris;
  tingkatOpsi: { id: number; nama: string }[];
  canUbah: boolean; canHapus: boolean;
  onSimpan: (kerja: () => Promise<unknown>, sukses: string) => Promise<void>;
}) {
  const [tingkat, setTingkat] = useState(b.tingkat ?? '');
  const [kkm, setKkm] = useState(b.kkm === null ? '' : String(b.kkm));
  const [urutan, setUrutan] = useState(String(b.urutan));

  useEffect(() => {
    setTingkat(b.tingkat ?? ''); setKkm(b.kkm === null ? '' : String(b.kkm)); setUrutan(String(b.urutan));
  }, [b]);

  return (
    <tr>
      <td className="border border-border px-2 py-1">{b.mata_pelajaran.nama_mapel}</td>
      <td className="border border-border px-1 py-0.5">
        <select
          className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs"
          aria-label={`Tingkat ${b.mata_pelajaran.nama_mapel}`}
          disabled={!canUbah} value={tingkat}
          onChange={(e) => setTingkat(e.target.value)}
        >
          <option value="">Semua tingkat</option>
          {tingkatOpsi.map((t) => <option key={t.id} value={t.nama}>{t.nama}</option>)}
        </select>
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input
          type="number" min={0} max={100} className="h-7 text-xs"
          aria-label={`KKM ${b.mata_pelajaran.nama_mapel}`}
          disabled={!canUbah} value={kkm} placeholder="—"
          onChange={(e) => setKkm(e.target.value)}
        />
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input
          type="number" min={0} className="h-7 text-xs"
          aria-label={`Urutan ${b.mata_pelajaran.nama_mapel}`}
          disabled={!canUbah} value={urutan}
          onChange={(e) => setUrutan(e.target.value)}
        />
      </td>
      <td className="border border-border px-1 py-0.5">
        <div className="flex justify-center gap-1">
          {canUbah && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Simpan ${b.mata_pelajaran.nama_mapel}`}
              onClick={() => void onSimpan(
                () => ubahKomposisi(b.id, {
                  tingkat: tingkat || null,
                  kkm: kkm === '' ? null : Number(kkm),
                  urutan: Number(urutan) || 0,
                }),
                'Komposisi disimpan.',
              )}>
              <Save size={14} />
            </Button>
          )}
          {canHapus && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Keluarkan ${b.mata_pelajaran.nama_mapel}`}
              onClick={() => void onSimpan(() => hapusKomposisi(b.id), 'Mapel dikeluarkan dari kurikulum.')}>
              <X size={14} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

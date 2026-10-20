import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ErrorNotice, PAGE_SHELL } from '@/components/PageHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { KELAS_LIST_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { PapanKolom } from '@/components/papan/PapanKolom';
import { Columns3, Loader2, Plus, RefreshCcw } from '@/icons';
import {
  geserButirPapan,
  hapusButirPapan,
  muatPapan,
  muatRiwayatPapan,
  pindahStatusPapan,
  tambahButirPapan,
  ubahButirPapan,
  ubahSubPapan,
  hapusSubPapan,
  type DataPapan,
  type RiwayatPapan,
  type StatusPapan,
} from '@/api/papan';
import { bisa } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { kartuModul, kemajuanModul, modulPertama, type KartuPapan } from '@/lib/papan';
import type { AksiButir, AksiSub } from '@/components/papan/PapanKolom';
import { KelolaSubModul } from '@/components/papan/KelolaSubModul';

/** Kolom selesai/ditunda mulai terlipat agar fokus ke pekerjaan aktif. */
const KOLOM_TERTUTUP_AWAL: StatusPapan[] = ['sudah', 'ditunda'];

/**
 * Papan perkembangan modul - satu tab per modul (A, B, C, ...), tiap tab
 * berisi papan empat kolom (akan, sedang, sudah, ditunda).
 *
 * Tab dibangun dari modul yang ada di papan, jadi modul baru langsung muncul
 * tanpa mengubah kode. Sumbernya API /board, bukan data pesantren, jadi
 * halaman ini tidak ikut mode lembaga aktif.
 */
export default function PapanPage() {
  const { kodeModul } = useParams<{ kodeModul?: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<DataPapan | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatPapan[]>([]);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [kelolaTerbuka, setKelolaTerbuka] = useState(false);

  const { user } = useAuth();
  // Satu gerbang untuk seluruh UI sunting. Tanpa izin ini halaman
  // tetap berfungsi penuh sebagai pembaca - tidak ada tombol mati yang
  // menggantung, dan kartu tidak bisa diseret ke kolom lain.
  const bolehUbah = bisa(user, 'papan.ubah');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const papan = await muatPapan();
      setData(papan);
      setGalat(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Board gagal dimuat.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  useEffect(() => {
    muatRiwayatPapan(undefined, 8)
      .then((log) => setRiwayat(log.riwayat))
      .catch(() => setRiwayat([]));
  }, []);

  const modul = useMemo(() => data?.modul ?? [], [data]);
  const aktif = useMemo(() => {
    if (!kodeModul) return null;

    return modul.find((m) => m.kode.toUpperCase() === kodeModul.toUpperCase()) ?? null;
  }, [modul, kodeModul]);

  /**
   * Simpan perpindahan satu POIN; gagal = kembalikan tampilan ke data server.
   *
   * Pemindahan menyentuh dua hal sekaligus: status poinnya, dan status
   * sub-modul induknya yang diturunkan. Keduanya digeser optimistis di layar
   * supaya tidak ada jeda; kalau server menolak, seluruh papan dimuat ulang.
   */
  const pindah = useCallback(
    async (butirId: number, ke: StatusPapan) => {
      if (!data) return;

      // Sub-modul yang poinnya berpindah, untuk menghitung ulang turunannya.
      const subTersentuh = data.modul
        .flatMap((m) => m.sub)
        .find((s) => s.butir.some((b) => b.id === butirId));

      const hitungTurunan = (status: StatusPapan[]): StatusPapan => {
        if (status.includes('sedang')) return 'sedang';
        if (status.includes('akan')) return 'akan';
        if (!status.includes('sudah')) return 'ditunda';

        return 'sudah';
      };

      setData({
        ...data,
        modul: data.modul.map((m) => ({
          ...m,
          sub: m.sub.map((s) => {
            const butir = s.butir.map((b) => (b.id === butirId ? { ...b, status: ke } : b));

            return {
              ...s,
              butir,
              status:
                subTersentuh?.kode === s.kode ? hitungTurunan(butir.map((b) => b.status)) : s.status,
            };
          }),
        })),
      });

      try {
        await pindahStatusPapan(subTersentuh?.kode ?? '', butirId, ke);
        const log = await muatRiwayatPapan(undefined, 8);
        setRiwayat(log.riwayat);
        setGalat(null);
      } catch (e) {
        setGalat(e instanceof Error ? e.message : 'Perpindahan gagal disimpan.');
        void muat();
      }
    },
    [data, muat],
  );

  /**
   * Simpan perubahan pada satu poin, lalu segarkan papan dari server.
   *
   * Berbeda dari pemindahan lewat seret (yang optimistis), suntingan di
   * sini memuat ulang setelah sukses. Alasannya: menyunting juga bisa
   * menambah/menghapus poin dan mengubah sub-modul, yang menggeser
   * banyak kartu sekaligus - menebak hasilnya di layar lebih berisiko
   * daripada satu permintaan tambahan.
   */
  const segarkan = useCallback(async () => {
    try {
      const [papan, log] = await Promise.all([muatPapan(), muatRiwayatPapan(undefined, 8)]);
      setData(papan);
      setRiwayat(log.riwayat);
      setGalat(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Board gagal dimuat ulang.');
    }
  }, []);

  /** Aksi sunting untuk satu kartu poin, dipakai panel rincian. */
  const aksiButir = useCallback(
    (kartu: KartuPapan): AksiButir => ({
      onSimpanTeks: async (deskripsi) => {
        await ubahButirPapan(kartu.subKode, kartu.id, { deskripsi });
        await segarkan();
      },
      onSimpanSubpoin: async (subpoin) => {
        await ubahButirPapan(kartu.subKode, kartu.id, { subpoin });
        await segarkan();
      },
      onSimpanStatus: async (status) => {
        await ubahButirPapan(kartu.subKode, kartu.id, { status });
        await segarkan();
      },
      onNaik: async () => {
        await geserButirPapan(kartu.subKode, kartu.id, -1);
        await segarkan();
      },
      onTurun: async () => {
        await geserButirPapan(kartu.subKode, kartu.id, 1);
        await segarkan();
      },
      onHapus: async () => {
        await hapusButirPapan(kartu.subKode, kartu.id);
        await segarkan();
      },
    }),
    [segarkan],
  );

  const aksiSub = useCallback(
    (kartu: { subKode: string }): AksiSub => ({
      onSimpan: async (kode, nama) => {
        await ubahSubPapan(kartu.subKode, { kode_baru: kode, nama });
        await segarkan();
      },
      onHapus: async () => {
        await hapusSubPapan(kartu.subKode);
        await segarkan();
      },
    }),
    [segarkan],
  );

  /** Tambah poin baru ke sebuah sub-modul lalu muat ulang papan. */
  const tambahPoin = useCallback(
    async (subKode: string, status: StatusPapan, deskripsi: string) => {
      await tambahButirPapan(subKode, status, deskripsi);
      await segarkan();
    },
    [segarkan],
  );
  // Modul tak dikenal atau belum dipilih -> arahkan ke modul pertama yang berisi.
  if (data && (!kodeModul || !aktif)) {
    const tujuan = modulPertama(modul);

    return <Navigate to={tujuan ? `/board/${tujuan.kode}` : '/board/redirect'} replace />;
  }

  if (memuat && !data) {
    return (
      <div id="papan_modul" className={cn(PAGE_SHELL, 'h-full')}>
        <div
          role="status"
          className="flex flex-1 items-center justify-center gap-2 px-6 text-sm text-muted-foreground"
        >
          <Loader2 size={15} className="animate-spin" />
          Memuat Board...
        </div>
      </div>
    );
  }

  if (galat && !data) {
    return (
      <div id="papan_modul" className={cn(PAGE_SHELL, 'h-full')}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-6">
          <ErrorNotice className="mb-0">{galat}</ErrorNotice>
          <Button
            id="btn_muat_ulang_papan"
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void muat()}
            className="self-start"
          >
            <RefreshCcw size={13} />
            Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  const kartu = aktif ? kartuModul(aktif) : [];

  return (
    <div id="papan_modul" className={cn(PAGE_SHELL, 'h-full')}>
      {modul.length > 0 ? (
        <Tabs
          value={aktif?.kode ?? ''}
          onValueChange={(k) => navigate(`/board/${k}`)}
          className="min-h-0 flex-1 gap-0"
        >
          <TabsList
            className={KELAS_LIST_TAB}
            indikator="primer"
            // Daftar tab yang lebih lebar dari layar harus mulai dari kiri.
            // justify-center bawaan memotong tab awal saat wadah bergulir.
            style={{ justifyContent: 'flex-start' }}
          >
            {modul.map((m) => (
              <TabsTrigger
                key={m.kode}
                id={`tab_papan_${m.kode.toLowerCase()}`}
                value={m.kode}
                className={KELAS_TRIGGER}
              >
                {m.kode}. {m.nama}
                {/* Lencana = kemajuan POIN (selesai/total), bukan jumlah
                    sub-modul: sejak yang bergerak adalah poin, angka sub-modul
                    tidak lagi menggambarkan kemajuan. Warna diatur di
                    index.css (.lencana-tab-papan) supaya bisa dibalik saat tab
                    aktif — lihat catatan di sana. */}
                <span className="lencana-tab-papan" title="Poin selesai dari total poin">
                  {kemajuanModul(m).selesai}/{kemajuanModul(m).total}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {galat ? (
            <div className="px-3 pt-2 sm:px-6">
              <ErrorNotice className="mb-0">{galat}</ErrorNotice>
            </div>
          ) : null}

          {aktif ? (
            <PapanKolom
              key={aktif.kode}
              kartu={kartu}
              tampilkanModul={false}
              onPindah={pindah}
              bolehUbah={bolehUbah}
              aksiButir={aksiButir}
              aksiSub={aksiSub}
              onTambahPoin={tambahPoin}
              subKosong={aktif.sub.filter((s) => s.butir.length === 0)}
              riwayat={riwayat}
              idAwalan={`modul_${aktif.kode.toLowerCase()}`}
              lipatAwal={KOLOM_TERTUTUP_AWAL}
              alat={
                bolehUbah ? (
                  <Button
                    id="btn_kelola_papan"
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setKelolaTerbuka(true)}
                  >
                    <Plus size={13} />
                    Tambah sub-modul
                  </Button>
                ) : null
              }
            />
          ) : null}
        </Tabs>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <Columns3 size={24} className="text-muted-foreground/60" />
          <p className="text-sm font-medium">Board belum berisi modul</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Modul akan muncul otomatis setelah datanya tersedia di server.
          </p>
        </div>
      )}

      {bolehUbah && kelolaTerbuka && aktif ? (
        <KelolaSubModul
          modulKode={aktif.kode}
          modulNama={aktif.nama}
          onTutup={() => setKelolaTerbuka(false)}
          onBerubah={segarkan}
        />
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Settings } from '@/icons';
import { errorMessage } from '@/api/client';
import { muatToolbarPreset, simpanToolbarPreset } from '@/api/toolbarPreset';
import { gabungVisibilitas } from '@/components/excel/filterTabel';
import { grupTersedia, type InfoKomponenTabel } from '@/components/excel/komponenTabel';
import { kabariToolbar } from '@/components/kelolaTabel/jenis';
import { bukaDariMenu } from '@/components/excel/kelolaTabelDariMenu';
import { bukaPengaturanTampilan } from '@/components/pengaturan/SheetPengaturanTampilan';
import { toast } from 'sonner';

interface Props {
  tableKey: string;
  /** Komponen yang benar-benar ada di tabel ini (menentukan sakelar tampil). */
  info: InfoKomponenTabel;
  /** Tabel halaman ini terdaftar; tanpa itu pintasan Kelola Tabel disembunyikan. */
  tabelTerdaftar?: boolean;
  /** Super_admin efektif; hanya mereka yang boleh membuka Kelola Tabel. */
  bolehKelola?: boolean;
  onKelolaTabel?: () => void;
}

/**
 * MenuPengaturanV2 — dropdown "Menu lainnya" di toolbar ExcelTabelV2.
 *
 *  Berisi pengaturan cepat yang dulu hanya ada di dialog Kelola Tabel:
 *  sakelar visibilitas komponen. Menu sengaja TETAP TERBUKA saat checkbox
 *  diubah (onSelect dicegah) supaya beberapa sakelar bisa diubah berurutan.
 *
 *  Sakelar tampilan perangkat (isi lebar / baris ikut isi) BELUM dipindah ke
 *  sini: V2 belum menerapkan keduanya, jadi menaruhnya di menu hanya akan
 *  menjadi tombol mati. Keduanya tetap di Kelola Tabel sampai poinnya.
 *
 *  Visibilitas ditulis dengan MERGE peta server (simpanToolbarPreset
 *  menimpa satu peta utuh), lalu kabariToolbar memicu grid memuat ulang.
 */
export default function MenuPengaturanV2({
  tableKey,
  info,
  tabelTerdaftar = false,
  bolehKelola = false,
  onKelolaTabel,
}: Props) {
  const [buka, setBuka] = useState(false);
  const [nilai, setNilai] = useState<Record<string, boolean>>({});
  const [sibuk, setSibuk] = useState(false);

  const grup = useMemo(() => grupTersedia(info), [info]);

  /** Muat sekali tiap menu dibuka: peta visibilitas dari server. */
  useEffect(() => {
    if (!buka) return;
    let hidup = true;
    void (async () => {
      try {
        const res = await muatToolbarPreset(tableKey);
        if (!hidup) return;
        const server = res.data.visibilitas ?? {};
        const peta: Record<string, boolean> = {};
        for (const { items } of grup) {
          for (const item of items) peta[item.kunci] = server[item.kunci] !== false;
        }
        setNilai(peta);
      } catch {
        /* Biarkan nilai terakhir; kegagalan muat tidak menghalangi menu. */
      }
    })();
    return () => { hidup = false; };
  }, [buka, grup, tableKey]);

  async function ubahVisibilitas(kunci: string, tampil: boolean) {
    if (sibuk) return;
    const sebelum = nilai;
    setNilai({ ...nilai, [kunci]: tampil });
    setSibuk(true);
    try {
      const res = await muatToolbarPreset(tableKey);
      const gabung = gabungVisibilitas(res.data.visibilitas ?? {}, { [kunci]: tampil });
      await simpanToolbarPreset(tableKey, gabung);
      kabariToolbar(tableKey);
    } catch (e) {
      setNilai(sebelum);
      toast.error(errorMessage(e));
    } finally {
      setSibuk(false);
    }
  }

  return (
    <DropdownMenu open={buka} onOpenChange={setBuka}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          data-trigger="excel-table-menu"
          aria-label="Menu lainnya"
          title="Pengaturan tabel"
          className="!h-full !w-6"
        >
          <MoreVertical size={14} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="max-h-[70vh] w-64 overflow-y-auto">
        {grup.map(({ grup: g, items }) => (
          <div key={g.id} className="contents">
            <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
            {items.map((item) => (
              <DropdownMenuCheckboxItem
                key={item.kunci}
                checked={nilai[item.kunci] !== false}
                disabled={sibuk}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(c) => void ubahVisibilitas(item.kunci, c === true)}
              >
                {item.label}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        ))}

        {tabelTerdaftar && bolehKelola && onKelolaTabel ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => bukaDariMenu(() => onKelolaTabel())}>
              <span className="flex shrink-0 items-center text-muted-foreground">
                <Settings size={14} aria-hidden="true" />
              </span>
              Kelola Tabel…
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem onSelect={() => bukaPengaturanTampilan()}>
          Pengaturan tampilan tabel…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

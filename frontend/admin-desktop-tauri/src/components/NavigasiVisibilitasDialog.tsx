import {
  blokGrup,
  halamanSubgrup,
  NAV_GRUP,
  kunciGrupNavigasi,
  kunciHalamanNavigasi,
  kunciSubNavigasi,
  kunciTabNavigasi,
  type HalamanDef,
  type SubgrupNav,
  type TabKategori,
} from '@/lib/halaman';
import { useNavigasiVisibilitas } from '@/components/NavigasiVisibilitasProvider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RotateCcw } from '@/icons';

interface NodeNavigasi {
  key: string;
  label: string;
  children: NodeNavigasi[];
}

function halamanNode(h: HalamanDef): NodeNavigasi {
  return {
    key: kunciHalamanNavigasi(h.to),
    label: h.label,
    children: (h.tabHalaman ?? []).map((t) => ({
      key: kunciTabNavigasi(t.to),
      label: t.label,
      children: [],
    })),
  };
}

function subNode(grup: TabKategori, subs: SubgrupNav[] | undefined, prefix: string): NodeNavigasi[] {
  return (subs ?? []).flatMap((s) => {
    if ('langsung' in s) return [];
    const kunci = `${prefix}:${s.id}`;

    return [{
      key: kunciSubNavigasi(kunci),
      label: s.label,
      children: [
        ...subNode(grup, s.anak, kunci),
        ...halamanSubgrup(grup, s.id).map(halamanNode),
      ],
    }];
  });
}

function grupNode(grup: TabKategori, label: string): NodeNavigasi {
  const children = blokGrup(grup).flatMap((blok) => (
    Array.isArray(blok) ? blok.map(halamanNode) : subNode(grup, [blok], grup)
  ));

  return { key: kunciGrupNavigasi(grup), label, children };
}

function kumpulanKunci(node: NodeNavigasi): string[] {
  return [node.key, ...node.children.flatMap(kumpulanKunci)];
}

function Baris({
  node,
  level,
  indukTersembunyi = false,
}: {
  node: NodeNavigasi;
  level: number;
  indukTersembunyi?: boolean;
}) {
  const { tersembunyi, atur } = useNavigasiVisibilitas();
  const aktif = !tersembunyi.has(node.key) && !indukTersembunyi;
  const id = `cek_nav_${node.key.replace(/[^a-z0-9]+/gi, '_')}`;

  return (
    <li>
      <label
        className={`flex items-center gap-2 py-1 text-xs ${indukTersembunyi ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${level * 14}px` }}
      >
        <input
          id={id}
          type="checkbox"
          checked={aktif}
          disabled={indukTersembunyi}
          onChange={() => atur(kumpulanKunci(node), !aktif)}
          className="size-3.5 shrink-0 accent-[var(--accent)]"
        />
        <span className={node.children.length > 0 ? 'font-medium' : ''}>{node.label}</span>
      </label>
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((anak) => (
            <Baris
              key={anak.key}
              node={anak}
              level={level + 1}
              indukTersembunyi={indukTersembunyi || !aktif}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Pengaturan entri navigasi yang tampil di sidebar/menubar/tab (per perangkat). */
export default function NavigasiVisibilitasDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { reset } = useNavigasiVisibilitas();
  const pohon = NAV_GRUP.map((g) => grupNode(g.id, g.label));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Navigasi sidebar</DialogTitle>
          <DialogDescription>
            Pilih grup, sub-grup, halaman, dan tab yang tampil di navigasi.
            Pengaturan ini hanya tampilan di perangkat ini; alamat langsung tetap bisa dibuka.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto border px-2 py-1" style={{ borderColor: 'var(--divider)' }}>
          <ul id="pohon_navigasi_sidebar">
            {pohon.map((node) => <Baris key={node.key} node={node} level={0} />)}
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            id="btn_tampilkan_semua_navigasi"
            type="button"
            variant="ghost"
            onClick={reset}
          >
            <RotateCcw size={14} />
            Tampilkan semua
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

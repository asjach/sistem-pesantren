/* AUTO-GENERATED oleh scripts/icons-gen.mjs — JANGAN edit manual.
 * 72 ikon × 9 set (Iconify/unplugin-icons). Set aktif dari prefs
 * `iconSet`; nama yang tidak tersedia di suatu set jatuh ke Lucide.
 * Regenerasi: node scripts/icons-gen.mjs */
import type { ComponentType, SVGProps } from 'react';
import { useTheme } from '@/theme';
import type { IconSetId } from '@/iconSets';
import setLucide from './lucide';
import setTabler from './tabler';
import setPh from './ph';
import setHeroicons from './heroicons';
import setRi from './ri';
import setIconoir from './iconoir';
import setRadix from './radix';
import setBi from './bi';
import setMaterial from './material';

/* ---------- API publik ---------- */

export interface IkonProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  /** Ukuran sisi ikon (px). Bawaan 24. */
  size?: number | string;
}
export type Ikon = ComponentType<IkonProps>;
type IkonDasar = ComponentType<SVGProps<SVGSVGElement>>;

const SET: Record<IconSetId, Record<string, IkonDasar>> = {
  lucide: setLucide,
  tabler: setTabler,
  ph: setPh,
  heroicons: setHeroicons,
  ri: setRi,
  iconoir: setIconoir,
  radix: setRadix,
  bi: setBi,
  material: setMaterial,
};

function IkonDinamis({ nama, size = 24, className, ...rest }: IkonProps & { nama: string }) {
  const { iconSet } = useTheme();
  const C = (SET[iconSet] ?? SET.lucide)[nama] ?? SET.lucide[nama];
  return (
    <C
      width={size}
      height={size}
      className={className ? `simpes-ikon ${className}` : 'simpes-ikon'}
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
}

/* ---------- komponen ikon (nama sama dengan lucide-react) ---------- */
export const AlignCenter = (p: IkonProps) => <IkonDinamis {...p} nama="AlignCenter" />;
export const AlignLeft = (p: IkonProps) => <IkonDinamis {...p} nama="AlignLeft" />;
export const AlignRight = (p: IkonProps) => <IkonDinamis {...p} nama="AlignRight" />;
export const ArrowRight = (p: IkonProps) => <IkonDinamis {...p} nama="ArrowRight" />;
export const BadgeCheck = (p: IkonProps) => <IkonDinamis {...p} nama="BadgeCheck" />;
export const Ban = (p: IkonProps) => <IkonDinamis {...p} nama="Ban" />;
export const Blend = (p: IkonProps) => <IkonDinamis {...p} nama="Blend" />;
export const BookMarked = (p: IkonProps) => <IkonDinamis {...p} nama="BookMarked" />;
export const BookOpen = (p: IkonProps) => <IkonDinamis {...p} nama="BookOpen" />;
export const CalendarCheck = (p: IkonProps) => <IkonDinamis {...p} nama="CalendarCheck" />;
export const CalendarDays = (p: IkonProps) => <IkonDinamis {...p} nama="CalendarDays" />;
export const CalendarRange = (p: IkonProps) => <IkonDinamis {...p} nama="CalendarRange" />;
export const Check = (p: IkonProps) => <IkonDinamis {...p} nama="Check" />;
export const CheckCircle2 = (p: IkonProps) => <IkonDinamis {...p} nama="CheckCircle2" />;
export const ChevronDown = (p: IkonProps) => <IkonDinamis {...p} nama="ChevronDown" />;
export const ChevronLeft = (p: IkonProps) => <IkonDinamis {...p} nama="ChevronLeft" />;
export const ChevronRight = (p: IkonProps) => <IkonDinamis {...p} nama="ChevronRight" />;
export const ClipboardCheck = (p: IkonProps) => <IkonDinamis {...p} nama="ClipboardCheck" />;
export const ClipboardList = (p: IkonProps) => <IkonDinamis {...p} nama="ClipboardList" />;
export const Copy = (p: IkonProps) => <IkonDinamis {...p} nama="Copy" />;
export const Eye = (p: IkonProps) => <IkonDinamis {...p} nama="Eye" />;
export const FileCheck2 = (p: IkonProps) => <IkonDinamis {...p} nama="FileCheck2" />;
export const FileUp = (p: IkonProps) => <IkonDinamis {...p} nama="FileUp" />;
export const FolderOpen = (p: IkonProps) => <IkonDinamis {...p} nama="FolderOpen" />;
export const GraduationCap = (p: IkonProps) => <IkonDinamis {...p} nama="GraduationCap" />;
export const History = (p: IkonProps) => <IkonDinamis {...p} nama="History" />;
export const Home = (p: IkonProps) => <IkonDinamis {...p} nama="Home" />;
export const ImageUp = (p: IkonProps) => <IkonDinamis {...p} nama="ImageUp" />;
export const Landmark = (p: IkonProps) => <IkonDinamis {...p} nama="Landmark" />;
export const LogOut = (p: IkonProps) => <IkonDinamis {...p} nama="LogOut" />;
export const Minus = (p: IkonProps) => <IkonDinamis {...p} nama="Minus" />;
export const Monitor = (p: IkonProps) => <IkonDinamis {...p} nama="Monitor" />;
export const Moon = (p: IkonProps) => <IkonDinamis {...p} nama="Moon" />;
export const MoreVertical = (p: IkonProps) => <IkonDinamis {...p} nama="MoreVertical" />;
export const SquareMousePointer = (p: IkonProps) => <IkonDinamis {...p} nama="SquareMousePointer" />;
export const MoveHorizontal = (p: IkonProps) => <IkonDinamis {...p} nama="MoveHorizontal" />;
export const NotebookTabs = (p: IkonProps) => <IkonDinamis {...p} nama="NotebookTabs" />;
export const Paintbrush = (p: IkonProps) => <IkonDinamis {...p} nama="Paintbrush" />;
export const Palette = (p: IkonProps) => <IkonDinamis {...p} nama="Palette" />;
export const Pencil = (p: IkonProps) => <IkonDinamis {...p} nama="Pencil" />;
export const Plus = (p: IkonProps) => <IkonDinamis {...p} nama="Plus" />;
export const PlusCircle = (p: IkonProps) => <IkonDinamis {...p} nama="PlusCircle" />;
export const ReceiptText = (p: IkonProps) => <IkonDinamis {...p} nama="ReceiptText" />;
export const RotateCcw = (p: IkonProps) => <IkonDinamis {...p} nama="RotateCcw" />;
export const Save = (p: IkonProps) => <IkonDinamis {...p} nama="Save" />;
export const ScrollText = (p: IkonProps) => <IkonDinamis {...p} nama="ScrollText" />;
export const Search = (p: IkonProps) => <IkonDinamis {...p} nama="Search" />;
export const Server = (p: IkonProps) => <IkonDinamis {...p} nama="Server" />;
export const Sun = (p: IkonProps) => <IkonDinamis {...p} nama="Sun" />;
export const Trash2 = (p: IkonProps) => <IkonDinamis {...p} nama="Trash2" />;
export const Undo2 = (p: IkonProps) => <IkonDinamis {...p} nama="Undo2" />;
export const Upload = (p: IkonProps) => <IkonDinamis {...p} nama="Upload" />;
export const Download = (p: IkonProps) => <IkonDinamis {...p} nama="Download" />;
export const UserCheck = (p: IkonProps) => <IkonDinamis {...p} nama="UserCheck" />;
export const UserX = (p: IkonProps) => <IkonDinamis {...p} nama="UserX" />;
export const Users = (p: IkonProps) => <IkonDinamis {...p} nama="Users" />;
export const Wallet = (p: IkonProps) => <IkonDinamis {...p} nama="Wallet" />;
export const X = (p: IkonProps) => <IkonDinamis {...p} nama="X" />;
export const XCircle = (p: IkonProps) => <IkonDinamis {...p} nama="XCircle" />;
export const GripVertical = (p: IkonProps) => <IkonDinamis {...p} nama="GripVertical" />;
export const ChevronUp = (p: IkonProps) => <IkonDinamis {...p} nama="ChevronUp" />;
export const CircleCheck = (p: IkonProps) => <IkonDinamis {...p} nama="CircleCheck" />;
export const Info = (p: IkonProps) => <IkonDinamis {...p} nama="Info" />;
export const Loader2 = (p: IkonProps) => <IkonDinamis {...p} nama="Loader2" />;
export const OctagonX = (p: IkonProps) => <IkonDinamis {...p} nama="OctagonX" />;
export const TriangleAlert = (p: IkonProps) => <IkonDinamis {...p} nama="TriangleAlert" />;
export const DensitySmall = (p: IkonProps) => <IkonDinamis {...p} nama="DensitySmall" />;
export const DensityMedium = (p: IkonProps) => <IkonDinamis {...p} nama="DensityMedium" />;
export const DensityLarge = (p: IkonProps) => <IkonDinamis {...p} nama="DensityLarge" />;
export const Pin = (p: IkonProps) => <IkonDinamis {...p} nama="Pin" />;
export const PinOff = (p: IkonProps) => <IkonDinamis {...p} nama="PinOff" />;
export const StretchHorizontal = (p: IkonProps) => <IkonDinamis {...p} nama="StretchHorizontal" />;

// Generator façade ikon: nama Lucide → 9 koleksi Iconify.
// - Memvalidasi setiap nama terhadap node_modules/@iconify-json/<set>/icons.json
//   (icons + aliases); yang tidak ada → null → façade memakai ikon Lucide.
// - Menulis scripts/icon-map.json (hasil pemetaan, untuk audit) dan
//   src/icons.tsx (komponen terbangkit, JANGAN diedit manual).
// Jalankan: node scripts/icons-gen.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = {
  lucide: 'lucide',
  tabler: 'tabler',
  ph: 'ph',
  heroicons: 'heroicons',
  ri: 'ri',
  iconoir: 'iconoir',
  radix: 'radix-icons',
  bi: 'bi',
  material: 'material-symbols',
};

function muat(paket) {
  const p = path.join(AKAR, 'node_modules', '@iconify-json', paket, 'icons.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return new Set([...Object.keys(j.icons ?? {}), ...Object.keys(j.aliases ?? {})]);
}
const ADA = Object.fromEntries(Object.entries(PREFIX).map(([k, paket]) => [k, muat(paket)]));

const IKON = {
  AlignCenter: ['align-center', 'text-align-center', 'format-align-center'],
  AlignLeft: ['align-left', 'text-align-left', 'format-align-left', 'text-left'],
  AlignRight: ['align-right', 'text-align-right', 'format-align-right', 'text-right'],
  BadgeCheck: ['badge-check', 'verified', 'seal-check', 'rosette-discount-check', 'certificate', 'verified-badge', 'check-badge', 'patch-check'],
  Ban: ['ban', 'block', 'prohibited', 'cancel', 'slash-circle', 'block-2', 'denied', 'prohibit', 'prohibit-inset', 'no-symbol'],
  Blend: ['blend', 'color-filter', 'palette-2', 'swatch', 'droplet', 'droplets', 'color-mix'],
  BookMarked: ['book-marked', 'bookmark', 'book-bookmark', 'notebook', 'bookmark-filled'],
  BookOpen: ['book-open', 'book', 'book-2', 'reading', 'book-open-cover'],
  CalendarCheck: ['calendar-check', 'calendar-checkmark', 'calendar-ok', 'calendar-tick', 'calendar-done', 'calendar-event'],
  CalendarDays: ['calendar-days', 'calendar', 'calendar-month', 'calendar-dates', 'calendar-3', 'calendar-day'],
  CalendarRange: ['calendar-range', 'calendar-week', 'date-range', 'calendar-fold', 'calendar-search', 'calendar-2-line', 'calendar'],
  Check: ['check', 'checkmark', 'tick', 'check-line', 'done', 'check-2'],
  CheckCircle2: ['circle-check-big', 'check-circle-2', 'circle-check', 'check-circle', 'checkmark-circle', 'check-circle-fill', 'check-circled', 'checkbox-circle-line'],
  ChevronDown: ['chevron-down', 'caret-down', 'chevron-bottom', 'angle-down', 'expand-more', 'down', 'arrow-down-s-line', 'nav-arrow-down'],
  ChevronLeft: ['chevron-left', 'caret-left', 'chevron-back', 'angle-left', 'arrow-ios-back', 'left', 'arrow-left-s-line', 'nav-arrow-left'],
  ChevronRight: ['chevron-right', 'caret-right', 'chevron-forward', 'angle-right', 'arrow-ios-forward', 'right', 'arrow-right-s-line', 'nav-arrow-right'],
  ClipboardCheck: ['clipboard-check', 'clipboard-checked', 'clipboard-ok', 'task', 'clipboard-verify', 'clipboard-document-check'],
  ClipboardList: ['clipboard-list', 'clipboard', 'task-list', 'clipboard-notes', 'clipboard-text', 'clipboard-document-list', 'assignment'],
  Copy: ['copy', 'copy-simple', 'duplicate', 'content-copy', 'clipboard-copy', 'files', 'document-duplicate', 'file-copy-line'],
  Eye: ['eye', 'eye-open', 'eye-2', 'view', 'visibility', 'show', 'eye-line'],
  FileCheck2: ['file-check-2', 'file-check', 'file-checked', 'file-ok', 'file-verify', 'document-check'],
  FileUp: ['file-up', 'upload-file', 'document-arrow-up', 'file-upload', 'file-arrow-up', 'file-import'],
  FolderOpen: ['folder-open', 'folder-opened', 'folder-2', 'folder'],
  GraduationCap: ['graduation-cap', 'graduation-cap-2', 'mortar-board', 'school', 'graduation', 'student', 'academic-cap', 'mortarboard'],
  History: ['history', 'clock-rotate-left', 'time-machine', 'history-2', 'clock-counter-clockwise', 'recent', 'clock', 'clock-history'],
  Home: ['home', 'house', 'home-2', 'home-line', 'home-4'],
  ImageUp: ['image-up', 'image-upload', 'photo-up', 'picture-arrow-up', 'image-plus', 'photo-add', 'add-photo', 'media-image-plus', 'add-photo-alternate'],
  Landmark: ['landmark', 'bank', 'building-library', 'building-bank', 'museum', 'bank-line', 'institution', 'building-2', 'building'],
  LogOut: ['log-out', 'exit', 'sign-out', 'signout', 'logout', 'arrow-right-from-bracket', 'log-out-2', 'arrow-right-start-on-rectangle', 'box-arrow-right', 'logout-box-r-line', 'exit-line'],
  Minus: ['minus', 'minus-line', 'remove', 'dash', 'subtract', 'horizontal-rule', 'minus-2'],
  Monitor: ['monitor', 'desktop', 'computer-desktop', 'screen', 'display', 'device-desktop', 'monitor-2', 'computer-line', 'computer'],
  Moon: ['moon', 'dark-mode', 'weather-night', 'night', 'moon-fill', 'moon-simple', 'moon-line', 'half-moon'],
  MoreVertical: ['more-vertical', 'ellipsis-vertical', 'dots-vertical', 'kebab', 'more-vertical-2', 'ellipsis-v', 'three-dots-vertical', 'dots-three-vertical', 'more-2-line', 'more-vert'],
  MousePointerClick: ['mouse-pointer-click', 'pointer', 'cursor-click', 'hand-pointer', 'click', 'touch-app', 'pointer-2', 'ads-click', 'select-cursor', 'mouse-pointer-2'],
  MoveHorizontal: ['move-horizontal', 'arrows-horizontal', 'arrow-left-right', 'arrows-right-left', 'horizontal-distribute', 'move-horizontal-2', 'arrow-horizontal', 'width'],
  MoveVertical: ['move-vertical', 'arrows-vertical', 'arrow-up-down', 'arrows-up-down', 'vertical-distribute', 'move-vertical-2', 'arrow-vertical', 'height'],
  NotebookTabs: ['notebook-tabs', 'notebook', 'note', 'notebook-2', 'book-2', 'journal-page', 'journal-text'],
  Paintbrush: ['paintbrush', 'brush', 'paint-brush', 'paint', 'brush-line', 'paint-brush-line'],
  Palette: ['palette', 'color', 'color-filter', 'palette-2', 'swatch'],
  Pencil: ['pencil', 'edit', 'pencil-1', 'edit-2', 'pencil-line', 'pencil-simple', 'file-edit'],
  Plus: ['plus', 'add', 'plus-line', 'math-plus', 'plus-2', 'add-2'],
  PlusCircle: ['circle-plus', 'plus-circle', 'plus-circle-2', 'add-circle', 'circle-add', 'plus-circle-fill', 'plus-circled'],
  ReceiptText: ['receipt-text', 'receipt', 'receipt-2', 'invoice', 'bill', 'receipt-long', 'receipt-percent', 'receipt-refund', 'file-text', 'file-text-line', 'page'],
  RotateCcw: ['rotate-ccw', 'rotate-counter-clockwise', 'arrow-counter-clockwise', 'undo-2', 'refresh-ccw', 'arrow-rotate-left', 'rotate-left', 'ccw', 'reload', 'arrow-uturn-left', 'arrow-counterclockwise', 'restart-line', 'anticlockwise-line', 'refresh-double', 'refresh-circular'],
  Save: ['save', 'device-floppy', 'floppy', 'floppy-disk', 'disk', 'content-save', 'save-fill'],
  ScrollText: ['scroll-text', 'scroll', 'document-text', 'scroll-2', 'notes', 'file-text-line', 'journal-text'],
  Search: ['search', 'magnifying-glass', 'search-line', 'find', 'magnifier', 'search-2', 'zoom'],
  Server: ['server', 'server-2', 'dns', 'server-stack', 'hard-drives', 'database', 'server-line'],
  Sun: ['sun', 'light-mode', 'weather-sunny', 'sun-fill', 'sun-1', 'sun-line', 'brightness'],
  Trash2: ['trash-2', 'trash', 'delete', 'trash-bin', 'bin', 'trash-line', 'delete-2', 'garbage', 'delete-bin-line'],
  Undo2: ['undo-2', 'undo', 'arrow-u-left-top', 'arrow-go-back', 'rotate-left', 'corner-up-left', 'reply', 'arrow-uturn-left', 'arrow-u-up-left', 'arrow-go-back-line'],
  Upload: ['upload', 'cloud-upload', 'upload-2', 'upload-line', 'arrow-up-tray', 'upload-simple', 'file-upload'],
  UserCheck: ['user-check', 'user-checked', 'person-check', 'user-follow', 'account-check', 'user-circle-check'],
  UserX: ['user-x', 'user-cancel', 'person-x', 'account-cancel', 'user-remove', 'user-cross', 'user-block', 'user-minus', 'user-unfollow-line', 'person-off'],
  Users: ['users', 'user-group', 'group', 'people', 'users-group', 'user-multiple', 'users-line', 'accounts'],
  Wallet: ['wallet', 'wallet-2', 'wallet-minimal', 'card-wallet', 'wallet-line', 'wallet-3', 'money-wallet'],
  X: ['x', 'cross', 'close', 'x-line', 'x-mark', 'cross-2', 'close-line', 'multiply', 'x-lg'],
  XCircle: ['circle-x', 'x-circle', 'close-circle', 'circle-close', 'xmark-circle', 'cross-circle', 'circle-xmark', 'cross-circled'],
  GripVertical: ['grip-vertical', 'drag-vertical', 'drag-handle', 'handle-vertical', 'grip', 'dots-vertical'],
  ChevronUp: ['chevron-up', 'caret-up', 'chevron-top', 'angle-up', 'collapse-less', 'up', 'arrow-up-s-line', 'nav-arrow-up'],
  CircleCheck: ['circle-check', 'check-circle', 'checkmark-circle', 'check-circled', 'check-circle-fill', 'circle-check-big'],
  Info: ['info', 'information', 'info-circle', 'information-circle', 'info-filled'],
  Loader2: ['loader-circle', 'loader-2', 'loader', 'spinner', 'loading', 'spinner-2', 'refresh'],
  OctagonX: ['octagon-x', 'x-octagon', 'octagon-close', 'close-octagon', 'octagon-xmark'],
  TriangleAlert: ['triangle-alert', 'alert-triangle', 'warning', 'triangle-warning', 'alert-triangle-fill'],
};

const NAMA = Object.keys(IKON);
const SET_IDS = Object.keys(PREFIX);
const hasil = {};
const jatuh = {};
for (const [nama, kandidat] of Object.entries(IKON)) {
  hasil[nama] = {};
  for (const set of SET_IDS) {
    let ketemu = null;
    for (const c of kandidat) {
      if (ADA[set].has(c)) { ketemu = c; break; }
    }
    if (!ketemu) {
      for (const c of kandidat) {
        for (const suf of ['-line', '-fill', '-solid', '-outline', '-2']) {
          if (ADA[set].has(c + suf)) { ketemu = c + suf; break; }
        }
        if (ketemu) break;
      }
    }
    hasil[nama][set] = ketemu;
    if (!ketemu) (jatuh[set] ??= []).push(nama);
  }
}

fs.writeFileSync(
  path.join(AKAR, 'scripts', 'icon-map.json'),
  JSON.stringify(hasil, null, 1) + '\n',
);
console.log('=== fallback per set (memakai ikon Lucide) ===');
for (const [set, list] of Object.entries(jatuh)) console.log(`${set} (${list.length}): ${list.join(', ')}`);
console.log(`total: ${Object.values(hasil).reduce((n, p) => n + Object.values(p).filter(Boolean).length, 0)}/${NAMA.length * SET_IDS.length}`);

// --- Bangkitkan src/icons.tsx ---
const alias = (nama, set) => `Ic${nama}${set[0].toUpperCase()}${set.slice(1)}`;
let out = `/* AUTO-GENERATED oleh scripts/icons-gen.mjs — JANGAN edit manual.
 * ${NAMA.length} ikon × ${SET_IDS.length} set (Iconify/unplugin-icons). Set aktif dari prefs
 * \`iconSet\`; nama yang tidak tersedia di suatu set jatuh ke Lucide.
 * Regenerasi: node scripts/icons-gen.mjs */
import type { ComponentType, SVGProps } from 'react';
import { useTheme } from '@/theme';
import type { IconSetId } from '@/iconSets';

/* ---------- impor ikon per set ---------- */
`;
for (const set of SET_IDS) {
  out += `// ${PREFIX[set]}\n`;
  for (const nama of NAMA) {
    const ikon = hasil[nama][set];
    if (ikon) out += `import ${alias(nama, set)} from '~icons/${PREFIX[set]}/${ikon}';\n`;
  }
  out += '\n';
}
out += `/* ---------- API publik ---------- */

export interface IkonProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  /** Ukuran sisi ikon (px). Bawaan 24. */
  size?: number | string;
}
export type Ikon = ComponentType<IkonProps>;
type IkonDasar = ComponentType<SVGProps<SVGSVGElement>>;

const SET: Record<IconSetId, Record<string, IkonDasar>> = {
`;
for (const set of SET_IDS) {
  out += `  ${set}: {\n`;
  for (const nama of NAMA) {
    const ikon = hasil[nama][set];
    if (ikon) out += `    ${nama}: ${alias(nama, set)},\n`;
  }
  out += '  },\n';
}
out += `};

function IkonDinamis({ nama, size = 24, className, ...rest }: IkonProps & { nama: string }) {
  const { iconSet } = useTheme();
  const C = (SET[iconSet] ?? SET.lucide)[nama] ?? SET.lucide[nama];
  return (
    <C
      width={size}
      height={size}
      className={className ? \`simpes-ikon \${className}\` : 'simpes-ikon'}
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
}

/* ---------- komponen ikon (nama sama dengan lucide-react) ---------- */
`;
for (const nama of NAMA) {
  out += `export const ${nama} = (p: IkonProps) => <IkonDinamis {...p} nama="${nama}" />;\n`;
}
fs.writeFileSync(path.join(AKAR, 'src', 'icons.tsx'), out);
console.log('src/icons.tsx ditulis');

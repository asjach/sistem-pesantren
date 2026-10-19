import { useCallback, useEffect, useRef, useState, type ComponentProps, type MutableRefObject } from 'react';
import { Group, Panel, Separator, type PanelImperativeHandle } from 'react-resizable-panels';
import { GripVertical } from '@/icons';
import { cn } from '@/lib/utils';

/** Pembungkus shadcn untuk react-resizable-panels v4 (Group/Panel/Separator).
 *  Bagian katalog "Resizable" menargetkan [data-slot='resizable-panel-group']. */

function ResizablePanelGroup({ className, ...props }: ComponentProps<typeof Group>) {
  return (
    <Group
      data-slot="resizable-panel-group"
      className={cn('flex h-full w-full', className)}
      {...props}
    />
  );
}

function ResizablePanel(props: ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />;
}

type PropsAutoHidePanel = ComponentProps<typeof Panel>;
type HandlerResizePanel = NonNullable<PropsAutoHidePanel['onResize']>;

type PropsAutoHidePanelTambahan = PropsAutoHidePanel & {
  /** Panel disembunyikan otomatis saat bernilai true (mis. tabel kosong),
   *  lalu expands lagi saat bernilai false. */
  sembunyiOtomatis?: boolean;
};

function ResizableAutoHidePanel({
  children,
  onResize,
  panelRef,
  sembunyiOtomatis = false,
  ...props
}: PropsAutoHidePanelTambahan) {
  /** Panel tersembunyi karena digeser ke 0% (bukan karena kosong). */
  const [terkunciGeser, setTerkunciGeser] = useState(false);
  const internalRef = useRef<PanelImperativeHandle | null>(null);

  const handleResize = useCallback<HandlerResizePanel>((size, id, previousSize) => {
    const tersembunyi = size.asPercentage <= 0;
    setTerkunciGeser((current) => (current === tersembunyi ? current : tersembunyi));
    onResize?.(size, id, previousSize);
  }, [onResize]);

  const setRefs = useCallback((node: PanelImperativeHandle | null) => {
    internalRef.current = node;
    if (typeof panelRef === 'function') {
      panelRef(node);
    } else if (panelRef) {
      (panelRef as MutableRefObject<PanelImperativeHandle | null>).current = node;
    }
  }, [panelRef]);

  useEffect(() => {
    const panel = internalRef.current;
    if (!panel) {
      return;
    }
    if (sembunyiOtomatis) {
      panel.collapse();
    } else if (panel.isCollapsed()) {
      panel.expand();
    }
  }, [sembunyiOtomatis]);

  return (
    <Panel
      {...props}
      panelRef={setRefs}
      data-slot="resizable-panel"
      collapsible
      collapsedSize="0%"
      onResize={handleResize}
    >
      {!terkunciGeser && !sembunyiOtomatis ? children : null}
    </Panel>
  );
}

/** Kelas strip pemisah — SATU sumber untuk `ResizableHandle` (panel group)
 *  maupun `PemisahGeser` (tata letak yang digeser sendiri oleh halaman).
 *  `group` membuat garis & knob ikut menyala saat di-hover/ditarik. Latar
 *  memakai var permukaan tabel (`--part-tabel_sel-bg`, cadangan
 *  `--background`) — sama dengan latar tabel di kiri-kanannya, sehingga strip
 *  ini tidak tampak sebagai celah berwarna lain.
 *  Zona hover/geser 8px (`w-2`/`h-2`); yang terlihat hanya garis 1px. */
const KELAS_PEMISAH = 'group relative z-10 flex shrink-0 items-center justify-center bg-[color:var(--part-tabel_sel-bg,var(--background))] outline-none';

function kelasArah(orientation: 'horizontal' | 'vertical'): string {
  return orientation === 'horizontal' ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize';
}

/** Isi pemisah: garis 1px + knob titik-titik opsional. */
function IsiPemisah({ orientation, withHandle }: {
  orientation: 'horizontal' | 'vertical';
  withHandle?: boolean;
}) {
  return (
    <>
      <span
        className={cn(
          'absolute bg-border transition-colors duration-150 group-hover:bg-primary group-active:bg-primary',
          orientation === 'horizontal' ? 'inset-y-0 w-px' : 'inset-x-0 h-px',
        )}
      />
      {withHandle && (
        <span
          className={cn(
            'relative z-10 flex items-center justify-center rounded-sm border bg-border transition-colors duration-150 group-hover:border-primary group-hover:bg-primary group-active:border-primary group-active:bg-primary',
            orientation === 'horizontal' ? 'h-4 w-2' : 'h-2 w-4',
          )}
        >
          <GripVertical
            className={cn(
              'size-2 text-muted-foreground transition-colors duration-150 group-hover:text-primary-foreground group-active:text-primary-foreground',
              orientation === 'vertical' && 'rotate-90',
            )}
          />
        </span>
      )}
    </>
  );
}

function ResizableHandle({
  withHandle,
  orientation = 'horizontal',
  className,
  ...props
}: ComponentProps<typeof Separator> & {
  /** Pegangan titik-titik di tengah garis pemisah. */
  withHandle?: boolean;
  /** Orientasi GROUP: 'horizontal' = pemisah vertikal (geser kiri/kanan). */
  orientation?: 'horizontal' | 'vertical';
}) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(KELAS_PEMISAH, kelasArah(orientation), className)}
      {...props}
    >
      <IsiPemisah orientation={orientation} withHandle={withHandle} />
    </Separator>
  );
}

type PropsPemisahGeser = ComponentProps<'div'> & {
  /** Orientasi TATA LETAK: 'horizontal' = dua kolom (geser kiri/kanan). */
  orientation?: 'horizontal' | 'vertical';
  /** Pegangan titik-titik di tengah garis pemisah. */
  withHandle?: boolean;
};

/**
 * Pemisah geser untuk halaman yang mengatur ukuran panel SENDIRI (state lebar/
 * tinggi + handler pointer), bukan lewat `ResizablePanelGroup`. Markup & gaya
 * sengaja identik dengan `ResizableHandle` supaya standar pemisah aplikasi
 * (strip 8px `bg-card`, garis 1px `bg-border` → `primary` saat hover, knob)
 * tetap satu meski mesin gesernya berbeda.
 */
function PemisahGeser({
  orientation = 'horizontal',
  withHandle,
  className,
  ...props
}: PropsPemisahGeser) {
  return (
    <div
      data-slot="resizable-handle"
      role="separator"
      aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
      className={cn(KELAS_PEMISAH, kelasArah(orientation), className)}
      {...props}
    >
      <IsiPemisah orientation={orientation} withHandle={withHandle} />
    </div>
  );
}

export {
  ResizablePanelGroup, ResizablePanel, ResizableAutoHidePanel, ResizableHandle, PemisahGeser,
};

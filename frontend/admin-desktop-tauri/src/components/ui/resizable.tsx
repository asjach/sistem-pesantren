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

  // Ref gabungan: internal (untuk collapse/expand) + ref dari pemanggil.
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
      className={cn(
        'relative z-10 flex shrink-0 items-center justify-center bg-transparent outline-none',
         orientation === 'horizontal' ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'absolute bg-border',
          orientation === 'horizontal' ? 'inset-y-0 w-px' : 'inset-x-0 h-px',
        )}
      />
      {withHandle && (
        <span
          className={cn(
            'relative z-10 flex items-center justify-center rounded-sm border bg-border',
            orientation === 'horizontal' ? 'h-4 w-2' : 'h-2 w-4',
          )}
        >
          <GripVertical
            className={cn('size-2 text-muted-foreground', orientation === 'vertical' && 'rotate-90')}
          />
        </span>
      )}
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableAutoHidePanel, ResizableHandle };

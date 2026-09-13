import { Group, Panel, Separator } from 'react-resizable-panels';
import { GripVertical } from '@/icons';
import { cn } from '@/lib/utils';

/** Pembungkus shadcn untuk react-resizable-panels v4 (Group/Panel/Separator).
 *  Bagian katalog "Resizable" menargetkan [data-slot='resizable-panel-group']. */

function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof Group>) {
  return (
    <Group
      data-slot="resizable-panel-group"
      className={cn('flex h-full w-full', className)}
      {...props}
    />
  );
}

function ResizablePanel(props: React.ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  orientation = 'horizontal',
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
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
          orientation === 'horizontal' ? 'inset-y-1 w-px' : 'inset-x-1 h-px',
        )}
      />
      {withHandle && (
        <span
          className={cn(
            'relative z-10 flex items-center justify-center rounded-sm border bg-border',
            orientation === 'horizontal' ? 'h-4 w-3' : 'h-3 w-4',
          )}
        >
          <GripVertical
            className={cn('size-2.5 text-muted-foreground', orientation === 'vertical' && 'rotate-90')}
          />
        </span>
      )}
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };

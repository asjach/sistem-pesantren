import * as React from 'react';
import { HoverCard as HoverCardPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

/** HoverCard Radix tak punya Provider; delay diatur per Root (openDelay). */
function HoverCard({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}

const HoverCardTrigger = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Trigger>
>((props, ref) => (
  <HoverCardPrimitive.Trigger ref={ref} data-slot="hover-card-trigger" {...props} />
));
HoverCardTrigger.displayName = HoverCardPrimitive.Trigger.displayName;

/**
 * Mematikan pointer pada pembungkus Popper milik Radix.
 *
 * `pointer-events: none` pada isi kartu saja tak cukup: Radix menyisipkan
 * `<div data-radix-popper-content-wrapper>` yang tetap menahan pointer,
 * sehingga sel/baris yang tertutup kartu tak bisa diklik. Wrapper itu ikut
 * dimatikan. Kartu hover memang hanya untuk dibaca, bukan diklik.
 */
function WrapperTanPointer({ children }: { children: React.ReactNode }) {
  const ref = React.useCallback((el: HTMLDivElement | null) => {
    const bungkus = el?.parentElement?.parentElement;
    if (bungkus instanceof HTMLElement) bungkus.style.pointerEvents = 'none';
  }, []);
  return <div ref={ref}>{children}</div>;
}

function HoverCardContent({
  className,
  align = 'center',
  sideOffset = 4,
  children,
  style,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal data-slot="hover-card-portal">
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        /* Inline (bukan kelas) supaya pasti: kartu hover tak boleh menahan
           klik ke tabel di bawahnya. `pointer-events` diwariskan ke anak,
           jadi cukup di elemen ini. */
        style={{ pointerEvents: 'none', ...style }}
        className={cn(
          'z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden',
          className,
        )}
        {...props}
      >
        <WrapperTanPointer>{children}</WrapperTanPointer>
      </HoverCardPrimitive.Content>
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
import * as React from "react"
import { Combobox as ComboboxPrimitive, type ComboboxRoot as ComboboxRootNs } from "@base-ui/react/combobox"
import { Check as CheckIcon, ChevronDown as ChevronDownIcon } from '@/icons'
import { cn } from "@/lib/utils"

function ComboboxRoot<Value, Multiple extends boolean | undefined = false, Item = Value>(
  props: ComboboxRootNs.Props<Value, Multiple, Item>,
) {
  return <ComboboxPrimitive.Root {...props} />
}

function ComboboxInput({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Input>) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      {...props}
      className={cn(
        "h-[26px] w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
    />
  )
}

function ComboboxTrigger({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Trigger>) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      {...props}
      className={cn(
        "grid size-[26px] shrink-0 place-items-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      <ChevronDownIcon className="size-4 opacity-50" />
    </ComboboxPrimitive.Trigger>
  )
}

function ComboboxContent({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Popup>) {

  const [elPopup, setElPopup] = React.useState<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (elPopup === null) return;
    const hentikan = (e: WheelEvent) => { e.stopPropagation(); };
    elPopup.addEventListener('wheel', hentikan);
    return () => { elPopup.removeEventListener('wheel', hentikan); };
  }, [elPopup]);
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner

        className="z-50 pointer-events-auto transition-[top,left] duration-150 ease-out"
        sideOffset={4}
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          {...props}
          ref={setElPopup}
          className={cn(
            "max-h-[min(20rem,var(--available-height))] w-(--anchor-width) min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border border-foreground/30 bg-popover text-popover-foreground shadow-md transition-[opacity,transform] duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            className
          )}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.List>) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      {...props}
      className={cn("p-0", className)}
    />
  )
}

function ComboboxItem({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Item>) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      {...props}
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1 text-xs select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-selected:bg-accent data-selected:text-accent-foreground",
        className
      )}
    />
  )
}

function ComboboxEmpty({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Empty>) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      {...props}

      className={cn("px-2 py-1.5 text-xs text-muted-foreground empty:py-0", className)}
    />
  )
}

function ComboboxItemIndicator({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.ItemIndicator>) {
  return (
    <ComboboxPrimitive.ItemIndicator
      data-slot="combobox-item-indicator"
      {...props}
      className={cn("ml-auto size-3.5 shrink-0", className)}
    >
      <CheckIcon className="size-3.5" />
    </ComboboxPrimitive.ItemIndicator>
  )
}

export {
  ComboboxRoot,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxItemIndicator,
}

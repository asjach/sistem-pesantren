import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Tabs as TabsPrimitive } from "radix-ui"
import { pakaiIndikatorGeser } from "@/components/ui/indikatorGeser";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  indikator = "netral",
  ref: refLuar,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants> & {
    /** Warna latar indikator geser: `netral` (dialog dkk) atau `primer`
     *  (strip tab halaman — hijaunya pindah ke indikator supaya ikut meluncur). */
    indikator?: "netral" | "primer";
  }) {
  const { refWadah, geometri } = pakaiIndikatorGeser<HTMLDivElement>("active");
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-indikator={indikator}
      ref={(node) => {
        refWadah.current = node;
        if (typeof refLuar === "function") refLuar(node);
        else if (refLuar !== null && refLuar !== undefined && typeof refLuar === "object") {
          (refLuar as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      }}
      className={cn(tabsListVariants({ variant }), "relative", className)}
      {...props}
    >
      {/* Latar aktif yang bergeser mengikuti trigger terpilih (mengalir). */}
      <span
        aria-hidden="true"
        data-slot="tabs-indicator"
        className={cn(
          "pointer-events-none absolute",
          variant === "line"
            ? "bottom-[-5px] h-0.5 bg-foreground"
            : indikator === "primer"
              ? "bg-primary shadow"
              : "border border-transparent bg-background shadow-sm dark:border-input dark:bg-input/30",
          geometri === null && "opacity-0",
        )}
        style={
          geometri === null
            ? undefined
            : variant === "line"
              ? { left: geometri.left, width: geometri.width }
              : { left: geometri.left, top: geometri.top, width: geometri.width, height: geometri.height }
        }
      />
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1 text-xs font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-[state=active]:text-foreground dark:data-[state=active]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }

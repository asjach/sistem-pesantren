import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // Netral (bukan warna aksen): kerangka muat tak boleh berkedip ungu
      // mengikuti tema — lihat PageFallback yang memakainya sehalaman penuh.
      className={cn("animate-pulse rounded-md bg-[color-mix(in_srgb,var(--foreground)_10%,var(--background))]", className)}
      {...props}
    />
  )
}

export { Skeleton }

import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "default" | "sm" | "xs"
}) {
  const ukuran = {
    default: "h-5 w-9",
    sm: "h-4 w-7",
    xs: "h-3.5 w-6",
  }[size]
  const thumbUkuran = {
    default: "size-4 data-[state=checked]:translate-x-4",
    sm: "size-3 data-[state=checked]:translate-x-3",
    xs: "size-2.5 data-[state=checked]:translate-x-2.5",
  }[size]
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        ukuran,
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background pointer-events-none block rounded-full ring-0 shadow-sm transition-transform data-[state=unchecked]:translate-x-0",
          thumbUkuran
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

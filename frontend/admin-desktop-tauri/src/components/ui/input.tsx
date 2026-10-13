import * as React from "react"
import { cn } from "@/lib/utils"

/** `forwardRef`: elemen input perlu dipegang langsung oleh pemanggil yang
 *  menulis ulang teksnya sendiri (mis. pemisah ribuan pada `LabeledInput`
 *  yang harus memulihkan posisi kursor setelah nilai diformat ulang). */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "h-[26px] w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-5 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
    )
  },
)

export { Input }

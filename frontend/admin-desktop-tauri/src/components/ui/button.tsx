import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground text-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/70 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs text-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80",
        ghost:
          "text-xs hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary text-xs underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-[22px] gap-1 rounded-md px-2 text-[11px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[26px] gap-1 rounded-md px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3.5",
        default: "h-[26px] px-3 py-0.5 text-xs has-[>svg]:px-2.5 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-[34px] rounded-md px-4 text-sm has-[>svg]:px-3 [&_svg:not([class*='size-'])]:size-[18px]",
        xl: "h-[40px] rounded-md px-5 text-sm has-[>svg]:px-4 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-6 [&_svg:not([class*='size-'])]:size-4",
        "icon-xs": "size-5 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-[18px]",
        "icon-xl": "size-8 rounded-md [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button"

    return (
      <Comp
        ref={ref}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

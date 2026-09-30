import * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Tombol ikon + tooltip shadcn (pengganti `title` bawaan).
 *  `tip` tampil sebagai tooltip sekaligus `aria-label`. */
const TombolIkon = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { tip: string }
>(function TombolIkon({ tip, children, ...props }, ref) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={tip} {...props} ref={ref}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tip}</p>
      </TooltipContent>
    </Tooltip>
  );
});

export default TombolIkon;

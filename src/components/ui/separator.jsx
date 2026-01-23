import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

const Separator = React.forwardRef((
  { className, orientation = "horizontal", decorative = true, ...props },
  ref
) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className
    )}
    {...props} />
))
Separator.displayName = SeparatorPrimitive.Root.displayName

/**
 * Separator component based on Radix UI.
 * Visually or semantically separates content.
 * 
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes
 * @param {'horizontal' | 'vertical'} [props.orientation='horizontal'] - Orientation of the separator
 * @param {boolean} [props.decorative=true] - Whether the separator is purely decorative
 * @returns {JSX.Element}
 */
export { Separator }

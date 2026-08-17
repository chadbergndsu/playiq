import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 text-sm text-fg placeholder:text-fg-subtle focus-ring",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

import React from "react";
import { cn } from "@/lib/utils";

type ListItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export default function ListItem({ active, className, children, ...props }: ListItemProps) {
  return (
    <button
      className={cn(
        "flex w-full flex-col items-start gap-1 rounded-md border border-border px-4 py-3 text-left transition duration-[var(--duration)] hover:bg-surface-2",
        active && "bg-primary-soft",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

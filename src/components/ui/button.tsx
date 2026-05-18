import React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

const baseStyles =
  "relative inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-[var(--duration)] focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover overflow-hidden",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-2 hover:border-border-strong",
  ghost: "bg-transparent text-text border border-border hover:bg-surface-2",
};

export default function Button({
  variant = "primary",
  loading,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const spinnerClass =
    variant === "primary"
      ? "border-on-primary border-t-on-primary"
      : "border-text border-t-text";

  return (
    <button
      className={cn(baseStyles, variantStyles[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {/* 流光效果 - 仅 primary 按钮 */}
      {variant === "primary" && !disabled && !loading && (
        <span
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 ease-out group-hover:translate-x-full hover:translate-x-full"
          aria-hidden="true"
        />
      )}
      {loading && (
        <span
          className={cn(
            "h-4 w-4 animate-spin rounded-full border-2 opacity-70",
            spinnerClass
          )}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

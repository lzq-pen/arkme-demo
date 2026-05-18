import React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, value, defaultValue, onChange, ...props }: InputProps) {
  const [innerValue, setInnerValue] = React.useState<string>(
    typeof defaultValue === "string" ? defaultValue : ""
  );

  const isControlled = value !== undefined;

  return (
    <input
      className={cn(
        // 基础样式
        "w-full rounded-[12px] px-3 py-2.5 text-sm text-text",
        // 背景 - 半透明磨砂
        "bg-white/80 backdrop-blur-sm",
        // 边框 - 默认透明，聚焦时不变
        "border border-transparent",
        // 占位符
        "placeholder:text-input-placeholder",
        // 过渡动画
        "transition-all duration-[160ms] ease-out",
        // Focus 状态 - 柔和光晕（霓虹灯效果）
        "focus:outline-none focus-visible:outline-none",
        "focus:shadow-[0_0_0_1px_rgba(9,184,62,0.2),0_0_12px_rgba(9,184,62,0.15)]",
        "focus-visible:shadow-[0_0_0_1px_rgba(9,184,62,0.2),0_0_12px_rgba(9,184,62,0.15)]",
        className
      )}
      value={isControlled ? value : innerValue}
      onChange={(event) => {
        if (!isControlled) {
          setInnerValue(event.target.value);
        }
        onChange?.(event);
      }}
      {...props}
    />
  );
}

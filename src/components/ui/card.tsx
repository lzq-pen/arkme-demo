import React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export default function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        // 基础样式
        "rounded-md",
        // 背景 - 半透明磨砂
        "bg-white/80 backdrop-blur-sm",
        // 边框 - 极淡
        "border border-gray-6/30",
        // 阴影 - 柔和层次
        "shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)]",
        // 过渡动画
        "transition-shadow duration-[var(--duration)]",
        // 悬停提升效果
        "hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.03)]",
        className
      )}
      {...props}
    />
  );
}

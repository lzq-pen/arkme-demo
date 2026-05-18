import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 背景色
        bg: "var(--bg)",
        "sidebar-bg": "var(--sidebar-bg)",

        // 表面色
        surface: "var(--surface)",
        "surface-muted": "var(--surface-muted)",
        "surface-subtle": "var(--surface-subtle)",
        "surface-2": "var(--surface-2)",

        // 灰度系统
        gray: {
          1: "var(--gray-1)",
          2: "var(--gray-2)",
          3: "var(--gray-3)",
          4: "var(--gray-4)",
          5: "var(--gray-5)",
          6: "var(--gray-6)",
          7: "var(--gray-7)",
          8: "var(--gray-8)",
        },

        // 输入框
        "input-bg": "var(--input-bg)",
        "input-bg-focus": "var(--input-bg-focus)",
        "input-border": "var(--input-border)",
        "input-border-focus": "var(--input-border-focus)",
        "input-placeholder": "var(--input-placeholder)",
        "input-selected": "var(--input-selected)",

        // 边框
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        "border-light": "var(--border-light)",

        // 文字
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        "text-tertiary": "var(--text-tertiary)",
        "text-disabled": "var(--text-disabled)",

        // 主色
        primary: "var(--primary)",
        "primary-soft": "var(--primary-soft)",
        "primary-selected": "var(--primary-selected)",
        "primary-hover": "var(--primary-hover)",
        "on-primary": "var(--on-primary)",

        // Hover
        "hover-overlay": "var(--hover-overlay)",

        // 功能色
        danger: "var(--danger)",
        success: "var(--success)",
        warning: "var(--warning)",
        link: "var(--link)",

        // VIP色
        vip: "var(--vip)",
        "vip-soft": "var(--vip-soft)",
        svip: "var(--svip)",
        "svip-soft": "var(--svip-soft)",

        // 遮罩
        overlay: "var(--overlay)",
        "overlay-light": "var(--overlay-light)",

        // 对话框
        "dialog-bg": "var(--dialog-bg)",
        "dialog-hover": "var(--dialog-hover)",

        // 填充
        "fill-1": "var(--fill-1)",
        "fill-2": "var(--fill-2)",
        "fill-3": "var(--fill-3)",
        "fill-4": "var(--fill-4)",

        // 标签色
        tag: {
          orange: "var(--tag-orange)",
          pink: "var(--tag-pink)",
          purple: "var(--tag-purple)",
          red: "var(--tag-red)",
          green: "var(--tag-green)",
          blue: "var(--tag-blue)",
          cyan: "var(--tag-cyan)",
          yellow: "var(--tag-yellow)",
        },
      },
      borderRadius: {
        1: "var(--radius-1)",
        2: "var(--radius-2)",
        3: "var(--radius-3)",
        4: "var(--radius-4)",
        5: "var(--radius-5)",
        6: "var(--radius-6)",
        // 兼容旧命名
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        soft: "var(--shadow-sm)",
        lift: "var(--shadow-md)",
        heavy: "var(--shadow-lg)",
        focus: "var(--focus-ring)",
        // 微光效果
        "glow-primary": "var(--glow-primary)",
        "glow-soft": "var(--glow-primary-soft)",
        "glow-surface": "var(--glow-surface)",
        // 气泡阴影
        bubble: "0 2px 8px rgba(0, 0, 0, 0.04)",
        // 选中态内发光
        "selected-inner": "0 1px 2px rgba(255, 255, 255, 0.6) inset, 0 0 12px rgba(9, 184, 62, 0.06)",
      },
      animation: {
        "fade-in-up": "fade-in-up 0.3s ease-out forwards",
        "fade-in-scale": "fade-in-scale 0.2s ease-out forwards",
        skeleton: "skeleton-pulse 1.5s ease-in-out infinite",
        shimmer: "shimmer 0.5s ease forwards",
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "skeleton-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
      },
    },
  },
  plugins: [],
} satisfies Config;

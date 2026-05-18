import React from "react";
import ReactDOM from "react-dom";
import { cn } from "@/lib/utils";
import Button from "./button";

type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  closeLabel?: string;
};

export default function Modal({
  open,
  title,
  onClose,
  children,
  className,
  closeLabel = "Close",
}: ModalProps) {
  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative z-10 w-[520px] max-w-[90vw] rounded-md border border-border bg-surface p-6 shadow-lift",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-base font-semibold text-text">{title}</h2>}
          <Button variant="ghost" onClick={onClose} aria-label={closeLabel}>
            {closeLabel}
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

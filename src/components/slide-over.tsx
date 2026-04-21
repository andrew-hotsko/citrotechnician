"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type SlideOverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Header-right slot for action buttons */
  actions?: React.ReactNode;
  /** Width in px (default 520) */
  width?: number;
  children: React.ReactNode;
};

/**
 * SlideOver — right-side drawer primitive used for job detail, property detail,
 * and any focused secondary flow. Built on shadcn's Sheet.
 */
export function SlideOver({
  open,
  onOpenChange,
  title,
  description,
  actions,
  width = 520,
  children,
}: SlideOverProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn("flex flex-col gap-0 p-0 sm:max-w-none")}
        style={{ width }}
      >
        <SheetHeader className="flex-row items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 space-y-0">
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-[15px] font-semibold tracking-tight truncate">
              {title}
            </SheetTitle>
            {description ? (
              <SheetDescription className="text-xs text-neutral-500 mt-0.5">
                {description}
              </SheetDescription>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {actions}
            <SheetClose
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </SheetClose>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

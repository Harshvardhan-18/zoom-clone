"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/** Client-side provider wrapper — keeps layout.tsx a pure Server Component. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <Toaster position="top-right" richColors />
    </TooltipProvider>
  );
}

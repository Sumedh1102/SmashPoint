"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass({ variant: "ghostLight" })}>
      <Printer className="size-4" /> Print / save PDF
    </button>
  );
}

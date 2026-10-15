"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/button";

export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="grid min-h-[80vh] place-items-center bg-ink px-4 py-24 text-white">
      <div className="max-w-lg text-center">
        <p className="eyebrow text-lime">Something went wrong</p>
        <h1 className="display mt-4 text-[clamp(2.8rem,9vw,5rem)]">Out of bounds.</h1>
        <p className="mt-4 text-white/70">
          We couldn&apos;t load this page{error.digest ? ` (ref ${error.digest})` : ""}. Your bookings and payments are not affected.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => retry()}>Try again</Button>
          <Link href="/" className={buttonClass({ variant: "ghostLight" })}>
            Go to the home page
          </Link>
        </div>
      </div>
    </main>
  );
}

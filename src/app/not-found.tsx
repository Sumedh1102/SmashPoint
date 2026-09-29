import Link from "next/link";
import { Shuttlecock } from "@/components/brand/illustrations";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="max-w-xl text-center">
        <Shuttlecock className="mx-auto size-24" />
        <p className="mt-6 font-mono text-sm font-medium uppercase tracking-widest text-brand">Error 404 · Out!</p>
        <h1 className="mt-3 text-5xl font-semibold leading-none md:text-7xl">That shot landed outside the lines.</h1>
        <p className="mt-5 text-lg text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" size="lg">
            Back to home
          </ButtonLink>
          <ButtonLink href="/book" size="lg" variant="outline">
            Book a court
          </ButtonLink>
        </div>
        <p className="mt-8 text-sm text-muted">
          Need help? <Link href="/contact" className="font-medium underline">Contact the front desk</Link>
        </p>
      </div>
    </main>
  );
}

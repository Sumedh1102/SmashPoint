import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { NavigationBar } from "@/components/site/navigation-bar";

export default function NotFound() {
  return (
    <>
      <NavigationBar />
      <main id="main" className="grid min-h-dvh place-items-center bg-ink px-4 py-24 text-white">
        <div className="max-w-lg text-center">
          <p className="eyebrow text-gold">404</p>
          <h1 className="display mt-4 text-[clamp(3rem,10vw,6rem)]">Let. Replay.</h1>
          <p className="mt-4 text-white/70">That page doesn&apos;t exist, or the link has expired. If you were looking for a booking, use the link from your confirmation email.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/#book" className={buttonClass({ variant: "primary" })}>
              Book a court
            </Link>
            <Link href="/" className={buttonClass({ variant: "ghostLight" })}>
              Home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

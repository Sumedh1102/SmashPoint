import { RevealObserver } from "@/components/motion/reveal-observer";
import { NavigationBar } from "@/components/site/navigation-bar";
import { SiteFooter } from "@/components/site/site-footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavigationBar />
      <main id="main">{children}</main>
      <SiteFooter />
      <RevealObserver />
    </>
  );
}

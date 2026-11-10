import { BookingSelectionProvider } from "@/components/booking/selection-context";
import { NavigationBar } from "@/components/site/navigation-bar";
import { SiteFooter } from "@/components/site/site-footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookingSelectionProvider>
      <NavigationBar />
      <main id="main">{children}</main>
      <SiteFooter />
    </BookingSelectionProvider>
  );
}

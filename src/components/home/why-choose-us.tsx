import { Award, CalendarRange, LayoutGrid, Layers, ShieldCheck, Zap } from "lucide-react";
import { SectionHeading } from "./section-heading";

/** Only what the rate card states or the booking system does — no invented amenities. */
const REASONS = [
  { icon: LayoutGrid, title: "Three sports, one destination", body: "Badminton, pickleball and basketball courts at one academy — bring the whole group." },
  { icon: Award, title: "State-certified coaches", body: "Coaches experienced in training players for state and national competitions." },
  { icon: Layers, title: "Your choice of badminton surface", body: "Play on a 5 mm green mat or a 2.5 mm wooden finish." },
  { icon: CalendarRange, title: "Hourly or monthly", body: "Book one or two hours online, or take a 1, 3, 6 or 12-month plan (Monday to Saturday)." },
  { icon: Zap, title: "Live availability", body: "See which slots are free right now and book in a few taps — no account needed." },
  { icon: ShieldCheck, title: "Secure, instant confirmation", body: "Pay with Razorpay. Your court is confirmed the moment the payment is verified." },
];

export function WhyChooseUs() {
  return (
    <section id="why" aria-labelledby="why-title" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="why-title"
          eyebrow="Why choose us"
          align="center"
          title={
            <>
              Made for <span className="text-royal">players.</span>
            </>
          }
          intro="Everything you need to get on court — and keep coming back."
        />
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {REASONS.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              data-reveal
              style={{ ["--reveal-delay" as string]: `${(i % 3) * 80}ms` }}
              className="group rounded-[var(--radius-card)] border border-line bg-paper p-6 transition-[border-color,background-color,box-shadow] duration-300 hover:border-royal/30 hover:bg-white hover:shadow-md sm:p-7"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-white text-royal shadow-sm ring-1 ring-line transition-colors group-hover:bg-royal group-hover:text-white">
                <Icon aria-hidden className="size-6" strokeWidth={1.8} />
              </span>
              <h3 className="display mt-6 text-[1.5rem]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

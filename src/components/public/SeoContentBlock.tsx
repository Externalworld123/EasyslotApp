import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const CITIES = [
  "bangalore", "chennai", "hyderabad", "pune", "vijayawada",
  "mumbai", "delhi-ncr", "visakhapatnam", "guntur",
];
const SPORTS = [
  "badminton", "football", "cricket", "tennis", "basketball",
  "swimming", "table_tennis", "squash", "volleyball",
];

const SPORT_LABEL: Record<string, string> = {
  badminton: "Badminton Courts", football: "Football Grounds", cricket: "Cricket Grounds",
  tennis: "Tennis Courts", basketball: "Basketball Courts", swimming: "Swimming Pools",
  table_tennis: "Table Tennis Clubs", squash: "Squash Courts", volleyball: "Volleyball Courts",
};
const SPORT_SHORT: Record<string, string> = {
  badminton: "Badminton", football: "Football", cricket: "Cricket",
  tennis: "Tennis", basketball: "Basketball", swimming: "Swimming",
  table_tennis: "Table Tennis", squash: "Squash", volleyball: "Volleyball",
};
const CITY_LABEL: Record<string, string> = {
  hyderabad: "Hyderabad", bangalore: "Bangalore", chennai: "Chennai",
  mumbai: "Mumbai", delhi: "Delhi", pune: "Pune", vijayawada: "Vijayawada",
  "delhi-ncr": "Delhi NCR", visakhapatnam: "Visakhapatnam", guntur: "Guntur",
};

interface SeoContentBlockProps {
  city?: string;
  sport?: string;
}

/* ── FAQ data (reused for UI + JSON-LD) ── */
const FAQ_ITEMS = [
  {
    q: "What is EasySlot booking?",
    a: "EasySlot is India's leading online sports slot booking platform. It lets you discover, compare, and instantly book cricket turfs, badminton courts, football grounds, tennis courts and more — all without creating an account. Just search, pick a time, and play.",
  },
  {
    q: "How do I book a slot on EasySlot?",
    a: "Simply visit the EasySlot booking page, search for venues near you, select a sport and an available time slot, enter your name and phone number, and confirm. The entire process takes under 30 seconds. You'll receive a booking confirmation with a QR code to show at the venue.",
  },
  {
    q: "Is EasySlot available in India?",
    a: "Yes! EasySlot is available across major Indian cities including Hyderabad, Bangalore, Chennai, Mumbai, Delhi NCR, Pune, Vijayawada, Visakhapatnam, and Guntur. We're expanding to more cities every month.",
  },
  {
    q: "Can I pay using UPI?",
    a: "Absolutely. EasySlot supports multiple payment options including UPI (Google Pay, PhonePe, Paytm), cash at the venue, and card payments. Most users prefer to pay at the venue for maximum convenience.",
  },
  {
    q: "Do I need to create an account to book?",
    a: "No account is needed. EasySlot allows instant booking with just your name and phone number. Your booking history is accessible anytime by entering your phone number on the My Bookings page.",
  },
  {
    q: "Which sports can I book on EasySlot?",
    a: "EasySlot supports badminton, tennis, cricket, football, basketball, swimming, table tennis, squash, and volleyball. Availability depends on the venues in your area.",
  },
  {
    q: "Can I cancel or reschedule my booking?",
    a: "Cancellation policies vary by venue. Most venues allow free cancellation up to 2 hours before the booked slot. Check the venue's cancellation policy on its detail page before confirming your booking.",
  },
];
/* ── Reusable collapsible SEO link matrix ── */
export function SeoLinkMatrix() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <h2 className="text-lg font-bold text-foreground">
          Find Sports Venues Across India
        </h2>
        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="space-y-6 mt-5">
          {CITIES.map((c) => {
            const cLabel = CITY_LABEL[c];
            return (
              <div key={c}>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-2">
                  {cLabel}
                </h3>
                <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                  <Link
                    to={`/easyslot-booking/${c}`}
                    className="text-xs text-primary hover:text-primary/80 hover:underline"
                  >
                    Sports Complexes in {cLabel}
                  </Link>
                  {SPORTS.map((s) => (
                    <span key={s} className="flex items-center">
                      <span className="text-muted-foreground mx-1 text-xs">·</span>
                      <Link
                        to={`/easyslot-booking/${c}/${s}`}
                        className="text-xs text-primary hover:text-primary/80 hover:underline"
                      >
                        {SPORT_LABEL[s]} in {cLabel}
                      </Link>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function SeoContentBlock({ city, sport }: SeoContentBlockProps) {
  const cityName = city ? CITY_LABEL[city] || city : null;
  const sportName = sport ? SPORT_SHORT[sport] || sport : null;
  const locationText = cityName || "your city";

  return (
    <div className="space-y-10">
      {/* ── Internal Links ── */}
      <section>
        <h3 className="text-sm font-bold text-foreground mb-3">Explore by Sport</h3>
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <Link key={s} to={city ? `/easyslot-booking/${city}/${s}` : `/easyslot-booking/${s}`}
              className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
              Book {SPORT_SHORT[s]} Courts
            </Link>
          ))}
        </div>
        <h3 className="text-sm font-bold text-foreground mt-5 mb-3">Explore by City</h3>
        <div className="flex flex-wrap gap-2">
          {CITIES.map((c) => (
            <Link key={c} to={sport ? `/easyslot-booking/${c}/${sport}` : `/easyslot-booking/${c}`}
              className="px-3 py-1.5 rounded-full bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors">
              Courts in {CITY_LABEL[c]}
            </Link>
          ))}
        </div>

        {/* Internal links to key pages */}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/easyslot-booking" className="text-xs text-primary underline hover:text-primary/80">
            Browse All Venues →
          </Link>
          <Link to="/my-bookings" className="text-xs text-primary underline hover:text-primary/80">
            View My Bookings →
          </Link>
        </div>
      </section>

      {/* ── City × Sport SEO Link Matrix (collapsible) ── */}
      <SeoLinkMatrix />

      {/* ── Long-Form SEO Content ── */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">
          EasySlot Booking – Complete Guide to Online Sports Slot Booking
        </h2>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-4">
          <p>
            EasySlot booking is the fastest way to find and reserve sports courts online in India.
            Whether you're looking to book a cricket turf for a weekend match, a badminton court
            for your daily practice, or a football ground for a friendly game, EasySlot connects
            you with top-rated sports facilities {cityName ? `in ${cityName} and ` : ""}across
            India — all with instant confirmation and zero hassle.
          </p>

          <h3 className="text-base font-semibold text-foreground pt-2">
            Why Choose EasySlot for Sports Slot Booking Online?
          </h3>
          <p>
            Traditional sports court booking involves calling venues, waiting for callbacks, and
            dealing with uncertain availability. EasySlot eliminates all of that. Our platform
            offers <strong>real-time slot availability</strong>, letting you see exactly which
            courts are free and at what price — no phone calls needed. You can complete your
            sports slot booking online in under 30 seconds, making it the fastest turf booking
            app in India.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Instant booking</strong> — no waiting, no callbacks. See availability and book immediately.</li>
            <li><strong>No login required</strong> — just enter your name and phone number. No app download needed.</li>
            <li><strong>Real-time availability</strong> — our system syncs with venue schedules every 15 seconds.</li>
            <li><strong>UPI & cash payments</strong> — pay using Google Pay, PhonePe, Paytm, or cash at the venue.</li>
            <li><strong>QR code confirmation</strong> — receive a digital QR code for hassle-free check-in at the sports center.</li>
          </ul>

          <h3 className="text-base font-semibold text-foreground pt-2">
            Types of Sports You Can Book on EasySlot
          </h3>
          <p>
            EasySlot supports a wide range of sports across indoor and outdoor venues. You can
            book sports ground online for <strong>cricket</strong> (box cricket nets, turf grounds),
            <strong> badminton</strong> (indoor courts with wooden or synthetic flooring),
            <strong> football</strong> (5-a-side, 7-a-side turfs), <strong>tennis</strong> (clay,
            hard court), <strong>basketball</strong>, <strong>swimming</strong>, table tennis,
            squash, and volleyball. Each venue listing shows court type, surface details, capacity,
            and hourly pricing so you can make informed decisions.
          </p>

          <h3 className="text-base font-semibold text-foreground pt-2">
            Discover Sports Venues Near You{cityName ? ` in ${cityName}` : ""}
          </h3>
          <p>
            Finding the right sports facility shouldn't be hard. EasySlot's venue discovery system
            lets you browse all available {sportName ? sportName.toLowerCase() + " courts" : "courts and turfs"} in{" "}
            {locationText} with detailed information including location, pricing, available time
            slots, and court specifications. Use our sport and city filters to narrow down results
            instantly. Whether you're searching for "badminton courts near me" or "cricket turf
            booking {cityName ? `in ${cityName}` : "near me"}", EasySlot shows you the best options
            with transparent pricing.
          </p>

          <h3 className="text-base font-semibold text-foreground pt-2">
            How EasySlot Booking Works
          </h3>
          <p>
            The booking process is designed to be effortless. First, browse available venues or search
            for a specific sport. Select your preferred date from the calendar — you can book up to
            7 days in advance. Tap on a venue card to view its courts, real-time slot availability,
            and pricing. Choose an available time slot, enter your name and phone number, and confirm.
            You'll instantly receive a booking confirmation with a unique QR code. Show this QR at the
            venue for seamless check-in. Your booking history is always accessible via the
            {" "}<Link to="/my-bookings" className="text-primary underline hover:text-primary/80">My Bookings</Link> page
            using your phone number.
          </p>

          <h3 className="text-base font-semibold text-foreground pt-2">
            For Sports Center Owners — Grow with EasySlot
          </h3>
          <p>
            EasySlot isn't just for players — it's a complete sports center management platform.
            If you own or manage a sports facility, EasySlot provides a powerful SaaS dashboard to
            manage court bookings, track revenue, handle walk-in customers, set dynamic pricing rules,
            and view detailed analytics. Our platform helps you fill empty slots, reduce no-shows with
            automated reminders, and grow your business with zero upfront cost.
          </p>

          <h3 className="text-base font-semibold text-foreground pt-2">
            Book Sports Ground Online — Anywhere, Anytime
          </h3>
          <p>
            EasySlot is available across major Indian cities including Hyderabad, Bangalore, Chennai,
            Mumbai, Delhi NCR, Pune, Vijayawada, Visakhapatnam, and Guntur, with more cities being
            added regularly. Our mobile-optimized platform works perfectly on any device — no app
            download required. Start browsing available
            {" "}<Link to="/easyslot-booking" className="text-primary underline hover:text-primary/80">sports venues now</Link> and
            book your next game in seconds.
          </p>
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`q${i}`}>
              <AccordionTrigger className="text-sm text-left">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ── SEO Footer ── */}
      <footer className="border-t border-border pt-6 pb-8">
        <p className="text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} EasySlot — Book badminton courts, cricket turfs, football grounds
          and more sports facilities near you. Instant sports slot booking online with real-time availability.
        </p>
      </footer>
    </div>
  );
}

/* ── JSON-LD Schema Markup (WebPage + FAQPage) ── */
export function SeoJsonLd({ city, sport }: { city?: string; sport?: string }) {
  const cityName = city ? CITY_LABEL[city] || city : "India";
  const sportName = sport ? SPORT_SHORT[sport] || sport : "Sports";

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Book ${sportName} Courts in ${cityName} | EasySlot`,
    description: `Find and book ${sportName.toLowerCase()} courts, turfs, and facilities in ${cityName}. Instant booking with real-time availability on EasySlot.`,
    url: `https://easyslot.co.in/easyslot-booking${city ? `/${city}` : ""}${sport ? `/${sport}` : ""}`,
    mainEntity: {
      "@type": "SportsActivityLocation",
      name: `${sportName} Courts in ${cityName}`,
      description: `Book ${sportName.toLowerCase()} courts and sports facilities in ${cityName}`,
      address: {
        "@type": "PostalAddress",
        addressLocality: cityName,
        addressCountry: "IN",
      },
    },
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `https://easyslot.co.in/easyslot-booking${city ? `/${city}` : ""}`,
      },
      result: {
        "@type": "Reservation",
        name: `${sportName} Court Booking`,
      },
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </>
  );
}

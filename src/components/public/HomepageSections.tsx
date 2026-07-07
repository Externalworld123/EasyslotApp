import { useNavigate } from "react-router-dom";
import {
  Zap,
  Shield,
  Users,
  LogIn,
  MapPin,
  Star,
  Clock,
  CheckCircle,
  Smartphone,
  ArrowRight,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ─────────── Live Slot Preview ─────────── */
export function LiveSlotPreview() {
  const navigate = useNavigate();
  const slots = [
    { time: "06:00 AM", status: "available" },
    { time: "07:00 AM", status: "booked" },
    { time: "08:00 AM", status: "available" },
    { time: "09:00 AM", status: "booked" },
    { time: "10:00 AM", status: "available" },
    { time: "11:00 AM", status: "booked" },
  ];

  return (
    <section className="mt-12 px-4">
      <h2 className="text-lg font-bold text-foreground mb-0.5">See Live Availability & Book Instantly</h2>
      <p className="text-sm text-muted-foreground mb-5">Real-time slot status — no guessing</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {slots.map((s) => (
          <div
            key={s.time}
            className={cn(
              "flex flex-col items-center py-3.5 px-2 rounded-xl border text-center transition-colors",
              s.status === "available" ? "bg-success/10 border-success/30" : "bg-muted/40 border-border opacity-60",
            )}
          >
            <span className="text-xs font-bold text-foreground">{s.time}</span>
            <span
              className={cn(
                "text-[10px] mt-1.5 font-semibold uppercase tracking-wide",
                s.status === "available" ? "text-success" : "text-muted-foreground",
              )}
            >
              {s.status === "available" ? "Available" : "Booked"}
            </span>
          </div>
        ))}
      </div>
      <Button
        className="mt-5 rounded-full h-12 px-6 font-bold text-sm shadow-md touch-manipulation"
        onClick={() => navigate("/easyslot-booking")}
      >
        Check Slots Now <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </section>
  );
}

/* ─────────── Why EasySlot ─────────── */
export function WhyEasySlot() {
  const benefits = [
    { icon: Zap, title: "Instant Booking", desc: "Book in seconds, no waiting" },
    { icon: Star, title: "Top Venues", desc: "Curated quality sports facilities" },
    { icon: LogIn, title: "No Login Required", desc: "Book as a guest, pay at venue" },
    { icon: Users, title: "Find Players", desc: "Connect with nearby players" },
  ];

  return (
    <section className="mt-12 px-4">
      <h2 className="text-lg font-bold text-foreground mb-5">Why Choose EasySlot?</h2>
      <div className="grid grid-cols-2 gap-4">
        {benefits.map((b) => (
          <Card key={b.title} className="border-border rounded-2xl">
            <CardContent className="p-5 flex flex-col items-center text-center gap-2.5">
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
                <b.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground">{b.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ─────────── Social Proof ─────────── */
export function SocialProof() {
  const testimonials = [
    { name: "Rahul S.", text: "Booked a football turf in 30 seconds. Best experience ever!", rating: 5 },
    { name: "Priya M.", text: "Love the live availability feature. No more calling venues!", rating: 5 },
    { name: "Arjun K.", text: "Found amazing cricket nets near me. Will use again!", rating: 4 },
  ];
  const stats = [
    { value: "1000+", label: "Bookings" },
    { value: "50+", label: "Venues" },
    { value: "500+", label: "Players" },
  ];

  return (
    <section className="mt-12 px-4">
      <h2 className="text-lg font-bold text-foreground mb-5">Trusted by Players</h2>
      <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
        {testimonials.map((t) => (
          <Card key={t.name} className="min-w-[270px] shrink-0 border-border rounded-2xl snap-start">
            <CardContent className="p-5">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-warning fill-warning" />
                ))}
              </div>
              <p className="text-sm text-foreground italic leading-relaxed">"{t.text}"</p>
              <p className="text-xs text-muted-foreground mt-3 font-semibold">— {t.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 mt-6">
        {stats.map((s) => (
          <div key={s.label} className="text-center py-4 rounded-2xl bg-primary/5 border border-primary/10">
            <p className="text-2xl font-extrabold text-primary">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────── Venue Owner CTA ─────────── */
export function VenueOwnerCTA() {
  const benefits = ["Get more bookings automatically", "Manage slots & schedules easily", "Grow your business online"];

  return (
    <section className="mt-10 mx-4 rounded-2xl bg-gradient-to-br from-secondary to-primary p-6 text-primary-foreground">
      <h2 className="text-lg font-bold">Own a Sports Venue?</h2>
      <p className="text-sm text-primary-foreground/80 mt-1 mb-4">Join EasySlot and fill your empty slots</p>
      <ul className="space-y-2 mb-5">
        {benefits.map((b) => (
          <li key={b} className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 shrink-0" /> {b}
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        className="rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 border-0 font-semibold"
      >
        List Your Venue <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </section>
  );
}


/* ─────────── SEO Articles ─────────── */
export function SeoArticles() {
  const articles = [
    {
      title: "Top 10 Football Turfs in Hyderabad",
      desc: "Discover the best football turfs with floodlights, artificial grass, and great facilities.",
    },
    {
      title: "Best Badminton Courts Near You",
      desc: "Find wooden and synthetic courts with flexible hourly bookings.",
    },
    { title: "How to Book Turf Online", desc: "A step-by-step guide to booking your sports slot in under 30 seconds." },
  ];

  return (
    <section className="mt-10 px-4">
      <h2 className="text-lg font-bold text-foreground mb-4">Explore Sports in Hyderabad</h2>
      <div className="space-y-3">
        {articles.map((a) => (
          <Card key={a.title} className="border-border rounded-2xl cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold text-foreground">{a.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{a.desc}</p>
              <span className="text-xs text-primary font-medium mt-2 inline-block">Read More →</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ─────────── Footer ─────────── */
export function HomepageFooter() {
  const links = [
    { label: "About", href: "#" },
    { label: "Contact", href: "#" },
    { label: "Privacy Policy", href: "#" },
    { label: "Terms", href: "#" },
  ];
  const socials = [
    { icon: Facebook, href: "#" },
    { icon: Twitter, href: "#" },
    { icon: Instagram, href: "https://www.instagram.com/easyslot_booking/" },
    { icon: Youtube, href: "#" },
  ];

  return (
    <footer className="mt-14 border-t border-border bg-card">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-base font-bold text-foreground">EasySlot</span>
        </div>
        <div className="flex flex-wrap gap-5 mb-5">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex gap-3 mb-5">
          {socials.map((s, i) => (
            <a
              key={i}
              href={s.href}
              className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors touch-manipulation"
            >
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </a>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">© 2026 EasySlot. All rights reserved.</p>
      </div>
    </footer>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface OfferCard {
  id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  metadata: any;
}

export default function OfferCarousel() {
  const { data: offers } = useQuery({
    queryKey: ["public-offer-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_content")
        .select("*")
        .eq("section_key", "offer_card")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as OfferCard[];
    },
    staleTime: 60_000,
  });

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start" },
    [Autoplay({ delay: 3500, stopOnInteraction: false })]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  if (!offers || offers.length === 0) return null;

  return (
    <div className="mx-4 mt-4">
      <div ref={emblaRef} className="overflow-hidden rounded-2xl">
        <div className="flex">
          {offers.map((offer) => {
            const bgColor = offer.metadata?.bg_color || "hsl(var(--primary))";
            const textColor = offer.metadata?.text_color || "hsl(var(--primary-foreground))";
            return (
              <div key={offer.id} className="flex-[0_0_100%] min-w-0">
                <a
                  href={offer.link_url || "#"}
                  onClick={(e) => !offer.link_url && e.preventDefault()}
                  className="block"
                >
                  <div
                    className="relative h-36 sm:h-40 rounded-2xl overflow-hidden flex items-center"
                    style={{ background: offer.image_url ? undefined : bgColor }}
                  >
                    {offer.image_url && (
                      <img
                        src={offer.image_url}
                        alt={offer.title || "Offer"}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <div
                      className={cn(
                        "relative z-10 px-5 py-4 w-full",
                        offer.image_url && "bg-gradient-to-r from-black/60 to-transparent"
                      )}
                    >
                      {offer.subtitle && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider opacity-80"
                          style={{ color: offer.image_url ? "#fff" : textColor }}
                        >
                          {offer.subtitle}
                        </span>
                      )}
                      {offer.title && (
                        <h3
                          className="text-lg sm:text-xl font-extrabold leading-tight mt-0.5"
                          style={{ color: offer.image_url ? "#fff" : textColor }}
                        >
                          {offer.title}
                        </h3>
                      )}
                      {offer.description && (
                        <p
                          className="text-xs mt-1 opacity-90 max-w-[240px]"
                          style={{ color: offer.image_url ? "#fff" : textColor }}
                        >
                          {offer.description}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              </div>
            );
          })}
        </div>
      </div>
      {/* Dots */}
      {offers.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {offers.map((_, i) => (
            <button
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === selectedIndex ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
              onClick={() => emblaApi?.scrollTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

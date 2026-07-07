import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ShoppingCart, X, Loader2, Trash2, Clock, Split, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { cartTotal, formatHourRange, type CartItem } from "@/lib/playoBooking";

interface Props {
  cart: CartItem[];
  onRemove: (key: string) => void;
  onClear: () => void;
  onConfirm: (customer: { name: string; phone: string; depositUpi?: number; depositCash?: number }) => Promise<void>;
  onUpdateDuration?: (key: string, hours: number) => void;
  onUpdateStart?: (key: string, startHour: number) => void;
  onSplit?: (key: string) => void;
  /** Controlled open state — when provided, parent owns open/close so the
   *  cart sheet does not collapse on re-renders, route returns, or app
   *  backgrounding. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Half-hour granularity so users can book "6:30am to 9:30am" style ranges.
const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6] as const;
const CUSTOMER_KEY = "easyslot_cart_customer";

// Generate selectable start times in 30-min steps from 5:00 to 23:30.
const START_OPTIONS: number[] = (() => {
  const arr: number[] = [];
  for (let h = 0; h < 24; h++) {
    arr.push(h);
    arr.push(h + 0.5);
  }
  return arr;
})();

const fmtHour = (h: number) => {
  const d = new Date();
  d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
  return format(d, "h:mm a");
};

export function BookingCart({ cart, onRemove, onClear, onConfirm, onUpdateDuration, onUpdateStart, onSplit, open: openProp, onOpenChange }: Props) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setOpenState(v);
  };
  const [name, setName] = useState<string>(() => {
    try { return JSON.parse(sessionStorage.getItem(CUSTOMER_KEY) ?? "{}").name ?? ""; } catch { return ""; }
  });
  const [phone, setPhone] = useState<string>(() => {
    try { return JSON.parse(sessionStorage.getItem(CUSTOMER_KEY) ?? "{}").phone ?? ""; } catch { return ""; }
  });
  const [submitting, setSubmitting] = useState(false);
  const [depositUpi, setDepositUpi] = useState<string>("");
  const [depositCash, setDepositCash] = useState<string>("");

  // Persist customer fields so they survive backgrounding / lock / app switch.
  // Skip the first run so we don't overwrite stored values with the initial
  // render snapshot (prevents flicker when the app returns from background).
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) { hydratedRef.current = true; return; }
    try { sessionStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name, phone })); } catch {}
  }, [name, phone]);

  const total = cartTotal(cart);
  const canSubmit = name.trim().length > 0 && phone.trim().length >= 10 && cart.length > 0;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const upi = Number(depositUpi) || 0;
      const cash = Number(depositCash) || 0;
      await onConfirm({
        name: name.trim(),
        phone: phone.trim(),
        depositUpi: upi > 0 ? upi : undefined,
        depositCash: cash > 0 ? cash : undefined,
      });
      setName("");
      setPhone("");
      setDepositUpi("");
      setDepositCash("");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // (Save-as-Monthly-Plan was removed per UX request — handled from Monthly Plans page.)


  const formatRange = (startHour: number, hours: number) => {
    const start = new Date();
    start.setHours(Math.floor(startHour), (startHour % 1) * 60, 0, 0);
    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
    const fmt = (d: Date) => format(d, "hh:mm a").toLowerCase();
    return `${fmt(start)} - ${fmt(end)}`;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="lg"
          className={cn(
            "fixed bottom-20 right-4 md:bottom-6 md:right-6 h-14 rounded-full shadow-lg z-40 px-5 gap-2",
            cart.length === 0 && "opacity-60",
          )}
          disabled={cart.length === 0}
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="font-bold">{cart.length}</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">₹{total}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className={cn(
          "w-full sm:max-w-md flex flex-col p-0",
          // Smoother slide: restrict to transform, GPU compositing, and shorter
          // open duration so re-renders during the animation don't visibly jitter.
          "!transition-transform [transform:translateZ(0)] [backface-visibility:hidden] [will-change:transform]",
          "data-[state=open]:duration-300 data-[state=closed]:duration-200",
        )}
      >
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center justify-between">
            <span>Cart ({cart.length})</span>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClear}>
                <Trash2 className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Tap green slots to add to cart
              </p>
            ) : (
              cart.map((item) => {
                const key = `${item.resourceId}|${item.date}|${item.hour}`;
                const rangeLabel = formatRange(item.hour, item.hours);
                return (
                  <div
                    key={key}
                    className="rounded-2xl border border-border bg-card p-3 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {item.resourceName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(item.date + "T00:00:00"), "EEE, MMM d")} · {rangeLabel}
                        </p>
                      </div>
                      <Badge variant="secondary" className="font-bold tabular-nums shrink-0">
                        ₹{item.amount}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => onRemove(key)}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-full hover:bg-destructive/10 text-destructive touch-manipulation shrink-0"
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Start time picker (30-min increments) */}
                    {onUpdateStart && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[11px] text-muted-foreground mr-1">Starts</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="h-8 px-2.5 inline-flex items-center gap-1 rounded-full text-xs font-semibold bg-muted/60 text-foreground hover:bg-muted touch-manipulation"
                            >
                              {fmtHour(item.hour)}
                              <ChevronDown className="h-3 w-3 opacity-70" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="p-2 w-56"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                            <div
                              className="grid grid-cols-2 gap-1 max-h-[60vh] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] [touch-action:pan-y] pr-1"
                              onWheel={(e) => e.stopPropagation()}
                              onTouchMove={(e) => e.stopPropagation()}
                            >
                              {START_OPTIONS.map((h) => {
                                const active = Math.abs(item.hour - h) < 0.01;
                                return (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={() => !active && onUpdateStart(key, h)}
                                    className={cn(
                                      "h-10 px-2 rounded-md text-xs font-semibold tabular-nums touch-manipulation",
                                      active
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/40 text-foreground hover:bg-muted",
                                    )}
                                  >
                                    {fmtHour(h)}
                                  </button>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <span className="text-[11px] text-muted-foreground ml-auto">
                          ends {fmtHour(item.hour + item.hours)}
                        </span>
                      </div>
                    )}

                    {/* Inline duration editor + split */}
                    {(onUpdateDuration || onSplit) && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[11px] text-muted-foreground mr-1">Duration</span>
                        <div className="flex gap-1 flex-wrap">
                          {onUpdateDuration && DURATION_OPTIONS.map((h) => {
                            const active = Math.abs(item.hours - h) < 0.01;
                            return (
                              <button
                                key={h}
                                type="button"
                                onClick={() => !active && onUpdateDuration(key, h)}
                                className={cn(
                                  "h-8 min-w-[40px] px-2 rounded-full text-xs font-semibold tabular-nums transition-all touch-manipulation",
                                  active
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                              >
                                {h}h
                              </button>
                            );
                          })}
                        </div>
                        {onSplit && item.hours > 1 && (
                          <button
                            type="button"
                            onClick={() => onSplit(key)}
                            className="ml-auto h-8 px-2.5 inline-flex items-center gap-1 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors touch-manipulation"
                            aria-label="Split into 1-hour slots"
                          >
                            <Split className="h-3.5 w-3.5" />
                            Split
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {cart.length > 0 && (
          <>
            <Separator />
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Customer Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone *</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label className="text-xs font-semibold text-foreground">Deposit / Payment Split (optional)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">UPI (₹)</Label>
                    <Input
                      value={depositUpi}
                      onChange={(e) => setDepositUpi(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Cash (₹)</Label>
                    <Input
                      value={depositCash}
                      onChange={(e) => setDepositCash(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0"
                      inputMode="decimal"
                    />
                  </div>
                </div>
                {(Number(depositUpi) || 0) + (Number(depositCash) || 0) > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Paid now</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      ₹{(Number(depositUpi) || 0) + (Number(depositCash) || 0)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Total</span>
                  {(Number(depositUpi) || 0) + (Number(depositCash) || 0) > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      Balance ₹{Math.max(0, total - ((Number(depositUpi) || 0) + (Number(depositCash) || 0)))}
                    </span>
                  )}
                </div>
                <span className="text-xl font-bold text-foreground">₹{total}</span>
              </div>

              <Button
                className="w-full h-12 text-base font-bold"
                onClick={handleConfirm}
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : null}
                Confirm {cart.length} Booking{cart.length > 1 ? "s" : ""}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

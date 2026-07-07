import { useMemo } from "react";
import { format } from "date-fns";
import { MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface BookingInfo {
  customerName: string;
  customerPhone?: string | null;
  resourceName: string;
  centerName?: string;
  startTime: string | Date;
  durationMinutes?: number | null;
  amount?: number | null;
  paidAmount?: number | null;
}

interface Props {
  booking: BookingInfo;
  variant?: "icon" | "button" | "small";
  className?: string;
}

function buildMessage(b: BookingInfo): string {
  const start = new Date(b.startTime);
  const dateStr = format(start, "EEE, MMM d, yyyy");
  const startStr = format(start, "h:mm a");
  const endStr = b.durationMinutes
    ? format(new Date(start.getTime() + b.durationMinutes * 60000), "h:mm a")
    : null;
  const timeRange = endStr ? `${startStr} to ${endStr}` : startStr;
  const venue = b.centerName?.trim() || "Venue";
  const amount = Number(b.amount || 0);
  const paid = Number(b.paidAmount || 0);
  const pending = Math.max(0, amount - paid);
  const amt = amount > 0 ? `₹${amount.toFixed(0)}` : "";

  return `🏟️ Booking Details

📍 Venue: ${venue}
🎯 Court: ${b.resourceName}
👤 Name: ${b.customerName}
📞 Contact: ${b.customerPhone || "—"}
📅 Date: ${dateStr}
⏰ Time: ${timeRange}${amt ? `\n💰 Court price: ${amt}\n✅ Deposit paid: ₹${paid.toFixed(0)}\n⏳ Pending amount: ₹${pending.toFixed(0)}` : ""}

Booked via EasySlot ⚡
https://www.easyslot.co.in`;
}

function cleanPhone(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.length === 10) clean = "91" + clean;
  return clean;
}

export default function ShareBookingButton({ booking, variant = "icon", className }: Props) {
  const message = useMemo(() => buildMessage(booking), [booking]);

  const whatsappUrl = useMemo(() => {
    const phone = booking.customerPhone?.trim();
    const base = phone ? `https://wa.me/${cleanPhone(phone)}` : "https://wa.me/";
    return `${base}?text=${encodeURIComponent(message)}`;
  }, [booking.customerPhone, message]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    toast.success("Booking details copied!");
  };

  if (variant === "icon") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={className}>
            <Share2 className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-green-600" /> Share on WhatsApp
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopy}>
            📋 Copy Details
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === "small") {
    return (
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition-colors"
      >
        <Share2 className="h-3.5 w-3.5" /> Share
      </a>
    );
  }

  return (
    <Button variant="outline" className={className} onClick={() => window.open(whatsappUrl, "_blank")}>
      <MessageCircle className="h-4 w-4 mr-2 text-green-600" /> Share on WhatsApp
    </Button>
  );
}

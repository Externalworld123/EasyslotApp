import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { Copy, ExternalLink, MessageCircle, Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "sonner";

interface SessionLite {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  start_time: string;
  scheduled_end_time: string;
  resource_id: string;
  final_amount?: number | null;
  total_amount?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centerId: string | null;
  centerName: string;
  resourceName: string;
  session: SessionLite | null;
  onCollected?: () => void;
}

function cleanPhone(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.length === 10) clean = "91" + clean;
  return clean;
}

export function CollectPaymentDialog({
  open,
  onOpenChange,
  centerId,
  centerName,
  resourceName,
  session,
  onCollected,
}: Props) {
  const { format: fmtMoney, symbol } = useCurrency();
  const [upiId, setUpiId] = useState<string>("");
  const [loadingUpi, setLoadingUpi] = useState(false);
  const [amount, setAmount] = useState<string>("0");
  const [submitting, setSubmitting] = useState(false);

  const defaultAmount = session?.final_amount ?? session?.total_amount ?? 0;

  useEffect(() => {
    if (open) setAmount(String(defaultAmount || 0));
  }, [open, defaultAmount]);

  useEffect(() => {
    if (!open || !centerId) return;
    setLoadingUpi(true);
    supabase
      .from("centers")
      .select("upi_id")
      .eq("id", centerId)
      .maybeSingle()
      .then(({ data }) => {
        setUpiId((data as any)?.upi_id || "");
        setLoadingUpi(false);
      });
  }, [open, centerId]);

  const numericAmount = Number(amount) || 0;
  const payeeName = `EasySlot - ${centerName}`;

  const upiLink = useMemo(() => {
    if (!upiId) return "";
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
      payeeName,
    )}&am=${numericAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
      `Booking: ${resourceName}`,
    )}`;
  }, [upiId, payeeName, numericAmount, resourceName]);

  const whatsappMessage = useMemo(() => {
    if (!session) return "";
    const dateStr = format(new Date(session.start_time), "EEE, MMM d");
    const timeStr = format(new Date(session.start_time), "h:mm a");
    return `Hi ${session.customer_name}, please complete your payment for the booking at ${centerName}.

🎯 Court: ${resourceName}
📅 ${dateStr} · ⏰ ${timeStr}
💰 Amount: ${symbol}${numericAmount.toFixed(0)}

UPI ID: ${upiId}
Pay link: ${upiLink}

Thank you! — EasySlot`;
  }, [session, centerName, resourceName, numericAmount, upiId, upiLink, symbol]);

  const whatsappUrl = useMemo(() => {
    const phone = session?.customer_phone?.trim();
    const base = phone ? `https://wa.me/${cleanPhone(phone)}` : "https://wa.me/";
    return `${base}?text=${encodeURIComponent(whatsappMessage)}`;
  }, [session?.customer_phone, whatsappMessage]);

  const handleCopyUpi = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      toast.success("UPI ID copied");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleMarkPaid = async () => {
    if (!session || !centerId) return;
    if (numericAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { error: payErr } = await supabase.from("payments").insert({
        session_id: session.id,
        center_id: centerId,
        amount: numericAmount,
        method: "upi",
        payment_type: "full",
        received_by: userId,
      });
      if (payErr) throw payErr;

      await supabase
        .from("sessions")
        .update({ payment_status: "paid" })
        .eq("id", session.id);

      toast.success("Payment recorded");
      onCollected?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle>Collect Payment</DialogTitle>
          <DialogDescription>
            {session.customer_name} · {resourceName}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-xs">Amount ({symbol})</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Booking total: {fmtMoney(defaultAmount || 0)}
            </p>
          </div>

          {loadingUpi ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !upiId ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
              No UPI ID configured for this center. Add it in Settings to share QR.
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4">
                <QRCodeSVG value={upiLink} size={180} level="M" includeMargin />
                <p className="text-xs text-muted-foreground">Scan with any UPI app</p>
                <div className="flex items-center gap-2 w-full">
                  <code className="flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs font-mono">
                    {upiId}
                  </code>
                  <Button size="sm" variant="outline" onClick={handleCopyUpi}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(upiLink, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  Open UPI App
                </Button>
              </div>

              <Separator />

              <Button
                className="w-full h-11 bg-[#25D366] hover:bg-[#1fb955] text-white"
                onClick={() => window.open(whatsappUrl, "_blank")}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Share on WhatsApp
              </Button>
            </>
          )}

          <Button
            className="w-full h-11"
            disabled={submitting || numericAmount <= 0}
            onClick={handleMarkPaid}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Mark as Paid
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

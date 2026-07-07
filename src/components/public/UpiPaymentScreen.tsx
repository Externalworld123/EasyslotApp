import { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  Smartphone,
  Shield,
  CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { openRazorpayCheckout } from "@/lib/razorpay";

interface UpiPaymentScreenProps {
  sessionId: string;
  centerId: string;
  centerName: string;
  resourceName: string;
  amount: number;
  upiId: string;
  customerName: string;
  customerPhone: string;
  preBookMode?: boolean;
  onPaymentSubmitted: () => void;
}

export default function UpiPaymentScreen({
  sessionId,
  centerId,
  centerName,
  resourceName,
  amount,
  upiId,
  customerName,
  customerPhone,
  preBookMode = false,
  onPaymentSubmitted,
}: UpiPaymentScreenProps) {
  const [utrId, setUtrId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"razorpay" | "qr" | "link">("razorpay");
  const [rzpLoading, setRzpLoading] = useState(false);

  const payeeName = `EasySlot - ${centerName}`;

  const upiLink = useMemo(() => {
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
      payeeName
    )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
      `Booking: ${resourceName}`
    )}`;
  }, [upiId, payeeName, amount, resourceName]);

  const handleCopyUpi = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("UPI ID copied!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleSubmitPayment = async () => {
    if (!utrId.trim()) {
      toast.error("Please enter the UTR / Transaction ID");
      return;
    }
    if (utrId.trim().length < 6) {
      toast.error("Please enter a valid UTR ID (min 6 characters)");
      return;
    }

    setSubmitting(true);
    try {
      if (preBookMode) {
        // In pre-book mode, we store the payment info temporarily;
        // the actual public_payments record is created after booking
        // Store in sessionStorage so it survives the booking flow
        sessionStorage.setItem("easyslot_pending_payment", JSON.stringify({
          center_id: centerId,
          amount,
          utr_id: utrId.trim(),
          payment_method: "upi",
          customer_name: customerName,
          customer_phone: customerPhone,
        }));
        setSubmitted(true);
        toast.success("Payment details captured! Now confirm your booking.");
        onPaymentSubmitted();
      } else {
        const { error } = await supabase.from("public_payments").insert({
          session_id: sessionId,
          center_id: centerId,
          amount,
          utr_id: utrId.trim(),
          payment_method: "upi",
          status: "pending",
          customer_name: customerName,
          customer_phone: customerPhone,
        });

        if (error) throw error;

        setSubmitted(true);
        toast.success("Payment submitted for verification!");
        onPaymentSubmitted();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit payment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRazorpay = async () => {
    setRzpLoading(true);
    try {
      await openRazorpayCheckout({
        amount,
        name: payeeName,
        description: `Booking: ${resourceName}`,
        prefill: { name: customerName, contact: customerPhone },
        verifyContext: preBookMode
          ? undefined
          : {
              purpose: "booking",
              session_id: sessionId,
              center_id: centerId,
              customer_name: customerName,
              customer_phone: customerPhone,
            },
        notes: { resource: resourceName, center: centerName },
      });
      if (preBookMode) {
        sessionStorage.setItem("easyslot_pending_payment", JSON.stringify({
          center_id: centerId, amount,
          utr_id: "razorpay_paid",
          payment_method: "razorpay",
          customer_name: customerName, customer_phone: customerPhone,
        }));
      }
      setSubmitted(true);
      toast.success("Payment successful!");
      onPaymentSubmitted();
    } catch (e: any) {
      if (e.message !== "Payment cancelled") toast.error(e.message || "Payment failed");
    } finally {
      setRzpLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center space-y-4 py-6">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/15 mx-auto">
          <CheckCircle2 className="h-9 w-9 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          {preBookMode ? "Payment Details Captured!" : "Payment Submitted!"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {preBookMode
            ? "Click 'Confirm Booking' below to secure your slot."
            : "Your payment is being verified by the venue owner. You'll receive confirmation shortly."}
        </p>
        <Badge variant="outline" className="text-xs">
          UTR: {utrId}
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Amount Header - PG style */}
      <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Amount to Pay</p>
        <p className="text-3xl font-bold text-foreground">₹{amount.toFixed(0)}</p>
        <p className="text-xs text-muted-foreground mt-1">{payeeName}</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex rounded-lg bg-muted p-1 gap-1">
        <button
          onClick={() => setActiveTab("razorpay")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
            activeTab === "razorpay"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Card / UPI
        </button>
        <button
          onClick={() => setActiveTab("qr")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
            activeTab === "qr"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <QrCode className="h-4 w-4" />
          Scan QR
        </button>
        <button
          onClick={() => setActiveTab("link")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
            activeTab === "link"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Smartphone className="h-4 w-4" />
          UPI App
        </button>
      </div>

      {/* Razorpay Tab */}
      {activeTab === "razorpay" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium text-foreground">Pay securely with Razorpay</p>
            <p className="text-xs text-muted-foreground">
              Cards, UPI, Netbanking, Wallets — instant verification, no UTR needed.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold"
            onClick={handleRazorpay}
            disabled={rzpLoading}
          >
            {rzpLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CreditCard className="h-5 w-5 mr-2" />}
            Pay ₹{amount.toFixed(0)} Now
          </Button>
        </div>
      )}

      {/* QR Code Tab */}
      {activeTab === "qr" && (
        <div className="flex flex-col items-center space-y-3">
          <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
            <QRCodeSVG value={upiLink} size={200} level="H" includeMargin />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Open any UPI app and scan this QR code to pay
          </p>
        </div>
      )}

      {/* UPI App Tab */}
      {activeTab === "link" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border p-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">UPI ID</p>
              <p className="text-sm font-mono font-medium text-foreground truncate">{upiId}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyUpi}
              className="shrink-0 h-8"
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          <a
            href={upiLink}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Open UPI App & Pay ₹{amount.toFixed(0)}
          </a>
        </div>
      )}

      <Separator />

      {/* UTR Input */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" />
          Enter UTR / Transaction ID *
        </Label>
        <Input
          value={utrId}
          onChange={(e) => setUtrId(e.target.value)}
          placeholder="Enter 12-digit UTR number"
          className="h-12 text-base font-mono"
          maxLength={30}
        />
        <p className="text-xs text-muted-foreground">
          Find this in your UPI app → Transaction History → Reference/UTR ID
        </p>
      </div>

      <Button
        size="lg"
        className="w-full h-14 text-base font-semibold"
        onClick={handleSubmitPayment}
        disabled={submitting || !utrId.trim() || utrId.trim().length < 6}
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
        ) : null}
        {preBookMode ? "Submit Payment & Continue" : "Confirm Payment"}
      </Button>

      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
        <Shield className="h-3 w-3" />
        Payment verified by venue owner
      </p>
    </div>
  );
}

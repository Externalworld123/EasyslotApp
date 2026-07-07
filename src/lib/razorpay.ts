import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Razorpay checkout"));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export interface CheckoutOptions {
  amount: number; // in INR rupees
  currency?: string;
  receipt?: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  /** Verification context — sent to verify endpoint after success */
  verifyContext?: {
    purpose: "booking" | "subscription";
    session_id?: string;
    center_id?: string;
    organization_id?: string;
    customer_name?: string;
    customer_phone?: string;
  };
}

export interface CheckoutResult {
  verified: boolean;
  payment_id: string;
  order_id: string;
  signature: string;
}

/** Opens Razorpay Checkout. Resolves on verified success, rejects on failure/dismiss. */
export async function openRazorpayCheckout(opts: CheckoutOptions): Promise<CheckoutResult> {
  await loadRazorpayScript();

  const amountPaise = Math.round(opts.amount * 100);
  if (amountPaise < 100) throw new Error("Amount must be at least ₹1");

  // 1. Create order
  const { data: orderData, error: orderErr } = await supabase.functions.invoke(
    "razorpay-create-order",
    {
      body: {
        amount: amountPaise,
        currency: opts.currency || "INR",
        receipt: opts.receipt,
        notes: opts.notes,
      },
    },
  );
  if (orderErr) throw new Error(orderErr.message || "Failed to create order");
  if (!orderData?.order_id) throw new Error(orderData?.error || "Order not created");

  // 2. Open checkout
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency,
      order_id: orderData.order_id,
      name: opts.name,
      description: opts.description,
      prefill: opts.prefill,
      notes: opts.notes,
      theme: { color: opts.theme?.color || "#3B82F6" },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
      handler: async (resp: any) => {
        try {
          const { data: vData, error: vErr } = await supabase.functions.invoke(
            "razorpay-verify-payment",
            {
              body: {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
                amount: orderData.amount,
                ...(opts.verifyContext || {}),
              },
            },
          );
          if (vErr || !vData?.verified) {
            reject(new Error(vErr?.message || vData?.error || "Verification failed"));
            return;
          }
          resolve({
            verified: true,
            payment_id: resp.razorpay_payment_id,
            order_id: resp.razorpay_order_id,
            signature: resp.razorpay_signature,
          });
        } catch (e: any) {
          reject(new Error(e.message || "Verification failed"));
        }
      },
    });

    rzp.on("payment.failed", (resp: any) => {
      reject(new Error(resp?.error?.description || "Payment failed"));
    });

    rzp.open();
  });
}

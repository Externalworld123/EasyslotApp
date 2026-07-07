import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency as _format, currencySymbol } from "@/lib/currency";

export function useCurrency() {
  const { centerId } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ["center-settings", centerId],
    queryFn: async () => {
      if (!centerId) return null;
      const { data, error } = await supabase
        .from("center_settings")
        .select("default_currency")
        .eq("center_id", centerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
    staleTime: 5 * 60 * 1000, // 5 min — re-use across pages
  });

  const code = settings?.default_currency ?? "INR";

  return {
    currencyCode: code,
    symbol: currencySymbol(code),
    format: (amount: number) => _format(amount, code),
  };
}

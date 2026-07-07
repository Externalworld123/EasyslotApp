/** Map currency code → symbol */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/** Returns the symbol for a currency code, defaulting to ₹ (INR) */
export function currencySymbol(code?: string | null): string {
  return CURRENCY_SYMBOLS[code ?? "INR"] ?? code ?? "₹";
}

/** Format a number as a currency string, e.g. ₹1,200.00 */
export function formatCurrency(amount: number, code?: string | null): string {
  const symbol = currencySymbol(code);
  return `${symbol}${amount.toFixed(2)}`;
}

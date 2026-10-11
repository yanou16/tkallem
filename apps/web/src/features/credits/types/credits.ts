export type Credits = {
  balance: number;
  /** ISO date of the next daily refill. null for a guest: signing in gives daily credits. */
  next_refill_at: string | null;
};

export type GuestCreated = { guest_token: string; credits: Credits };
export type Claimed = { transferred: number; credits: Credits };

/** `ApiError.data.detail` of a 402 ("no_credits") or a 429 ("daily_budget_reached"). */
export type CreditErrorDetail = {
  code?: "no_credits" | "daily_budget_reached";
  balance?: number;
  next_refill_at?: string | null;
  message?: string;
};

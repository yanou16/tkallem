import { api } from "@/lib/api/client";
import type { Claimed, Credits, GuestCreated } from "../types/credits";

export const getCredits = () => api.get<Credits>("/me/credits");
export const createGuest = () => api.post<GuestCreated>("/guests", undefined, { skipAuthRedirect: true });
export const claimGuest = (guestToken: string) =>
  api.post<Claimed>("/me/claim-guest", { guest_token: guestToken }, { skipAuthRedirect: true });

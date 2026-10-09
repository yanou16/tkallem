import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toUser, type MeResponse, type User } from "../types/user";

export const getCurrentUser = (token: string | null) =>
  api.get<MeResponse>(endpoints.auth.me, { token }).then(toUser);

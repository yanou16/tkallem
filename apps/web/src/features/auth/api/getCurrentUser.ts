import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { User } from "../types/user";

export const getCurrentUser = (token: string | null) =>
  api.get<User>(endpoints.auth.me, { token });

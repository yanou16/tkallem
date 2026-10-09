"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/config";

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  const { signOut } = useClerk();
  return useMutation({
    mutationFn: () => signOut({ redirectUrl: ROUTES.signIn }),
    onSettled: () => {
      qc.clear();
      router.replace(ROUTES.signIn);
    },
  });
}

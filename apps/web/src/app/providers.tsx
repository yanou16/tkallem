"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ApiError, setAuthTokenProvider } from "@/lib/api/client";

function AuthTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenProvider(getToken);
    return () => setAuthTokenProvider(null);
  }, [getToken]);

  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (n, e) =>
              !(e instanceof ApiError && [401, 403, 404].includes(e.status)) &&
              n < 2,
          },
        },
      })
  );

  return (
    <ClerkProvider>
      {!pathname?.startsWith("/sign-in") && !pathname?.startsWith("/sign-up") && (
        <AuthTokenBridge />
      )}
      <QueryClientProvider client={client}>
        {children}
      </QueryClientProvider>
    </ClerkProvider>
  );
}
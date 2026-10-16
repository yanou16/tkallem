"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ApiError, setAuthTokenProvider } from "@/lib/api/client";
import GuestBootstrap from "@/components/GuestBootstrap";

function AuthTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenProvider(getToken);
    return () => setAuthTokenProvider(null);
  }, [getToken]);

  return null;
}

/**
 * Clerk v6's `useAuth()` throws "called in static mode" during Next.js 14 SSR.
 * We delay the entire inner tree until after client-side hydration so no component
 * in the tree can call useAuth() during server rendering.
 */
const emptySubscribe = () => () => {};
function HydrationGate({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  if (!mounted) return null;
  return <>{children}</>;
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
    <ClerkProvider dynamic>
      <HydrationGate>
        {!pathname?.startsWith("/sign-in") && !pathname?.startsWith("/sign-up") && (
          <AuthTokenBridge />
        )}
        <QueryClientProvider client={client}>
          <GuestBootstrap />
          {children}
        </QueryClientProvider>
      </HydrationGate>
    </ClerkProvider>
  );
}

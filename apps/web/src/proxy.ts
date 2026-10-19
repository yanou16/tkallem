import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { PUBLIC_ROUTES } from "@/lib/publicRoutes";

const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTES]);

export default clerkMiddleware(async (auth, req) => {
  // Signed-out visitors (a judge opening the demo link) land on the public page that offers to try without an account.
  if (req.nextUrl.pathname === "/" && !(await auth()).userId) {
    return NextResponse.redirect(new URL("/welcome", req.url));
  }
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|glb)).*)",
    "/(api|trpc)(.*)",
  ],
};
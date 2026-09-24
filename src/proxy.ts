import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Cron and queue routes are called by Vercel, not users: the cron checks CRON_SECRET and the
// queue SDK fetches each message from the queue service itself, so neither trusts the caller.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/cron(.*)",
  "/api/queues(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { RouterContext } from "../router";
import { Loader2 } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#000000" },
      { title: "Looplance — Replays na palma da mão" },
      { name: "description", content: "Veja, baixe e compartilhe seus melhores lances em tempo real direto da quadra." },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Looplance" },
      { property: "og:title", content: "Looplance — Replays na palma da mão" },
      { property: "og:description", content: "Veja, baixe e compartilhe seus melhores lances em tempo real direto da quadra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Looplance — Replays na palma da mão" },
      { name: "twitter:description", content: "Veja, baixe e compartilhe seus melhores lances em tempo real direto da quadra." },
    ],
    links: [
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <Loader2 className="h-12 w-12 animate-spin text-brand-orange" />
    </div>
  ),
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <PWAInstallPrompt />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <InnerRoot />
    </AuthProvider>
  );
}

function InnerRoot() {
  const { queryClient } = Route.useRouteContext();
  const { user, profile, isLoading, initialized, isSuperAdmin } = useAuth();
  const router = useRouter();
  const location = router.state.location;

  // Debug log every render during loop investigation
  useEffect(() => {
    console.log("[AUTH ROUTE CHECK]", {
      path: location.pathname,
      user: !!user,
      role: profile?.role,
      isSuperAdmin,
      isLoading,
      initialized
    });
  }, [location.pathname, user, profile?.role, isSuperAdmin, isLoading, initialized]);

  // Global loading gate - wait for auth initialization
  if (isLoading || !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-12 w-12 animate-spin text-brand-orange" />
      </div>
    );
  }

  // Centralized Route Protection Logic
  const publicPaths = ["/", "/login", "/signup", "/admin/login", "/manifest.json", "/sw.js", "/favicon.png"];
  // Normalize path by removing trailing slash for comparison
  const normalizedPath = location.pathname === "/" ? "/" : location.pathname.replace(/\/$/, "");
  const isPublicPath = publicPaths.includes(normalizedPath);

  // Protected route logic
  if (!isPublicPath && !user) {
    console.log("[PROTECTED ROUTE] [REDIRECT] No session, moving to /login from:", normalizedPath);
    return <Redirect to="/login" search={{ redirect: location.href }} />;
  }

  // Admin route protection
  if (normalizedPath.startsWith('/admin') && normalizedPath !== '/admin/login' && !isSuperAdmin) {
    console.log("[PROTECTED ROUTE] [REDIRECT] Not super-admin, moving home from:", normalizedPath);
    return <Redirect to="/" />;
  }

  // Public-only paths (if logged in, don't go here)
  const publicOnlyPaths = ["/login", "/signup", "/admin/login"];
  if (user && publicOnlyPaths.includes(normalizedPath)) {
    console.log("[REDIRECT] Already logged in, moving home from:", normalizedPath);
    return <Redirect to="/" />;
  }

  // Profile completeness check
  if (user && !isPublicPath && normalizedPath !== "/complete-profile" && !normalizedPath.startsWith('/admin')) {
    const isProfileIncomplete = !profile?.cpf || !profile?.birth_date;
    if (isProfileIncomplete && !isSuperAdmin) {
      console.log("[REDIRECT] Profile incomplete, moving to /complete-profile");
      return <Redirect to="/complete-profile" />;
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}

function Redirect({ to, search }: { to: string; search?: any }) {
  const navigate = useRouter().navigate;
  const currentPath = useRouter().state.location.pathname;
  
  useEffect(() => {
    if (currentPath !== to) {
      console.log(`[NAVIGATING] From ${currentPath} to ${to}`);
      navigate({ to, search, replace: true });
    }
  }, [navigate, to, search, currentPath]);
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-brand-orange" />
        <p className="text-white/50 text-xs font-bold uppercase tracking-widest animate-pulse">
          Redirecionando...
        </p>
      </div>
    </div>
  );
}
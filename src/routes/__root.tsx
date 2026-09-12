import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

const INIMIGOS_COMMUNITY_URL = "https://chat.whatsapp.com/GiE4WfxQk4O4aPDOzHM8eJ";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Inimigos do Fim | Agenda Cultural" },
      { name: "description", content: "Agenda cultural pública, dinâmica e colaborativa." },
      { property: "og:title", content: "Inimigos do Fim" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster position="top-right" />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showCommunityCta = pathname === "/agenda";

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      {showCommunityCta ? (
        <a
          href={INIMIGOS_COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-2xl border border-emerald-700/20 bg-emerald-600 px-4 py-3 text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-emerald-700 sm:max-w-sm"
          aria-label="Participar da Comunidade Inimigos do Fim no WhatsApp"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <strong className="block text-sm leading-tight">Fique por dentro também</strong>
            <span className="mt-0.5 block text-xs leading-snug text-emerald-50">
              Participe da Comunidade Inimigos do Fim no WhatsApp
            </span>
          </span>
        </a>
      ) : null}
    </QueryClientProvider>
  );
}

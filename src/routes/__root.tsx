import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Link,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Toaster } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Toaster position="top-right" /><Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showAgendaCtas = pathname === "/agenda";

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      {showAgendaCtas ? (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="grid h-[52px] w-[52px] place-items-center rounded-full border border-[#8d321f]/20 bg-[#fffaf3] text-[#9f3d25] shadow-xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f3d25] focus-visible:ring-offset-2"
                aria-label="Conhecer a Comunidade Inimigos do Fim"
              >
                <Sparkles className="h-6 w-6" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" sideOffset={10} className="w-auto border-0 bg-transparent p-0 shadow-none">
              <Link
                to="/community"
                className="flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-2xl border border-[#8d321f]/20 bg-[#fffaf3] px-4 py-3 text-[#5b291d] shadow-2xl transition hover:-translate-y-0.5"
                aria-label="Conhecer a Comunidade Inimigos do Fim"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f4e6d7] text-[#9f3d25]"><Sparkles className="h-5 w-5" /></span>
                <span><strong className="block text-sm leading-tight">Conheça a nova comunidade</strong><span className="mt-0.5 block text-xs text-[#8a5c4d]">Perfis, marketplace e publicação de eventos</span></span>
              </Link>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="grid h-[52px] w-[52px] place-items-center rounded-full border border-emerald-700/20 bg-emerald-600 text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                aria-label="Participar da Comunidade Inimigos do Fim no WhatsApp"
              >
                <MessageCircle className="h-6 w-6" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" sideOffset={10} className="w-auto border-0 bg-transparent p-0 shadow-none">
              <a
                href={INIMIGOS_COMMUNITY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-2xl border border-emerald-700/20 bg-emerald-600 px-4 py-3 text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-emerald-700"
                aria-label="Participar da Comunidade Inimigos do Fim no WhatsApp"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15"><MessageCircle className="h-5 w-5" /></span>
                <span><strong className="block text-sm leading-tight">Comunidade no WhatsApp</strong><span className="mt-0.5 block text-xs text-emerald-50">Continue acompanhando o grupo atual</span></span>
              </a>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
    </QueryClientProvider>
  );
}

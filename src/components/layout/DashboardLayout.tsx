import {
  LayoutDashboard,
  ClipboardCheck,
  Send,
  ListTree,
  Users,
  Zap,
  Rss,
  ScrollText,
  Settings,
  ExternalLink,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter();

  const menuItems = [
    { label: "Visão geral", icon: LayoutDashboard, to: "/" },
    { label: "Revisão", icon: ClipboardCheck, to: "/review" },
    { label: "Publicados", icon: Send, to: "/published" },
    { label: "Fontes / Feeds", icon: Rss, to: "/feeds" },
    { label: "Regras", icon: ListTree, to: "/rules" },
    { label: "Grupos", icon: Users, to: "/groups" },
    { label: "Integrações", icon: Zap, to: "/integrations" },
    { label: "Logs", icon: ScrollText, to: "/logs" },
    { label: "Configurações", icon: Settings, to: "/settings" },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.invalidate();
    window.location.href = "/auth";
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0",
          !isSidebarOpen && "-translate-x-full lg:hidden",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6">
            <span className="text-lg font-black text-primary">Inimigos do Fim</span>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {menuItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "bg-accent text-accent-foreground" }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t p-4">
            <Button asChild variant="outline" className="mb-2 w-full justify-start gap-3">
              <a href="/agenda" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Ver agenda pública
              </a>
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex h-16 items-center justify-between border-b bg-card px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
            <span className="text-lg font-semibold lg:hidden">Inimigos do Fim</span>
          </div>

          <div className="flex items-center gap-4" />
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

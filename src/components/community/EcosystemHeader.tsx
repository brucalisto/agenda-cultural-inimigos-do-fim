import { Link } from "@tanstack/react-router";
import { CalendarDays, Menu, Store, Users, Wrench, X } from "lucide-react";
import { useState } from "react";

const navigation = [
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/community", label: "Comunidade", icon: Users },
  { to: "/people", label: "Pessoas", icon: Users },
  { to: "/marketplace", label: "Marketplace", icon: Store },
  { to: "/tools", label: "Ferramentas", icon: Wrench },
] as const;

export function EcosystemHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[#fffaf3]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
        <Link to="/agenda" className="flex items-center gap-3" aria-label="Inimigos do Fim">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#9f3d25] text-lg font-black text-white">IF</span>
          <span><strong className="block leading-tight text-[#351810]">Inimigos do Fim</strong><small className="text-[#8a5c4d]">Cultura que aproxima</small></span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#5b392f] transition hover:bg-[#f4e6d7] hover:text-[#8d321f]" activeProps={{ className: "bg-[#f4e6d7] text-[#8d321f]" }}>
              <Icon className="size-4" />{label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link to="/submit-event" className="rounded-xl border border-[#9f3d25] px-4 py-2 text-sm font-semibold text-[#9f3d25]">Divulgar evento</Link>
          <Link to="/join" className="rounded-xl bg-[#9f3d25] px-4 py-2 text-sm font-semibold text-white">Entrar</Link>
        </div>
        <button className="rounded-xl p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Abrir menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && <nav className="border-t bg-[#fffaf3] px-4 py-4 lg:hidden">{navigation.map(({ to, label }) => <Link key={to} to={to} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 font-medium text-[#5b392f]">{label}</Link>)}<div className="mt-3 grid grid-cols-2 gap-2"><Link to="/submit-event" className="rounded-xl border border-[#9f3d25] p-3 text-center text-sm font-semibold text-[#9f3d25]">Divulgar evento</Link><Link to="/join" className="rounded-xl bg-[#9f3d25] p-3 text-center text-sm font-semibold text-white">Entrar</Link></div></nav>}
    </header>
  );
}

export function EcosystemFooter() {
  return <footer className="border-t border-black/5 bg-[#351810] px-4 py-8 text-center text-sm text-[#f7ded1]"><strong>Inimigos do Fim</strong><p className="mt-1">Agenda, encontros e economia criativa no mesmo lugar.</p></footer>;
}

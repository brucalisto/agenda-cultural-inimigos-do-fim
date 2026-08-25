import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  AtSign,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid2X2,
  MapPin,
  Phone,
  Search,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/agenda")({ component: PublicAgenda });
type EventItem = {
  id: string;
  title: string | null;
  category: string | null;
  summary: string | null;
  full_description: string | null;
  event_date: string;
  location: string | null;
  city: string | null;
  price: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_instagram: string | null;
  source_url: string | null;
  keywords: string[] | null;
};
type PriceFilter = "all" | "free" | "paid" | "unknown";
type ViewMode = "cards" | "calendar";

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const todayKey = () => dateKey(new Date());
const normalize = (value: string | null | undefined) => (value || "").trim().toLowerCase();
const priceKind = (price: string | null): Exclude<PriceFilter, "all"> => {
  if (!price?.trim()) return "unknown";
  const value = normalize(price);
  return ["0", "0.00", "0,00"].includes(value) || /grátis|gratuito|entrada franca/.test(value)
    ? "free"
    : "paid";
};
const priceLabel = (event: EventItem) =>
  priceKind(event.price) === "free"
    ? "Gratuito"
    : priceKind(event.price) === "unknown"
      ? "Valor não informado"
      : /^r\$/i.test(event.price || "")
        ? event.price
        : `R$ ${event.price}`;
const eventCity = (event: EventItem) => {
  if (event.city?.trim()) return event.city.trim();
  const location = event.location?.trim();
  if (!location) return "Não informada";
  const cityWithState = location.match(/([^,–-]+)\s*[-–]\s*[A-Z]{2}$/i)?.[1]?.trim();
  if (cityWithState) return cityWithState;
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) || "Não informada";
};
const instagramHandle = (value: string) => value.trim().replace(/^@/, "").split(/[/?#]/)[0] ?? "";
const instagramUrl = (value: string) =>
  /^https?:\/\//i.test(value)
    ? value
    : `https://www.instagram.com/${encodeURIComponent(instagramHandle(value))}`;

function EventCard({
  event,
  onSelect,
}: {
  event: EventItem;
  onSelect: (event: EventItem) => void;
}) {
  const date = new Date(event.event_date);
  const kind = priceKind(event.price);
  return (
    <button
      onClick={() => onSelect(event)}
      className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#171715] text-left shadow-[0_20px_60px_rgba(0,0,0,.18)] transition duration-300 hover:-translate-y-1 hover:border-amber-300/40 hover:shadow-[0_24px_80px_rgba(234,179,8,.08)]"
    >
      <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-fuchsia-500" />
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[.04] px-3 py-2 text-center">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-amber-300">
              {date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
            </span>
            <span className="block text-2xl font-black leading-none">{date.getDate()}</span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full bg-white/[.06] px-3 py-1 text-xs text-stone-300">
              {event.category || "Cultura"}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${kind === "free" ? "bg-emerald-400/10 text-emerald-300" : kind === "paid" ? "bg-amber-400/10 text-amber-300" : "bg-stone-400/10 text-stone-400"}`}
            >
              {priceLabel(event)}
            </span>
          </div>
        </div>
        <h3 className="text-xl font-extrabold leading-tight transition group-hover:text-amber-200">
          {event.title || "Evento cultural"}
        </h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-400">
          {event.summary || event.full_description || "Confira os detalhes deste evento."}
        </p>
        <div className="mt-6 space-y-2.5 border-t border-white/[.07] pt-5 text-sm text-stone-300">
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span className="line-clamp-2">{event.location || eventCity(event)}</span>
          </p>
        </div>
        <span className="mt-6 flex items-center gap-2 text-sm font-bold text-amber-300">
          Ver detalhes <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </button>
  );
}

function MonthCalendar({
  events,
  month,
  onMonth,
  onDay,
}: {
  events: EventItem[];
  month: Date;
  onMonth: (date: Date) => void;
  onDay: (key: string) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const counts = new Map<string, number>();
  events.forEach((event) => {
    const key = dateKey(new Date(event.event_date));
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#171715]">
      <div className="flex items-center justify-between border-b border-white/10 p-5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <ChevronLeft />
        </Button>
        <h2 className="text-lg font-extrabold capitalize">
          {month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 border-b border-white/10 text-center text-[10px] font-bold uppercase tracking-wider text-stone-500">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <div key={day} className="py-3">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dateKey(day);
          const count = counts.get(key) || 0;
          const current = day.getMonth() === month.getMonth();
          const today = key === todayKey();
          return (
            <button
              key={key}
              onClick={() => count && onDay(key)}
              disabled={!count}
              className={`min-h-20 border-b border-r border-white/[.06] p-2 text-left transition sm:min-h-28 ${current ? "text-white" : "text-stone-700"} ${count ? "hover:bg-amber-400/[.07]" : "cursor-default"}`}
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${today ? "bg-amber-400 font-black text-black" : ""}`}
              >
                {day.getDate()}
              </span>
              {count > 0 ? (
                <span className="mt-2 block rounded-lg bg-fuchsia-400/10 px-2 py-1 text-[10px] font-bold text-fuchsia-200 sm:text-xs">
                  {count} {count === 1 ? "evento" : "eventos"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PublicAgenda() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");
  const [category, setCategory] = useState("all");
  const [price, setPrice] = useState<PriceFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [view, setView] = useState<ViewMode>("cards");
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") || "");
    setCity(params.get("cidade") || "all");
    setCategory(params.get("categoria") || "all");
    setPrice((params.get("preco") as PriceFilter) || "all");
    const initialFrom = params.get("de") || "";
    const initialTo = params.get("ate") || "";
    setFrom(initialFrom);
    setTo(initialTo);
    setAppliedFrom(initialFrom);
    setAppliedTo(initialTo);
    setView((params.get("visao") as ViewMode) || "cards");
    fetch("/api/public/events")
      .then((response) => response.json())
      .then((value) => setEvents(value.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (city !== "all") params.set("cidade", city);
    if (category !== "all") params.set("categoria", category);
    if (price !== "all") params.set("preco", price);
    if (appliedFrom) params.set("de", appliedFrom);
    if (appliedTo) params.set("ate", appliedTo);
    if (view !== "cards") params.set("visao", view);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${params.size ? `?${params}` : ""}`,
    );
  }, [query, city, category, price, appliedFrom, appliedTo, view]);
  const cities = useMemo(
    () =>
      [...new Set(events.map(eventCity).filter((value) => value !== "Não informada"))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [events],
  );
  const categories = useMemo(
    () =>
      [...new Set(events.map((event) => event.category).filter(Boolean) as string[])].sort((a, b) =>
        a.localeCompare(b),
      ),
    [events],
  );
  const filtered = useMemo(
    () =>
      events.filter((event) => {
        const haystack = normalize(
          `${event.title} ${event.category} ${event.location} ${event.city} ${event.summary}`,
        );
        const key = dateKey(new Date(event.event_date));
        return (
          haystack.includes(normalize(query)) &&
          (city === "all" || eventCity(event) === city) &&
          (category === "all" || event.category === category) &&
          (price === "all" || priceKind(event.price) === price) &&
          (!appliedFrom || key >= appliedFrom) &&
          (!appliedTo || key <= appliedTo)
        );
      }),
    [events, query, city, category, price, appliedFrom, appliedTo],
  );
  const grouped = useMemo(
    () =>
      Object.entries(
        filtered.reduce<Record<string, EventItem[]>>((groups, event) => {
          const key = dateKey(new Date(event.event_date));
          (groups[key] ??= []).push(event);
          return groups;
        }, {}),
      ).sort(([a], [b]) => a.localeCompare(b)),
    [filtered],
  );
  const hasFilters = Boolean(
    query || city !== "all" || category !== "all" || price !== "all" || appliedFrom || appliedTo,
  );
  const clearFilters = () => {
    setQuery("");
    setCity("all");
    setCategory("all");
    setPrice("all");
    setFrom("");
    setTo("");
    setAppliedFrom("");
    setAppliedTo("");
  };
  const setPeriod = (period: "today" | "week" | "month" | "all") => {
    if (period === "all") {
      setFrom("");
      setTo("");
      setAppliedFrom("");
      setAppliedTo("");
      return;
    }
    const start = new Date();
    const end = new Date(start);
    if (period === "week") end.setDate(start.getDate() + 7);
    if (period === "month") end.setMonth(start.getMonth() + 1);
    setFrom(dateKey(start));
    setTo(dateKey(end));
    setAppliedFrom(dateKey(start));
    setAppliedTo(dateKey(end));
  };
  const applyPeriod = () => {
    setAppliedFrom(from);
    setAppliedTo(to);
  };
  return (
    <main className="min-h-screen bg-[#0c0c0b] text-stone-100">
      <section className="relative overflow-hidden border-b border-white/[.07] px-5 pb-12 pt-16 sm:pt-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(234,179,8,.20),transparent_34%),radial-gradient(circle_at_5%_80%,rgba(192,38,211,.15),transparent_32%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.28em] text-amber-400">
                <Sparkles className="h-4 w-4" /> Cultura acontecendo agora
              </p>
              <h1 className="max-w-4xl text-5xl font-black tracking-[-.04em] sm:text-7xl">
                Inimigos do Fim
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-300">
                Descubra o que acontece perto de você. Shows, encontros, arte e cultura em uma
                agenda simples de explorar.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.04] px-5 py-3">
              <span className="block text-2xl font-black text-amber-300">{filtered.length}</span>
              <span className="text-xs text-stone-400">eventos encontrados</span>
            </div>
          </div>
        </div>
      </section>
      <section className="sticky top-0 z-20 border-b border-white/[.07] bg-[#0c0c0b]/95 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_.8fr_.8fr_.8fr_auto]">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-stone-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar evento, artista ou local"
                className="h-12 border-white/10 bg-white/[.05] pl-12 text-white placeholder:text-stone-500"
              />
            </div>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="h-12 border-white/10 bg-white/[.05] text-white">
                <SelectValue placeholder="Cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cities.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-12 border-white/10 bg-white/[.05] text-white">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={price} onValueChange={(value) => setPrice(value as PriceFilter)}>
              <SelectTrigger className="h-12 border-white/10 bg-white/[.05] text-white">
                <SelectValue placeholder="Preço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os valores</SelectItem>
                <SelectItem value="free">Gratuitos</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="unknown">Não informado</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex rounded-xl border border-white/10 bg-white/[.05] p-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setView("cards")}
                aria-label="Ver cards"
                className={view === "cards" ? "bg-white/10 text-amber-300" : "text-stone-500"}
              >
                <Grid2X2 />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setView("calendar")}
                aria-label="Ver calendário"
                className={view === "calendar" ? "bg-white/10 text-amber-300" : "text-stone-500"}
              >
                <CalendarDays />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <SlidersHorizontal className="mr-1 h-4 w-4 text-stone-500" />
            {[
              ["Hoje", "today"],
              ["Próximos 7 dias", "week"],
              ["Próximos 30 dias", "month"],
              ["Todas as datas", "all"],
            ].map(([label, value]) => (
              <button
                key={value}
                onClick={() => setPeriod(value as "today" | "week" | "month" | "all")}
                className="rounded-full border border-white/10 px-3 py-1.5 text-stone-300 transition hover:border-amber-300/40 hover:text-amber-200"
              >
                {label}
              </button>
            ))}
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              aria-label="Data inicial"
              className="h-9 w-auto border-white/10 bg-white/[.04] text-white"
            />
            <span className="text-stone-600">até</span>
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              aria-label="Data final"
              className="h-9 w-auto border-white/10 bg-white/[.04] text-white"
            />
            <Button
              type="button"
              size="sm"
              onClick={applyPeriod}
              className="h-9 bg-amber-400 font-bold text-black hover:bg-amber-300"
            >
              Filtrar período
            </Button>
            {hasFilters ? (
              <button
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1 text-stone-400 hover:text-white"
              >
                <X className="h-4 w-4" /> Limpar filtros
              </button>
            ) : null}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-[1.75rem] bg-white/[.05]" />
            ))}
          </div>
        ) : null}
        {!loading && !filtered.length ? (
          <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[.025] p-14 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-stone-600" />
            <h2 className="mt-4 text-xl font-bold">Nenhum evento encontrado</h2>
            <p className="mt-2 text-stone-400">
              Tente ampliar o período ou remover alguns filtros.
            </p>
            {hasFilters ? (
              <Button
                onClick={clearFilters}
                className="mt-6 bg-amber-400 text-black hover:bg-amber-300"
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>
        ) : null}
        {!loading && filtered.length && view === "cards" ? (
          <div className="space-y-12">
            {grouped.map(([key, items]) => (
              <section key={key}>
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[.08]" />
                  <h2 className="flex items-center gap-2 text-lg font-extrabold capitalize">
                    <CalendarDays className="h-5 w-5 text-amber-400" />
                    {new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                    })}
                  </h2>
                  <div className="h-px flex-1 bg-white/[.08]" />
                </div>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((event) => (
                    <EventCard key={event.id} event={event} onSelect={setSelected} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
        {!loading && filtered.length && view === "calendar" ? (
          <MonthCalendar
            events={filtered}
            month={month}
            onMonth={setMonth}
            onDay={(key) => {
              setFrom(key);
              setTo(key);
              setAppliedFrom(key);
              setAppliedTo(key);
              setView("cards");
            }}
          />
        ) : null}
      </section>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-white/10 bg-[#171715] text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-8 text-3xl leading-tight">{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-amber-400/10 px-3 py-1 text-sm text-amber-300">
                  {selected.category || "Cultura"}
                </span>
                <span className="rounded-full bg-white/[.06] px-3 py-1 text-sm text-stone-300">
                  {priceLabel(selected)}
                </span>
              </div>
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 sm:grid-cols-2">
                <p className="flex gap-2">
                  <Clock className="h-5 w-5 text-amber-400" />
                  {new Date(selected.event_date).toLocaleString("pt-BR")}
                </p>
                <p className="flex gap-2">
                  <MapPin className="h-5 w-5 text-amber-400" />
                  {selected.location || eventCity(selected)}
                </p>
              </div>
              <p className="whitespace-pre-wrap leading-7 text-stone-300">
                {selected.full_description || selected.summary}
              </p>
              {selected.contact_phone || selected.contact_instagram ? (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <p className="flex items-center gap-2 font-bold text-amber-300">
                    <Ticket className="h-5 w-5" /> Contato
                    {selected.contact_name ? ` — ${selected.contact_name}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {selected.contact_phone ? (
                      <a
                        href={`tel:${selected.contact_phone.replace(/[^\d+]/g, "")}`}
                        className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm hover:border-amber-300/50 hover:text-amber-200"
                      >
                        <Phone className="h-4 w-4" /> {selected.contact_phone}
                      </a>
                    ) : null}
                    {selected.contact_instagram ? (
                      <a
                        href={instagramUrl(selected.contact_instagram)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm hover:border-fuchsia-300/50 hover:text-fuchsia-200"
                      >
                        <AtSign className="h-4 w-4" />@
                        {instagramHandle(selected.contact_instagram)}
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {selected.source_url ? (
                <Button asChild className="bg-amber-400 font-bold text-black hover:bg-amber-300">
                  <a href={selected.source_url} target="_blank" rel="noreferrer">
                    Ver fonte oficial <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

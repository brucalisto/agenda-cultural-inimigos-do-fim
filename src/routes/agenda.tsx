import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  AtSign,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  LocateFixed,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Star,
  Ticket,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoryIllustration } from "@/lib/category-illustrations";

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
  image_url: string | null;
  keywords: string[] | null;
  is_featured: boolean;
  featured_priority: number;
  featured_starts_at: string | null;
  featured_ends_at: string | null;
  latitude: number | null;
  longitude: number | null;
};

type PriceFilter = "all" | "free" | "paid" | "unknown";
type ViewMode = "list" | "cards" | "calendar";

type MapApi = {
  map: (element: HTMLElement) => {
    setView: (point: [number, number], zoom: number) => unknown;
    fitBounds: (bounds: unknown, options: object) => void;
    remove: () => void;
  };
  tileLayer: (url: string, options: object) => { addTo: (map: unknown) => unknown };
  marker: (point: [number, number]) => {
    addTo: (map: unknown) => { bindPopup: (html: string) => unknown };
  };
  featureGroup: (layers: unknown[]) => { getBounds: () => unknown };
};

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const todayKey = () => dateKey(new Date());
const normalize = (value: string | null | undefined) => (value || "").trim().toLowerCase();
const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

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

const instagramHandle = (value: string) => value.trim().replace(/^@/, "").split(/[/?#]/)[0];
const instagramUrl = (value: string) =>
  /^https?:\/\//i.test(value)
    ? value
    : `https://www.instagram.com/${encodeURIComponent(instagramHandle(value))}`;

function ViewSelector({ view, onView }: { view: ViewMode; onView: (view: ViewMode) => void }) {
  const options: Array<{ value: ViewMode; label: string; icon: typeof List }> = [
    { value: "list", label: "Linha", icon: List },
    { value: "cards", label: "Cards", icon: LayoutGrid },
    { value: "calendar", label: "Calendário", icon: CalendarDays },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-bold text-[#4d4439]">Modo de visualização</span>
      <div className="flex flex-wrap gap-1 rounded-xl border border-[#d8cbb8] bg-[#fffdf8] p-1">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onView(value)}
            aria-pressed={view === value}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
              view === value
                ? "bg-[#f1dfbb] text-[#8f3525] shadow-sm"
                : "text-[#665b4d] hover:bg-[#f8efe0]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EventCard({ event, onSelect }: { event: EventItem; onSelect: (event: EventItem) => void }) {
  const date = new Date(event.event_date);
  const kind = priceKind(event.price);
  return (
    <button
      onClick={() => onSelect(event)}
      className="group relative h-full overflow-hidden rounded-[1.35rem] border border-[#e1d4c2] bg-white text-left shadow-[0_12px_35px_rgba(74,52,31,.08)] transition duration-300 hover:-translate-y-1 hover:border-[#c78a35] hover:shadow-[0_20px_45px_rgba(133,76,32,.13)]"
    >
      <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-[linear-gradient(135deg,#f3e6ce,#fffaf0)]">
        <img
          src={categoryIllustration(event.category)}
          alt={`Ilustração da categoria ${event.category || "Outros"}`}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="p-4">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="rounded-2xl border border-[#e5d8c4] bg-[#fffaf0] px-3 py-2 text-center">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-[#a43a28]">
              {date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
            </span>
            <span className="block text-2xl font-black leading-none">{date.getDate()}</span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full bg-[#f1eadf] px-2 py-1 text-[11px] text-[#665b4d]">
              {event.category || "Cultura"}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                kind === "free"
                  ? "bg-emerald-100 text-emerald-700"
                  : kind === "paid"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-stone-100 text-stone-500"
              }`}
            >
              {priceLabel(event)}
            </span>
          </div>
        </div>
        <h3 className="line-clamp-2 text-base font-extrabold leading-tight text-[#292620] group-hover:text-[#a43a28]">
          {event.title || "Evento cultural"}
        </h3>
        <div className="mt-4 space-y-2 border-t border-[#eee4d6] pt-4 text-xs text-[#5f574d]">
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span className="line-clamp-2">{event.location || eventCity(event)}</span>
          </p>
        </div>
        <span className="mt-4 flex items-center gap-2 text-xs font-bold text-[#a43a28]">
          Ver detalhes <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

function EventRow({ event, onSelect }: { event: EventItem; onSelect: (event: EventItem) => void }) {
  const date = new Date(event.event_date);
  const kind = priceKind(event.price);
  return (
    <button
      id={`evento-${event.id}`}
      type="button"
      onClick={() => onSelect(event)}
      className="group grid w-full gap-3 rounded-2xl border border-[#e2d7c8] bg-white p-4 text-left shadow-[0_7px_22px_rgba(74,52,31,.05)] transition hover:border-[#c78a35] hover:shadow-[0_10px_28px_rgba(133,76,32,.10)] md:grid-cols-[90px_1fr_170px_150px_auto] md:items-center"
    >
      <div>
        <p className="text-lg font-black text-[#292620]">
          {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="text-xs text-[#776b5c]">{date.toLocaleDateString("pt-BR")}</p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-extrabold text-[#292620] group-hover:text-[#a43a28]">
            {event.title || "Evento cultural"}
          </h3>
          <span className="rounded-full bg-[#f1eadf] px-2 py-1 text-[10px] text-[#665b4d]">
            {event.category || "Cultura"}
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-[#6d6255]">{event.summary || event.full_description}</p>
      </div>
      <div className="flex items-start gap-2 text-sm text-[#5f574d]">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <span className="line-clamp-2">{event.location || eventCity(event)}</span>
      </div>
      <div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            kind === "free"
              ? "bg-emerald-100 text-emerald-700"
              : kind === "paid"
                ? "bg-amber-100 text-amber-700"
                : "bg-stone-100 text-stone-500"
          }`}
        >
          {priceLabel(event)}
        </span>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#a43a28] md:justify-self-end">
        Detalhes <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function FeaturedEvents({ events, onSelect }: { events: EventItem[]; onSelect: (event: EventItem) => void }) {
  if (!events.length) return null;
  const feature = (event: EventItem) => (
    <article className="relative min-h-[340px] overflow-hidden rounded-[2rem] bg-[#30241d] p-7 text-[#fff8e8] shadow-[0_24px_70px_rgba(74,47,28,.18)] sm:p-10">
      <img src={categoryIllustration(event.category)} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#241a15]/95 via-[#241a15]/80 to-[#241a15]/35" />
      <Sparkles className="absolute bottom-8 right-8 h-28 w-28 text-[#d8a936]/20" />
      <div className="relative flex min-h-[270px] max-w-3xl flex-col justify-between gap-10">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#d8a936] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#2a211b]">
            <Star className="h-4 w-4 fill-current" /> Curadoria da Agenda
          </span>
          <h3 className="mt-6 font-serif text-3xl font-black leading-tight sm:text-5xl">{event.title || "Evento cultural"}</h3>
          <p className="mt-4 line-clamp-3 max-w-2xl leading-7 text-[#eadfce]">{event.summary || event.full_description}</p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="space-y-2 text-sm">
            <p className="flex gap-2"><CalendarDays className="h-4 w-4 text-[#e5b64a]" />{new Date(event.event_date).toLocaleString("pt-BR")}</p>
            <p className="flex gap-2"><MapPin className="h-4 w-4 text-[#e5b64a]" />{event.location || eventCity(event)}</p>
          </div>
          <Button onClick={() => onSelect(event)} className="rounded-full bg-[#fff7df] px-6 text-[#442b1e] hover:bg-white">
            Ver evento <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
  return (
    <section className="bg-[#fffaf0] px-5 py-14">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-black uppercase tracking-[.24em] text-[#a43a28]">Escolhas da curadoria</p>
        <h2 className="mb-7 mt-2 font-serif text-4xl font-black text-[#2b2823]">Destaques</h2>
        {events.length === 1 ? feature(events[0]) : (
          <Carousel opts={{ loop: true }}>
            <CarouselContent>{events.map((event) => <CarouselItem key={event.id}>{feature(event)}</CarouselItem>)}</CarouselContent>
            <CarouselPrevious className="left-4 border-0 bg-white/90 text-[#3b2b20]" />
            <CarouselNext className="right-4 border-0 bg-white/90 text-[#3b2b20]" />
          </Carousel>
        )}
      </div>
    </section>
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
    <div className="overflow-hidden rounded-[1.75rem] border border-[#dfd3c2] bg-white">
      <div className="flex items-center justify-between border-b border-[#e4d9c9] p-5">
        <Button variant="ghost" size="icon" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="text-[#a43a28] hover:bg-[#f5e8d2]"><ChevronLeft /></Button>
        <h2 className="text-lg font-extrabold capitalize">{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2>
        <Button variant="ghost" size="icon" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="text-[#a43a28] hover:bg-[#f5e8d2]"><ChevronRight /></Button>
      </div>
      <div className="grid grid-cols-7 border-b border-[#e4d9c9] text-center text-[10px] font-bold uppercase tracking-wider text-stone-500">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <div key={day} className="py-3">{day}</div>)}
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
              className={`min-h-20 border-b border-r border-[#eee5d8] p-2 text-left transition sm:min-h-28 ${current ? "text-[#292620]" : "text-stone-400"} ${count ? "hover:bg-[#fff5df]" : "cursor-default"}`}
            >
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${today ? "bg-amber-400 font-black text-black" : ""}`}>{day.getDate()}</span>
              {count > 0 ? <span className="mt-2 block rounded-lg bg-[#f1dfbb] px-2 py-1 text-[10px] font-bold text-[#8b4c2a] sm:text-xs">{count} {count === 1 ? "evento" : "eventos"}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventsMap({ events }: { events: EventItem[] }) {
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<{ setView: (point: [number, number], zoom: number) => unknown; remove: () => void } | null>(null);
  const mapped = useMemo(() => events.filter((event) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude)), [events]);

  useEffect(() => {
    if (!element.current) return;
    const mount = () => {
      const leaflet = (window as unknown as { L?: MapApi }).L;
      if (!leaflet || !element.current || instance.current) return;
      const map = leaflet.map(element.current);
      instance.current = map;
      map.setView([-23.62, -45.41], 9);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
      const layers = mapped.map((event) => {
        const title = (event.title || "Evento cultural").replace(/[<>]/g, "");
        const local = (event.location || eventCity(event)).replace(/[<>]/g, "");
        const marker = leaflet.marker([event.latitude as number, event.longitude as number]);
        marker.addTo(map).bindPopup(`<strong>${title}</strong><br>${new Date(event.event_date).toLocaleString("pt-BR")}<br>${local}<br><a href="#evento-${event.id}">Ver evento</a>`);
        return marker;
      });
      if (layers.length) map.fitBounds(leaflet.featureGroup(layers).getBounds(), { padding: [40, 40], maxZoom: 13 });
    };

    if ((window as unknown as { L?: MapApi }).L) mount();
    else {
      if (!document.querySelector("[data-leaflet-css]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.dataset.leafletCss = "true";
        document.head.appendChild(link);
      }
      const current = document.querySelector<HTMLScriptElement>("[data-leaflet-js]");
      if (current) current.addEventListener("load", mount, { once: true });
      else {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.dataset.leafletJs = "true";
        script.onload = mount;
        document.body.appendChild(script);
      }
    }
    return () => {
      instance.current?.remove();
      instance.current = null;
    };
  }, [mapped]);

  const locate = () => navigator.geolocation?.getCurrentPosition(({ coords }) => instance.current?.setView([coords.latitude, coords.longitude], 12));

  return (
    <section className="bg-[#f4ede2] px-5 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#687538]">Território e descoberta</p>
            <h2 className="mt-2 font-serif text-4xl font-black">Explore o que está acontecendo perto de você</h2>
            <p className="mt-3 text-[#756b5d]">Os pins acompanham os mesmos eventos publicados e filtrados exibidos acima.</p>
          </div>
          <Button variant="outline" onClick={locate} className="rounded-full border-[#b7a78e] bg-white"><LocateFixed className="mr-2 h-4 w-4" />Usar minha localização</Button>
        </div>
        <div className="overflow-hidden rounded-[2rem] border border-[#d8cbb8] bg-white shadow-xl">
          <div ref={element} className="h-[480px] w-full" />
          {!mapped.length ? <p className="p-4 text-center text-sm text-[#756b5d]">Estamos localizando os endereços dos eventos. Os pins aparecem automaticamente assim que as coordenadas são encontradas.</p> : null}
        </div>
      </div>
    </section>
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
  const [includePast, setIncludePast] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const geocoding = useRef(new Set<string>());

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
    setIncludePast(Boolean(initialFrom || initialTo) || params.get("datas") === "todas");
    const requestedView = params.get("visao");
    setView(requestedView === "cards" || requestedView === "calendar" || requestedView === "list" ? requestedView : "list");

    const loadEvents = () =>
      fetch("/api/public/events")
        .then((response) => response.json())
        .then((value) => setEvents(value.events || []))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));

    void loadEvents();
    const refresh = window.setInterval(loadEvents, 60_000);
    return () => window.clearInterval(refresh);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (city !== "all") params.set("cidade", city);
    if (category !== "all") params.set("categoria", category);
    if (price !== "all") params.set("preco", price);
    if (appliedFrom) params.set("de", appliedFrom);
    if (appliedTo) params.set("ate", appliedTo);
    if (includePast && !appliedFrom && !appliedTo) params.set("datas", "todas");
    if (view !== "list") params.set("visao", view);
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, [query, city, category, price, appliedFrom, appliedTo, includePast, view]);

  useEffect(() => {
    let cancelled = false;
    const missing = events.filter(
      (event) =>
        !Number.isFinite(event.latitude) &&
        !Number.isFinite(event.longitude) &&
        Boolean(event.location || event.city) &&
        !geocoding.current.has(event.id),
    );
    if (!missing.length) return;

    const run = async () => {
      for (const event of missing) {
        if (cancelled) return;
        geocoding.current.add(event.id);
        try {
          const response = await fetch("/api/public/events", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: event.id }),
          });
          if (response.ok) {
            const result = await response.json();
            if (Number.isFinite(result.latitude) && Number.isFinite(result.longitude)) {
              setEvents((current) =>
                current.map((item) =>
                  item.id === event.id
                    ? { ...item, latitude: result.latitude, longitude: result.longitude }
                    : item,
                ),
              );
            }
          }
        } catch {
          // Um endereço incompleto não deve impedir a agenda de funcionar.
        }
        await delay(1100);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [events]);

  const cities = useMemo(
    () => [...new Set(events.map(eventCity).filter((value) => value !== "Não informada"))].sort((a, b) => a.localeCompare(b)),
    [events],
  );
  const categories = useMemo(
    () => [...new Set(events.map((event) => event.category).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [events],
  );

  const filtered = useMemo(() => {
    const defaultFrom = !includePast && !appliedFrom && !appliedTo ? todayKey() : "";
    const effectiveFrom = appliedFrom || defaultFrom;
    return events.filter((event) => {
      const haystack = normalize(`${event.title} ${event.category} ${event.location} ${event.city} ${event.summary}`);
      const key = dateKey(new Date(event.event_date));
      return (
        haystack.includes(normalize(query)) &&
        (city === "all" || eventCity(event) === city) &&
        (category === "all" || event.category === category) &&
        (price === "all" || priceKind(event.price) === price) &&
        (!effectiveFrom || key >= effectiveFrom) &&
        (!appliedTo || key <= appliedTo)
      );
    });
  }, [events, query, city, category, price, appliedFrom, appliedTo, includePast]);

  const grouped = useMemo(
    () => Object.entries(filtered.reduce<Record<string, EventItem[]>>((groups, event) => {
      const key = dateKey(new Date(event.event_date));
      (groups[key] ??= []).push(event);
      return groups;
    }, {})).sort(([a], [b]) => a.localeCompare(b)),
    [filtered],
  );

  const featured = useMemo(() => {
    const now = new Date().toISOString();
    return filtered
      .filter((event) => event.is_featured && (!event.featured_starts_at || event.featured_starts_at <= now) && (!event.featured_ends_at || event.featured_ends_at >= now))
      .sort((a, b) => b.featured_priority - a.featured_priority);
  }, [filtered]);

  const hasFilters = Boolean(query || city !== "all" || category !== "all" || price !== "all" || appliedFrom || appliedTo || includePast);

  const clearFilters = () => {
    setQuery("");
    setCity("all");
    setCategory("all");
    setPrice("all");
    setFrom("");
    setTo("");
    setAppliedFrom("");
    setAppliedTo("");
    setIncludePast(false);
  };

  const setPeriod = (period: "today" | "tomorrow" | "weekend" | "week" | "month" | "all") => {
    if (period === "all") {
      setFrom("");
      setTo("");
      setAppliedFrom("");
      setAppliedTo("");
      setIncludePast(true);
      return;
    }
    const start = new Date();
    const end = new Date(start);
    if (period === "tomorrow") {
      start.setDate(start.getDate() + 1);
      end.setDate(end.getDate() + 1);
    }
    if (period === "weekend") {
      start.setDate(start.getDate() + ((6 - start.getDay() + 7) % 7));
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 1);
    }
    if (period === "week") end.setDate(start.getDate() + 7);
    if (period === "month") end.setMonth(start.getMonth() + 1);
    setFrom(dateKey(start));
    setTo(dateKey(end));
    setAppliedFrom(dateKey(start));
    setAppliedTo(dateKey(end));
    setIncludePast(true);
  };

  const applyPeriod = () => {
    setAppliedFrom(from);
    setAppliedTo(to);
    setIncludePast(Boolean(from || to));
  };

  return (
    <main className="min-h-screen bg-[#fffdf8] text-[#292620]">
      <section className="bg-[#171310]">
        <img src="/agenda-banner.webp" alt="Inimigos do Fim — Cultura acontecendo agora" className="mx-auto h-auto w-full max-w-[2048px]" />
      </section>

      <FeaturedEvents events={featured} onSelect={setSelected} />

      <section className="border-b border-[#e2d6c5] bg-white px-5 py-8 sm:py-10">
        <div className="mx-auto max-w-7xl space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#a43a28]">Encontre sua próxima experiência</p>
            <h2 className="mt-2 font-serif text-3xl font-black">Explore a programação</h2>
          </div>

          <ViewSelector view={view} onView={setView} />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_.8fr_.8fr_.8fr]">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-stone-500" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar evento, artista ou local" className="h-12 border-[#d8cbb8] bg-[#fffdf8] pl-12" />
            </div>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="h-12 border-[#d8cbb8] bg-[#fffdf8]"><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as cidades</SelectItem>{cities.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-12 border-[#d8cbb8] bg-[#fffdf8]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categories.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={price} onValueChange={(value) => setPrice(value as PriceFilter)}>
              <SelectTrigger className="h-12 border-[#d8cbb8] bg-[#fffdf8]"><SelectValue placeholder="Preço" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os valores</SelectItem>
                <SelectItem value="free">Gratuitos</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="unknown">Não informado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {[
              ["Hoje", "today"],
              ["Amanhã", "tomorrow"],
              ["Este fim de semana", "weekend"],
              ["Próximos 7 dias", "week"],
              ["Próximos 30 dias", "month"],
              ["Todas as datas", "all"],
            ].map(([label, value]) => (
              <button key={value} onClick={() => setPeriod(value as "today" | "tomorrow" | "weekend" | "week" | "month" | "all")} className="rounded-full border border-[#d2b782] bg-[#fff8e8] px-3 py-1.5 font-semibold text-[#74452c] transition hover:bg-[#eed39d]">{label}</button>
            ))}
            <Input type="date" value={from} onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => setFrom(event.target.value)} aria-label="Data inicial" className="h-9 w-auto border-[#d8cbb8] bg-[#fffdf8]" />
            <span className="text-stone-600">até</span>
            <Input type="date" value={to} onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => setTo(event.target.value)} aria-label="Data final" className="h-9 w-auto border-[#d8cbb8] bg-[#fffdf8]" />
            <Button type="button" size="sm" onClick={applyPeriod} className="h-9 bg-[#a43a28] font-bold text-white hover:bg-[#843020]">Filtrar período</Button>
            {hasFilters ? <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-[#756b5d] hover:text-[#a43a28]"><X className="h-4 w-4" /> Limpar filtros</button> : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#687538]">Programação cultural</p>
            <h2 className="mt-2 font-serif text-4xl font-black">Eventos encontrados</h2>
          </div>
          <span className="rounded-full bg-[#f1dfbb] px-4 py-2 text-sm font-black text-[#75442b]">{filtered.length} resultado{filtered.length === 1 ? "" : "s"}</span>
        </div>

        {loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-[#eee6d9]" />)}</div> : null}

        {!loading && !filtered.length ? (
          <div className="rounded-[1.75rem] border border-dashed border-[#cfbea6] bg-white p-14 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-stone-600" />
            <h2 className="mt-4 text-xl font-bold">Nenhum evento encontrado</h2>
            <p className="mt-2 text-stone-400">Tente ampliar o período ou remover alguns filtros.</p>
            {hasFilters ? <Button onClick={clearFilters} className="mt-6 bg-[#a43a28] text-white hover:bg-[#843020]">Limpar filtros</Button> : null}
          </div>
        ) : null}

        {!loading && filtered.length && view === "list" ? (
          <div className="space-y-10">
            {grouped.map(([key, items]) => (
              <section key={key}>
                <div className="mb-3 flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-amber-500" />
                  <h2 className="font-extrabold capitalize">{new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</h2>
                  <div className="h-px flex-1 bg-[#e2d7c8]" />
                </div>
                <div className="space-y-2">{items.map((event) => <EventRow key={event.id} event={event} onSelect={setSelected} />)}</div>
              </section>
            ))}
          </div>
        ) : null}

        {!loading && filtered.length && view === "cards" ? (
          <div className="space-y-12">
            {grouped.map(([key, items]) => (
              <section key={key}>
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#e2d7c8]" />
                  <h2 className="flex items-center gap-2 text-lg font-extrabold capitalize"><CalendarDays className="h-5 w-5 text-amber-400" />{new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</h2>
                  <div className="h-px flex-1 bg-[#e2d7c8]" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{items.map((event) => <EventCard key={event.id} event={event} onSelect={setSelected} />)}</div>
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
              setIncludePast(true);
              setView("list");
            }}
          />
        ) : null}
      </section>

      <EventsMap events={filtered} />

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-[#ddcfbd] bg-[#fffdf8] text-[#292620] sm:max-w-2xl">
          <DialogHeader><DialogTitle className="pr-8 text-3xl leading-tight">{selected?.title}</DialogTitle></DialogHeader>
          {selected ? (
            <div className="space-y-6">
              {selected.image_url ? <img src={selected.image_url} alt="" className="aspect-video w-full rounded-2xl object-cover" /> : null}
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800">{selected.category || "Cultura"}</span>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">{priceLabel(selected)}</span>
              </div>
              <div className="grid gap-3 rounded-2xl border border-[#e1d5c5] bg-white p-4 sm:grid-cols-2">
                <p className="flex gap-2"><Clock className="h-5 w-5 text-amber-500" />{new Date(selected.event_date).toLocaleString("pt-BR")}</p>
                <p className="flex gap-2"><MapPin className="h-5 w-5 text-amber-500" />{selected.location || eventCity(selected)}</p>
              </div>
              <p className="whitespace-pre-wrap leading-7 text-[#5f574d]">{selected.full_description || selected.summary}</p>
              {selected.contact_phone || selected.contact_instagram ? (
                <div className="space-y-3 rounded-2xl border border-[#e1d5c5] bg-white p-4">
                  <p className="flex items-center gap-2 font-bold text-[#8f3525]"><Ticket className="h-5 w-5" /> Contato{selected.contact_name ? ` — ${selected.contact_name}` : ""}</p>
                  <div className="flex flex-wrap gap-3">
                    {selected.contact_phone ? <a href={`tel:${selected.contact_phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 rounded-full border border-[#d8cbb8] px-4 py-2 text-sm hover:border-amber-500"><Phone className="h-4 w-4" /> {selected.contact_phone}</a> : null}
                    {selected.contact_instagram ? <a href={instagramUrl(selected.contact_instagram)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full border border-[#d8cbb8] px-4 py-2 text-sm hover:border-[#a43a28]"><AtSign className="h-4 w-4" />@{instagramHandle(selected.contact_instagram)}</a> : null}
                  </div>
                </div>
              ) : null}
              {selected.source_url ? <Button asChild className="bg-amber-400 font-bold text-black hover:bg-amber-300"><a href={selected.source_url} target="_blank" rel="noreferrer">Ver fonte oficial <ArrowRight className="ml-2 h-4 w-4" /></a></Button> : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
